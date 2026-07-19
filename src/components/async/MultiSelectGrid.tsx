'use client'

import { useState } from 'react'
import { ANSWER_COLORS } from '@/lib/answer-colors'
import type { AsyncInputProps } from './types'
import { optText, optImage } from './types'

export function MultiSelectGrid({ question, disabled, onSubmit }: AsyncInputProps) {
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const opts = question.options ?? []

  function toggle(idx: number) {
    if (disabled || submitted) return
    setChosen(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function handleSubmit() {
    if (disabled || submitted || chosen.size === 0) return
    setSubmitted(true)
    onSubmit([...chosen].sort((a, b) => a - b).map(String))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        {opts.map((opt, i) => {
          const color = ANSWER_COLORS[i % ANSWER_COLORS.length]
          const isChosen = chosen.has(i)
          const img = optImage(opt)
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={disabled || submitted}
              className={[
                'relative flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-4 rounded-xl text-left min-h-[60px] lg:min-h-[68px]',
                'transition-all duration-150 disabled:cursor-default',
                isChosen ? 'ring-4 ring-white/50 brightness-110' : 'opacity-80 hover:opacity-100',
              ].join(' ')}
              style={{ backgroundColor: color.hex }}
            >
              {img && (
                <img src={img} alt="" className="h-12 w-12 lg:h-14 lg:w-14 shrink-0 object-cover rounded-lg" />
              )}
              <span className={[
                'shrink-0 w-10 h-10 lg:w-11 lg:h-11 rounded-full flex items-center justify-center text-base lg:text-lg font-bold text-white transition-colors',
                isChosen ? 'bg-white/40' : 'bg-black/25',
              ].join(' ')}>
                {isChosen ? '✓' : color.letter}
              </span>
              <span className="flex-1 min-w-0 break-words text-white font-black text-base lg:text-xl leading-tight">{optText(opt)}</span>
            </button>
          )
        })}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || submitted || chosen.size === 0}
        className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-default text-white font-black text-base transition-colors"
      >
        {submitted ? 'Submitted' : `Submit (${chosen.size} selected)`}
      </button>
    </div>
  )
}
