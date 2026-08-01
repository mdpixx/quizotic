// Guards the two-channel email split introduced alongside the lifecycle
// automation work.
//
// The rules being protected:
//   1. Transactional mail keeps going out over the Gmail API. Regressing
//      this breaks magic links, i.e. login.
//   2. Lifecycle mail goes out over Resend from the mail.quizotic.live
//      subdomain, so nudge complaints cannot damage magic-link reputation.
//   3. Lifecycle mail always carries one-click List-Unsubscribe headers.
//   4. EmailSuppression blocks lifecycle mail and never blocks transactional
//      mail — an unsubscribed user must still be able to log in.
//   5. Every outcome, including suppression, writes exactly one EmailLog row.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const emailLogCreate = vi.fn().mockResolvedValue({})
const suppressionFindUnique = vi.fn().mockResolvedValue(null)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailLog: { create: (...a: unknown[]) => emailLogCreate(...a) },
    emailSuppression: { findUnique: (...a: unknown[]) => suppressionFindUnique(...a) },
  },
}))

vi.mock('@prisma/client', () => ({ Prisma: { JsonNull: null } }))

const base = {
  to: 'teacher@example.com',
  subject: 'Your first quiz is waiting',
  html: '<p>hi</p>',
  text: 'hi',
}

async function loadSendEmail() {
  vi.resetModules()
  const mod = await import('@/lib/email')
  return mod.sendEmail
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
  emailLogCreate.mockClear().mockResolvedValue({})
  suppressionFindUnique.mockClear().mockResolvedValue(null)

  process.env.RESEND_API_KEY = 'test-resend-key'
  process.env.GMAIL_API_CLIENT_ID = 'gid'
  process.env.GMAIL_API_CLIENT_SECRET = 'gsecret'
  process.env.GMAIL_API_REFRESH_TOKEN = 'grefresh'
  delete process.env.EMAIL_FROM_LIFECYCLE
  delete process.env.EMAIL_REPLY_TO
})

describe('channel routing', () => {
  it('sends lifecycle mail through Resend, never Gmail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'resend-1' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    expect(result).toEqual({ ok: true, id: 'resend-1' })

    const urls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(urls).toContain('https://api.resend.com/emails')
    expect(urls.some(u => u.includes('gmail.googleapis.com'))).toBe(false)
  })

  it('defaults to the transactional Gmail path when no channel is given', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'gmail-1' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({ ...base, category: 'magic_link' })

    expect(result).toEqual({ ok: true, id: 'gmail-1' })
    const urls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.includes('gmail.googleapis.com'))).toBe(true)
    expect(urls).not.toContain('https://api.resend.com/emails')
  })

  it('sends lifecycle mail from the isolated subdomain, not the root domain', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'resend-2' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body.from).toContain('@mail.quizotic.live')
    // Replies must still reach a monitored human inbox.
    expect(body.reply_to).toBe('info@quizotic.live')
  })
})

describe('unsubscribe headers', () => {
  it('attaches one-click List-Unsubscribe headers to lifecycle mail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'resend-3' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body.headers['List-Unsubscribe']).toBe('<https://www.quizotic.live/api/unsubscribe/tok123>')
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('refuses a lifecycle send with no unsubscribe URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'nope' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    // Cast past the union: this is what a JS caller could do at runtime.
    const result = await sendEmail({ ...base, channel: 'lifecycle' } as never)

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('suppression', () => {
  it('blocks lifecycle mail to a suppressed address', async () => {
    suppressionFindUnique.mockResolvedValue({ reason: 'unsubscribed' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    expect(result).toEqual({ ok: false, error: 'suppressed: unsubscribed' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(emailLogCreate).toHaveBeenCalledTimes(1)
    expect(emailLogCreate.mock.calls[0][0].data.status).toBe('suppressed')
  })

  it('still delivers transactional mail to a suppressed address', async () => {
    // Unsubscribing from nudges must never lock someone out of their account.
    suppressionFindUnique.mockResolvedValue({ reason: 'unsubscribed' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'gmail-2' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({ ...base, category: 'magic_link' })

    expect(result).toEqual({ ok: true, id: 'gmail-2' })
    expect(suppressionFindUnique).not.toHaveBeenCalled()
  })

  it('fails closed when the suppression lookup errors', async () => {
    suppressionFindUnique.mockRejectedValue(new Error('db down'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('audit logging', () => {
  it('records the channel in EmailLog metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'resend-4' }))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
      metadata: { campaignKey: 'activation.host_first_session' },
    })

    expect(emailLogCreate).toHaveBeenCalledTimes(1)
    const row = emailLogCreate.mock.calls[0][0].data
    expect(row.status).toBe('sent')
    expect(row.providerId).toBe('resend-4')
    expect(row.metadata).toMatchObject({
      channel: 'lifecycle',
      campaignKey: 'activation.host_first_session',
    })
  })

  it('logs a failed row and does not throw when Resend rejects the send', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'bad' }, false, 422))
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    expect(result).toEqual({ ok: false, error: 'Resend 422' })
    expect(emailLogCreate.mock.calls[0][0].data.status).toBe('failed')
  })

  it('skips the send when RESEND_API_KEY is absent rather than falling back to Gmail', async () => {
    delete process.env.RESEND_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const sendEmail = await loadSendEmail()
    const result = await sendEmail({
      ...base,
      channel: 'lifecycle',
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok123',
    })

    expect(result).toEqual({ ok: false, error: 'RESEND_API_KEY not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
