'use client'

import { useState } from 'react'
import { ANSWER_COLORS } from '@/lib/answer-colors'
import type { AsyncInputProps } from './types'
import { optText } from './types'

export function OptionGrid({ question, disabled, onSubmit }: AsyncInputProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const opts = question.options ?? []

  function handleClick(idx: number) {
    if (disabled || selected !== null) return
    setSelected(idx)
    onSubmit(idx)
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((opt, i) => {
        const color = ANSWER_COLORS[i % ANSWER_COLORS.length]
        const isSelected = selected === i
        return (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={disabled}
            className={[
              'relative flex items-start gap-2 p-3 rounded-xl text-left min-h-[72px]',
              'transition-all duration-150 active:scale-[0.97] disabled:cursor-default',
              isSelected ? 'ring-4 ring-white/50 scale-[0.97]' : 'hover:brightness-110',
              disabled && !isSelected ? 'opacity-50' : '',
            ].join(' ')}
            style={{ backgroundColor: color.hex }}
          >
            <span className="shrink-0 w-7 h-7 rounded-full bg-black/25 flex items-center justify-center text-sm font-bold text-white">
              {color.letter}
            </span>
            <span className="text-white font-semibold text-sm leading-snug mt-0.5">{optText(opt)}</span>
          </button>
        )
      })}
    </div>
  )
}
