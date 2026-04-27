import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { recordWebhook } from '@/lib/webhook-log'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// Race-safe insert: relies on @@unique([providerEventId]) + providerPaymentId
// to dedupe concurrent deliveries. Returns true on new insert, false on
// duplicate (already processed).
async function createPaymentIdempotent(data: Prisma.PaymentUncheckedCreateInput): Promise<boolean> {
  try {
    await prisma.payment.create({ data })
    return true
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return false
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitRequest(req, {
    bucket: 'razorpay-webhook',
    ipLimit: 240,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  if (!verifySignature(body, signature, process.env.RAZORPAY_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  const eventId = event.event ?? ''
  const payload = event.payload ?? {}

  // Idempotency key: event type + entity ID + event timestamp. Including the
  // timestamp means a legitimate second charge reusing the same payment.id is
  // treated distinctly, but a raw replay of the same webhook delivery dedupes.
  const entityId = payload.payment?.entity?.id ?? payload.subscription?.entity?.id
  if (!entityId) {
    // Unknown event type with no entity ID — acknowledge but skip processing
    await recordWebhook({ req, provider: 'razorpay', eventType: eventId || 'unknown', eventId: null, rawPayload: event })
      .then(rec => rec?.markStatus('processed'))
    return NextResponse.json({ received: true })
  }
  const eventCreatedAt: number = typeof event.created_at === 'number' ? event.created_at : 0
  const providerEventId = `${eventId}_${entityId}_${eventCreatedAt}`

  // Audit-log the inbound webhook BEFORE business logic, so a failure
  // downstream still leaves a trace.
  const recorded = await recordWebhook({
    req, provider: 'razorpay', eventType: eventId, eventId: providerEventId, rawPayload: event,
  })

  const existing = await prisma.payment.findFirst({ where: { providerEventId } })
  if (existing) {
    await recorded?.markStatus('duplicate')
    return NextResponse.json({ received: true })
  }

  try {
    switch (eventId) {
      case 'subscription.activated': {
        const sub = payload.subscription?.entity
        if (!sub) break

        // Trusted lookup: we created a pending Subscription row at checkout keyed on
        // providerSubscriptionId. Never trust sub.notes.userId — it's attacker-controlled
        // metadata that can be forged when creating a subscription outside our flow.
        const pending = await prisma.subscription.findFirst({
          where: { providerSubscriptionId: sub.id, provider: 'razorpay' },
        })
        if (!pending) {
          console.warn(`[razorpay-webhook] no pending subscription row for ${sub.id} — refusing to activate`)
          break
        }
        const userId = pending.userId
        const plan = pending.plan || sub.notes?.plan || 'pro_monthly'

        await prisma.subscription.update({
          where: { userId },
          data: {
            plan,
            status: 'active',
            provider: 'razorpay',
            providerSubscriptionId: sub.id,
            providerCustomerId: sub.customer_id ?? null,
            currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : new Date(),
            currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
            cancelledAt: null,
          },
        })
        break
      }

      case 'subscription.charged':
      case 'payment.captured': {
        const payment = payload.payment?.entity
        if (!payment) break

        // Resolve userId ONLY via providerSubscriptionId → our DB mapping.
        // payment.notes is attacker-controlled; never trust it.
        const subscriptionId = payment.subscription_id
        const sub = subscriptionId
          ? await prisma.subscription.findFirst({
              where: { providerSubscriptionId: subscriptionId, provider: 'razorpay' },
            })
          : null

        if (!sub) {
          console.warn(`[razorpay-webhook] no subscription mapping for payment ${payment.id} — skipping`)
          break
        }
        const userId = sub.userId

        await createPaymentIdempotent({
          userId,
          subscriptionId: sub.id,
          provider: 'razorpay',
          providerPaymentId: payment.id,
          providerEventId,
          amount: payment.amount ?? 0,
          currency: payment.currency ?? 'inr',
          status: 'succeeded',
          invoiceUrl: payment.invoice_id ? `https://api.razorpay.com/v1/invoices/${payment.invoice_id}` : null,
          metadata: event,
        })

        // Update subscription period if available
        if (sub && payload.subscription?.entity?.current_end) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'active',
              currentPeriodEnd: new Date(payload.subscription.entity.current_end * 1000),
            },
          })
        }
        break
      }

      case 'subscription.cancelled': {
        const sub = payload.subscription?.entity
        if (!sub) break

        await prisma.subscription.updateMany({
          where: { providerSubscriptionId: sub.id, provider: 'razorpay' },
          data: { status: 'cancelled', cancelledAt: new Date() },
        })
        break
      }
    }
  } catch (err) {
    console.error('[razorpay-webhook]', err)
    await recorded?.markStatus('failed', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  await recorded?.markStatus('processed')
  return NextResponse.json({ received: true })
}
