// Thin Resend wrapper. First-ever email integration in this codebase.
// Caller passes html + text + subject; we add the from address and tags
// (for downstream filtering in the Resend dashboard). Returns the message
// id on success or an error string — never throws, so admin actions can
// continue even if email delivery fails.
//
// Future Session 3 will add an EmailLog table that captures every send
// here for support replay; for now we just console.log.

const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL ?? 'Quizotic <hello@quizotic.live>'

export interface SendEmailArgs {
  to: string | string[]
  subject: string
  html: string
  text: string
  tags?: { name: string; value: string }[]
  replyTo?: string
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured; email skipped', { subject: args.subject, to: args.to })
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  let resendModule
  try {
    resendModule = await import('resend')
  } catch (err) {
    console.warn('[email] resend module load failed:', err instanceof Error ? err.message : err)
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
      return { ok: false, error: result.error.message }
    }
    const id = result.data?.id ?? 'unknown'
    console.log(`[email] sent: id=${id} subject=${JSON.stringify(args.subject)} to=${Array.isArray(args.to) ? args.to.join(',') : args.to}`)
    return { ok: true, id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[email] send threw:', msg, { subject: args.subject, to: args.to })
    return { ok: false, error: msg }
  }
}
