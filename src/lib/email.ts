// Two-channel email transport.
//
//   'transactional' (default) — magic links, receipts, session invites,
//       credit grants. Sent via the Gmail API OAuth2 refresh-token flow
//       from the Google Workspace mailbox (info@quizotic.live). Never
//       suppressed: someone who unsubscribed from nudges must still be
//       able to log in.
//
//   'lifecycle' — onboarding nudges, digests, testimonial asks. Sent via
//       Resend from the mail.quizotic.live subdomain, which carries its
//       own SPF/DKIM and therefore its own sender reputation. A spam
//       complaint on a nudge can never degrade magic-link deliverability.
//       Requires an unsubscribe URL at the type level and honours the
//       EmailSuppression table.
//
// Callers pass html + text + subject; we add the from address and send.
// Returns the provider message id on success or an error string — never
// throws, so callers can continue even if delivery fails.
//
// Every send (success, failure or suppression) writes one EmailLog row so
// support can answer "did the user actually get this?" without trawling
// the Gmail Sent folder or the Resend dashboard.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const FROM_TRANSACTIONAL = process.env.EMAIL_FROM ?? 'Quizotic <info@quizotic.live>'
const FROM_LIFECYCLE = process.env.EMAIL_FROM_LIFECYCLE ?? 'Quizotic <hello@mail.quizotic.live>'
// Nudges are written to be replied to, so replies land in the human inbox.
const LIFECYCLE_REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'info@quizotic.live'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type EmailChannel = 'transactional' | 'lifecycle'

interface SendEmailBase {
  to: string | string[]
  subject: string
  html: string
  text: string
  tags?: { name: string; value: string }[]
  replyTo?: string
  // For EmailLog persistence:
  category?: string             // e.g. 'credit_grant', 'welcome', 'magic_link'
  userId?: string | null        // FK to User if applicable
  metadata?: Record<string, unknown> | null
}

// The discriminated union is the guardrail, not a convention: TypeScript
// will not compile a lifecycle send that has no unsubscribe URL.
export type SendEmailArgs =
  | (SendEmailBase & { channel?: 'transactional'; unsubscribeUrl?: never })
  | (SendEmailBase & { channel: 'lifecycle'; unsubscribeUrl: string })

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

interface SendContext {
  args: SendEmailBase & { unsubscribeUrl?: string }
  toEmail: string
  toHeader: string
  category: string
  metadata: Record<string, unknown>
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const toEmail = Array.isArray(args.to) ? args.to[0] : args.to
  const toHeader = Array.isArray(args.to) ? args.to.join(', ') : args.to
  const channel: EmailChannel = args.channel ?? 'transactional'
  const category = args.category ?? (channel === 'lifecycle' ? 'lifecycle' : 'transactional')
  const metadata: Record<string, unknown> = { ...(args.metadata ?? {}), channel }
  const ctx: SendContext = { args, toEmail, toHeader, category, metadata }

  if (channel === 'lifecycle') {
    // Suppression is enforced here rather than at each call site so a new
    // campaign cannot forget it.
    const suppressedReason = await suppressionReason(toEmail)
    if (suppressedReason) {
      console.log(`[email] lifecycle send suppressed for ${toEmail} (${suppressedReason})`)
      await logEmailRow({
        ...args,
        metadata,
        toEmail,
        category,
        status: 'suppressed',
        errorMessage: `suppressed: ${suppressedReason}`,
      })
      return { ok: false, error: `suppressed: ${suppressedReason}` }
    }
    return sendViaResend(ctx)
  }

  return sendViaGmail(ctx)
}

async function sendViaGmail(ctx: SendContext): Promise<SendEmailResult> {
  const { toEmail, toHeader, category } = ctx
  // Re-attach the channel-augmented metadata so every `...args` spread
  // below carries it into EmailLog.
  const args = { ...ctx.args, metadata: ctx.metadata }

  const clientId = process.env.GMAIL_API_CLIENT_ID
  const clientSecret = process.env.GMAIL_API_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_API_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[email] GMAIL_API creds not configured; email skipped', { subject: args.subject, to: args.to })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: 'GMAIL_API creds not configured' })
    return { ok: false, error: 'GMAIL_API creds not configured' }
  }

  let accessToken: string
  try {
    accessToken = await getGmailAccessToken({ clientId, clientSecret, refreshToken })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[email] failed to refresh Gmail token:', msg)
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: `token refresh failed: ${msg}` })
    return { ok: false, error: `token refresh failed: ${msg}` }
  }

  const raw = buildRawMime({
    from: FROM_TRANSACTIONAL,
    to: toHeader,
    replyTo: args.replyTo,
    subject: args.subject,
    html: args.html,
    text: args.text,
  })

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.warn('[email] Gmail API send failed:', res.status, errText, { subject: args.subject, to: args.to })
      await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: `Gmail ${res.status}: ${errText.slice(0, 200)}` })
      return { ok: false, error: `Gmail API ${res.status}` }
    }

    const data = await res.json().catch(() => ({})) as { id?: string }
    const id = data.id ?? 'unknown'
    console.log(`[email] sent: id=${id} subject=${JSON.stringify(args.subject)} to=${toHeader}`)
    await logEmailRow({ ...args, toEmail, category, status: 'sent', providerId: id })
    return { ok: true, id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[email] send threw:', msg, { subject: args.subject, to: args.to })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: msg })
    return { ok: false, error: msg }
  }
}

