'use client'

/**
 * NameSlideNudge — one-line, dismissible prompt in the builder suggesting the
 * host open with a "what's your name?" slide.
 *
 * Why this exists: participants routinely mistype their name at join, or type a
 * roll number, and the host then opens the report and cannot tell who is who.
 * A nudge alone would just create work, so the card carries the action — one
 * tap inserts a pre-configured identity slide at position 1, whose answer the
 * report promotes to a sub-line under each participant's name.
 *
 * Shown only when it can actually help: the quiz scores something (so the host
 * cares who earned what) and there is no identity slide already. Dismissal is
 * remembered per browser, not per quiz — a host who has learned the trick
 * should not be told again on every new quiz.
 */

import { useState, useSyncExternalStore } from 'react'
import type { Question } from '@/lib/quiz-types'
import { isScoredQuestion } from '@/lib/quiz-types'
import { isNameCaptureQuestion } from '@/lib/openended-input.mjs'

const DISMISS_KEY = 'quizotic:nudge:name-slide:dismissed'

// localStorage is client-only, and this component is server-rendered like every
// other client component in the builder. useSyncExternalStore is React's
// sanctioned way to read a client-only value without a setState-in-effect
// cascade: the server snapshot hides the nudge, the client snapshot reads the
// real preference, and React reconciles the two without a hydration mismatch.
const subscribeToNothing = () => () => {}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // Private mode / storage disabled — show the nudge rather than crash.
    return false
  }
}

// Server render: assume dismissed so nothing flashes in before hydration.
const dismissedOnServer = () => true

export interface NameSlideNudgeProps {
  questions: Question[]
  onAddNameSlide: () => void
}

export function NameSlideNudge({ questions, onAddNameSlide }: NameSlideNudgeProps) {
  const storedDismissed = useSyncExternalStore(subscribeToNothing, readDismissed, dismissedOnServer)
  // Tracked separately so the card disappears the instant it is dismissed,
  // without needing the external store to re-emit.
  const [justDismissed, setJustDismissed] = useState(false)
  const dismissed = storedDismissed || justDismissed

  const dismiss = () => {
    setJustDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Non-fatal: the nudge simply returns next session.
    }
  }

  const alreadyHasNameSlide = questions.some((q, i) => isNameCaptureQuestion(q, i))
  const hasScoredQuestion = questions.some(q => isScoredQuestion(q))

  if (dismissed || alreadyHasNameSlide || !hasScoredQuestion) return null

  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5"
      style={{ background: '#F0FDFA', border: '1px solid #99F6E4' }}
    >
      <span aria-hidden="true" className="mt-0.5 text-sm">💡</span>
      <p className="flex-1 text-[12px] leading-snug" style={{ color: '#115E59' }}>
        Participants sometimes mistype their name when joining, which makes results
        hard to match afterwards.{' '}
        <button
          type="button"
          onClick={onAddNameSlide}
          className="font-bold underline underline-offset-2"
          style={{ color: '#0D9488' }}
        >
          Add a name slide
        </button>{' '}
        to ask for their real name or roll number.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss suggestion"
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-base leading-none transition-colors hover:bg-teal-100"
        style={{ color: '#5EEAD4' }}
      >
        &times;
      </button>
    </div>
  )
}
