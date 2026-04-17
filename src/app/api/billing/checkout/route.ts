export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { stripe } from '@/lib/stripe'
import { razorpay } from '@/lib/razorpay'
import { prisma } from '@/lib/prisma'
import { PRICES } from '@/lib/billing'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimitRequest(req, {
    bucket: 'billing-checkout',
    userId: user.id,
    userLimit: 10,
    ipLimit: 20,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const { provider, plan }: { provider: 'stripe' | 'razorpay'; plan: 'pro_monthly' | 'pro_yearly' } = await req.json()

  // Guard: block checkout if payment provider keys are not configured
  if (provider === 'razorpay' && !process.env.RAZORPAY_KEY_ID) {
    return NextResponse.json({ error: 'Pro subscriptions are coming soon. Stay tuned!' }, { status: 503 })
  }
  if (provider === 'stripe' && !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Pro subscriptions are coming soon. Stay tuned!' }, { status: 503 })
  }

  const userId = user.id as string

  if (provider === 'stripe') {
    // Find or create Stripe customer
    const sub = await prisma.subscription.findUnique({ where: { userId } })
    let customerId = sub?.providerCustomerId

    if (!customerId || sub?.provider !== 'stripe') {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: user.name ?? '',
        metadata: { userId },
      })
      customerId = customer.id
    }

    // Persist the customer→user mapping immediately so the webhook can resolve
    // userId via providerCustomerId (trusted) and never need to trust metadata.
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: 'pending',
        provider: 'stripe',
        providerCustomerId: customerId,
      },
      update: {
        plan,
        provider: 'stripe',
        providerCustomerId: customerId,
      },
    })

    const priceId = plan === 'pro_yearly' ? PRICES.stripe.yearly : PRICES.stripe.monthly

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/host/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/host/billing`,
      metadata: { userId, plan },
    })

    return NextResponse.json({ url: session.url })
  }

  if (provider === 'razorpay') {
    const planId = plan === 'pro_yearly' ? PRICES.razorpay.yearly : PRICES.razorpay.monthly

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: plan === 'pro_yearly' ? 10 : 120, // 10 years or 10 years of monthly
      notes: { userId, plan },
    })

    // Persist a pending mapping so the webhook can resolve userId from
    // providerSubscriptionId (trusted) instead of webhook notes (attacker-controlled).
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        status: 'pending',
        provider: 'razorpay',
        providerSubscriptionId: subscription.id,
      },
      update: {
        plan,
        status: 'pending',
        provider: 'razorpay',
        providerSubscriptionId: subscription.id,
      },
    })

    return NextResponse.json({
      subscriptionId: subscription.id,
      key_id: process.env.RAZORPAY_KEY_ID,
      plan,
    })
  }

  return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
}
