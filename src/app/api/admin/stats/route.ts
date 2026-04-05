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
    sessions: {
      total: totalSessions,
      thisMonth: sessionsThisMonth,
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
