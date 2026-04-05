import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest) {
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

  // Idempotency check using the event's entity ID + event type as a composite key
  const entityId = payload.payment?.entity?.id ?? payload.subscription?.entity?.id
  if (!entityId) {
    // Unknown event type with no entity ID — acknowledge but skip processing
    return NextResponse.json({ received: true })
  }
  const providerEventId = `${eventId}_${entityId}`

  const existing = await prisma.payment.findFirst({ where: { providerEventId } })
  if (existing) {
    return NextResponse.json({ received: true })
  }

  try {
    switch (eventId) {
      case 'subscription.activated': {
        const sub = payload.subscription?.entity
        if (!sub) break

        const userId = sub.notes?.userId
        if (!userId) break

        const plan = sub.notes?.plan ?? 'pro_monthly'

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            plan,
            status: 'active',
            provider: 'razorpay',
            providerSubscriptionId: sub.id,
            providerCustomerId: sub.customer_id ?? null,
            currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : new Date(),
            currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
            cancelledAt: null,
          },
          create: {
            userId,
            plan,
            status: 'active',
            provider: 'razorpay',
            providerSubscriptionId: sub.id,
            providerCustomerId: sub.customer_id ?? null,
            currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : new Date(),
            currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
          },
        })
        break
      }

      case 'subscription.charged':
      case 'payment.captured': {
        const payment = payload.payment?.entity
        if (!payment) break

        // Find the subscription for this payment
        const subscriptionId = payment.subscription_id
        const sub = subscriptionId
          ? await prisma.subscription.findFirst({
              where: { providerSubscriptionId: subscriptionId, provider: 'razorpay' },
            })
          : null

        const userId = sub?.userId ?? payment.notes?.userId
        if (!userId) break

        await prisma.payment.create({
          data: {
            userId,
            subscriptionId: sub?.id ?? null,
            provider: 'razorpay',
            providerPaymentId: payment.id,
            providerEventId,
            amount: payment.amount ?? 0,
            currency: payment.currency ?? 'inr',
            status: 'succeeded',
            invoiceUrl: payment.invoice_id ? `https://api.razorpay.com/v1/invoices/${payment.invoice_id}` : null,
            metadata: event,
          },
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
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
