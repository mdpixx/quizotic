// Pure-function builder for the credit-grant notification email. No I/O —
// returns subject + html + text strings the caller passes to sendEmail.
// Tested directly with fixed inputs in src/__tests__/credit-grant.test.ts.

export interface CreditGrantEmailArgs {
  firstName: string | null
  amount: number
  bucket: 'questions' | 'enhancements'
  reason: string
  expiresAt: Date | null
}

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

const BRAND_NAVY = '#0F1B3D'
const BRAND_YELLOW = '#FBD13B'
const BRAND_CREAM = '#FAF7F2'

export function buildCreditGrantEmail(args: CreditGrantEmailArgs): BuiltEmail {
  const safeFirstName = (args.firstName ?? '').trim().split(/\s+/)[0] || 'there'
  const cleanedReason = capitaliseFirst(args.reason.trim()).replace(/[.!?]?$/, '.')
  const bucketLabel = args.bucket === 'questions' ? 'AI question' : 'AI enhancement'
  const amountLabel = `${args.amount} ${bucketLabel}${Math.abs(args.amount) === 1 ? '' : 's'}`
  const expiryClause = args.expiresAt
    ? ` (valid until ${formatDate(args.expiresAt)})`
    : ''

  const subject = args.amount > 0
    ? `We've added ${amountLabel} to your Quizotic account`
    : `We've adjusted your Quizotic ${bucketLabel} credits`

  const text = [
    `Hi ${safeFirstName},`,
    '',
    `${cleanedReason} That shouldn't have happened, and we don't want it to cost you any of your credits.`,
    '',
    `We've ${args.amount >= 0 ? 'added' : 'adjusted'} ${amountLabel} to your account${expiryClause}. They're available right away — you'll see them when you create your next quiz.`,
    '',
    `If you have any other questions or run into anything else, just reply to this email.`,
    '',
    `Thanks for using Quizotic,`,
    `Mahesh`,
    `Quizotic`,
  ].join('\n')

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${BRAND_CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_NAVY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <div style="display:inline-block;background:${BRAND_YELLOW};color:#0D0D0D;font-weight:900;font-size:14px;padding:6px 12px;border-radius:8px;letter-spacing:0.5px;">QUIZOTIC</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0 32px;">
              <p style="margin:16px 0 0 0;font-size:16px;line-height:1.55;color:${BRAND_NAVY};">Hi ${escapeHtml(safeFirstName)},</p>
              <p style="margin:16px 0 0 0;font-size:16px;line-height:1.55;color:${BRAND_NAVY};">${escapeHtml(cleanedReason)} That shouldn't have happened, and we don't want it to cost you any of your credits.</p>
              <p style="margin:16px 0 0 0;font-size:16px;line-height:1.55;color:${BRAND_NAVY};">We've ${args.amount >= 0 ? 'added' : 'adjusted'} <strong>${escapeHtml(amountLabel)}</strong> to your account${escapeHtml(expiryClause)}. They're available right away — you'll see them when you create your next quiz.</p>
              <p style="margin:24px 0 0 0;font-size:16px;line-height:1.55;color:${BRAND_NAVY};">If you have any other questions or run into anything else, just reply to this email.</p>
              <p style="margin:32px 0 8px 0;font-size:16px;line-height:1.55;color:${BRAND_NAVY};">Thanks for using Quizotic,<br/><strong>Mahesh</strong><br/><span style="color:#64748B;">Quizotic</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid #E2E8F0;margin-top:24px;">
              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#94A3B8;">You're receiving this because you have a Quizotic account. <a href="https://quizotic.live/host" style="color:#64748B;text-decoration:underline;">Open Quizotic</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`

  return { subject, html, text }
}

function capitaliseFirst(s: string): string {
  if (!s) return ''
  return s[0].toUpperCase() + s.slice(1)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
