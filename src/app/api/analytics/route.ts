import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import {
  buildLearningPulse,
  buildSupportLearners,
  extractTeachingTopic,
  resolveDashboardRange,
  selectNextScheduled,
  summarizeLearningPeriod,
  type ConfidenceGridLike,
  type DashboardSessionLike,
  type DashboardSessionResults,
} from '@/lib/dashboard-insights'
import { prisma } from '@/lib/prisma'

const BLOOMS_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create']

interface AnalyticsSession extends DashboardSessionLike {
  type: string
  quizId: string | null
  presentationId: string | null
  endedAt: Date | null
  quiz: { id: string; title: string } | null
  presentation: { id: string; title: string } | null
}

function asResults(value: unknown): DashboardSessionResults | null {
  return value && typeof value === 'object' ? value as DashboardSessionResults : null
}

function emptyConfidenceGrid(): ConfidenceGridLike {
  return { sureCorrect: 0, sureWrong: 0, unsureCorrect: 0, unsureWrong: 0 }
}

function aggregateConfidence(sessions: AnalyticsSession[]): ConfidenceGridLike {
  const total = emptyConfidenceGrid()
  for (const session of sessions) {
    for (const question of session.results?.questionStats ?? []) {
      const grid = question.confidenceGrid
      if (!grid) continue
      total.sureCorrect += grid.sureCorrect ?? 0
      total.sureWrong += grid.sureWrong ?? 0
      total.unsureCorrect += grid.unsureCorrect ?? 0
      total.unsureWrong += grid.unsureWrong ?? 0
    }
  }
  return total
}

