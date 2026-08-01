import { describe, expect, it } from 'vitest'

import {
  buildLearningPulse,
  buildSupportLearners,
  extractTeachingTopic,
  resolveDashboardRange,
  selectNextScheduled,
  summarizeLearningPeriod,
} from '@/lib/dashboard-insights'

function session({
  date,
  participants = 10,
  scores = [600, 700],
  maxScore = 1000,
  correct = [60, 80],
  confidence = { sureCorrect: 6, sureWrong: 2, unsureCorrect: 1, unsureWrong: 1 },
}: {
  date: string
  participants?: number
  scores?: number[]
  maxScore?: number
  correct?: number[]
  confidence?: { sureCorrect: number; sureWrong: number; unsureCorrect: number; unsureWrong: number }
}) {
  return {
    id: `session-${date}`,
    createdAt: new Date(date),
    status: 'ended',
    participantCount: participants,
    results: {
      maxScore,
      questionCount: Math.max(1, correct.length),
      leaderboard: scores.map((score, index) => ({ name: index === 0 ? 'Asha' : 'Ravi', score })),
      questionStats: correct.map((correctPct, index) => ({
        index,
        text: `Question ${index + 1}`,
        correctPct,
        confidenceGrid: confidence,
      })),
    },
  }
}

describe('dashboard range', () => {
  it('defaults missing, malformed, and unsupported values to 30 days', () => {
    expect(resolveDashboardRange(null)).toBe(30)
    expect(resolveDashboardRange('abc')).toBe(30)
    expect(resolveDashboardRange('60')).toBe(30)
  })

  it('accepts only the supported dashboard ranges', () => {
    expect(resolveDashboardRange('30')).toBe(30)
    expect(resolveDashboardRange('90')).toBe(90)
    expect(resolveDashboardRange('365')).toBe(365)
  })
})

describe('learning pulse', () => {
  it('uses confident responses as the confidence denominator', () => {
    const summary = summarizeLearningPeriod([
      session({ date: '2026-07-30T10:00:00Z' }),
    ])

    expect(summary).toMatchObject({
      learnerReach: 10,
      accuracy: 70,
      completion: 20,
      confidence: 80,
    })
  })

  it('returns percentage change for reach and point changes for rates', () => {
    const pulse = buildLearningPulse(
      { learnerReach: 120, accuracy: 68, completion: 94, confidence: 71 },
      { learnerReach: 100, accuracy: 60, completion: 90, confidence: 75 },
    )

    expect(pulse.learnerReach).toEqual({ value: 120, previous: 100, delta: 20, deltaKind: 'percent' })
    expect(pulse.accuracy.delta).toBe(8)
    expect(pulse.completion.delta).toBe(4)
    expect(pulse.confidence.delta).toBe(-4)
  })

  it('returns null comparisons when the previous period has no usable value', () => {
    const pulse = buildLearningPulse(
      { learnerReach: 12, accuracy: 50, completion: null, confidence: null },
      { learnerReach: 0, accuracy: null, completion: null, confidence: null },
    )

    expect(pulse.learnerReach.delta).toBeNull()
    expect(pulse.accuracy.delta).toBeNull()
    expect(pulse.completion.delta).toBeNull()
    expect(pulse.confidence.delta).toBeNull()
  })
})

describe('teaching topic extraction', () => {
  it('extracts a concise topic from common definition questions', () => {
    expect(extractTeachingTopic('What does context window mean in an AI model?', 'AI Masterclass'))
      .toBe('Context window')
    expect(extractTeachingTopic('What is a neural network?', 'AI Masterclass'))
      .toBe('Neural network')
  })

  it('falls back to the session title when extraction would be unreliable', () => {
    expect(extractTeachingTopic('When should a model refuse a request?', 'AI Masterclass'))
      .toBe('AI Masterclass')
  })
})

describe('support learners', () => {
  it('normalizes raw points before evaluating decline', () => {
    const learners = buildSupportLearners([
      {
        id: 'older',
        createdAt: new Date('2026-07-01T10:00:00Z'),
        status: 'ended',
        participantCount: 1,
        results: { maxScore: 2000, questionCount: 2, leaderboard: [{ name: 'Asha', score: 1400 }] },
      },
      {
        id: 'newer',
        createdAt: new Date('2026-07-10T10:00:00Z'),
        status: 'ended',
        participantCount: 1,
        results: { maxScore: 1000, questionCount: 1, leaderboard: [{ name: 'Asha', score: 450 }] },
      },
    ])

    expect(learners[0]).toMatchObject({
      name: 'Asha',
      latestScore: 45,
      change: -25,
      reason: 'declining',
    })
  })

  it('uses question count as the legacy max-score fallback and caps the list at four', () => {
    const names = ['Asha', 'Ravi', 'Meera', 'Kabir', 'Zoya']
    const sessions = [0, 1].map(index => ({
      id: `legacy-${index}`,
      createdAt: new Date(`2026-07-0${index + 1}T10:00:00Z`),
      status: 'ended',
      participantCount: names.length,
      results: {
        questionCount: 2,
        leaderboard: names.map(name => ({ name, score: index === 0 ? 900 : 700 })),
      },
    }))

    const learners = buildSupportLearners(sessions)

    expect(learners).toHaveLength(4)
    expect(learners.every(learner => learner.reason === 'low_and_declining')).toBe(true)
    expect(learners[0].latestScore).toBe(35)
  })
})

describe('next scheduled session', () => {
  const now = new Date('2026-08-01T10:00:00Z')

  it('prioritizes an open session over a future session', () => {
    const selected = selectNextScheduled([
      { sessionId: 'future', phase: 'upcoming', opensAt: '2026-08-02T10:00:00Z' },
      { sessionId: 'open', phase: 'open', opensAt: '2026-08-01T09:00:00Z' },
    ], now)

    expect(selected?.sessionId).toBe('open')
  })

  it('chooses the earliest upcoming session when none is open', () => {
    const selected = selectNextScheduled([
      { sessionId: 'later', phase: 'upcoming', opensAt: '2026-08-04T10:00:00Z' },
      { sessionId: 'earlier', phase: 'upcoming', opensAt: '2026-08-02T10:00:00Z' },
      { sessionId: 'ended', phase: 'ended', opensAt: '2026-07-20T10:00:00Z' },
    ], now)

    expect(selected?.sessionId).toBe('earlier')
  })
})
