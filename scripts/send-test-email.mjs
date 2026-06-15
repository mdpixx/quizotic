// Send ONE test copy of the testimonial email to dhiman.mahesh@gmail.com.
// Uses the same Gmail API OAuth2 flow as src/lib/email.ts.
// Embeds screenshots as CID attachments if they exist in exports/screenshots/.
//
// Run with:
//   railway run --service quizotic-beta node scripts/send-test-email.mjs
//   (needs GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, GMAIL_API_REFRESH_TOKEN on Railway)
//
// Or locally if you have those vars in .env:
//   node scripts/send-test-email.mjs

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

// Load .env when running locally
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

const TEST_RECIPIENT = 'dhiman.mahesh@gmail.com'
const SENDER_NAME    = 'Mahesh Dhiman, Quizotic'
const FROM           = process.env.EMAIL_FROM ?? `${SENDER_NAME} <info@quizotic.live>`
const SUBJECT        = "Set a quiz live, then walk away — plus a small ask"
const TEST_NAME      = 'Mahesh'

// ─── Gmail OAuth2 ─────────────────────────────────────────────────────────────

async function getAccessToken() {
  const clientId     = process.env.GMAIL_API_CLIENT_ID
  const clientSecret = process.env.GMAIL_API_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_API_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(
      '\nGMAIL_API_* env vars not set.\n' +
      'Run via Railway to pick up production creds:\n' +
      '  railway run --service quizotic-beta node scripts/send-test-email.mjs\n' +
      'Or add GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, GMAIL_API_REFRESH_TOKEN to .env'
    )
    process.exit(1)
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(data.error_description ?? 'Failed to get Gmail access token')
  }
  return data.access_token
}

// ─── Load screenshots ─────────────────────────────────────────────────────────

function loadScreenshot(filename) {
  const p = join(__dir, '..', 'exports', 'screenshots', filename)
  if (!existsSync(p)) return null
  return readFileSync(p)
}

// ─── Build MIME ───────────────────────────────────────────────────────────────

function buildMime({ from, to, subject, textBody, htmlBody, screenshots }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
  const altBoundary    = `alt_${Date.now().toString(36)}`
  const relBoundary    = `rel_${(Date.now() + 1).toString(36)}`

  const hasImages = screenshots.length > 0

  // Plain-text part
  const plainPart = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    textBody,
  ].join('\r\n')

  // HTML part — swap placeholder src to cid:
  let finalHtml = htmlBody
  for (const s of screenshots) {
    finalHtml = finalHtml.replaceAll(
      `src="screenshots/${s.filename}"`,
      `src="cid:${s.cid}"`
    )
  }
  const htmlPart = [
    `--${altBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    finalHtml,
  ].join('\r\n')

  // Alternative block (plain + html)
  let altBlock
  if (!hasImages) {
    // Simple multipart/alternative
    altBlock = [
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      plainPart,
      htmlPart,
      `--${altBoundary}--`,
    ].join('\r\n')
  } else {
    // Nested inside multipart/related
    const altSection = [
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      plainPart,
      htmlPart,
      `--${altBoundary}--`,
    ].join('\r\n')

    const imageParts = screenshots.map(s => [
      `--${relBoundary}`,
      `Content-Type: ${s.mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${s.cid}>`,
      `Content-Disposition: inline; filename="${s.filename}"`,
      '',
      s.data.toString('base64').match(/.{1,76}/g).join('\r\n'),
    ].join('\r\n')).join('\r\n')

    altBlock = [
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      '',
      `--${relBoundary}`,
      altSection,
      '',
      imageParts,
      `--${relBoundary}--`,
    ].join('\r\n')
  }

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    altBlock,
  ].join('\r\n')

  return Buffer.from(headers).toString('base64url')
}

// ─── Email content ────────────────────────────────────────────────────────────

function buildTextBody(name) {
  return `Hi ${name},

It's Mahesh, the founder of Quizotic. I noticed you had explored the platform a while
back, and I just wanted to personally say thank you — early hosts like you are the reason
it keeps getting better.

The big thing we've shipped since you last visited: Scheduled Quizzes.

You can now set a quiz to open at any date and time, share the link in advance, and let
people take it on their own schedule — without you needing to be online or host it live.
Think classroom assignments, training windows before a workshop, or selection rounds for
events. Set it. Share it. Walk away.

If you've been away for a bit, this is a good moment to come back and try it. Most hosts
tell us Quizotic feels quicker and less fussy than the usual tools — and the core features
stay free, no paywalls in your way.

→ Log in and try Scheduled Quizzes: https://www.quizotic.live/host

---

One genuine ask.

If Quizotic has been useful to you in any way, would you share a short testimonial? We're
building out our website and we'd love to feature real hosts — teachers, trainers,
managers — in their own words. Chosen testimonials go on the Quizotic homepage.

If you're open to it, just reply to this email with:
  • A line or two about your experience with Quizotic
  • A photo of yourself (any clear, recent one)
  • Your name + designation and organization
    (Students: "Student at [your college/university]")

That's it. No forms, no surveys. Just a reply.

Your feedback also shapes what we build next — so even if a testimonial doesn't feel
right, feel free to hit reply and tell us what you'd like to see improved. We read
every message.

Thank you for being part of the Quizotic story from early on.

Warmly,
Mahesh Dhiman
Founder, Quizotic
info@quizotic.live
https://www.quizotic.live`
}

function buildHtmlBody(name) {
  const html = readFileSync(join(__dir, '..', 'exports', 'testimonial-email-preview.html'), 'utf8')
  return html.replace(/\{\{name\}\}/g, name)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPreparing test email to ${TEST_RECIPIENT}...`)

  // Load screenshots (optional)
  const screenshots = []
  const screenshotDefs = [
    { filename: 'scheduled-create.png', cid: 'scheduled-create', mimeType: 'image/png' },
    { filename: 'scheduled-list.png',   cid: 'scheduled-list',   mimeType: 'image/png' },
  ]
  for (const def of screenshotDefs) {
    const data = loadScreenshot(def.filename)
    if (data) {
      screenshots.push({ ...def, data })
      console.log(`  ✓ Loaded screenshot: ${def.filename} (${(data.length / 1024).toFixed(0)} KB)`)
    } else {
      console.log(`  ⚠ Screenshot not found (will skip): exports/screenshots/${def.filename}`)
    }
  }

  const textBody = buildTextBody(TEST_NAME)
  const htmlBody = buildHtmlBody(TEST_NAME)
  const rawMime  = buildMime({
    from: FROM,
    to:   TEST_RECIPIENT,
    subject: SUBJECT,
    textBody,
    htmlBody,
    screenshots,
  })

  console.log('\nGetting Gmail access token...')
  const accessToken = await getAccessToken()

  console.log(`Sending to ${TEST_RECIPIENT}...`)
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawMime }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    console.error(`\nGmail API error ${res.status}: ${errText}`)
    process.exit(1)
  }

  const data = await res.json().catch(() => ({}))
  console.log(`\n✓ Test email sent! Gmail message id: ${data.id ?? 'unknown'}`)
  console.log(`  Check ${TEST_RECIPIENT} for the email.`)
  console.log(`  Screenshots embedded: ${screenshots.length > 0 ? screenshots.map(s => s.filename).join(', ') : 'none (text-only fallback)'}`)
  console.log('\n  Review it, then approve before sending to the full list.')
}

main().catch(err => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
