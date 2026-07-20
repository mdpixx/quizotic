import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertSendAllowed,
  buildStoryUrl,
  claimInvite,
  createCampaignInvite,
  deliverClaimedInvitation,
  GmailHttpError,
  isEmailSuppressed,
  parseCampaignArgs,
  recipientQuery,
  renderEmailTemplate,
  safeRecipientEmail,
} from '../../scripts/send-testimonial-email.mjs'

const recipient = { id: 'user-1', email: 'asha@example.com' }

function deliveryHarness(overrides: Record<string, unknown> = {}) {
  const calls: Array<unknown[]> = []
  return {
    calls,
    options: {
      pool: {},
      recipient,
      accessToken: 'access-token',
      message: 'message',
      checkSuppression: async () => false,
      send: async () => 'gmail-1',
      markDelivery: async (...args: unknown[]) => { calls.push(['mark', ...args.slice(1)]) },
      writeLog: async (...args: unknown[]) => { calls.push(['log', args[1]]) },
      ...overrides,
    },
  }
}

describe('testimonial campaign safety', () => {
  it('defaults to a 90-day active-user dry run', () => {
    expect(parseCampaignArgs([])).toMatchObject({ send: false, activeDays: 90, confirmCount: null, testList: [] })
    expect(recipientQuery(false)).toContain('"lastActiveAt" >= NOW() - INTERVAL \'90 days\'')
    expect(recipientQuery(false)).toContain('FROM "TestimonialInvite" ti')
    expect(recipientQuery(false)).toContain('ti."campaignKey" = $1')
    expect(recipientQuery(false)).toContain('ti."deliveryState" <> \'retryable\'')
    expect(recipientQuery(false)).toContain('FROM "EmailSuppression" s')
  })

  it('requires an exact confirmed recipient count before sending', () => {
    expect(() => assertSendAllowed({ send: true, confirmCount: 2 }, 3)).toThrow(/confirm-count=3/)
    expect(() => assertSendAllowed({ send: false, confirmCount: null }, 3)).not.toThrow()
    expect(() => assertSendAllowed({ send: true, confirmCount: 3 }, 3)).not.toThrow()
  })

  it('supports an explicit test list without changing the safe default', () => {
    expect(parseCampaignArgs(['--test-list=one@example.com,two@example.com'])).toMatchObject({
      send: false,
      testList: ['one@example.com', 'two@example.com'],
    })
  })

  it('supports explicit suppression and stale-claim reconciliation modes', () => {
    expect(parseCampaignArgs(['--suppress=one@example.com,two@example.com', '--suppression-reason=reply_unsubscribe'])).toMatchObject({
      suppressList: ['one@example.com', 'two@example.com'],
      suppressionReason: 'reply_unsubscribe',
    })
    expect(parseCampaignArgs(['--mark-stale-claims-unknown=24'])).toMatchObject({ staleClaimsHours: 24 })
  })

  it('rejects malformed or unsafe batching options', () => {
    expect(() => parseCampaignArgs(['--batch-size=oops'])).toThrow(/batch-size/)
    expect(() => parseCampaignArgs(['--batch-size=0'])).toThrow(/batch-size/)
    expect(() => parseCampaignArgs(['--delay-ms=Infinity'])).toThrow(/delay-ms/)
  })

  it('rejects email-header injection in recipient data', () => {
    expect(safeRecipientEmail('asha@example.com')).toBe('asha@example.com')
    expect(() => safeRecipientEmail('asha@example.com\r\nBcc: attacker@example.com')).toThrow(/recipient email/i)
  })

  it('rechecks suppression immediately before external delivery', async () => {
    const send = vi.fn()
    const harness = deliveryHarness({ checkSuppression: async () => true, send })

    await expect(deliverClaimedInvitation(harness.options)).resolves.toMatchObject({ outcome: 'suppressed' })
    expect(send).not.toHaveBeenCalled()
    expect(harness.calls).toContainEqual(['mark', recipient.id, 'retryable', 'Recipient became suppressed before delivery'])
  })

  it('quarantines suppression-check failures without rejecting the campaign loop', async () => {
    const send = vi.fn()
    const harness = deliveryHarness({
      checkSuppression: async () => { throw new Error('suppression store unavailable') },
      send,
    })

    await expect(deliverClaimedInvitation(harness.options)).resolves.toMatchObject({
      outcome: 'failed',
      deliveryState: 'unknown',
    })
    expect(send).not.toHaveBeenCalled()
    expect(harness.calls).toContainEqual(['mark', recipient.id, 'unknown', 'suppression store unavailable'])
  })

  it('records accepted deliveries and preserves audit failures for the caller', async () => {
    const harness = deliveryHarness({
      markDelivery: async () => { throw new Error('state unavailable') },
    })

    const result = await deliverClaimedInvitation(harness.options)

    expect(result).toMatchObject({ outcome: 'sent', providerId: 'gmail-1' })
    expect(result.auditErrors).toHaveLength(1)
    expect(harness.calls[0]).toEqual(['log', expect.objectContaining({ status: 'sent', providerId: 'gmail-1' })])
  })

  it('marks definitive 4xx rejections retryable and uncertain failures unknown', async () => {
    const rejected = deliveryHarness({ send: async () => { throw new GmailHttpError(400) } })
    const uncertain = deliveryHarness({ send: async () => { throw new DOMException('timed out', 'TimeoutError') } })

    await expect(deliverClaimedInvitation(rejected.options)).resolves.toMatchObject({ deliveryState: 'retryable' })
    await expect(deliverClaimedInvitation(uncertain.options)).resolves.toMatchObject({ deliveryState: 'unknown' })
  })

  it('treats a concurrent invitation claim loss as a safe skip', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rowCount: 0 }) }
    await expect(claimInvite(pool, recipient.id, 'a'.repeat(64))).resolves.toBe(false)
  })

  it('checks the durable suppression table case-insensitively', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) }
    await expect(isEmailSuppressed(pool, 'Asha@example.com')).resolves.toBe(true)
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('lower($1)'), ['Asha@example.com'])
  })
})

describe('testimonial invitation email', () => {
  it('creates an opaque invitation and a URL that contains no customer email', () => {
    const invite = createCampaignInvite()
    const url = buildStoryUrl(invite.token)

    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(invite.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(url).toBe(`https://www.quizotic.live/share-your-story?invite=${invite.token}`)
    expect(url).not.toContain('@')
  })

  it('escapes personalised names and replaces the story URL', () => {
    const html = renderEmailTemplate(
      '<p>Hi {{name}}</p><a href="{{story_url}}">Share</a>',
      { name: '<Asha & Ravi>', storyUrl: 'https://www.quizotic.live/share-your-story?invite=abc' },
    )

    expect(html).toContain('Hi &lt;Asha &amp; Ravi&gt;')
    expect(html).toContain('invite=abc')
    expect(html).not.toContain('{{')
  })

  it('ships mobile-safe HTML with one primary CTA and reply consent fallback', () => {
    const template = readFileSync(join(process.cwd(), 'exports/testimonial-email.html'), 'utf8')

    expect(template).toContain('Your Quizotic story could be featured')
    expect(template).toContain('What did you enjoy most about using Quizotic?')
    expect(template).toContain('select some of our favourite testimonials')
    expect(template).toContain('Share my Quizotic story')
    expect(template).toContain('{{story_url}}')
    expect(template).toContain('I give Quizotic permission to publish')
    expect(template.match(/class="cta"/g)).toHaveLength(1)
  })
})
