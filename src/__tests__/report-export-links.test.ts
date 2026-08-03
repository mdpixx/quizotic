// Guards the export affordances on the session report card: the Pro link must
// point at the workbook route, the free state must stay locked, and the PDF
// button must remain available to everyone.
//
// The Pro/free split used to hang off a CSV route that no longer exists, and
// the workbook route is reachable by session id *or* room code — a regression
// in either would silently strand hosts on a 404 the way the old XLSX and PDF
// pills did.

import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { SessionReport } from '@/components/SessionReport'
import type { QuestionStat } from '@/lib/quiz-types'

const STAT: QuestionStat = {
  index: 0,
  text: 'Which standard defines Viscosity Index?',
  type: 'mcq',
  correctPct: 62,
  confidenceGrid: { sureCorrect: 5, sureWrong: 2, unsureCorrect: 1, unsureWrong: 2 },
  bloomsLevel: 'remember',
  explanation: null,
  isNonScored: false,
  totalResponses: 10,
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join(' ')
  if (!isValidElement(node)) return ''
  return textContent((node.props as { children?: ReactNode }).children)
}

type AnyElement = ReactElement<{ children?: ReactNode; href?: string }>

function collect(node: ReactNode, type: string, out: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, type, out)
    return out
  }
  if (!isValidElement(node)) return out
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === type) out.push(element as AnyElement)
  collect(element.props.children, type, out)
  return out
}

function render(plan: 'free' | 'pro', sessionId?: string) {
  return SessionReport({
    questionStats: [STAT],
    quizTitle: 'Lubes Knowledge League',
    plan,
    sessionId,
  } as Parameters<typeof SessionReport>[0])
}

describe('session report export links', () => {
  it('points Pro hosts at the workbook route', () => {
    const links = collect(render('pro', 'sess_123'), 'a')
    const href = links.map(l => l.props.href).find(Boolean)
    expect(href).toBe('/api/sessions/sess_123/export/xlsx')
    expect(links.map(l => textContent(l.props.children)).join(' ')).toContain('Excel')
  })

  it('shows free hosts a locked pill with no link', () => {
    const tree = render('free', 'sess_123')
    expect(collect(tree, 'a')).toHaveLength(0)
    const locked = collect(tree, 'span').map(s => textContent(s.props.children))
    expect(locked.some(t => t.includes('Excel'))).toBe(true)
  })

  it('keeps the PDF report available on both plans', () => {
    for (const plan of ['free', 'pro'] as const) {
      const labels = collect(render(plan, 'sess_123'), 'button').map(b => textContent(b.props.children))
      expect(labels.some(t => t.includes('Download PDF report'))).toBe(true)
    }
  })

  it('renders no export link when there is no session to export', () => {
    expect(collect(render('pro'), 'a')).toHaveLength(0)
  })
})
