import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SessionReport } from '@/components/SessionReport'
import type { MisconceptionSummary } from '@/lib/session-matrix'
import type { QuestionStat } from '@/lib/quiz-types'

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join(' ')
  if (!isValidElement(node)) return ''
  return textContent((node.props as { children?: ReactNode }).children)
}

function findButton(node: ReactNode, label: string): ReactElement<{ onClick: () => void }> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findButton(child, label)
      if (match) return match
    }
    return null
  }
  if (!isValidElement(node)) return null
  const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>
  if (element.type === 'button' && textContent(element.props.children).includes(label) && element.props.onClick) {
    return element as ReactElement<{ onClick: () => void }>
  }
  return findButton(element.props.children, label)
}

const RATING_STAT: QuestionStat = {
  index: 0,
  text: 'How useful was this session?',
  type: 'rating',
  correctPct: null,
  confidenceGrid: null,
  bloomsLevel: null,
  explanation: null,
  isNonScored: true,
  ratingHistogram: [1, 2, 3, 5, 6],
  ratingAverage: 3.59,
  ratingMax: 5,
}

const MISCONCEPTIONS: MisconceptionSummary = {
  hasConfidenceData: true,
  answerCount: 2,
  learnerCount: 2,
  questionCount: 1,
  questions: [{
    index: 1,
    label: 'What does <context> mean?',
    answerCount: 2,
    respondentCount: 3,
    affectedPct: 67,
    participants: [
      { id: 'asha', name: 'Asha Rao' },
      { id: 'unsafe', name: '<script>alert(1)</script>' },
    ],
  }],
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SessionReport download', () => {
  it('adds complete escaped participant detail and star ratings to the printable report', () => {
    vi.useFakeTimers()
    let writtenHtml = ''
    const print = vi.fn()
    vi.stubGlobal('window', {
      open: () => ({
        document: {
          write: (html: string) => { writtenHtml = html },
          close: vi.fn(),
        },
        focus: vi.fn(),
        print,
      }),
    })

    const tree = SessionReport({
      questionStats: [RATING_STAT],
      quizTitle: 'AI Masterclass',
      misconceptionSummary: MISCONCEPTIONS,
    } as Parameters<typeof SessionReport>[0])
    const download = findButton(tree, 'Download PDF report')

    expect(download).not.toBeNull()
    download?.props.onClick()
    vi.runAllTimers()

    expect(writtenHtml).toContain('Confidently wrong appendix')
    expect(writtenHtml).toContain('Asha Rao')
    expect(writtenHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(writtenHtml).not.toContain('<script>alert(1)</script>')
    expect(writtenHtml).toContain('2 of 3 respondents (67%)')
    expect(writtenHtml).toContain('aria-label="Average rating 3.59 out of 5 from 17 ratings"')
    expect(writtenHtml).toContain('3.59 / 5')
    expect(print).toHaveBeenCalledOnce()
  })
})
