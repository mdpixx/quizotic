export type DashboardRange = 30 | 90 | 365

export interface ConfidenceGridLike {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}

export interface DashboardQuestionStat {
  index?: number
  text?: string
  correctPct?: number
  confidenceGrid?: ConfidenceGridLike
  bloomsLevel?: string | null
}

export interface DashboardLeaderboardEntry {
  name: string
  archetype?: string
  score: number
}

export interface DashboardSessionResults {
  leaderboard?: DashboardLeaderboardEntry[]
  questionStats?: DashboardQuestionStat[]
  duration?: number
  quizTitle?: string
  questionCount?: number
  maxScore?: number
}

export interface DashboardSessionLike {
  id: string
  createdAt: Date
  status: string
  participantCount: number | null
  results: DashboardSessionResults | null
}

export interface LearningPeriodSummary {
  learnerReach: number
  accuracy: number | null
  completion: number | null
  confidence: number | null
}

export interface PulseMetric {
  value: number | null
  previous: number | null
  delta: number | null
  deltaKind: 'percent' | 'points'
}

export interface LearningPulse {
  learnerReach: PulseMetric
  accuracy: PulseMetric
  completion: PulseMetric
  confidence: PulseMetric
}

export interface SupportLearner {
  name: string
  archetype?: string
  sessions: number
  latestScore: number
  change: number
  scores: number[]
  reason: 'declining' | 'low_accuracy' | 'low_and_declining'
}

export interface ScheduledCandidate {
  sessionId: string
  phase: 'upcoming' | 'open' | 'ended'
  opensAt: string | null
}

const SUPPORTED_RANGES = new Set<DashboardRange>([30, 90, 365])

export function resolveDashboardRange(raw: string | null): DashboardRange {
  const parsed = Number(raw)
  return SUPPORTED_RANGES.has(parsed as DashboardRange) ? parsed as DashboardRange : 30
}

function roundOrNull(total: number, count: number): number | null {
  return count > 0 ? Math.round(total / count) : null
}

export function summarizeLearningPeriod(sessions: DashboardSessionLike[]): LearningPeriodSummary {
  let accuracyTotal = 0
  let accuracyCount = 0
  let completionTotal = 0
  let completionCount = 0
  let sureResponses = 0
  let allConfidenceResponses = 0

  for (const session of sessions) {
    const results = session.results
    if (!results) continue

    const scoredQuestions = (results.questionStats ?? []).filter(
      question => typeof question.correctPct === 'number',
    )
    if (scoredQuestions.length > 0) {
      accuracyTotal += scoredQuestions.reduce((sum, question) => sum + (question.correctPct ?? 0), 0)
        / scoredQuestions.length
      accuracyCount++
    }

    if ((session.participantCount ?? 0) > 0 && results.leaderboard) {
      completionTotal += (results.leaderboard.length / (session.participantCount ?? 1)) * 100
      completionCount++
    }

    for (const question of results.questionStats ?? []) {
      const grid = question.confidenceGrid
      if (!grid) continue
      sureResponses += grid.sureCorrect + grid.sureWrong
      allConfidenceResponses += grid.sureCorrect + grid.sureWrong + grid.unsureCorrect + grid.unsureWrong
    }
  }

  return {
    learnerReach: sessions.reduce((sum, session) => sum + (session.participantCount ?? 0), 0),
    accuracy: roundOrNull(accuracyTotal, accuracyCount),
    completion: roundOrNull(completionTotal, completionCount),
    confidence: allConfidenceResponses > 0
      ? Math.round((sureResponses / allConfidenceResponses) * 100)
      : null,
  }
}

function pointMetric(current: number | null, previous: number | null): PulseMetric {
  return {
    value: current,
    previous,
    delta: current !== null && previous !== null ? current - previous : null,
    deltaKind: 'points',
  }
}

