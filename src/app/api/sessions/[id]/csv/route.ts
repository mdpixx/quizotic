export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// GET /api/sessions/[id]/csv — download session as CSV (Pro only)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const plan = await getUserPlan(user.id)

    if (plan !== 'pro') {
      return NextResponse.json({ error: 'CSV export is not enabled on your account. Email info@quizotic.live if you need it — we review every request.' }, { status: 403 })
    }

    const { id } = await params
    const session = await prisma.gameSession.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const results = session.results as Record<string, unknown> | null
    if (!results) {
      return NextResponse.json({ error: 'No results available for this session' }, { status: 404 })
    }

    const quizTitle = (results.quizTitle as string) || 'Quiz Session'
    const questionCount = (results.questionCount as number) || 0
    const duration = (results.duration as number) || 0
    const questionStats = (results.questionStats as Array<Record<string, unknown>>) || []
    const leaderboard = (results.leaderboard as Array<Record<string, unknown>>) || []

    const lines: string[] = []

    // Header section
    lines.push('Session Report')
    lines.push(`Title,${escapeCsv(quizTitle)}`)
    lines.push(`Date,${session.createdAt.toISOString().split('T')[0]}`)
    lines.push(`Participants,${session.participantCount ?? 0}`)
    lines.push(`Questions,${questionCount}`)
    lines.push(`Duration (seconds),${duration}`)
    lines.push('')

    // Question stats section
    if (questionStats.length > 0) {
      lines.push('Question Stats')
      lines.push('Q#,Question,Correct %,Bloom\'s Level,Explanation')
      for (const stat of questionStats) {
        const idx = ((stat.index as number) ?? 0) + 1
        const text = escapeCsv((stat.text as string) || '')
        // correctPct is null for non-scored types (poll, word cloud, …) —
        // export N/A instead of a misleading 0%.
        const rawPct = stat.correctPct as number | null | undefined
        const correctPct = typeof rawPct === 'number' ? `${rawPct}%` : 'N/A'
        const blooms = (stat.bloomsLevel as string) || ''
        const explanation = escapeCsv((stat.explanation as string) || '')
        lines.push(`${idx},${text},${correctPct},${blooms},${explanation}`)
      }
      lines.push('')
    }

    // Leaderboard section
    if (leaderboard.length > 0) {
      lines.push('Leaderboard')
      lines.push('Rank,Name,Score,Team')
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i]
        const name = escapeCsv((entry.name as string) || 'Anonymous')
        const score = (entry.score as number) ?? 0
        const team = (entry.team as Record<string, unknown>)?.name as string || ''
        lines.push(`${i + 1},${name},${score},${escapeCsv(team)}`)
      }
    }

    // Attendance section
    const attendees = await prisma.attendee.findMany({
      where: { sessionId: id },
      orderBy: { joinedAt: 'asc' },
    })

    lines.push('')
    lines.push('Attendance')
    lines.push('Nickname,Email,Joined At,Left At,Duration (sec),Final Score,Team')
    for (const a of attendees) {
      const nickname = escapeCsv(a.nickname ?? '')
      const email = escapeCsv(a.email ?? '')
      const joinedAt = a.joinedAt ? a.joinedAt.toISOString() : ''
      const leftAt = a.leftAt ? a.leftAt.toISOString() : ''
      const duration = a.durationSec ?? ''
      const finalScore = a.finalScore ?? ''
      const team = escapeCsv(a.team ?? '')
      lines.push(`${nickname},${email},${joinedAt},${leftAt},${duration},${finalScore},${team}`)
    }

    const csv = lines.join('\n')
    const filename = `quizotic-${quizTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${session.createdAt.toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
