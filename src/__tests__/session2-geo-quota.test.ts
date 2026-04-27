// Session 2 unit tests:
//   - Geo extraction from request headers (CDN-style and Accept-Language)
//   - lastActiveAt debounce semantics
//
// Quota math (countQuestions on the typed column) is exercised via the
// prisma mock here too — it locks in the "fall back to DEFAULT_QUESTION_COST
// when typed columns are zero but rows exist" defence-in-depth branch.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { extractCountry, extractLocale, extractGeo } from '../lib/geo'

describe('extractCountry', () => {
  function mk(headers: Record<string, string>): Headers {
    return new Headers(headers)
  }

  it('reads Cloudflare CF-IPCountry first', () => {
    expect(extractCountry(mk({ 'cf-ipcountry': 'IN' }))).toBe('IN')
  })

  it('falls back to Vercel x-vercel-ip-country', () => {
    expect(extractCountry(mk({ 'x-vercel-ip-country': 'us' }))).toBe('US')
  })

  it('falls back to Fastly fastly-geo-country', () => {
    expect(extractCountry(mk({ 'fastly-geo-country': 'GB' }))).toBe('GB')
  })

  it('rejects placeholder values from Cloudflare for unknown / Tor', () => {
    expect(extractCountry(mk({ 'cf-ipcountry': 'XX' }))).toBeNull()
    expect(extractCountry(mk({ 'cf-ipcountry': 'T1' }))).toBeNull()
  })

  it('rejects non-alpha-2 values', () => {
    expect(extractCountry(mk({ 'cf-ipcountry': 'INDIA' }))).toBeNull()
    expect(extractCountry(mk({ 'cf-ipcountry': '' }))).toBeNull()
    expect(extractCountry(mk({ 'cf-ipcountry': '12' }))).toBeNull()
  })

  it('returns null when no recognised header is present', () => {
    expect(extractCountry(mk({ 'x-other': 'IN' }))).toBeNull()
    expect(extractCountry(mk({}))).toBeNull()
  })
})

describe('extractLocale', () => {
  function mk(al: string): Headers {
    return new Headers({ 'accept-language': al })
  }

  it('returns the highest-priority tag', () => {
    expect(extractLocale(mk('en-IN,en;q=0.9,hi;q=0.8'))).toBe('en-IN')
  })

  it('respects q values and picks the highest', () => {
    expect(extractLocale(mk('en;q=0.5,fr-FR;q=0.9,de;q=0.7'))).toBe('fr-FR')
  })

  it('handles a bare primary tag', () => {
    expect(extractLocale(mk('hi'))).toBe('hi')
  })

  it('skips wildcards', () => {
    expect(extractLocale(mk('*,en-US;q=0.9'))).toBe('en-US')
  })

  it('returns null when header is absent', () => {
    expect(extractLocale(new Headers())).toBeNull()
  })

  it('rejects garbage that does not look like BCP47', () => {
    expect(extractLocale(mk('1234'))).toBeNull()
    expect(extractLocale(mk('   '))).toBeNull()
  })
})

describe('extractGeo combined', () => {
  it('returns both fields together', () => {
    const h = new Headers({ 'cf-ipcountry': 'IN', 'accept-language': 'en-IN,hi;q=0.9' })
    expect(extractGeo(h)).toEqual({ country: 'IN', locale: 'en-IN' })
  })

  it('returns nulls when nothing useful is present', () => {
    expect(extractGeo(new Headers())).toEqual({ country: null, locale: null })
  })
})

// ─── lastActiveAt debounce ──────────────────────────────────────────────────
const updateMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: updateMock },
    referral: { aggregate: vi.fn() },
    creditGrant: { aggregate: vi.fn() },
    subscription: { findUnique: vi.fn() },
    usageLog: { aggregate: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}))

import { bumpLastActive, __test__ as lastActiveTest } from '../lib/last-active'

beforeEach(() => {
  updateMock.mockClear()
  lastActiveTest.lastWritten.clear()
})

describe('bumpLastActive', () => {
  it('writes once for a user, then debounces subsequent calls', async () => {
    bumpLastActive('user-1')
    bumpLastActive('user-1')
    bumpLastActive('user-1')
    // Allow microtasks to flush
    await new Promise(r => setTimeout(r, 0))
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({ lastActiveAt: expect.any(Date) }),
    }))
  })

  it('writes separately for different users', async () => {
    bumpLastActive('user-a')
    bumpLastActive('user-b')
    await new Promise(r => setTimeout(r, 0))
    expect(updateMock).toHaveBeenCalledTimes(2)
  })

  it('writes again after the debounce window expires', async () => {
    bumpLastActive('user-1')
    await new Promise(r => setTimeout(r, 0))
    // Manually backdate the cache to simulate the debounce window expiring.
    lastActiveTest.lastWritten.set('user-1', Date.now() - lastActiveTest.DEBOUNCE_MS - 1)
    bumpLastActive('user-1')
    await new Promise(r => setTimeout(r, 0))
    expect(updateMock).toHaveBeenCalledTimes(2)
  })

  it('ignores empty userId', async () => {
    bumpLastActive('')
    await new Promise(r => setTimeout(r, 0))
    expect(updateMock).not.toHaveBeenCalled()
  })
})
