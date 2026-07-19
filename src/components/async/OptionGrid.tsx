'use client'

import { useState } from 'react'
import { ANSWER_COLORS, tileStyle } from '@/lib/answer-colors'
import type { AsyncInputProps } from './types'
import { optText, optImage } from './types'

export function OptionGrid({ question, disabled, onSubmit }: AsyncInputProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const opts = question.options ?? []

  function handleClick(idx: number) {
    if (disabled || selected !== null) return
    setSelected(idx)
    onSubmit(idx)
  }

  return (
    <div className="flex flex-col gap-3">
      {opts.map((opt, i) => {
        const color = ANSWER_COLORS[i % ANSWER_COLORS.length]
        const isSelected = selected === i
        const img = optImage(opt)
        return (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={disabled}
            className={[
              'relative flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-4 rounded-xl text-left min-h-[60px] lg:min-h-[68px]',
              'transition-all duration-150 active:scale-[0.97] disabled:cursor-default',
              isSelected ? 'ring-4 ring-white/50 scale-[0.97]' : 'hover:brightness-110',
              disabled && !isSelected ? 'opacity-50' : '',
            ].join(' ')}
            style={tileStyle(color)}
          >
            {img && (
              <img src={img} alt="" className="h-12 w-12 lg:h-14 lg:w-14 shrink-0 object-cover rounded-lg" />
            )}
            <span className="shrink-0 w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-black/25 flex items-center justify-center text-base lg:text-lg font-bold text-white">
              {color.letter}
            </span>
            <span className="flex-1 min-w-0 break-words text-white font-black text-base lg:text-xl leading-tight">{optText(opt)}</span>
          </button>
        )
      })}
    </div>
  )
}
