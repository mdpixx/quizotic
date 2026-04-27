// Thin Resend wrapper. First-ever email integration in this codebase.
// Caller passes html + text + subject; we add the from address and tags
// (for downstream filtering in the Resend dashboard). Returns the message
// id on success or an error string — never throws, so admin actions can
// continue even if email delivery fails.
//
// Session 3 added EmailLog persistence — every send (success or failure)
// writes one row so support can answer "did the user actually get this?"
// without trawling Resend's dashboard.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL ?? 'Quizotic <hello@quizotic.live>'

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
  const category = args.category ?? 'transactional'

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured; email skipped', { subject: args.subject, to: args.to })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: 'RESEND_API_KEY not configured' })
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  let resendModule
  try {
    resendModule = await import('resend')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[email] resend module load failed:', msg)
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: 'resend module not loadable' })
    return { ok: false, error: 'resend module not loadable' }
  }

  const { Resend } = resendModule
  const client = new Resend(apiKey)

  try {
    const result = await client.emails.send({
      from: FROM_DEFAULT,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      tags: args.tags,
    })
    if (result.error) {
      console.warn('[email] resend returned error:', result.error.message, { subject: args.subject, to: args.to })
      await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: result.error.message })
      return { ok: false, error: result.error.message }
    }
    const id = result.data?.id ?? 'unknown'
    console.log(`[email] sent: id=${id} subject=${JSON.stringify(args.subject)} to=${Array.isArray(args.to) ? args.to.join(',') : args.to}`)
    await logEmailRow({ ...args, toEmail, category, status: 'sent', providerId: id })
    return { ok: true, id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[email] send threw:', msg, { subject: args.subject, to: args.to })
    await logEmailRow({ ...args, toEmail, category, status: 'failed', errorMessage: msg })
    return { ok: false, error: msg }
  }
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
