import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventObject = Record<string, any>

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check
  const existing = await prisma.payment.findFirst({ where: { providerEventId: event.id } })
  if (existing) {
    return NextResponse.json({ received: true })
  }

  const obj = event.data.object as EventObject

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = obj.metadata?.userId as string | undefined
        if (!userId) break

        const subscriptionId = obj.subscription as string
        const customerId = obj.customer as string
        const plan = (obj.metadata?.plan as string) ?? 'pro_monthly'

        // Fetch subscription details for period dates
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
        const firstItem = stripeSub.items?.data?.[0]
        const periodStart = firstItem?.current_period_start
          ? new Date(firstItem.current_period_start * 1000)
          : new Date()
        const periodEnd = firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            plan,
            status: 'active',
            provider: 'stripe',
            providerSubscriptionId: subscriptionId,
            providerCustomerId: customerId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelledAt: null,
          },
          create: {
            userId,
            plan,
            status: 'active',
            provider: 'stripe',
            providerSubscriptionId: subscriptionId,
            providerCustomerId: customerId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        })

        const dbSub = await prisma.subscription.findUnique({ where: { userId } })

        await prisma.payment.create({
          data: {
            userId,
            subscriptionId: dbSub?.id,
            provider: 'stripe',
            providerPaymentId: (obj.payment_intent as string) ?? `checkout_${obj.id}`,
            providerEventId: event.id,
            amount: obj.amount_total ?? 0,
            currency: obj.currency ?? 'usd',
            status: 'succeeded',
            invoiceUrl: null,
            metadata: JSON.parse(JSON.stringify(event)),
          },
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const customerId = obj.customer as string

        const sub = await prisma.subscription.findFirst({
          where: { providerCustomerId: customerId, provider: 'stripe' },
        })
        if (!sub) break

        // Update period end from line items
        const lineItem = obj.lines?.data?.[0]
        if (lineItem?.period) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'active',
              currentPeriodStart: new Date(lineItem.period.start * 1000),
              currentPeriodEnd: new Date(lineItem.period.end * 1000),
            },
          })
        }

        await prisma.payment.create({
          data: {
            userId: sub.userId,
            subscriptionId: sub.id,
            provider: 'stripe',
            providerPaymentId: (obj.payment_intent as string) ?? `inv_${obj.id}`,
            providerEventId: event.id,
            amount: obj.amount_paid ?? 0,
            currency: obj.currency ?? 'usd',
            status: 'succeeded',
            invoiceUrl: obj.hosted_invoice_url ?? null,
            metadata: JSON.parse(JSON.stringify(event)),
          },
        })
        break
      }

      case 'invoice.payment_failed': {
        const customerId = obj.customer as string
        await prisma.subscription.updateMany({
          where: { providerCustomerId: customerId, provider: 'stripe' },
          data: { status: 'past_due' },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const customerId = obj.customer as string
        await prisma.subscription.updateMany({
          where: { providerCustomerId: customerId, provider: 'stripe' },
          data: { status: 'expired', cancelledAt: new Date() },
        })
        break
      }
    }
  } catch (err) {
    console.error('[stripe-webhook]', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
