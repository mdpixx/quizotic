// Session 3 unit tests:
//   - recordWebhook captures the right header subset
//   - markStatus updates the right row
//   - logEmailRow shape (verified through sendEmail test surface)

import { describe, expect, it, vi, beforeEach } from 'vitest'

const { webhookCreateMock, webhookUpdateMock, emailLogCreateMock } = vi.hoisted(() => ({
  webhookCreateMock: vi.fn<(arg: unknown) => Promise<unknown>>(() => Promise.resolve({ id: 'webhook-1' })),
  webhookUpdateMock: vi.fn<(arg: unknown) => Promise<unknown>>(() => Promise.resolve({})),
  emailLogCreateMock: vi.fn<(arg: unknown) => Promise<unknown>>(() => Promise.resolve({})),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      create: webhookCreateMock,
      update: webhookUpdateMock,
    },
    emailLog: { create: emailLogCreateMock },
  },
}))

import { recordWebhook } from '../lib/webhook-log'

beforeEach(() => {
  webhookCreateMock.mockClear()
  webhookUpdateMock.mockClear()
  emailLogCreateMock.mockClear()
})

function makeReq(headers: Record<string, string>): Request {
  return new Request('https://example.com/webhook', { headers })
}

describe('recordWebhook', () => {
  it('captures provider, eventType, eventId and selected headers', async () => {
    const req = makeReq({
      'content-type': 'application/json',
      'x-razorpay-signature': 'abc123',
      'authorization': 'Bearer secret',          // not in safe list — should be dropped
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    })
    const rec = await recordWebhook({
      req,
      provider: 'razorpay',
      eventType: 'payment.captured',
      eventId: 'evt_X',
      rawPayload: { foo: 'bar' },
    })
    expect(rec).not.toBeNull()
    expect(webhookCreateMock).toHaveBeenCalledOnce()
    const call = webhookCreateMock.mock.calls[0][0] as unknown as { data: { provider: string; eventType: string; eventId: string; ipAddress: string | null; headers: Record<string, string> } }
    expect(call.data.provider).toBe('razorpay')
    expect(call.data.eventType).toBe('payment.captured')
    expect(call.data.eventId).toBe('evt_X')
    expect(call.data.ipAddress).toBe('203.0.113.5')
    expect(call.data.headers['x-razorpay-signature']).toBe('abc123')
    // Authorization header must NOT be captured
    expect(call.data.headers['authorization']).toBeUndefined()
  })

  it('returns a markStatus closure that updates the right row', async () => {
    const rec = await recordWebhook({
      req: makeReq({}),
      provider: 'stripe',
      eventType: 'invoice.paid',
      eventId: 'evt_Y',
      rawPayload: {},
    })
    if (!rec) throw new Error('expected rec')
    await rec.markStatus('processed')
    expect(webhookUpdateMock).toHaveBeenCalledOnce()
    const upd = webhookUpdateMock.mock.calls[0][0] as unknown as { where: { id: string }; data: { status: string; processedAt: Date } }
    expect(upd.where.id).toBe('webhook-1')
    expect(upd.data.status).toBe('processed')
    expect(upd.data.processedAt).toBeInstanceOf(Date)
  })

  it('passes errorMessage through markStatus', async () => {
    const rec = await recordWebhook({
      req: makeReq({}),
      provider: 'stripe',
      eventType: 'invoice.paid',
      eventId: 'evt_Z',
      rawPayload: {},
    })
    if (!rec) throw new Error('expected rec')
    await rec.markStatus('failed', 'downstream timeout')
    const upd = webhookUpdateMock.mock.calls[0][0] as unknown as { data: { status: string; errorMessage: string } }
    expect(upd.data.status).toBe('failed')
    expect(upd.data.errorMessage).toBe('downstream timeout')
  })

  it('returns null on DB failure but never throws', async () => {
    webhookCreateMock.mockRejectedValueOnce(new Error('db down'))
    const rec = await recordWebhook({
      req: makeReq({}),
      provider: 'razorpay',
      eventType: 'x',
      eventId: 'y',
      rawPayload: {},
    })
    expect(rec).toBeNull()
  })
})
