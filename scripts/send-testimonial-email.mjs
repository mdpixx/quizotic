// Safe-by-default testimonial campaign sender.
//
// Preview recipients only (default; no invitation writes, no email):
//   node scripts/send-testimonial-email.mjs
//
// Restrict a dry run to explicit addresses:
//   node scripts/send-testimonial-email.mjs --test-list=one@example.com,two@example.com
//
// Record reply opt-outs/bounces without sending:
//   node scripts/send-testimonial-email.mjs --suppress=one@example.com --suppression-reason=reply_unsubscribe --confirm-count=1
//
// Quarantine claims stranded by a process crash for manual review:
//   node scripts/send-testimonial-email.mjs --mark-stale-claims-unknown=24
//
// Sending is irreversible and requires BOTH flags with the exact dry-run count:
//   node scripts/send-testimonial-email.mjs --send --confirm-count=42

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const CAMPAIGN_KEY = 'testimonial-2026-07'
const SUBJECT = 'Your Quizotic story could be featured'
const BASE_URL = 'https://www.quizotic.live'
const GMAIL_REQUEST_TIMEOUT_MS = 15_000
const __dir = dirname(fileURLToPath(import.meta.url))

export function parseCampaignArgs(args) {
  const countRaw = args.find(arg => arg.startsWith('--confirm-count='))?.split('=')[1]
  const testRaw = args.find(arg => arg.startsWith('--test-list='))?.slice('--test-list='.length) ?? ''
  const suppressRaw = args.find(arg => arg.startsWith('--suppress='))?.slice('--suppress='.length) ?? ''
  const integerOption = (name, fallback, min, max) => {
    const raw = args.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1]
    if (raw === undefined) return fallback
    if (!/^\d+$/.test(raw)) throw new Error(`--${name} must be a whole number from ${min} to ${max}.`)
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`--${name} must be a whole number from ${min} to ${max}.`)
    }
    return value
  }
  return {
    send: args.includes('--send'),
    confirmCount: countRaw && /^\d+$/.test(countRaw) ? Number(countRaw) : null,
    testList: testRaw ? testRaw.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) : [],
    suppressList: suppressRaw ? suppressRaw.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) : [],
    suppressionReason: args.find(arg => arg.startsWith('--suppression-reason='))?.slice('--suppression-reason='.length) || 'manual',
    staleClaimsHours: args.some(arg => arg.startsWith('--mark-stale-claims-unknown='))
      ? integerOption('mark-stale-claims-unknown', 24, 1, 720)
      : null,
    allUsers: args.includes('--all-users'),
    activeDays: 90,
    batchSize: integerOption('batch-size', 20, 1, 500),
    delayMs: integerOption('delay-ms', 3000, 0, 60_000),
  }
}

export function assertSendAllowed(options, actualCount) {
  if (!options.send) return
  if (actualCount < 1) throw new Error('Refusing to send to an empty recipient set.')
  if (options.confirmCount !== actualCount) {
    throw new Error(`Refusing to send. Re-run with --send --confirm-count=${actualCount}`)
  }
}

export function recipientQuery(allUsers) {
  return `
    SELECT u.id, u.name, u.email
    FROM "User" u
    WHERE u.email IS NOT NULL
      ${allUsers ? '' : 'AND u."lastActiveAt" >= NOW() - INTERVAL \'90 days\''}
      AND NOT EXISTS (
        SELECT 1 FROM "Testimonial" t WHERE t."userId" = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM "TestimonialInvite" ti
        WHERE ti."userId" = u.id
          AND ti."campaignKey" = $1
          AND ti."deliveryState" <> 'retryable'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "EmailSuppression" s WHERE s.email = lower(u.email)
      )
    ORDER BY u."lastActiveAt" DESC NULLS LAST, u."createdAt" DESC
  `
}

export function createCampaignInvite() {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex')
  return { token, tokenHash }
}

export function buildStoryUrl(token) {
  return `${BASE_URL}/share-your-story?invite=${encodeURIComponent(token)}`
}

