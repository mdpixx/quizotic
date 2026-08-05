import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AddInteractionPicker } from '@/components/host/builder/AddInteractionPicker'
import { TYPE_PILLS } from '@/lib/quiz-builder-logic'
import { getTypeIcon, getTypeIllustration } from '@/lib/quiz-type-icons'
import type { QuestionType } from '@/lib/quiz-types'

function renderIllustration(type: QuestionType): string {
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, getTypeIllustration(type)),
  )
}

function count(markup: string, token: string): number {
  return markup.split(token).length - 1
}

describe('add interaction picker visuals', () => {
  it('gives every question type a distinct visual preview', () => {
    const previews = TYPE_PILLS.map(({ value }) => renderIllustration(value))

    expect(new Set(previews).size).toBe(TYPE_PILLS.length)
  })

  it('shows the response control that distinguishes the scored formats', () => {
    expect(renderIllustration('mcq')).toContain('data-control="radio"')
    expect(renderIllustration('multiselect')).toContain('data-control="checkbox"')

    const trueFalse = renderIllustration('truefalse')
    expect(trueFalse).toContain('>True<')
    expect(trueFalse).toContain('>False<')

    const fillBlank = renderIllustration('fillblank')
    expect(fillBlank).toContain('Type answer')
    expect(fillBlank).toContain('Accepts')
  })

  it('keeps the MCQ label icon consistent with its single-choice preview', () => {
    const icon = renderToStaticMarkup(
      React.createElement(React.Fragment, null, getTypeIcon('mcq')),
    )

    expect(icon).toContain('data-control="radio"')
  })

  it('uses the same padded preview frame for every card', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AddInteractionPicker, {
        onAdd: () => {},
        onGenerateAI: () => {},
        onClose: () => {},
      }),
    )

    expect(count(markup, 'data-slot="interaction-preview"')).toBe(TYPE_PILLS.length)
    expect(count(markup, 'data-slot="interaction-preview-surface"')).toBe(TYPE_PILLS.length)
    expect(count(markup, 'padding:12px 14px')).toBe(TYPE_PILLS.length)
  })
})
