import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  CREATE_MENU_ITEMS,
  DashboardHeader,
} from '@/components/host/dashboard/DashboardHeader'
import {
  AttentionQueue,
  RecentWork,
} from '@/components/host/dashboard/DashboardSections'

const brief = {
  sessionId: 'session-1',
  sessionTitle: 'AI Masterclass',
  topic: 'Context window',
  tone: 'attention' as const,
  hardQuestionCount: 3,
  confidentlyWrongPct: 38,
  confidentlyWrongCount: 8,
  misconceptionQuestionCount: 2,
  supportLearnerCount: 1,
  weakestQuestion: {
    index: 2,
    text: 'What does context window mean in an AI model?',
    correctPct: 24,
    bloomsLevel: 'Understand',
  },
}

describe('DashboardHeader', () => {
  it('uses a Scheduled shortcut rather than a decorative notification bell', () => {
    const markup = renderToStaticMarkup(createElement(DashboardHeader, { scheduleCount: 2 }))

    expect(markup).toContain('aria-label="Scheduled sessions, 2 active"')
    expect(markup).toContain('href="/host/scheduled"')
    expect(markup).not.toContain('Notifications')
  })

  it('offers only Quiz and Presentation in the Create menu', () => {
    expect(CREATE_MENU_ITEMS.map(item => item.label)).toEqual(['Quiz', 'Presentation'])
    expect(CREATE_MENU_ITEMS.map(item => item.href)).toEqual(['/host/build', '/host/present/create'])
  })

  it('exposes a dedicated top-bar feature request action', () => {
    const markup = renderToStaticMarkup(createElement(DashboardHeader, { scheduleCount: 0 }))

    expect(markup).toContain('Request feature')
    expect(markup).toContain('aria-label="Request a feature"')
    expect(markup).not.toContain('AI-assisted practice')
  })
})

describe('AttentionQueue', () => {
  it('uses one evidence drill-down instead of repetitive row actions', () => {
    const markup = renderToStaticMarkup(createElement(AttentionQueue, {
      brief,
      supportLearners: [{
        name: 'Anita Rao',
        archetype: 'Needs a check-in',
        sessions: 3,
        latestScore: 34,
        change: -18,
        scores: [62, 52, 34],
        reason: 'low_and_declining',
      }],
    }))

    expect(markup).toContain('Learners to support')
    expect(markup).toContain('Anita Rao')
    expect(markup).toContain('8 confidently wrong answers')
    expect(markup).toContain('2 questions')
    expect(markup).toContain('See questions and learners')
    expect(markup.match(/href="\/host\/reports\/session-1#misconceptions"/g)).toHaveLength(1)
    expect(markup).not.toContain('Review question')
    expect(markup).not.toContain('Open confidence report')
    expect(markup).not.toContain('Review learners')
    expect(markup).not.toContain('Top participants')
  })

  it('offers a neutral evidence action when confidence was not captured', () => {
    const markup = renderToStaticMarkup(createElement(AttentionQueue, {
      brief: {
        ...brief,
        confidentlyWrongPct: null,
        confidentlyWrongCount: 0,
        misconceptionQuestionCount: 0,
      },
      supportLearners: [],
    }))

    expect(markup).toContain('Review session evidence')
    expect(markup).toContain('href="/host/reports/session-1"')
    expect(markup).not.toContain('#misconceptions')
  })
})

describe('RecentWork', () => {
  it('keeps session reports and recently edited content in one scannable area', () => {
    const markup = renderToStaticMarkup(createElement(RecentWork, {
      sessions: [{
        id: 'session-1',
        contentId: 'quiz-1',
        type: 'quiz',
        title: 'AI Masterclass',
        date: '2026-08-01T09:00:00.000Z',
        participants: 18,
        avgScore: 48,
        completionPct: 100,
        duration: 600,
        status: 'ended',
      }],
      content: [{
        id: 'quiz-1',
        type: 'quiz',
        title: 'AI Masterclass',
        updatedAt: '2026-08-01T08:00:00.000Z',
      }],
    }))

    expect(markup).toContain('Recent work')
    expect(markup).toContain('AI Masterclass')
    expect(markup).toContain('href="/host/reports/session-1">View report</a>')
    expect(markup).not.toContain('>Open</a>')
    expect(markup).not.toContain('/host/build?id=')
    expect(markup).toContain('href="/host/build?edit=quiz-1"')
    expect(markup).toContain('Continue creating')
  })
})

describe('dashboard page contract', () => {
  it('defaults the dashboard range to 30 days and does not compose the sidebar', () => {
    const source = readFileSync('src/app/host/(dashboard)/page.tsx', 'utf8')

    expect(source).toContain('useState<DashboardRange>(30)')
    expect(source).not.toContain('HostSidebar')
  })

  it('defines a readable dashboard type scale and one shared two-column grid', () => {
    const styles = readFileSync('src/components/host/dashboard/DashboardCommandCenter.module.css', 'utf8')

    expect(styles).toContain('--dash-font-body: 14px')
    expect(styles).toContain('--dash-font-control: 12px')
    expect(styles).toContain('--dash-font-compact: 11px')
    expect(styles).toMatch(/\.attentionGrid,\s*\.recentGrid,\s*\.learningGrid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(300px,\s*\.68fr\)/)
  })
})
