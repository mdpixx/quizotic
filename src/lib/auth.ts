import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
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
          <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">Quizotic — Live quizzes &amp; interactive presentations<br><a href="https://www.quizotic.live" style="color:#64748B;text-decoration:none;">quizotic.live</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildWelcomeHtml(name: string | null): string {
  const firstName = (name?.trim().split(/\s+/)[0]) || 'there'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:40px 20px;">
  <tr><td align="center">
    <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,27,61,0.10);max-width:680px;width:100%;">
      <tr><td style="background:#0F1B3D;padding:36px 32px 28px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
          <td style="background:#F5E642;border:2px solid #0D0D0D;border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle;font-weight:900;font-size:17px;color:#0D0D0D;">Q</td>
          <td style="padding-left:12px;font-weight:900;font-size:24px;color:#ffffff;letter-spacing:-0.8px;">Quizo<span style="color:#F5E642;">tic</span></td>
        </tr></table>
        <p style="margin:12px 0 0;font-size:12px;color:#CBD5E1;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">The learning engagement platform</p>
      </td></tr>
      <tr><td style="background:#F5E642;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:44px 36px 12px;">
        <div style="display:inline-block;background:#FEF9C3;color:#854D0E;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:5px 11px;border-radius:20px;margin-bottom:18px;">✨ You're in</div>
        <h1 style="margin:0 0 16px;font-size:30px;font-weight:900;color:#0F1B3D;letter-spacing:-0.8px;line-height:1.2;">Welcome aboard, ${firstName}.</h1>
        <p style="margin:0;font-size:16px;line-height:1.65;color:#475569;">You just joined thousands of educators, trainers, and facilitators who are turning passive audiences into active learners.</p>
        <p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:#475569;">Quizotic isn't just another quiz tool — it's a <strong style="color:#0F1B3D;">learning engagement platform</strong> engineered around how the brain actually learns, retains, and recalls.</p>
      </td></tr>
      <tr><td style="padding:28px 36px 0;text-align:center;"><span style="color:#0F1B3D;font-size:20px;letter-spacing:8px;">• • •</span></td></tr>
      <tr><td style="padding:20px 36px 8px;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:800;color:#0F1B3D;letter-spacing:1.8px;text-transform:uppercase;text-align:center;">— Here's what you can do —</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="33%" style="padding:6px;" valign="top"><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid #F5E642;border-radius:12px;padding:18px 12px;text-align:center;height:130px;box-sizing:border-box;"><div style="font-size:28px;line-height:1;margin-bottom:8px;">🎯</div><div style="font-size:13px;font-weight:800;color:#0F1B3D;">Live Quizzes</div><div style="font-size:11px;color:#64748B;margin-top:5px;line-height:1.5;">Check understanding in real time</div></div></td>
          <td width="33%" style="padding:6px;" valign="top"><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid #F5E642;border-radius:12px;padding:18px 12px;text-align:center;height:130px;box-sizing:border-box;"><div style="font-size:28px;line-height:1;margin-bottom:8px;">📚</div><div style="font-size:13px;font-weight:800;color:#0F1B3D;">Interactive Lessons</div><div style="font-size:11px;color:#64748B;margin-top:5px;line-height:1.5;">19+ slide types that teach</div></div></td>
          <td width="33%" style="padding:6px;" valign="top"><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid #F5E642;border-radius:12px;padding:18px 12px;text-align:center;height:130px;box-sizing:border-box;"><div style="font-size:28px;line-height:1;margin-bottom:8px;">🧠</div><div style="font-size:13px;font-weight:800;color:#0F1B3D;">AI Question Bank</div><div style="font-size:11px;color:#64748B;margin-top:5px;line-height:1.5;">Generate &amp; align to Bloom's</div></div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 36px 8px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#94A3B8;letter-spacing:1.8px;text-transform:uppercase;">The Quizotic difference</p>
        <h2 style="margin:0 0 18px;font-size:19px;font-weight:800;color:#0F1B3D;letter-spacing:-0.4px;line-height:1.4;white-space:nowrap;">Engagement is easy. We're built for <span style="background:#F5E642;padding:2px 10px;border-radius:5px;color:#0D0D0D;">retention.</span></h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="44" style="padding-right:14px;"><div style="background:#0F1B3D;color:#F5E642;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-size:16px;font-weight:800;">01</div></td><td valign="top"><div style="font-size:14px;font-weight:800;color:#0F1B3D;">Bloom's Taxonomy, built in</div><div style="font-size:13px;color:#475569;line-height:1.55;margin-top:3px;">Tag each question from Remember to Create. Know exactly which cognitive level your learners are at.</div></td></tr></table></td></tr>
          <tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="44" style="padding-right:14px;"><div style="background:#0F1B3D;color:#F5E642;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-size:16px;font-weight:800;">02</div></td><td valign="top"><div style="font-size:14px;font-weight:800;color:#0F1B3D;">Confidence Grid</div><div style="font-size:13px;color:#475569;line-height:1.55;margin-top:3px;">Learners mark how sure they are. You instantly spot who knows, who guessed, and who's quietly lost.</div></td></tr></table></td></tr>
          <tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="44" style="padding-right:14px;"><div style="background:#0F1B3D;color:#F5E642;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-size:16px;font-weight:800;">03</div></td><td valign="top"><div style="font-size:14px;font-weight:800;color:#0F1B3D;">Spaced Retrieval</div><div style="font-size:13px;color:#475569;line-height:1.55;margin-top:3px;">Questions resurface at scientifically-timed intervals — the single most proven way to move learning into long-term memory.</div></td></tr></table></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 36px 8px;">
        <div style="background:#FEFCE8;border:1.5px solid #FDE68A;border-radius:14px;padding:22px 24px;">
          <div style="font-size:11px;font-weight:800;color:#854D0E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">🎁 Your free plan — no card needed</div>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td width="50%" style="padding:4px 0;font-size:13px;color:#422006;"><span style="color:#0F1B3D;font-weight:900;">✓</span> &nbsp;50 participants per session</td><td width="50%" style="padding:4px 0;font-size:13px;color:#422006;"><span style="color:#0F1B3D;font-weight:900;">✓</span> &nbsp;30 AI questions / month</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#422006;"><span style="color:#0F1B3D;font-weight:900;">✓</span> &nbsp;5 quizzes + 3 lessons</td><td style="padding:4px 0;font-size:13px;color:#422006;"><span style="color:#0F1B3D;font-weight:900;">✓</span> &nbsp;Free forever</td></tr>
          </table>
        </div>
      </td></tr>
      <tr><td style="padding:32px 36px 12px;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
        <a href="https://www.quizotic.live/host" style="display:inline-block;background:#F5E642;color:#0D0D0D;text-decoration:none;padding:17px 44px;border-radius:12px;font-size:16px;font-weight:900;border:2px solid #0D0D0D;letter-spacing:0.2px;">Create your first lesson →</a>
      </td></tr></table>
      <p style="margin:18px 0 0;font-size:12px;color:#94A3B8;text-align:center;">⏱ Takes under 2 minutes · AI can draft the questions for you</p>
      </td></tr>
      <tr><td style="padding:24px 36px 8px;">
        <div style="background:#F8FAFC;border-left:3px solid #F5E642;border-radius:0 10px 10px 0;padding:14px 18px;">
          <div style="font-size:11px;font-weight:800;color:#94A3B8;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">💡 First-day tip</div>
          <div style="font-size:13px;color:#475569;line-height:1.55;">Start with a topic you're teaching this week. Paste your notes, let AI draft 5 questions, and you'll have a live session ready in minutes.</div>
        </div>
      </td></tr>
      <tr><td style="padding:28px 36px 36px;">
        <div style="border-top:1px solid #E2E8F0;padding-top:22px;">
          <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">We're here for the long game with you. Reply anytime with questions, ideas, or feedback — real humans read every message.</p>
          <p style="margin:14px 0 0;font-size:14px;color:#0F1B3D;font-weight:800;">Happy teaching,</p>
          <p style="margin:2px 0 0;font-size:14px;color:#0F1B3D;font-weight:800;">— Team Quizotic</p>
        </div>
      </td></tr>
      <tr><td style="background:#0F1B3D;padding:22px 36px;">
        <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;line-height:1.6;">
          <a href="https://www.quizotic.live" style="color:#F5E642;text-decoration:none;font-weight:700;">quizotic.live</a>
          &nbsp;·&nbsp; <a href="https://www.quizotic.live/host" style="color:#CBD5E1;text-decoration:none;">Dashboard</a>
          &nbsp;·&nbsp; <a href="https://www.quizotic.live/pricing" style="color:#CBD5E1;text-decoration:none;">Pricing</a>
        </p>
        <p style="margin:10px 0 0;font-size:11px;color:#64748B;text-align:center;">You're receiving this because you signed up at quizotic.live</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

