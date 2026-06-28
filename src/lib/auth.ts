import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Nodemailer from 'next-auth/providers/nodemailer'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { headers as nextHeaders } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createUniqueReferralCode } from '@/lib/referral'
import { extractGeo } from '@/lib/geo'

// Apply a PendingProGrant (an admin-issued Pro grant for an email that had no
// account at grant time). Upserts a Pro subscription — same shape as
// /api/admin/grant-pro — then marks the grant applied so it fires once.
async function applyPendingProGrant(userId: string, email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase()
  const pending = await prisma.pendingProGrant.findUnique({ where: { email: normalizedEmail } })
  if (!pending || pending.appliedAt) return

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setMonth(expiresAt.getMonth() + pending.months)

  const subData = {
    plan: 'pro_monthly',
    status: 'active',
    provider: 'manual',
    currentPeriodStart: now,
    currentPeriodEnd: expiresAt,
  }
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...subData },
    update: subData,
  })
  await prisma.pendingProGrant.update({
    where: { email: normalizedEmail },
    data: { appliedAt: now },
  })
  console.log(`[auth] applied pending pro grant: ${normalizedEmail} (${pending.months}mo)`)
}

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

// 6-digit numeric code. Used as the verification token directly — NextAuth
// stores it in `VerificationToken.token`, then verifies on submit with no
// schema change. Switched away from clickable magic links because corporate
// firewalls (IOCL, school networks) block or rewrite the link, expiring it
// before the user can click.
function generateOtpCode(): string {
  // crypto.randomInt is unbiased for the [100000, 999999] range; Math.random
  // would skew distribution and make the lower digits ever-so-slightly
  // predictable. Worth the import for an auth primitive.
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

function buildOtpHtml(code: string): string {
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
            <td style="font-weight:800;font-size:28px;color:#ffffff;letter-spacing:-0.5px;">Quizotic</td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px 40px;text-align:center;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F1B3D;">Your sign-in code</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">Enter this code on Quizotic to sign in. No password needed.</p>
          <div style="display:inline-block;background:#FEFCE8;border:2px solid #FBD13B;border-radius:14px;padding:18px 32px;margin-bottom:6px;">
            <span style="font-family:'SF Mono','Monaco','Inconsolata','Roboto Mono',monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#0F1B3D;">${code}</span>
          </div>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#94A3B8;">This code expires in 15 minutes. If you didn't request it, you can safely ignore this email.</p>
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
          <td style="font-weight:900;font-size:32px;color:#ffffff;letter-spacing:-0.8px;">Quizotic</td>
        </tr></table>
        <p style="margin:12px 0 0;font-size:12px;color:#CBD5E1;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">The learning engagement platform</p>
      </td></tr>
      <tr><td style="background:#FBD13B;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
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
          <td width="33%" style="padding:6px;" valign="top"><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid #FBD13B;border-radius:12px;padding:18px 12px;text-align:center;height:130px;box-sizing:border-box;"><div style="font-size:28px;line-height:1;margin-bottom:8px;">🎯</div><div style="font-size:13px;font-weight:800;color:#0F1B3D;">Live Quizzes</div><div style="font-size:11px;color:#64748B;margin-top:5px;line-height:1.5;">Check understanding in real time</div></div></td>
          <td width="33%" style="padding:6px;" valign="top"><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid #FBD13B;border-radius:12px;padding:18px 12px;text-align:center;height:130px;box-sizing:border-box;"><div style="font-size:28px;line-height:1;margin-bottom:8px;">📚</div><div style="font-size:13px;font-weight:800;color:#0F1B3D;">Interactive Lessons</div><div style="font-size:11px;color:#64748B;margin-top:5px;line-height:1.5;">19+ slide types that teach</div></div></td>
          <td width="33%" style="padding:6px;" valign="top"><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:3px solid #FBD13B;border-radius:12px;padding:18px 12px;text-align:center;height:130px;box-sizing:border-box;"><div style="font-size:28px;line-height:1;margin-bottom:8px;">🧠</div><div style="font-size:13px;font-weight:800;color:#0F1B3D;">AI Question Bank</div><div style="font-size:11px;color:#64748B;margin-top:5px;line-height:1.5;">Generate &amp; align to Bloom's</div></div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 36px 8px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#94A3B8;letter-spacing:1.8px;text-transform:uppercase;">The Quizotic difference</p>
        <h2 style="margin:0 0 18px;font-size:19px;font-weight:800;color:#0F1B3D;letter-spacing:-0.4px;line-height:1.4;white-space:nowrap;">Engagement is easy. We're built for <span style="background:#FBD13B;padding:2px 10px;border-radius:5px;color:#0D0D0D;">retention.</span></h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="44" style="padding-right:14px;"><div style="background:#0F1B3D;color:#FBD13B;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-size:16px;font-weight:800;">01</div></td><td valign="top"><div style="font-size:14px;font-weight:800;color:#0F1B3D;">Bloom's Taxonomy, built in</div><div style="font-size:13px;color:#475569;line-height:1.55;margin-top:3px;">Tag each question from Remember to Create. Know exactly which cognitive level your learners are at.</div></td></tr></table></td></tr>
          <tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="44" style="padding-right:14px;"><div style="background:#0F1B3D;color:#FBD13B;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-size:16px;font-weight:800;">02</div></td><td valign="top"><div style="font-size:14px;font-weight:800;color:#0F1B3D;">Confidence Grid</div><div style="font-size:13px;color:#475569;line-height:1.55;margin-top:3px;">Learners mark how sure they are. You instantly spot who knows, who guessed, and who's quietly lost.</div></td></tr></table></td></tr>
          <tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="44" style="padding-right:14px;"><div style="background:#0F1B3D;color:#FBD13B;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-size:16px;font-weight:800;">03</div></td><td valign="top"><div style="font-size:14px;font-weight:800;color:#0F1B3D;">Spaced Retrieval</div><div style="font-size:13px;color:#475569;line-height:1.55;margin-top:3px;">Questions resurface at scientifically-timed intervals — the single most proven way to move learning into long-term memory.</div></td></tr></table></td></tr>
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
        <a href="https://www.quizotic.live/host" style="display:inline-block;background:#FBD13B;color:#0D0D0D;text-decoration:none;padding:17px 44px;border-radius:12px;font-size:16px;font-weight:900;border:2px solid #0D0D0D;letter-spacing:0.2px;">Create your first lesson →</a>
      </td></tr></table>
      <p style="margin:18px 0 0;font-size:12px;color:#94A3B8;text-align:center;">⏱ Takes under 2 minutes · AI can draft the questions for you</p>
      <p style="margin:12px 0 0;font-size:13px;color:#475569;text-align:center;">Prefer a tour first? <a href="https://www.quizotic.live/welcome.html" style="color:#0F1B3D;font-weight:700;text-decoration:none;border-bottom:2px solid #FBD13B;padding-bottom:1px;">Read the 2-minute quick-start guide →</a></p>
      </td></tr>
      <tr><td style="padding:24px 36px 8px;">
        <div style="background:#F8FAFC;border-left:3px solid #FBD13B;border-radius:0 10px 10px 0;padding:14px 18px;">
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
          <a href="https://www.quizotic.live" style="color:#FBD13B;text-decoration:none;font-weight:700;">quizotic.live</a>
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

  // RFC 2047 encoded-word for the Subject: header. Without this, non-ASCII
  // characters (em-dash, apostrophes) are transmitted as raw UTF-8 bytes and
  // rendered as Latin-1 garbage (e.g. "Ã¢€"") by most mail clients.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
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

async function sendOtpEmail(to: string, code: string) {
  console.log('[auth] Sending OTP email to:', to)
  const accessToken = await getGmailAccessToken()
  console.log('[auth] Got Gmail access token, sending email...')
  const from = process.env.EMAIL_FROM || 'Quizotic <info@quizotic.live>'
  const subject = `${code} is your Quizotic sign-in code`
  const htmlBody = buildOtpHtml(code)

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
          // 15 minutes is short enough to limit brute-force exposure on a
          // 6-digit code (with rate limiting on the verify endpoint) and
          // long enough that a delayed corporate-firewall email still
          // arrives in time. The previous magic-link 24h was way too
          // generous for a numeric code.
          maxAge: 15 * 60,
          // Override NextAuth's default URL-safe token with a 6-digit code.
          // The code IS the token — NextAuth stores it in
          // VerificationToken.token and validates it on submit. No schema
          // change required; the column is just `String`.
          generateVerificationToken: async () => generateOtpCode(),
          sendVerificationRequest: async ({ identifier, token }) => {
            console.log('[auth] sendVerificationRequest (OTP) for:', identifier)
            try {
              await sendOtpEmail(identifier, token)
              console.log('[auth] OTP email sent successfully')
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
      if (!user.id) return
      // Capture geo + locale from the signin request — only at user
      // creation, not on later logins (a user travelling abroad shouldn't
      // appear to relocate). Best-effort; null is fine.
      let geo: { country: string | null; locale: string | null } = { country: null, locale: null }
      // Email sign-ups arrive with no name (the OTP provider only knows the
      // email). The sign-up form stashes the typed name in a short-lived
      // cookie so we can attach it here, at the one moment the account is born.
      let pendingName: string | null = null
      try {
        const hdrs = await nextHeaders()
        geo = extractGeo(hdrs)
        const cookieHeader = hdrs.get('cookie') ?? ''
        const match = cookieHeader.match(/(?:^|;\s*)quizotic_pending_name=([^;]+)/)
        if (match) pendingName = decodeURIComponent(match[1]).trim() || null
      } catch (err) {
        console.warn('[auth] geo extraction failed:', err instanceof Error ? err.message : err)
      }

      // Prefer the OAuth-provided name (Google/Microsoft); fall back to the
      // name the user typed on the email sign-up form.
      const resolvedName = user.name || pendingName

      const updates: { name?: string; referralCode?: string; country?: string; locale?: string; lastActiveAt?: Date } = {
        lastActiveAt: new Date(),
      }
      if (!user.name && pendingName) updates.name = pendingName
      if (resolvedName) {
        updates.referralCode = await createUniqueReferralCode(resolvedName)
      }
      if (geo.country) updates.country = geo.country
      if (geo.locale) updates.locale = geo.locale

      await prisma.user.update({ where: { id: user.id }, data: updates })

      // Apply any pending Pro grant issued before this person had an account.
      // Best-effort: a failure here must never block signup.
      if (user.email) {
        try {
          await applyPendingProGrant(user.id, user.email)
        } catch (err) {
          console.error('[auth] pending pro grant failed:', err instanceof Error ? err.message : err)
        }
      }

      if (user.email) {
        sendWelcomeEmail(user.email, resolvedName ?? null)
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
