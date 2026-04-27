// Tests for the credit-grant flow's pure functions:
//   - buildCreditGrantEmail() — template renderer
//   - getBonusCredits() — aggregation logic, mocked at the prisma boundary
//
// Endpoint integration is not unit-tested here (no in-repo NextRequest
// mocking infra); manual smoke is in the plan's verification section.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildCreditGrantEmail } from '../lib/emails/credit-grant'

// ─── Mock the Prisma client BEFORE importing billing.ts ─────────────────────
const mockReferralAggregate = vi.fn()
const mockGrantAggregate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    referral: { aggregate: (...args: unknown[]) => mockReferralAggregate(...args) },
    creditGrant: { aggregate: (...args: unknown[]) => mockGrantAggregate(...args) },
    subscription: { findUnique: vi.fn() },
  },
}))

import { getBonusCredits } from '../lib/billing'

beforeEach(() => {
  mockReferralAggregate.mockReset()
  mockGrantAggregate.mockReset()
})

describe('getBonusCredits', () => {
  it('aggregates referral rewards + active manual grants for the questions bucket', async () => {
    mockReferralAggregate.mockResolvedValue({ _sum: { rewardValue: 30 } })
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: 50 } })
    const total = await getBonusCredits('user-1', 'questions')
    expect(total).toBe(80)
    expect(mockReferralAggregate).toHaveBeenCalledOnce()
    expect(mockGrantAggregate).toHaveBeenCalledOnce()
  })

  it('caps referral component at 100 (legacy rule preserved)', async () => {
    mockReferralAggregate.mockResolvedValue({ _sum: { rewardValue: 250 } })
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: 0 } })
    const total = await getBonusCredits('user-1', 'questions')
    expect(total).toBe(100)
  })

  it('does not cap manual grants — admin discretion', async () => {
    mockReferralAggregate.mockResolvedValue({ _sum: { rewardValue: 0 } })
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: 5000 } })
    const total = await getBonusCredits('user-1', 'questions')
    expect(total).toBe(5000)
  })

  it('subtracts negative grants (revoke flow)', async () => {
    mockReferralAggregate.mockResolvedValue({ _sum: { rewardValue: 50 } })
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: -10 } })
    const total = await getBonusCredits('user-1', 'questions')
    expect(total).toBe(40)
  })

  it('skips referral aggregation entirely for the enhancements bucket', async () => {
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: 25 } })
    const total = await getBonusCredits('user-1', 'enhancements')
    expect(total).toBe(25)
    expect(mockReferralAggregate).not.toHaveBeenCalled()
  })

  it('passes a non-expired filter so expired grants are excluded', async () => {
    mockReferralAggregate.mockResolvedValue({ _sum: { rewardValue: 0 } })
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: 0 } })
    await getBonusCredits('user-1', 'questions')
    const arg = mockGrantAggregate.mock.calls[0][0] as { where: { OR: Array<unknown> } }
    expect(arg.where.OR).toHaveLength(2)
    expect(JSON.stringify(arg.where.OR)).toContain('null')
    expect(JSON.stringify(arg.where.OR)).toMatch(/gt|now/i)
  })

  it('handles null aggregation results (no rows)', async () => {
    mockReferralAggregate.mockResolvedValue({ _sum: { rewardValue: null } })
    mockGrantAggregate.mockResolvedValue({ _sum: { amount: null } })
    const total = await getBonusCredits('user-1', 'questions')
    expect(total).toBe(0)
  })
})

describe('buildCreditGrantEmail', () => {
  it('produces subject + text + html with the right substitutions', () => {
    const email = buildCreditGrantEmail({
      firstName: 'Mahesh',
      amount: 50,
      bucket: 'questions',
      reason: 'comp for AI failure on 2026-04-26',
      expiresAt: null,
    })
    expect(email.subject).toContain('50 AI question')
    expect(email.subject).toContain('Quizotic')
    expect(email.text).toContain('Hi Mahesh,')
    expect(email.text).toContain('50 AI questions')
    expect(email.text).toContain('available right away')
    expect(email.text).toContain('Comp for AI failure on 2026-04-26')
    expect(email.html).toContain('Mahesh')
    expect(email.html).toContain('<strong>')
    // No template placeholders left unrendered
    expect(email.text).not.toMatch(/\{[a-z]+\}/)
    expect(email.html).not.toMatch(/\{[a-z]+\}/)
  })

  it('falls back to "there" when the user has no first name', () => {
    const email = buildCreditGrantEmail({
      firstName: null,
      amount: 30,
      bucket: 'questions',
      reason: 'support ticket SUP-456',
      expiresAt: null,
    })
    expect(email.text).toContain('Hi there,')
  })

  it('formats expiry into a readable date when set', () => {
    // Use a noon-UTC timestamp so the formatted date is the same in any
    // reasonable timezone (avoids IST/UTC shifting May 31 → June 1).
    const email = buildCreditGrantEmail({
      firstName: 'Mahesh',
      amount: 100,
      bucket: 'enhancements',
      reason: 'compensation for outage',
      expiresAt: new Date('2026-05-15T12:00:00Z'),
    })
    expect(email.text.toLowerCase()).toContain('valid until')
    expect(email.text).toMatch(/May 15, 2026/)
  })

  it('uses singular noun for amount of 1', () => {
    const email = buildCreditGrantEmail({
      firstName: 'A',
      amount: 1,
      bucket: 'questions',
      reason: 'test',
      expiresAt: null,
    })
    expect(email.subject).toContain('1 AI question to')
  })

  it('handles negative amounts (revoke) with adjusted phrasing', () => {
    const email = buildCreditGrantEmail({
      firstName: 'Mahesh',
      amount: -20,
      bucket: 'questions',
      reason: 'duplicate grant on 2026-04-25',
      expiresAt: null,
    })
    expect(email.subject.toLowerCase()).toContain('adjusted')
    expect(email.text).toContain('-20 AI questions')
  })

  it('uses enhancement label when bucket is enhancements', () => {
    const email = buildCreditGrantEmail({
      firstName: 'Mahesh',
      amount: 5,
      bucket: 'enhancements',
      reason: 'enhancement test',
      expiresAt: null,
    })
    expect(email.subject).toContain('AI enhancement')
    expect(email.text).toContain('5 AI enhancements')
  })

  it('escapes HTML in user-controlled fields', () => {
    const email = buildCreditGrantEmail({
      firstName: '<script>alert(1)</script>',
      amount: 10,
      bucket: 'questions',
      reason: 'support <reason>',
      expiresAt: null,
    })
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })
})
