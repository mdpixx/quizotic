export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { stripe } from '@/lib/stripe'
import { razorpay } from '@/lib/razorpay'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (!sub || sub.plan === 'free') {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
  }

  if (sub.provider === 'stripe' && sub.providerCustomerId) {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.providerCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/host/billing`,
    })
    return NextResponse.json({ url: portalSession.url })
  }

  if (sub.provider === 'razorpay' && sub.providerSubscriptionId) {
    await razorpay.subscriptions.cancel(sub.providerSubscriptionId, false) // cancel at period end
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })
    return NextResponse.json({ cancelled: true })
  }

  // Manual / admin-granted subscriptions — cancel immediately
  if (sub.provider === 'manual') {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })
    return NextResponse.json({ cancelled: true })
  }

  return NextResponse.json({ error: 'Unable to manage subscription' }, { status: 400 })
}
