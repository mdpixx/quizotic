import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface LeaderboardEntry {
  name: string
  archetype?: string
  score: number
  team?: string
}

interface SessionResults {
  leaderboard?: LeaderboardEntry[]
  quizTitle?: string
  duration?: number
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await prisma.gameSession.findMany({
    where: { userId: session.user.id, type: 'quiz' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, results: true, createdAt: true },
  })

  // Build participant stats from leaderboard entries across all sessions
  const participantMap = new Map<
    string,
    {
      name: string
      archetype: string | undefined
      sessions: number
      totalScore: number
      scoreCount: number
      lastSeen: string
      scores: number[]
    }
  >()

  for (const s of sessions) {
    const results = s.results as SessionResults | null
    if (!results?.leaderboard) continue

    for (const entry of results.leaderboard) {
      const key = entry.name.toLowerCase().trim()
      const existing = participantMap.get(key) ?? {
        name: entry.name,
        archetype: entry.archetype,
        sessions: 0,
        totalScore: 0,
        scoreCount: 0,
        lastSeen: s.createdAt.toISOString(),
        scores: [],
      }

      existing.sessions++
      if (entry.score != null) {
        existing.totalScore += entry.score
        existing.scoreCount++
        existing.scores.push(entry.score)
      }
      // Keep most recent session date
      if (s.createdAt.toISOString() > existing.lastSeen) {
        existing.lastSeen = s.createdAt.toISOString()
      }

      participantMap.set(key, existing)
    }
  }

  const participants = Array.from(participantMap.values())
    .map(p => ({
      name: p.name,
      archetype: p.archetype,
      sessions: p.sessions,
      avgScore: p.scoreCount > 0 ? Math.round(p.totalScore / p.scoreCount) : null,
      lastSeen: p.lastSeen,
      scores: p.scores.slice(-5), // last 5 scores for sparkline
    }))
    .sort((a, b) => b.sessions - a.sessions)

  return NextResponse.json({ participants })
}
