import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { createUniqueReferralCode } from '@/lib/referral'

// ── Gmail API email sender (HTTPS, not SMTP) ───────────────────────────────────

async function getGmailAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_API_CLIENT_ID!,
      client_secret: process.env.GMAIL_API_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_API_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Failed to refresh Gmail access token')
  return data.access_token
}

function buildMagicLinkHtml(url: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#0F1B3D;padding:28px 32px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
            <td style="background:#F5E642;border:2px solid #0D0D0D;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;font-weight:800;font-size:14px;color:#0D0D0D;">Q</td>
            <td style="padding-left:10px;font-weight:800;font-size:20px;color:#ffffff;letter-spacing:-0.5px;">Quizo<span style="color:#F5E642;">tic</span></td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F1B3D;">Sign in to Quizotic</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#475569;">Click the button below to securely sign in. No password needed.</p>
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <a href="${url}" style="display:inline-block;background:#F5E642;color:#0D0D0D;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;border:2px solid #0D0D0D;">
              Sign In →
            </a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#94A3B8;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;">
          <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">Quizotic — Live quizzes &amp; interactive presentations<br><a href="https://quizotic.live" style="color:#64748B;text-decoration:none;">quizotic.live</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendMagicLinkEmail(to: string, magicLinkUrl: string) {
  console.log('[auth] Sending magic link email to:', to)
  const accessToken = await getGmailAccessToken()
  console.log('[auth] Got Gmail access token, sending email...')
  const from = process.env.EMAIL_FROM || 'Quizotic <info@quizotic.live>'
  const subject = 'Sign in to Quizotic'
  const htmlBody = buildMagicLinkHtml(magicLinkUrl)

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].join('\r\n')

  const raw = Buffer.from(mime).toString('base64url')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    console.error('[auth] Gmail API send failed:', res.status, err)
    throw new Error(`Email send failed: ${res.status}`)
  }
}

// ── NextAuth config ─────────────────────────────────────────────────────────────

const emailFrom = process.env.EMAIL_FROM || 'Quizotic <info@quizotic.live>'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify',
    error: '/auth/error',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.GMAIL_API_REFRESH_TOKEN
      ? [Nodemailer({
          server: { host: 'localhost', port: 25, auth: { user: 'x', pass: 'x' } },
          from: emailFrom,
          sendVerificationRequest: async ({ identifier, url }) => {
            console.log('[auth] sendVerificationRequest called for:', identifier)
            try {
              await sendMagicLinkEmail(identifier, url)
              console.log('[auth] Magic link email sent successfully')
            } catch (err) {
              console.error('[auth] sendVerificationRequest failed:', err)
              throw err
            }
          },
        })]
      : (console.log('[auth] No GMAIL_API_REFRESH_TOKEN — email provider disabled'), [])),
  ],
  events: {
    async createUser({ user }) {
      if (user.id && user.name) {
        const code = await createUniqueReferralCode(user.name)
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: code },
        })
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { onboarded: true },
        })
        token.onboarded = dbUser?.onboarded ?? false
      }
      // Allow client-side update({ onboarded: true }) to refresh the JWT
      if (trigger === 'update' && session?.onboarded !== undefined) {
        token.onboarded = session.onboarded
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string
        session.user.onboarded = (token.onboarded as boolean) ?? false
      }
      return session
    },
  },
})