// Session buckets use IST because Quizotic's hosts primarily teach in India.
function istDateKey(date: Date): string {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function sessionAccuracy(results: DashboardSessionResults | null): number | null {
  const questions = (results?.questionStats ?? []).filter(
    question => typeof question.correctPct === 'number',
  )
  if (questions.length === 0) return null
  return questions.reduce((sum, question) => sum + (question.correctPct ?? 0), 0) / questions.length
}

function sessionCompletion(session: AnalyticsSession): number | null {
  if (!session.participantCount || !session.results?.leaderboard) return null
  return (session.results.leaderboard.length / session.participantCount) * 100
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const range = resolveDashboardRange(searchParams.get('range'))
  const now = new Date()
  const currentSince = new Date(now.getTime() - range * 24 * 60 * 60 * 1000)
  const previousSince = new Date(now.getTime() - range * 2 * 24 * 60 * 60 * 1000)
  const userId = session.user.id

  const [historyRows, presentationCount, recentQuizzes, recentPresentations, scheduledRows] = await Promise.all([
    prisma.gameSession.findMany({
      where: { userId, createdAt: { gte: previousSince } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        quizId: true,
        presentationId: true,
        status: true,
        participantCount: true,
        results: true,
        createdAt: true,
        endedAt: true,
        quiz: { select: { id: true, title: true } },
        presentation: { select: { id: true, title: true } },
      },
    }),
    prisma.presentation.count({ where: { userId } }),
    prisma.quiz.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 2,
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.presentation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 2,
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.gameSession.findMany({
      where: {
        userId,
        mode: 'async',
        status: 'open',
        OR: [{ closesAt: null }, { closesAt: { gte: now } }],
      },
      orderBy: { opensAt: 'asc' },
      take: 20,
      select: {
        id: true,
        quizId: true,
        shareSlug: true,
        status: true,
        opensAt: true,
        closesAt: true,
        participantCount: true,
        quizVersion: { select: { title: true, questionCount: true } },
      },
    }),
  ])

  const allSessions: AnalyticsSession[] = historyRows.map(row => ({
    ...row,
    results: asResults(row.results),
  }))
  const currentSessions = allSessions.filter(item => item.createdAt >= currentSince)
  const previousSessions = allSessions.filter(
    item => item.createdAt >= previousSince && item.createdAt < currentSince,
  )

  const currentPeriod = summarizeLearningPeriod(currentSessions)
  const previousPeriod = summarizeLearningPeriod(previousSessions)
  const learningPulse = buildLearningPulse(currentPeriod, previousPeriod)
  const confidenceGrid = aggregateConfidence(currentSessions)
  const supportLearners = buildSupportLearners(currentSessions)

  const recentSessions = currentSessions.slice(0, 8).map(item => ({
    id: item.id,
    contentId: item.quizId ?? item.presentationId,
    type: item.type,
    title: item.quiz?.title ?? item.presentation?.title ?? item.results?.quizTitle ?? 'Untitled',
    date: item.createdAt.toISOString(),
    participants: item.participantCount ?? 0,
    avgScore: sessionAccuracy(item.results) === null ? null : Math.round(sessionAccuracy(item.results) ?? 0),
    completionPct: sessionCompletion(item) === null ? null : Math.round(sessionCompletion(item) ?? 0),
    duration: item.results?.duration ?? null,
    status: item.status,
  }))

  const trendMap = new Map<string, {
    sessions: number
    participants: number
    accuracyTotal: number
    accuracyCount: number
    completionTotal: number
    completionCount: number
  }>()
  for (const item of [...currentSessions].reverse()) {
    if (item.status !== 'ended') continue
    const day = istDateKey(item.endedAt ?? item.createdAt)
    const bucket = trendMap.get(day) ?? {
      sessions: 0,
      participants: 0,
      accuracyTotal: 0,
      accuracyCount: 0,
      completionTotal: 0,
      completionCount: 0,
    }
    bucket.sessions++
    bucket.participants += item.participantCount ?? 0
    const accuracy = sessionAccuracy(item.results)
    if (accuracy !== null) {
      bucket.accuracyTotal += accuracy
      bucket.accuracyCount++
    }
    const completion = sessionCompletion(item)
    if (completion !== null) {
      bucket.completionTotal += completion
      bucket.completionCount++
    }
    trendMap.set(day, bucket)
  }
  const trend = Array.from(trendMap.entries()).map(([date, bucket]) => ({
    date,
    sessions: bucket.sessions,
    participants: bucket.participants,
    avgScore: bucket.accuracyCount > 0 ? Math.round(bucket.accuracyTotal / bucket.accuracyCount) : null,
    completionRate: bucket.completionCount > 0
      ? Math.round(bucket.completionTotal / bucket.completionCount)
      : null,
  }))

  const quizMap = new Map<string, {
    title: string
    sessions: number
    scoreTotal: number
    scoreCount: number
    participants: number
  }>()
  for (const item of currentSessions) {
    if (item.type !== 'quiz' || !item.quizId) continue
    const existing = quizMap.get(item.quizId) ?? {
      title: item.quiz?.title ?? 'Untitled',
      sessions: 0,
      scoreTotal: 0,
      scoreCount: 0,
      participants: 0,
    }
    existing.sessions++
    existing.participants += item.participantCount ?? 0
    const accuracy = sessionAccuracy(item.results)
    if (accuracy !== null) {
      existing.scoreTotal += accuracy
      existing.scoreCount++
    }
    quizMap.set(item.quizId, existing)
  }
  const topQuizzes = Array.from(quizMap.entries())
    .map(([id, item]) => ({
      id,
      title: item.title,
      sessions: item.sessions,
      participants: item.participants,
      avgScore: item.scoreCount > 0 ? Math.round(item.scoreTotal / item.scoreCount) : null,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5)

  // Kept for backwards compatibility with consumers of the original response.
  const topParticipants = supportLearners.map(item => ({
    name: item.name,
    archetype: item.archetype,
    sessions: item.sessions,
    avgScore: item.latestScore,
    scoreChange: item.change,
    scores: item.scores,
    atRisk: true,
  }))

  const bloomsMap = new Map<string, number>(BLOOMS_LEVELS.map(level => [level, 0]))
  const bloomsMastery = new Map<string, { total: number; count: number }>(
    BLOOMS_LEVELS.map(level => [level, { total: 0, count: 0 }]),
  )
  for (const item of currentSessions) {
    for (const question of item.results?.questionStats ?? []) {
      if (!question.bloomsLevel) continue
      const level = BLOOMS_LEVELS.find(
        candidate => candidate.toLowerCase() === question.bloomsLevel?.toLowerCase(),
      )
      if (!level) continue
      bloomsMap.set(level, (bloomsMap.get(level) ?? 0) + 1)
      if (typeof question.correctPct === 'number') {
        const mastery = bloomsMastery.get(level) ?? { total: 0, count: 0 }
        mastery.total += question.correctPct
        mastery.count++
        bloomsMastery.set(level, mastery)
      }
    }
  }
  const bloomsCoverage = BLOOMS_LEVELS.map(level => ({ level, count: bloomsMap.get(level) ?? 0 }))
  const bloomsMasteryResult = BLOOMS_LEVELS.map(level => {
    const mastery = bloomsMastery.get(level) ?? { total: 0, count: 0 }
    return {
      level,
      mastery: mastery.count > 0 ? Math.round(mastery.total / mastery.count) : null,
      questionCount: mastery.count,
    }
  })

  const engagementTrend = currentSessions
    .filter(item => item.type === 'quiz')
    .slice(0, 10)
    .reverse()
    .map(item => {
      const grids = (item.results?.questionStats ?? [])
        .map(question => question.confidenceGrid)
        .filter((grid): grid is ConfidenceGridLike => Boolean(grid))
      const totalResponses = grids.reduce(
        (sum, grid) => sum + grid.sureCorrect + grid.sureWrong + grid.unsureCorrect + grid.unsureWrong,
        0,
      )
      const sureResponses = grids.reduce((sum, grid) => sum + grid.sureCorrect + grid.sureWrong, 0)
      const completion = sessionCompletion(item)
      return {
        date: istDateKey(item.createdAt),
        label: item.createdAt.toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
        }),
        completionPct: completion === null ? 0 : Math.round(completion),
        confidencePct: totalResponses > 0 ? Math.round((sureResponses / totalResponses) * 100) : null,
      }
    })

  let recentQuestionDifficulty: {
    sessionId: string
    sessionTitle: string
    questions: Array<{ index: number; text: string; correctPct: number; bloomsLevel: string | null }>
  } | null = null
  let teachingBriefConfidence = emptyConfidenceGrid()
  let misconceptionQuestionCount = 0
  for (const item of currentSessions) {
    if (item.type !== 'quiz' || !item.results?.questionStats?.length) continue
    const questions = item.results.questionStats
      .filter(question => typeof question.correctPct === 'number')
      .map(question => ({
        index: question.index ?? 0,
        text: question.text ?? `Question ${(question.index ?? 0) + 1}`,
        correctPct: question.correctPct ?? 0,
        bloomsLevel: question.bloomsLevel ?? null,
      }))
    if (questions.length === 0) continue
    recentQuestionDifficulty = {
      sessionId: item.id,
      sessionTitle: item.quiz?.title ?? item.results.quizTitle ?? 'Recent quiz',
      questions,
    }
    teachingBriefConfidence = aggregateConfidence([item])
    misconceptionQuestionCount = (item.results.questionStats ?? [])
      .filter(question => (question.confidenceGrid?.sureWrong ?? 0) > 0)
      .length
    break
  }

  const hardQuestions = (recentQuestionDifficulty?.questions ?? []).filter(question => question.correctPct < 50)
  const weakestQuestion = [...(recentQuestionDifficulty?.questions ?? [])]
    .sort((a, b) => a.correctPct - b.correctPct)[0]
  const confidenceResponseTotal = teachingBriefConfidence.sureCorrect + teachingBriefConfidence.sureWrong
    + teachingBriefConfidence.unsureCorrect + teachingBriefConfidence.unsureWrong
  const confidentlyWrongPct = confidenceResponseTotal > 0
    ? Math.round((teachingBriefConfidence.sureWrong / confidenceResponseTotal) * 100)
    : null
  const teachingBrief = recentQuestionDifficulty && weakestQuestion
    ? {
        sessionId: recentQuestionDifficulty.sessionId,
        sessionTitle: recentQuestionDifficulty.sessionTitle,
        topic: extractTeachingTopic(weakestQuestion.text, recentQuestionDifficulty.sessionTitle),
        tone: hardQuestions.length > 0 ? 'attention' as const : 'positive' as const,
        hardQuestionCount: hardQuestions.length,
        confidentlyWrongPct,
        confidentlyWrongCount: teachingBriefConfidence.sureWrong,
        misconceptionQuestionCount,
        supportLearnerCount: supportLearners.length,
        weakestQuestion,
      }
    : null

  const scheduledCandidates = scheduledRows.map(item => ({
    sessionId: item.id,
    quizId: item.quizId,
    title: item.quizVersion?.title ?? 'Scheduled quiz',
    questionCount: item.quizVersion?.questionCount ?? 0,
    shareSlug: item.shareSlug,
    phase: item.opensAt && item.opensAt > now ? 'upcoming' as const : 'open' as const,
    opensAt: item.opensAt?.toISOString() ?? null,
    closesAt: item.closesAt?.toISOString() ?? null,
    participantCount: item.participantCount ?? 0,
  }))
  const nextScheduled = selectNextScheduled(scheduledCandidates, now)

  const recentContent = [
    ...recentQuizzes.map(item => ({
      id: item.id,
      type: 'quiz' as const,
      title: item.title,
      updatedAt: item.updatedAt.toISOString(),
    })),
    ...recentPresentations.map(item => ({
      id: item.id,
      type: 'presentation' as const,
      title: item.title,
      updatedAt: item.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 2)

  return NextResponse.json({
    range,
    summary: {
      totalSessions: currentSessions.length,
      totalParticipants: currentPeriod.learnerReach,
      avgScore: currentPeriod.accuracy,
      completionRate: currentPeriod.completion,
      presentationCount,
      presentationSessionCount: currentSessions.filter(item => item.presentationId !== null).length,
    },
    learningPulse,
    trend,
    recentSessions,
    confidenceGrid,
    topQuizzes,
    topParticipants,
    supportLearners,
    bloomsCoverage,
    bloomsMastery: bloomsMasteryResult,
    engagementTrend,
    recentQuestionDifficulty,
    teachingBrief,
    recentContent,
    nextScheduled,
    scheduleCount: scheduledCandidates.length,
  })
}
