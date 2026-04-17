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
  maxScore?: number
  questionCount?: number
}

// Per-session max raw-point total. Falls back to questionCount * 1000 for legacy
// rows that were persisted before `maxScore` was added to results. Returns null
// when neither is derivable — caller should skip scoring for that session.
function deriveSessionMax(results: SessionResults): number | null {
  if (typeof results.maxScore === 'number' && results.maxScore > 0) return results.maxScore
  if (typeof results.questionCount === 'number' && results.questionCount > 0) return results.questionCount * 1000
  return null
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
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

  // Build participant stats from leaderboard entries across all sessions.
  // avgScore is a weighted % across sessions: sum(rawScore) / sum(sessionMax) * 100.
  const participantMap = new Map<
    string,
    {
      name: string
      archetype: string | undefined
      sessions: number
      totalRawScore: number
      totalMaxScore: number
      lastSeen: string
      scores: number[]
    }
  >()

  for (const s of sessions) {
    const results = s.results as SessionResults | null
    if (!results?.leaderboard) continue
    const sessionMax = deriveSessionMax(results)

    for (const entry of results.leaderboard) {
      const key = entry.name.toLowerCase().trim()
      const existing = participantMap.get(key) ?? {
        name: entry.name,
        archetype: entry.archetype,
        sessions: 0,
        totalRawScore: 0,
        totalMaxScore: 0,
        lastSeen: s.createdAt.toISOString(),
        scores: [],
      }

      existing.sessions++
      if (entry.score != null && sessionMax != null) {
        existing.totalRawScore += entry.score
        existing.totalMaxScore += sessionMax
        existing.scores.push(clampPct((entry.score / sessionMax) * 100))
      }
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
      avgScore: p.totalMaxScore > 0 ? clampPct((p.totalRawScore / p.totalMaxScore) * 100) : null,
      lastSeen: p.lastSeen,
      scores: p.scores.slice(-5),
    }))
    .sort((a, b) => b.sessions - a.sessions)

  return NextResponse.json({ participants })
}
