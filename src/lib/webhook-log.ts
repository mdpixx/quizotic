// WebhookEvent recorder. Captures every inbound webhook (Razorpay, Stripe,
// future) before any business logic runs, and provides a `markStatus` that
// the caller flips after processing. The audit row survives even if the
// downstream Payment write fails — debugging "did we ever receive event X?"
// becomes a single SELECT.
//
// Idempotency continues to live with Payment.providerEventId — this module
// is purely an observability artefact, not a dedupe primitive.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

const SAFE_HEADERS = [
  'content-type',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'x-razorpay-event-id',
  'x-razorpay-signature',
  'stripe-signature',
] as const

export interface RecordedWebhook {
  id: string
  markStatus: (status: 'processed' | 'failed' | 'duplicate', errorMessage?: string) => Promise<void>
}

export async function recordWebhook(args: {
  req: NextRequest | Request
  provider: string
  eventType: string
  eventId?: string | null
  rawPayload: unknown
}): Promise<RecordedWebhook | null> {
  try {
    const headers: Record<string, string> = {}
    for (const name of SAFE_HEADERS) {
      const v = args.req.headers.get(name)
      if (v) headers[name] = v
    }
    const ipAddress = args.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? args.req.headers.get('x-real-ip')
      ?? null

    const row = await prisma.webhookEvent.create({
      data: {
        provider: args.provider,
        eventType: args.eventType,
        eventId: args.eventId ?? null,
        rawPayload: (args.rawPayload ?? {}) as Prisma.InputJsonValue,
        headers: headers as Prisma.InputJsonValue,
        ipAddress,
      },
    })
    return {
      id: row.id,
      async markStatus(status, errorMessage) {
        try {
          await prisma.webhookEvent.update({
            where: { id: row.id },
            data: {
              status,
              errorMessage: errorMessage ?? null,
              processedAt: new Date(),
            },
          })
        } catch (err) {
          console.warn('[webhook-log] markStatus failed:', err instanceof Error ? err.message : err)
        }
      },
    }
  } catch (err) {
    console.warn('[webhook-log] record failed:', err instanceof Error ? err.message : err)
    return null
  }
}
