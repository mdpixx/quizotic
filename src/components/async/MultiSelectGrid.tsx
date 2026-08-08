'use client'

import { useMemo, useState } from 'react'
import { ANSWER_COLORS } from '@/lib/answer-colors'
import { buildDisplayOrder, toOriginalIndex } from '@/lib/option-shuffle'
import type { AsyncInputProps } from './types'
import { optText, optImage } from './types'
import {
  TILE_IMAGE_CLASS,
  TILE_TEXT_CLASS,
  TILE_TEXT_CLASS_LONG,
  tileClass,
  tileGridClass,
  tileStyle,
} from './tile'

export function MultiSelectGrid({ question, disabled, onSubmit, shuffleOptions, participantId }: AsyncInputProps) {
  // Holds DISPLAY slots, not authored indices — mapped back on submit.
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const opts = question.options ?? []
  const locked = disabled || submitted
  const longText = question.longText === true

  const order = useMemo(() => buildDisplayOrder({
    optionCount: opts.length,
    enabled: !!shuffleOptions,
    questionType: question.type,
    participantId,
    questionId: question.id,
    questionIndex: question.index,
  }), [opts.length, shuffleOptions, question.type, question.id, question.index, participantId])

  function toggle(slot: number) {
    if (locked) return
    setChosen(prev => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  function handleSubmit() {
    if (locked || chosen.size === 0) return
    setSubmitted(true)
    // Map slots back to authored indices BEFORE sorting — sorting slots and
    // then mapping would emit a differently-ordered set per participant, and
    // checkAnswer compares against the authored correctAnswers array.
    const authored = [...chosen].map(slot => toOriginalIndex(order, slot))
    onSubmit(authored.sort((a, b) => a - b).map(String))
  }

  return (
    <div className="space-y-3">
      {/* Without this the tiles look identical to single-choice, so participants
          don't know they can pick more than one. The live player shows the same
          hint — this page was missing it entirely. */}
      {!submitted && (
        <div className="flex items-center gap-2 px-1">
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-5 h-5 rounded-md border-2 shrink-0"
            style={{ borderColor: '#FBD13B', background: 'rgba(251,209,59,0.15)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FBD13B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span className="text-sm font-bold" style={{ color: '#FBD13B' }}>Select all that apply</span>
        </div>
      )}

      <div className={tileGridClass(opts.length, longText)}>
        {order.map((originalIdx, slot) => {
          const opt = opts[originalIdx]
          if (opt === undefined) return null
          // Colour and letter follow the SLOT so neighbours can't compare notes.
          const color = ANSWER_COLORS[slot % ANSWER_COLORS.length]
          const isChosen = chosen.has(slot)
          const img = optImage(opt)
          return (
            <button
              key={originalIdx}
              onClick={() => toggle(slot)}
              disabled={locked}
              aria-label={`Option ${color.letter}: ${optText(opt)}`}
              aria-pressed={isChosen}
              className={tileClass({ selected: isChosen, disabled: locked, longText })}
              style={tileStyle(color)}
            >
              {img && <img src={img} alt="" className={TILE_IMAGE_CLASS} />}
              {/* A square checkbox — not the letter badge — is the only visible
                  cue that this question takes multiple answers. Matches live. */}
              <span
                aria-hidden
                className="flex items-center justify-center shrink-0 w-10 h-10 lg:w-11 lg:h-11 transition-all"
                style={{
                  borderRadius: 8,
                  borderWidth: 3,
                  borderStyle: 'solid',
                  borderColor: isChosen ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                  background: isChosen ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)',
                }}
              >
                {isChosen && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className={longText ? TILE_TEXT_CLASS_LONG : TILE_TEXT_CLASS} style={{ overflowWrap: 'anywhere' }}>
                {optText(opt)}
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={locked || chosen.size === 0}
        className="w-full py-4 rounded-2xl font-black text-base transition-all disabled:cursor-default motion-safe:active:scale-[0.98]"
        style={
          !locked && chosen.size > 0
            ? { background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D' }
            : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }
        }
      >
        {submitted ? 'Submitted' : `Submit (${chosen.size} selected)`}
      </button>
    </div>
  )
}
