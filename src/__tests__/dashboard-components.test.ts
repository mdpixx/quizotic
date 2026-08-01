import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  EngagementMasteryCarousel,
  MasterySlide,
  TeachingBriefCard,
} from '@/components/host/dashboard/DashboardCards'

const teachingBrief = {
  sessionId: 'session-1',
  sessionTitle: 'AI Masterclass',
  topic: 'Context window',
  tone: 'attention' as const,
  hardQuestionCount: 5,
  confidentlyWrongPct: 38,
  confidentlyWrongCount: 8,
  misconceptionQuestionCount: 2,
  supportLearnerCount: 4,
  weakestQuestion: {
    index: 2,
    text: 'What does context window mean in an AI model?',
    correctPct: 20,
    bloomsLevel: 'Understand',
  },
}

describe('TeachingBriefCard', () => {
  it('renders the recommendation as plain heading text without an underline treatment', () => {
    const markup = renderToStaticMarkup(createElement(TeachingBriefCard, { brief: teachingBrief }))

    expect(markup).toContain('Context window needs another pass.')
    expect(markup).not.toContain('<u')
    expect(markup).not.toContain('text-decoration')
    expect(markup).not.toContain('highlight')
  })
})

describe('EngagementMasteryCarousel', () => {
  it('shows Engagement first with accessible previous and next controls', () => {
    const markup = renderToStaticMarkup(createElement(EngagementMasteryCarousel, {
      trend: [{ date: '2026-08-01', sessions: 2 }],
      bloomsCoverage: [],
      bloomsMastery: [],
    }))

    expect(markup).toContain('Engagement')
    expect(markup).toContain('Previous insight')
    expect(markup).toContain('Next insight')
    expect(markup).toContain('aria-live="polite"')
  })
})

describe('MasterySlide', () => {
  it('shows the setup prompt when questions have no Bloom tags', () => {
    const markup = renderToStaticMarkup(createElement(MasterySlide, {
      bloomsCoverage: [],
      bloomsMastery: [],
    }))

    expect(markup).toContain('Set up thinking-skill mastery')
    expect(markup).toContain('Choose a quiz to tag')
    expect(markup).toContain('href="/host/quizzes"')
  })
})