async function sendViaResend(ctx: SendContext): Promise<SendEmailResult> {
  const { toEmail, category } = ctx
  const args = { ...ctx.args, metadata: ctx.metadata }
  const to = Array.isArray(args.to) ? args.to : [args.to]

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured; lifecycle email skipped', { subject: args.subject, to: args.to })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: 'RESEND_API_KEY not configured' })
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  // The union type already prevents this at compile time; the runtime check
  // exists because a missing header would silently degrade deliverability
  // rather than fail loudly, and JS callers bypass the type system.
  if (!args.unsubscribeUrl) {
    console.warn('[email] lifecycle send refused: no unsubscribeUrl', { subject: args.subject })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: 'missing unsubscribeUrl' })
    return { ok: false, error: 'missing unsubscribeUrl' }
  }

  // One-click unsubscribe. Google and Yahoo both expect these on bulk mail,
  // and their absence is a common cause of nudges landing in spam.
  const headers: Record<string, string> = {
    'List-Unsubscribe': `<${args.unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_LIFECYCLE,
        to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo ?? LIFECYCLE_REPLY_TO,
        headers,
        ...(args.tags?.length ? { tags: sanitizeTags(args.tags) } : {}),
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.warn('[email] Resend send failed:', res.status, errText, { subject: args.subject, to: args.to })
      await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: `Resend ${res.status}: ${errText.slice(0, 200)}` })
      return { ok: false, error: `Resend ${res.status}` }
    }

    const data = await res.json().catch(() => ({})) as { id?: string }
    const id = data.id ?? 'unknown'
    console.log(`[email] sent via Resend: id=${id} subject=${JSON.stringify(args.subject)} to=${toEmail}`)
    await logEmailRow({ ...args, toEmail, category, status: 'sent', providerId: id })
    return { ok: true, id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[email] Resend send threw:', msg, { subject: args.subject, to: args.to })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: msg })
    return { ok: false, error: msg }
  }
}

// Resend rejects tag names/values containing anything outside
// [A-Za-z0-9_-], which would fail the whole send with a 422.
function sanitizeTags(tags: { name: string; value: string }[]): { name: string; value: string }[] {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256)
  return tags.map(t => ({ name: clean(t.name), value: clean(t.value) }))
}

// Returns the suppression reason, or null when the address is clear.
// Never throws: a database blip must not silently become "not suppressed",
// so we fail closed and report the address as suppressed.
async function suppressionReason(email: string): Promise<string | null> {
  try {
    const row = await prisma.emailSuppression.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { reason: true },
    })
    return row ? (row.reason || 'suppressed') : null
  } catch (err) {
    console.warn('[email] suppression lookup failed, failing closed:', err instanceof Error ? err.message : err)
    return 'suppression-lookup-failed'
  }
}

async function getGmailAccessToken(creds: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(data.error_description || 'no access_token in response')
  }
  return data.access_token
}

function buildRawMime(args: {
  from: string
  to: string
  replyTo?: string
  subject: string
  html: string
  text: string
}): string {
  // RFC 2047 encoded-word for non-ASCII subjects (em-dashes, smart quotes).
  const encodedSubject = `=?UTF-8?B?${Buffer.from(args.subject, 'utf8').toString('base64')}?=`
  const boundary = `b_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`

  const headers = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    ...(args.replyTo ? [`Reply-To: ${args.replyTo}`] : []),
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  const body = [
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.html,
    `--${boundary}--`,
  ]

  const mime = [...headers, ...body].join('\r\n')
  return Buffer.from(mime).toString('base64url')
}

async function logEmailRow(args: {
  toEmail: string
  subject: string
  category: string
  userId?: string | null
  status: string
  providerId?: string
  errorMessage?: string
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        userId: args.userId ?? null,
        toEmail: args.toEmail,
        subject: args.subject.slice(0, 500),
        category: args.category,
        providerId: args.providerId ?? null,
        status: args.status,
        errorMessage: args.errorMessage ?? null,
        metadata: args.metadata
          ? (args.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    })
  } catch (err) {
    // Never block on audit-log failure.
    console.warn('[email] EmailLog write failed:', err instanceof Error ? err.message : err)
  }
}