export function safeRecipientEmail(value) {
  const email = String(value).trim()
  if (email.length > 320 || /[\r\n]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid recipient email address.')
  }
  return email
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderEmailTemplate(template, { name, storyUrl }) {
  return template
    .replace(/\{\{name\}\}/g, escapeHtml(name || 'there'))
    .replace(/\{\{story_url\}\}/g, escapeHtml(storyUrl))
}

function textBody(name, storyUrl) {
  return `Hi ${name || 'there'},

What did you enjoy most about using Quizotic?

Share a few honest lines about what Quizotic made easier, more engaging, or more enjoyable for you.

We will select some of our favourite testimonials to feature on the Quizotic website—with the contributor's name, designation, and optional photograph.

Share your Quizotic story: ${storyUrl}

It takes less than two minutes, and nothing will be published without your permission.

Prefer email? Reply with your testimonial, name, and designation, followed by: "I give Quizotic permission to publish this testimonial with my details."

Thank you for being part of Quizotic.

Mahesh Dhiman
Founder, Quizotic

You are receiving this one-time request because you signed up for Quizotic. Reply "unsubscribe" if you do not want future research emails.`
}

function loadLocalEnv() {
  const envPath = join(__dir, '..', '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

async function gmailAccessToken() {
  const clientId = process.env.GMAIL_API_CLIENT_ID
  const clientSecret = process.env.GMAIL_API_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_API_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GMAIL_API credentials are not configured.')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
  })
  const body = await response.json()
  if (!body.access_token) throw new Error(body.error_description || 'Could not refresh Gmail access token.')
  return body.access_token
}

function mimeMessage({ to, html, text }) {
  const from = process.env.EMAIL_FROM ?? 'Mahesh from Quizotic <info@quizotic.live>'
  const boundary = `testimonial_${randomUUID()}`
  const subject = `=?UTF-8?B?${Buffer.from(SUBJECT, 'utf8').toString('base64')}?=`
  const raw = [
    `From: ${from}`,
    'Reply-To: info@quizotic.live',
    `To: ${safeRecipientEmail(to)}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n')
  return Buffer.from(raw).toString('base64url')
}

async function sendGmail(accessToken, message) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: message }),
    signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new GmailHttpError(response.status)
  const body = await response.json()
  return body.id ?? 'unknown'
}

export class GmailHttpError extends Error {
  constructor(status) {
    super(`Gmail API ${status}`)
    this.status = status
  }

  get isDefinitiveRejection() {
    return this.status >= 400 && this.status < 500 && this.status !== 408
  }
}

export async function claimInvite(pool, userId, tokenHash) {
  const result = await pool.query(`
    INSERT INTO "TestimonialInvite"
      ("id", "tokenHash", "userId", "campaignKey", "expiresAt", "usedAt", "deliveryState", "deliveryAttemptedAt", "createdAt")
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NULL, 'claimed', NOW(), NOW())
    ON CONFLICT ("userId", "campaignKey") DO UPDATE
      SET "tokenHash" = EXCLUDED."tokenHash",
          "expiresAt" = EXCLUDED."expiresAt",
          "usedAt" = NULL,
          "deliveryState" = 'claimed',
          "deliveryAttemptedAt" = NOW(),
          "emailSentAt" = NULL,
          "lastDeliveryError" = NULL
      WHERE "TestimonialInvite"."deliveryState" = 'retryable'
        AND "TestimonialInvite"."usedAt" IS NULL
    RETURNING id
  `, [randomUUID(), tokenHash, userId, CAMPAIGN_KEY])
  return result.rowCount === 1
}

export async function isEmailSuppressed(pool, email) {
  const result = await pool.query(
    'SELECT 1 FROM "EmailSuppression" WHERE email = lower($1) LIMIT 1',
    [safeRecipientEmail(email)],
  )
  return result.rowCount > 0
}

async function markInviteDelivery(pool, userId, state, errorMessage = null) {
  await pool.query(`
    UPDATE "TestimonialInvite"
    SET "deliveryState" = $3,
        "emailSentAt" = CASE WHEN $3 = 'sent' THEN NOW() ELSE NULL END,
        "lastDeliveryError" = $4
    WHERE "userId" = $1 AND "campaignKey" = $2
  `, [userId, CAMPAIGN_KEY, state, errorMessage?.slice(0, 500) ?? null])
}

async function applySuppressions(pool, emails, reason) {
  for (const rawEmail of emails) {
    const email = safeRecipientEmail(rawEmail).toLowerCase()
    await pool.query(`
      INSERT INTO "EmailSuppression" (email, reason, source, "createdAt", "updatedAt")
      VALUES ($1, $2, 'campaign_cli', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
        SET reason = EXCLUDED.reason, source = EXCLUDED.source, "updatedAt" = NOW()
    `, [email, reason.slice(0, 120)])
  }
}

async function logEmail(pool, { userId, email, status, providerId = null, errorMessage = null }) {
  await pool.query(`
    INSERT INTO "EmailLog" ("id", "userId", "toEmail", "subject", "category", "providerId", "status", "errorMessage", "metadata", "createdAt")
    VALUES ($1, $2, $3, $4, 'testimonial_request', $5, $6, $7, $8::jsonb, NOW())
  `, [randomUUID(), userId, email, SUBJECT, providerId, status, errorMessage, JSON.stringify({ campaign: CAMPAIGN_KEY })])
}

export async function deliverClaimedInvitation({
  pool,
  recipient,
  accessToken,
  message,
  send = sendGmail,
  checkSuppression = isEmailSuppressed,
  markDelivery = markInviteDelivery,
  writeLog = logEmail,
}) {
  try {
    if (await checkSuppression(pool, recipient.email)) {
      const reason = 'Recipient became suppressed before delivery'
      await markDelivery(pool, recipient.id, 'retryable', reason)
      await writeLog(pool, {
        userId: recipient.id,
        email: recipient.email,
        status: 'suppressed',
        errorMessage: reason,
      })
      return { outcome: 'suppressed', deliveryState: 'retryable' }
    }
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : String(error)
    await markDelivery(pool, recipient.id, 'unknown', failureMessage).catch(() => undefined)
    await writeLog(pool, {
      userId: recipient.id,
      email: recipient.email,
      status: 'delivery_unknown',
      errorMessage: failureMessage.slice(0, 200),
    }).catch(() => undefined)
    return { outcome: 'failed', deliveryState: 'unknown', error }
  }

  try {
    const providerId = await send(accessToken, message)
    const auditErrors = []
    try {
      await markDelivery(pool, recipient.id, 'sent')
    } catch (error) {
      auditErrors.push(error)
    }
    try {
      await writeLog(pool, { userId: recipient.id, email: recipient.email, status: 'sent', providerId })
    } catch (error) {
      auditErrors.push(error)
    }
    return { outcome: 'sent', providerId, auditErrors }
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : String(error)
    const deliveryState = error instanceof GmailHttpError && error.isDefinitiveRejection ? 'retryable' : 'unknown'
    await markDelivery(pool, recipient.id, deliveryState, failureMessage).catch(() => undefined)
    await writeLog(pool, {
      userId: recipient.id,
      email: recipient.email,
      status: deliveryState === 'retryable' ? 'failed' : 'delivery_unknown',
      errorMessage: failureMessage.slice(0, 200),
    }).catch(() => undefined)
    return { outcome: 'failed', deliveryState, error }
  }
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms))
}

async function main() {
  loadLocalEnv()
  const options = parseCampaignArgs(process.argv.slice(2))
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    if (options.suppressList.length > 0) {
      if (options.send || options.staleClaimsHours !== null) throw new Error('Suppression mode cannot be combined with send or stale-claim mode.')
      const uniqueSuppressions = [...new Set(options.suppressList)]
      if (options.confirmCount !== uniqueSuppressions.length) {
        throw new Error(`Refusing suppression update. Re-run with --confirm-count=${uniqueSuppressions.length}`)
      }
      await applySuppressions(pool, uniqueSuppressions, options.suppressionReason)
      console.log(`Recorded ${uniqueSuppressions.length} email suppression(s).`)
      return
    }

    if (options.staleClaimsHours !== null) {
      if (options.send) throw new Error('Stale-claim reconciliation cannot send email.')
      const result = await pool.query(`
        UPDATE "TestimonialInvite"
        SET "deliveryState" = 'unknown',
            "lastDeliveryError" = 'Stale claimed delivery requires manual reconciliation'
        WHERE "deliveryState" = 'claimed'
          AND "deliveryAttemptedAt" < NOW() - ($1 * INTERVAL '1 hour')
          AND "usedAt" IS NULL
      `, [options.staleClaimsHours])
      console.log(`Marked ${result.rowCount ?? 0} stale claim(s) unknown for manual review.`)
      return
    }

    const { rows } = await pool.query(recipientQuery(options.allUsers || options.testList.length > 0), [CAMPAIGN_KEY])
    const testSet = new Set(options.testList)
    const recipients = testSet.size ? rows.filter(row => testSet.has(row.email.toLowerCase())) : rows
    console.log(`Campaign: ${CAMPAIGN_KEY}`)
    console.log(`Audience: ${testSet.size ? 'explicit test list' : options.allUsers ? 'all eligible users' : 'active in the last 90 days'}`)
    console.log(`Recipients: ${recipients.length}`)

    assertSendAllowed(options, recipients.length)
    if (!options.send) {
      console.log(`Dry run only. To send, re-run with --send --confirm-count=${recipients.length}`)
      return
    }

    const template = readFileSync(join(__dir, '..', 'exports', 'testimonial-email.html'), 'utf8')
    const accessToken = await gmailAccessToken()
    let sent = 0
    let failed = 0
    let auditFailures = 0
    for (let index = 0; index < recipients.length; index += options.batchSize) {
      const batch = recipients.slice(index, index + options.batchSize)
      for (const recipient of batch) {
        let invitation
        let message
        try {
          invitation = createCampaignInvite()
          const storyUrl = buildStoryUrl(invitation.token)
          const html = renderEmailTemplate(template, { name: recipient.name, storyUrl })
          message = mimeMessage({
            to: recipient.email,
            html,
            text: textBody(recipient.name, storyUrl),
          })
        } catch (validationError) {
          failed += 1
          const failureMessage = validationError instanceof Error ? validationError.message : String(validationError)
          await logEmail(pool, {
            userId: recipient.id,
            email: String(recipient.email).slice(0, 320),
            status: 'failed',
            errorMessage: failureMessage.slice(0, 200),
          }).catch(() => undefined)
          console.error(`Skipped invalid recipient ${sent + failed}/${recipients.length}: ${failureMessage}`)
          continue
        }
        let claimed
        try {
          claimed = await claimInvite(pool, recipient.id, invitation.tokenHash)
        } catch (claimError) {
          failed += 1
          const failureMessage = claimError instanceof Error ? claimError.message : String(claimError)
          await logEmail(pool, {
            userId: recipient.id,
            email: recipient.email,
            status: 'failed',
            errorMessage: failureMessage.slice(0, 200),
          }).catch(() => undefined)
          console.error(`Failed ${sent + failed}/${recipients.length}: ${failureMessage}`)
          continue
        }
        if (!claimed) {
          console.log('Skipped one recipient: campaign invitation already exists')
          continue
        }

        const delivery = await deliverClaimedInvitation({ pool, recipient, accessToken, message })
        if (delivery.outcome === 'suppressed') {
          console.log('Skipped one recipient: email address is suppressed')
          continue
        }
        if (delivery.outcome === 'failed') {
          failed += 1
          const sendError = delivery.error
          const failureMessage = sendError instanceof Error ? sendError.message : String(sendError)
          console.error(`Failed ${sent + failed}/${recipients.length}: ${failureMessage}`)
          continue
        }

        sent += 1
        console.log(`Sent ${sent + failed}/${recipients.length}`)
        for (const auditError of delivery.auditErrors) {
          auditFailures += 1
          console.error(`Delivery accepted but audit persistence failed: ${auditError instanceof Error ? auditError.message : auditError}`)
        }
      }
      if (index + options.batchSize < recipients.length && options.delayMs > 0) await wait(options.delayMs)
    }
    console.log(`Finished: ${sent} sent, ${failed} failed, ${auditFailures} audit-log failures.`)
    if (failed > 0 || auditFailures > 0) process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
