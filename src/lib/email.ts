// Thin Gmail API wrapper. Sends via the same OAuth2 refresh-token flow
// that auth.ts uses for magic-link/welcome emails — no SMTP, no Resend.
// Caller passes html + text + subject; we add the from address and send
// from info@quizotic.live (the Google Workspace mailbox). Returns the
// message id on success or an error string — never throws, so admin
// actions can continue even if email delivery fails.
//
// Every send (success or failure) writes one EmailLog row so support
// can answer "did the user actually get this?" without trawling the
// Gmail Sent folder.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const FROM_DEFAULT = process.env.EMAIL_FROM ?? 'Quizotic <info@quizotic.live>'

export interface SendEmailArgs {
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

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const toEmail = Array.isArray(args.to) ? args.to[0] : args.to
  const toHeader = Array.isArray(args.to) ? args.to.join(', ') : args.to
  const category = args.category ?? 'transactional'

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
    from: FROM_DEFAULT,
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