export function buildLearningPulse(
  current: LearningPeriodSummary,
  previous: LearningPeriodSummary,
): LearningPulse {
  return {
    learnerReach: {
      value: current.learnerReach,
      previous: previous.learnerReach,
      delta: previous.learnerReach > 0
        ? Math.round(((current.learnerReach - previous.learnerReach) / previous.learnerReach) * 100)
        : null,
      deltaKind: 'percent',
    },
    accuracy: pointMetric(current.accuracy, previous.accuracy),
    completion: pointMetric(current.completion, previous.completion),
    confidence: pointMetric(current.confidence, previous.confidence),
  }
}

function sentenceCase(value: string): string {
  const trimmed = value.trim().replace(/[?.!]+$/, '')
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed
}

export function extractTeachingTopic(questionText: string, fallbackTitle: string): string {
  const normalized = questionText.trim().replace(/[?.!]+$/, '')
  const definition = normalized.match(/^what does (.+?) mean(?:\s+in\b.*)?$/i)
  if (definition?.[1]) return sentenceCase(definition[1])

  const identity = normalized.match(/^what (?:is|are) (?:an?\s+|the\s+)?(.+?)(?:\s+in\b.*)?$/i)
  if (identity?.[1]) return sentenceCase(identity[1])

  return fallbackTitle.trim() || 'This topic'
}

function deriveSessionMax(results: DashboardSessionResults): number | null {
  if (typeof results.maxScore === 'number' && results.maxScore > 0) return results.maxScore
  if (typeof results.questionCount === 'number' && results.questionCount > 0) {
    return results.questionCount * 1000
  }
  return null
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function buildSupportLearners(sessions: DashboardSessionLike[]): SupportLearner[] {
  const learnerMap = new Map<string, {
    name: string
    archetype?: string
    sessions: number
    scores: number[]
  }>()

  const chronological = [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  for (const session of chronological) {
    const results = session.results
    if (!results?.leaderboard) continue
    const sessionMax = deriveSessionMax(results)
    if (!sessionMax) continue

    for (const entry of results.leaderboard) {
      const key = entry.name.toLowerCase().trim()
      const learner = learnerMap.get(key) ?? {
        name: entry.name,
        archetype: entry.archetype,
        sessions: 0,
        scores: [],
      }
      const score = clampPercentage((entry.score / sessionMax) * 100)
      learnerMap.set(key, {
        ...learner,
        name: entry.name,
        archetype: entry.archetype ?? learner.archetype,
        sessions: learner.sessions + 1,
        scores: [...learner.scores, score],
      })
    }
  }

  return Array.from(learnerMap.values())
    .filter(learner => learner.scores.length >= 2)
    .map(learner => {
      const previous = learner.scores[learner.scores.length - 2]
      const latest = learner.scores[learner.scores.length - 1]
      const change = latest - previous
      const lowAccuracy = previous < 50 && latest < 50
      const declining = change <= -10
      if (!lowAccuracy && !declining) return null
      return {
        ...learner,
        latestScore: latest,
        change,
        scores: learner.scores.slice(-5),
        reason: lowAccuracy && declining
          ? 'low_and_declining' as const
          : lowAccuracy ? 'low_accuracy' as const : 'declining' as const,
      }
    })
    .filter((learner): learner is SupportLearner => learner !== null)
    .sort((a, b) => {
      const priority = { low_and_declining: 0, low_accuracy: 1, declining: 2 }
      return priority[a.reason] - priority[b.reason]
        || a.latestScore - b.latestScore
        || a.change - b.change
    })
    .slice(0, 4)
}

export function selectNextScheduled<T extends ScheduledCandidate>(
  sessions: T[],
  now = new Date(),
): T | null {
  const open = sessions.find(session => session.phase === 'open')
  if (open) return open

  return [...sessions]
    .filter(session => session.phase === 'upcoming' && session.opensAt && new Date(session.opensAt) > now)
    .sort((a, b) => new Date(a.opensAt ?? 0).getTime() - new Date(b.opensAt ?? 0).getTime())[0]
    ?? null
}
