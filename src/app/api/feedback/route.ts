// Receives feedback submissions from the FeedbackModal (opened via the account
// menu, footer link, or post-session prompt) and emails the operator. Designed
// to be small and self-contained: validation via
// Zod, send via the existing Resend wrapper, log to console as a backstop.
//
// Why no Feedback DB model: emailing is enough for the volume we expect,
// and adding a model would mean another migration. EmailLog (already in
// schema) gives us a paper trail of every send via the existing wrapper.
//
// Rate limiting is intentionally minimal — Resend's own per-domain limit
// caps abuse, and Cloudflare in front of Railway absorbs floods. If we
// see real abuse later, add an in-memory IP rate limiter here.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 'feature' is submitted by the dashboard's Request a feature button, 'bug'
// and 'general' by the standard feedback modal. Unknown/absent values fall
// back to 'general' rather than 400-ing — a feedback endpoint should never
// reject a real message over a metadata field.
const FEEDBACK_TYPES = ['general', 'feature', 'bug'] as const

const FeedbackSchema = z.object({
  message: z.string().min(3).max(2000),
  type: z.enum(FEEDBACK_TYPES).optional().default('general'),
  email: z.string().email().max(200).nullable().optional().or(z.literal('')),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
})

const FEEDBACK_TO = process.env.FEEDBACK_TO_EMAIL || 'info@quizotic.live'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => i.message).join('; ') },
      { status: 400 },
    )
  }
  const { message, email, url, userAgent, type } = parsed.data

  // Best-effort: attach the signed-in user's email if available, even if
  // the form's optional email field was empty. Helpful for triage.
  const session = await auth().catch(() => null)
  const sessionEmail = session?.user?.email ?? null

  const submitter = (email && email.length > 0 ? email : sessionEmail) || 'anonymous'
  const replyTo = email && email.length > 0 ? email : (sessionEmail ?? undefined)

  // Persist for the admin triage panel — best-effort so a DB hiccup never
  // blocks the email path (which remains the primary notification).
  try {
    await prisma.feedback.create({
      data: {
        message,
        email: submitter === 'anonymous' ? null : submitter,
        url: url || null,
        userAgent: userAgent || null,
        type,
      },
    })
  } catch (err) {
    console.warn('[feedback] db persist failed:', err instanceof Error ? err.message : err)
  }

  const safeMsg = escapeHtml(message).replace(/\n/g, '<br>')
  const safeUrl = url ? escapeHtml(url) : '(not provided)'
  const safeUa = userAgent ? escapeHtml(userAgent) : '(not provided)'
  const safeSubmitter = escapeHtml(submitter)

  // Feature requests get their own heading and subject prefix so they're
  // filterable in the inbox without opening each mail.
  const isFeature = type === 'feature'
  const heading = isFeature ? 'Quizotic feature request' : 'Quizotic feedback'

  const html = `
    <h2 style="font-family:sans-serif;color:#0F1B3D;">${heading}</h2>
    <p style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1F2937;white-space:pre-wrap;">${safeMsg}</p>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:18px 0;">
    <table style="font-family:sans-serif;font-size:13px;color:#4B5563;">
      <tr><td style="padding-right:12px;"><b>From:</b></td><td>${safeSubmitter}</td></tr>
      <tr><td style="padding-right:12px;"><b>Page:</b></td><td>${safeUrl}</td></tr>
      <tr><td style="padding-right:12px;"><b>UA:</b></td><td>${safeUa}</td></tr>
    </table>
  `
  const text = `${heading}\n\n${message}\n\n---\nFrom: ${submitter}\nPage: ${url || '(not provided)'}\nUA:   ${userAgent || '(not provided)'}\n`

  const subject = `[Quizotic ${isFeature ? 'feature request' : 'feedback'}] ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`

  // Best-effort send. If Resend isn't configured (no RESEND_API_KEY) the
  // wrapper logs and returns ok:false; we still 200 to the client because
  // the user shouldn't see a failure for our deployment gap, AND we
  // log the full feedback to stdout so it lands in Railway logs as a backstop.
  console.log(`[feedback] type=${type} from=${submitter} url=${url ?? 'n/a'} message=${JSON.stringify(message.slice(0, 200))}`)

  const result = await sendEmail({
    to: FEEDBACK_TO,
    subject,
    html,
    text,
    replyTo,
    category: 'feedback',
    userId: session?.user?.id ?? null,
    metadata: { url, userAgent, submitter, type },
  })

  if (!result.ok) {
    console.warn('[feedback] email failed:', result.error)
    // Still 200 — message captured in stdout, user shouldn't see a 5xx.
  }

  return NextResponse.json({ ok: true })
}
