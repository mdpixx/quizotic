export const dynamic = 'force-dynamic'

// The in-app half of the nudge system. Design spec §4.
//
//   GET   the user's single open nudge, if any, with the copy to render.
//   POST  a state transition: shown | acted | dismissed.
//
// `shown` is the one that matters most. It is what stops the email: the worker
// only mails a nudge whose shownAt is still null after 48 hours. So this is
// not analytics — reporting the card as seen is the mechanism by which
// somebody who is already in the product does not also get mailed about it.
//
// In-app nudges never count against the 2-per-30-days email budget. Spec §4.

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { campaignFor } from '@/lib/lifecycle/campaigns'
import { NUDGE_CARDS, personaliseCard } from '@/lib/lifecycle/cards'

const TRANSITIONS = {
  shown: 'shownAt',
  acted: 'actedAt',
  dismissed: 'dismissedAt',
} as const

type Action = keyof typeof TRANSITIONS

// 'shown' is a marker, not a resolution — the card stays on screen and the
// user can still act on or dismiss it. The other two close the nudge.
const TERMINAL: Record<Action, boolean> = { shown: false, acted: true, dismissed: true }

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const nudge = await prisma.nudge.findFirst({
      where: { userId: user.id, state: { in: ['pending', 'shown'] } },
      orderBy: { priority: 'asc' },
      select: { id: true, campaignKey: true, state: true, shownAt: true },
    })
    if (!nudge) return NextResponse.json({ nudge: null })

    const card = NUDGE_CARDS[nudge.campaignKey as keyof typeof NUDGE_CARDS]
    // A campaign removed from the code but still open in the database must not
    // render an empty card.
    if (!card || !campaignFor(nudge.campaignKey)) return NextResponse.json({ nudge: null })

    // Same starter quiz the email would name, so the two surfaces agree if the
    // user sees both.
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, orgType: true },
    })
    const copy = personaliseCard(nudge.campaignKey, card, profile?.role, profile?.orgType)

    return NextResponse.json({
      nudge: { id: nudge.id, campaignKey: nudge.campaignKey, seen: nudge.shownAt !== null, ...copy },
    })
  } catch (err) {
    // The dashboard must render without this. A nudge is the least important
    // thing on the page.
    console.warn('[lifecycle] nudge fetch failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ nudge: null })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { id, action } = body
  if (!id || !action || !(action in TRANSITIONS)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const act = action as Action

  try {
    // Scoped to the caller's own userId, so an id from someone else's account
    // matches nothing rather than transitioning their nudge.
    const { count } = await prisma.nudge.updateMany({
      where: {
        id,
        userId: user.id,
        state: { in: ['pending', 'shown'] },
        // Timestamps are write-once: the first sighting is the one the 48h
        // grace period is measured from, and re-reporting must not push it
        // forward every time the dashboard mounts.
        ...(act === 'shown' ? { shownAt: null } : {}),
      },
      data: {
        [TRANSITIONS[act]]: new Date(),
        ...(TERMINAL[act] ? { state: act } : { state: 'shown' }),
      },
    })

    // Zero rows means already in that state or already closed. Idempotent by
    // design — the card fires 'shown' on every mount.
    return NextResponse.json({ ok: true, updated: count })
  } catch (err) {
    console.warn('[lifecycle] nudge transition failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
