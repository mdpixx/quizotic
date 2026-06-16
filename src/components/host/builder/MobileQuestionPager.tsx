'use client'

/**
 * MobileQuestionPager — horizontal CSS scroll-snap carousel of question cards
 * for the mobile quiz editor.
 *
 * One <QuestionCanvas> per question is rendered as a snap child. The user
 * swipes left/right to move between questions. On scroll-end we sync the
 * snapped page index back to builder state via onIndexChange.
 *
 * When activeIndex changes externally (strip tap, add-question) we
 * programmatically scroll to the correct card.
 *
 * Uses CSS scroll-snap (no dependency) to avoid gesture conflicts with the
 * text inputs / textareas inside each QuestionCanvas.
 */

import React, { useCallback, useEffect, useRef } from 'react'
import { QuestionCanvas } from './QuestionCanvas'
import type { Question, QuestionType } from '@/lib/quiz-types'

interface MobileQuestionPagerProps {
  questions: Question[]
  activeIndex: number
  plan: 'free' | 'pro'
  onIndexChange: (index: number) => void
  onUpdateQuestion: (index: number, partial: Partial<Question>) => void
  onTypeChange: (index: number, type: QuestionType) => void
  onDuplicate: (index: number) => void
  onDelete: (index: number) => void
}

export function MobileQuestionPager({
  questions,
  activeIndex,
  plan,
  onIndexChange,
  onUpdateQuestion,
  onTypeChange,
  onDuplicate,
  onDelete,
}: MobileQuestionPagerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Guard: don't call onIndexChange when scroll was triggered programmatically
  const isProgrammaticScroll = useRef(false)
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Programmatically scroll to a card when activeIndex changes externally
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.clientWidth
    const targetLeft = activeIndex * cardWidth
    if (Math.abs(el.scrollLeft - targetLeft) < 4) return // already there

    isProgrammaticScroll.current = true
    el.scrollTo({ left: targetLeft, behavior: 'smooth' })

    // Reset the guard after scroll animation finishes (~350 ms is plenty for
    // a single-card snap; we add a small buffer)
    setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 500)
  }, [activeIndex])

  const handleScroll = useCallback(() => {
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = setTimeout(() => {
      if (isProgrammaticScroll.current) return
      const el = scrollRef.current
      if (!el) return
      const cardWidth = el.clientWidth
      if (cardWidth === 0) return
      const snappedIndex = Math.round(el.scrollLeft / cardWidth)
      if (snappedIndex !== activeIndex) {
        onIndexChange(snappedIndex)
      }
    }, 80)
  }, [activeIndex, onIndexChange])

  if (questions.length === 0) return null

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 flex overflow-x-auto overflow-y-hidden"
      style={{
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {questions.map((question, i) => (
        <div
          key={question.id}
          className="w-full flex-shrink-0 overflow-y-auto"
          style={{
            scrollSnapAlign: 'center',
            // Ensure each card takes exactly the viewport width
            minWidth: '100%',
          }}
        >
          {/* Inner padding matches the desktop canvas (p-4) */}
          <div className="p-4">
            <QuestionCanvas
              question={question}
              index={i}
              total={questions.length}
              plan={plan}
              onChange={partial => onUpdateQuestion(i, partial)}
              onTypeChange={type => onTypeChange(i, type)}
              onDuplicate={() => onDuplicate(i)}
              onDelete={() => onDelete(i)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
