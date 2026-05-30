export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

// IST date key (YYYY-MM-DD, Asia/Kolkata). DB stores UTC; bucketing by UTC
// lands India activity after 6:30 PM IST on the wrong day. Mirrors the helper
// in /api/analytics so admin trends and host analytics agree.
function istDateKey(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

// Last `days` IST date keys ending today (oldest → newest).
function lastNDays(days: number): string[] {
  const keys: string[] = []
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    keys.push(istDateKey(new Date(now - i * 86_400_000)))
  }
  return keys
}

function dailyCounts(rows: { createdAt: Date }[], dayKeys: string[]): number[] {
  const counts = new Map<string, number>(dayKeys.map(k => [k, 0]))
  for (const r of rows) {
    const k = istDateKey(r.createdAt)
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return dayKeys.map(k => counts.get(k) ?? 0)
}

// Week-over-week from a 14-point daily series: last 7 vs prior 7.
// pct is null when last week was zero but this week isn't ("new", not ∞%).
function wowDelta(series: number[]): { thisWeek: number; lastWeek: number; pct: number | null } {
  const n = series.length
  const thisWeek = series.slice(Math.max(0, n - 7)).reduce((a, b) => a + b, 0)
  const lastWeek = series.slice(Math.max(0, n - 14), n - 7).reduce((a, b) => a + b, 0)
  const pct = lastWeek === 0 ? (thisWeek > 0 ? null : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  return { thisWeek, lastWeek, pct }
}

export async function GET() {
  const admin = await getCurrentUser()
  if (!admin || !isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()

  // Start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Start of current week (Monday)
  const startOfWeek = new Date(now)
  const day = startOfWeek.getDay()
  startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1))
  startOfWeek.setHours(0, 0, 0, 0)

  // Start of today
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  // Run all queries in parallel
  const [
    totalUsers,
    usersThisMonth,
    usersThisWeek,
    usersToday,
    totalQuizzes,
    quizzesThisMonth,
    totalSessions,
    sessionsThisMonth,
    totalSubscriptions,
    subscriptionsByPlan,
    totalAiUsage,
    aiUsageThisMonth,
    recentUsers,
    recentSessions,
    topUsers,
    onboardedCount,
    referralStats,
  ] = await Promise.all([
    // User counts
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),

    // Quiz counts
    prisma.quiz.count(),
    prisma.quiz.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Session counts
    prisma.gameSession.count(),
    prisma.gameSession.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Subscription counts
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: 'active' },
      _count: true,
    }),

    // AI usage
    prisma.usageLog.count(),
    prisma.usageLog.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Recent users (last 10)
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, orgType: true, organization: true, onboarded: true, referredByCode: true, discoveryChannel: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Recent sessions (last 10)
    prisma.gameSession.findMany({
      select: { id: true, code: true, type: true, hostName: true, status: true, participantCount: true, createdAt: true, endedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Top users by quiz count
    prisma.quiz.groupBy({
      by: ['userId'],
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      where: { userId: { not: null } },
      take: 10,
    }),

    // Onboarded users count
    prisma.user.count({ where: { onboarded: true } }),

    // Referral stats
    prisma.user.count({ where: { referredByCode: { not: null } } }),
  ])

  // Get emails for top users
  const topUserIds = topUsers.map(u => u.userId).filter((id): id is string => id !== null)
  const topUserDetails = topUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  const topUsersWithDetails = topUsers.map(u => {
    const details = topUserDetails.find(d => d.id === u.userId)
    return { email: details?.email, name: details?.name, quizCount: u._count }
  })

  // Discovery channel breakdown
  const discoveryBreakdown = await prisma.user.groupBy({
    by: ['discoveryChannel'],
    _count: true,
    where: { discoveryChannel: { not: null } },
  })

  // Role breakdown
  const roleBreakdown = await prisma.user.groupBy({
    by: ['role'],
    _count: true,
    where: { role: { not: null } },
  })

  // ── Trends, activation funnel, and "needs attention" inputs ───────────────
  const dayKeys = lastNDays(14)
  const since = new Date(Date.now() - 15 * 86_400_000) // 15d window safely covers all 14 IST buckets
  const oneDayAgo = new Date(Date.now() - 86_400_000)

  const [
    usersDaily,
    quizzesDaily,
    sessionsDaily,
    createdContentUsers,
    ranLiveUsers,
    hostSessionCounts,
    stuckSessions,
    openModeration,
    pendingDeletions,
    presentationsTotal,
    presentationsThisMonth,
  ] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.quiz.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.gameSession.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    // Distinct users who have created at least one quiz OR presentation.
    prisma.user.count({ where: { OR: [{ quizzes: { some: {} } }, { presentations: { some: {} } }] } }),
    // Distinct users who have hosted at least one game session.
    prisma.user.count({ where: { gameSessions: { some: {} } } }),
    // Per-host session counts → repeat hosts (>= 2) computed in JS.
    prisma.gameSession.groupBy({ by: ['userId'], _count: { _all: true }, where: { userId: { not: null } } }),
    prisma.gameSession.count({ where: { status: 'active', createdAt: { lt: oneDayAgo } } }),
    prisma.moderationFlag.count({ where: { status: 'open' } }),
    prisma.dataDeletionRequest.count({ where: { status: 'pending' } }),
    prisma.presentation.count(),
    prisma.presentation.count({ where: { createdAt: { gte: startOfMonth } } }),
  ])

  const usersSeries = dailyCounts(usersDaily, dayKeys)
  const quizzesSeries = dailyCounts(quizzesDaily, dayKeys)
  const sessionsSeries = dailyCounts(sessionsDaily, dayKeys)
  const repeatHosts = hostSessionCounts.filter(h => h._count._all >= 2).length

  return NextResponse.json({
    users: {
      total: totalUsers,
      thisMonth: usersThisMonth,
      thisWeek: usersThisWeek,
      today: usersToday,
      onboarded: onboardedCount,
      referrals: referralStats,
    },
    quizzes: {
      total: totalQuizzes,
      thisMonth: quizzesThisMonth,
    },
    presentations: {
      total: presentationsTotal,
      thisMonth: presentationsThisMonth,
    },
    sessions: {
      total: totalSessions,
      thisMonth: sessionsThisMonth,
    },
    trends: {
      days: dayKeys,
      users: usersSeries,
      quizzes: quizzesSeries,
      sessions: sessionsSeries,
    },
    deltas: {
      users: wowDelta(usersSeries),
      quizzes: wowDelta(quizzesSeries),
      sessions: wowDelta(sessionsSeries),
    },
    funnel: [
      { stage: 'Signed up', count: totalUsers },
      { stage: 'Onboarded', count: onboardedCount },
      { stage: 'Created content', count: createdContentUsers },
      { stage: 'Ran a live session', count: ranLiveUsers },
      { stage: 'Repeat host', count: repeatHosts },
    ],
    attention: {
      signedUpNeverCreated: Math.max(0, totalUsers - createdContentUsers),
      stuckSessions,
      openModeration,
      pendingDeletions,
    },
    subscriptions: {
      active: totalSubscriptions,
      byPlan: subscriptionsByPlan.map(s => ({ plan: s.plan, count: s._count })),
    },
    aiUsage: {
      total: totalAiUsage,
      thisMonth: aiUsageThisMonth,
    },
    breakdowns: {
      discovery: discoveryBreakdown.map(d => ({ channel: d.discoveryChannel, count: d._count })),
      roles: roleBreakdown.map(r => ({ role: r.role, count: r._count })),
    },
    recentUsers,
    recentSessions,
    topUsers: topUsersWithDetails,
  })
}