async function sendWelcomeEmail(to: string, name: string | null) {
  console.log('[auth] Sending welcome email to:', to)
  const accessToken = await getGmailAccessToken()
  const from = process.env.EMAIL_FROM || 'Quizotic <info@quizotic.live>'
  const firstName = (name?.trim().split(/\s+/)[0]) || null
  const subject = firstName
    ? `${firstName}, welcome to Quizotic — let's build your first lesson`
    : `Welcome to Quizotic — let's build your first lesson`
  const htmlBody = buildWelcomeHtml(name)

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
    console.error('[auth] Welcome email send failed:', res.status, err)
    throw new Error(`Welcome email failed: ${res.status}`)
  }
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

// One-shot startup diagnostic — logs at boot so Railway logs show env presence.
console.log('[auth] boot diagnostics:', JSON.stringify({
  hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasAuthSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  hasNextauthUrl: !!process.env.NEXTAUTH_URL,
  hasAuthUrl: !!process.env.AUTH_URL,
  hasAuthTrustHost: !!process.env.AUTH_TRUST_HOST,
  hasGmailRefresh: !!process.env.GMAIL_API_REFRESH_TOKEN,
  nodeEnv: process.env.NODE_ENV,
}))

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  debug: true,
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
      allowDangerousEmailAccountLinking: true,
    }),
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID
      ? [MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? 'https://login.microsoftonline.com/common/v2.0',
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
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
      if (user.email) {
        sendWelcomeEmail(user.email, user.name ?? null)
          .catch(err => console.error('[auth] welcome email failed:', err))
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
