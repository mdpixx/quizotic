import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ConfidenceGrid {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}

interface QuestionStat {
  index?: number
  text?: string
  correctPct?: number
  confidenceGrid?: ConfidenceGrid
  bloomsLevel?: string | null
}

interface LeaderboardEntry {
  name: string
  archetype?: string
  score: number
}

interface SessionResults {
  leaderboard?: LeaderboardEntry[]
  questionStats?: QuestionStat[]
  duration?: number
  quizTitle?: string
  questionCount?: number
}

const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create']

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const range = parseInt(searchParams.get('range') ?? '90')
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000)
  const userId = session.user.id

  const [presentationCount, presentationSessionCount] = await Promise.all([
    prisma.presentation.count({ where: { userId } }),
    prisma.gameSession.count({
      where: { userId, presentationId: { not: null }, createdAt: { gte: since } },
    }),
  ])

  const sessions = await prisma.gameSession.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: {
      quiz: { select: { id: true, title: true } },
      presentation: { select: { id: true, title: true } },
    },
  })

  // ── Summary ───────────────────────────────────────────────────────────────────
  const totalSessions = sessions.length
  const totalParticipants = sessions.reduce((s, r) => s + (r.participantCount ?? 0), 0)

  let scoreSum = 0, scoreCount = 0, completionSum = 0, completionCount = 0
  const confidenceGrid: ConfidenceGrid = { sureCorrect: 0, sureWrong: 0, unsureCorrect: 0, unsureWrong: 0 }

  for (const s of sessions) {
    const results = s.results as SessionResults | null
    if (!results) continue
    // Use correctPct from questionStats for accuracy-based avgScore (0–100 scale)
    if (results.questionStats?.length) {
      const scoredQs = results.questionStats.filter(qs => typeof qs.correctPct === 'number' && qs.correctPct != null)
      if (scoredQs.length > 0) {
        const sessionAccuracy = scoredQs.reduce((sum, q) => sum + (q.correctPct ?? 0), 0) / scoredQs.length
        scoreSum += sessionAccuracy; scoreCount++
      }
    }
    if (s.participantCount && results.leaderboard) {
      completionSum += (results.leaderboard.length / s.participantCount) * 100
      completionCount++
    }
    if (results.questionStats) {
      for (const qs of results.questionStats) {
        if (qs.confidenceGrid) {
          confidenceGrid.sureCorrect += qs.confidenceGrid.sureCorrect ?? 0
          confidenceGrid.sureWrong += qs.confidenceGrid.sureWrong ?? 0
          confidenceGrid.unsureCorrect += qs.confidenceGrid.unsureCorrect ?? 0
          confidenceGrid.unsureWrong += qs.confidenceGrid.unsureWrong ?? 0
        }
      }
    }
  }

  const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null
  const completionRate = completionCount > 0 ? Math.round(completionSum / completionCount) : null

  // ── Performance trend (by day) ────────────────────────────────────────────────
  const trendMap = new Map<string, { sessions: number; scoreSum: number; scoreCount: number; participants: number }>()
  for (const s of [...sessions].reverse()) {
    const day = s.createdAt.toISOString().slice(0, 10)
    const e = trendMap.get(day) ?? { sessions: 0, scoreSum: 0, scoreCount: 0, participants: 0 }
    e.sessions++; e.participants += s.participantCount ?? 0
    const results = s.results as SessionResults | null
    if (results?.questionStats?.length) {
      const scoredQs = results.questionStats.filter(qs => typeof qs.correctPct === 'number' && qs.correctPct != null)
      if (scoredQs.length > 0) {
        const accuracy = scoredQs.reduce((sum, q) => sum + (q.correctPct ?? 0), 0) / scoredQs.length
        e.scoreSum += accuracy; e.scoreCount++
      }
    }
    trendMap.set(day, e)
  }
  const trend = Array.from(trendMap.entries()).map(([date, d]) => ({
    date, sessions: d.sessions, participants: d.participants,
    avgScore: d.scoreCount > 0 ? Math.round(d.scoreSum / d.scoreCount) : null,
  }))

  // ── Recent sessions ───────────────────────────────────────────────────────────
  const recentSessions = sessions.slice(0, 8).map((s) => {
    const results = s.results as SessionResults | null
    const lboard = results?.leaderboard ?? []
    const scoredQs = (results?.questionStats ?? []).filter(qs => typeof qs.correctPct === 'number' && qs.correctPct != null)
    const sessionAvgScore = scoredQs.length > 0
      ? Math.round(scoredQs.reduce((sum, q) => sum + (q.correctPct ?? 0), 0) / scoredQs.length) : null
    const completionPct = s.participantCount && lboard.length
      ? Math.round((lboard.length / s.participantCount) * 100) : null
    return {
      id: s.id, type: s.type,
      title: s.quiz?.title ?? s.presentation?.title ?? results?.quizTitle ?? 'Untitled',
      date: s.createdAt.toISOString(),
      participants: s.participantCount ?? 0,
      avgScore: sessionAvgScore,
      completionPct,
      duration: results?.duration ?? null,
      status: s.status,
    }
  })

  // ── Top quizzes ───────────────────────────────────────────────────────────────
  const quizMap = new Map<string, { title: string; sessions: number; scoreSum: number; scoreCount: number; participants: number }>()
  for (const s of sessions) {
    if (s.type !== 'quiz' || !s.quizId) continue
    const title = s.quiz?.title ?? 'Untitled'
    const e = quizMap.get(s.quizId) ?? { title, sessions: 0, scoreSum: 0, scoreCount: 0, participants: 0 }
    e.sessions++; e.participants += s.participantCount ?? 0
    const results = s.results as SessionResults | null
    if (results?.questionStats?.length) {
      const scoredQs = results.questionStats.filter(qs => typeof qs.correctPct === 'number' && qs.correctPct != null)
      if (scoredQs.length > 0) {
        const accuracy = scoredQs.reduce((sum, q) => sum + (q.correctPct ?? 0), 0) / scoredQs.length
        e.scoreSum += accuracy; e.scoreCount++
      }
    }
    quizMap.set(s.quizId, e)
  }
  const topQuizzes = Array.from(quizMap.entries())
    .map(([id, d]) => ({ id, title: d.title, sessions: d.sessions, participants: d.participants,
      avgScore: d.scoreCount > 0 ? Math.round(d.scoreSum / d.scoreCount) : null }))
    .sort((a, b) => b.sessions - a.sessions).slice(0, 5)

  // ── Top participants ──────────────────────────────────────────────────────────
  // Track each participant's scores per session (most recent first)
  const participantMap = new Map<string, {
    name: string; archetype?: string; sessionCount: number
    scores: number[]  // chronological, oldest first
  }>()

  for (const s of [...sessions].reverse()) {  // oldest first for chronological scores
    const results = s.results as SessionResults | null
    if (!results?.leaderboard) continue
    for (const entry of results.leaderboard) {
      const key = entry.name.toLowerCase().trim()
      const e = participantMap.get(key) ?? { name: entry.name, archetype: entry.archetype, sessionCount: 0, scores: [] }
      e.sessionCount++
      if (entry.score != null) e.scores.push(entry.score)
      participantMap.set(key, e)
    }
  }

  const topParticipants = Array.from(participantMap.values())
    .filter(p => p.scores.length > 0)
    .map(p => {
      const avgPScore = Math.round(p.scores.reduce((s, v) => s + v, 0) / p.scores.length)
      const recent = p.scores.slice(-2)
      const scoreChange = recent.length >= 2 ? recent[1] - recent[0] : null
      const lastTwo = p.scores.slice(-2)
      // atRisk: scored below 1000 pts twice in a row (< 1 correct answer equivalent in a standard quiz)
      const atRisk = lastTwo.length >= 2 && lastTwo.every(s => s < 1000)
      return {
        name: p.name, archetype: p.archetype,
        sessions: p.sessionCount,
        avgScore: avgPScore,
        scoreChange,
        scores: p.scores.slice(-5),  // last 5 for sparkline
        atRisk,
      }
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5)

  // ── Bloom's coverage ──────────────────────────────────────────────────────────
  const bloomsMap = new Map<string, number>(BLOOMS_LEVELS.map(l => [l, 0]))
  for (const s of sessions) {
    const results = s.results as SessionResults | null
    if (!results?.questionStats) continue
    for (const qs of results.questionStats) {
      if (qs.bloomsLevel) {
        const level = BLOOMS_LEVELS.find(l => l.toLowerCase() === qs.bloomsLevel!.toLowerCase())
        if (level) bloomsMap.set(level, (bloomsMap.get(level) ?? 0) + 1)
      }
    }
  }
  const bloomsCoverage = BLOOMS_LEVELS.map(level => ({ level, count: bloomsMap.get(level) ?? 0 }))

  // ── Engagement trend (per session, last 10 quiz sessions) ─────────────────────
  const engagementTrend = sessions
    .filter(s => s.type === 'quiz')
    .slice(0, 10)
    .reverse()
    .map(s => {
      const results = s.results as SessionResults | null
      const lboard = results?.leaderboard ?? []
      const completionPct = s.participantCount && lboard.length
        ? Math.round((lboard.length / s.participantCount) * 100) : 0
      // Confidence %: sure responses / total responses
      let totalResponses = 0, sureResponses = 0
      if (results?.questionStats) {
        for (const qs of results.questionStats) {
          if (qs.confidenceGrid) {
            const t = (qs.confidenceGrid.sureCorrect + qs.confidenceGrid.sureWrong +
              qs.confidenceGrid.unsureCorrect + qs.confidenceGrid.unsureWrong)
            const sure = qs.confidenceGrid.sureCorrect + qs.confidenceGrid.sureWrong
            totalResponses += t; sureResponses += sure
          }
        }
      }
      const confidencePct = totalResponses > 0 ? Math.round((sureResponses / totalResponses) * 100) : null
      return {
        date: s.createdAt.toISOString().slice(0, 10),
        label: new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        completionPct,
        confidencePct,
      }
    })

  // ── Question difficulty (most recent quiz session with stats) ─────────────────
  let recentQuestionDifficulty: {
    sessionTitle: string
    questions: Array<{ index: number; text: string; correctPct: number; bloomsLevel: string | null }>
  } | null = null

  for (const s of sessions) {
    if (s.type !== 'quiz') continue
    const results = s.results as SessionResults | null
    if (!results?.questionStats?.length) continue
    recentQuestionDifficulty = {
      sessionTitle: s.quiz?.title ?? results.quizTitle ?? 'Recent Quiz',
      questions: results.questionStats
        .filter(qs => qs.correctPct != null)
        .map(qs => ({
          index: qs.index ?? 0,
          text: qs.text ?? `Question ${(qs.index ?? 0) + 1}`,
          correctPct: qs.correctPct ?? 0,
          bloomsLevel: qs.bloomsLevel ?? null,
        })),
    }
    break
  }

  return NextResponse.json({
    summary: { totalSessions, totalParticipants, avgScore, completionRate, presentationCount, presentationSessionCount },
    trend,
    recentSessions,
    confidenceGrid,
    topQuizzes,
    topParticipants,
    bloomsCoverage,
    engagementTrend,
    recentQuestionDifficulty,
  })
}
