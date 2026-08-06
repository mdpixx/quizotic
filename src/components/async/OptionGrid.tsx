'use client'

import { useMemo, useState } from 'react'
import { ANSWER_COLORS } from '@/lib/answer-colors'
import { buildDisplayOrder, toOriginalIndex } from '@/lib/option-shuffle'
import type { AsyncInputProps } from './types'
import { optText, optImage } from './types'
import {
  TILE_BADGE_CLASS,
  TILE_IMAGE_CLASS,
  TILE_TEXT_CLASS,
  tileClass,
  tileGridClass,
  tileStyle,
} from './tile'

export function OptionGrid({ question, disabled, onSubmit, shuffleOptions, participantId }: AsyncInputProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const opts = question.options ?? []

  // Display slot -> authored option index. Identity when shuffling is off, the
  // type isn't shuffleable (true/false and polls are excluded), or there's no
  // participant to seed from — so the render below never has to branch.
  const order = useMemo(() => buildDisplayOrder({
    optionCount: opts.length,
    enabled: !!shuffleOptions,
    questionType: question.type,
    participantId,
    questionId: question.id,
    questionIndex: question.index,
  }), [opts.length, shuffleOptions, question.type, question.id, question.index, participantId])

  function handleClick(slot: number) {
    if (disabled || selected !== null) return
    setSelected(slot)
    // Submit the AUTHORED index — the server grades in authored space and has
    // no idea a permutation happened.
    onSubmit(toOriginalIndex(order, slot))
  }

  return (
    <div className={tileGridClass(opts.length)}>
      {order.map((originalIdx, slot) => {
        const opt = opts[originalIdx]
        if (opt === undefined) return null
        // Colour and letter follow the SLOT, not the authored index: two
        // participants must not be able to compare "the blue one".
        const color = ANSWER_COLORS[slot % ANSWER_COLORS.length]
        const isSelected = selected === slot
        const img = optImage(opt)
        return (
          <button
            key={originalIdx}
            onClick={() => handleClick(slot)}
            disabled={disabled}
            aria-label={`Option ${color.letter}: ${optText(opt)}`}
            aria-pressed={isSelected}
            className={tileClass({ selected: isSelected, disabled })}
            style={tileStyle(color)}
          >
            {img && <img src={img} alt="" className={TILE_IMAGE_CLASS} />}
            <span className={TILE_BADGE_CLASS}>{color.letter}</span>
            <span className={TILE_TEXT_CLASS} style={{ overflowWrap: 'anywhere' }}>
              {optText(opt)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
