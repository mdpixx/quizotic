'use client'

import { useState } from 'react'
import type { AsyncInputProps } from './types'
import { optText } from './types'

export function RatingInput({ question, disabled, onSubmit }: AsyncInputProps) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const opts = question.options ?? []
  const max = opts.length > 0 ? opts.length : 5
  const minLabel = opts.length > 0 ? optText(opts[0]) : undefined
  const maxLabel = opts.length > 0 ? optText(opts[opts.length - 1]) : undefined

  function handleSubmit() {
    if (disabled || submitted || selected === 0) return
    setSubmitted(true)
    onSubmit(String(selected - 1))
  }

  const starSize = max <= 5 ? 'w-12 h-12' : max <= 7 ? 'w-10 h-10' : 'w-8 h-8'
  const gap = max <= 5 ? 12 : max <= 7 ? 8 : 4

  return (
    <div className="space-y-5">
      {(minLabel || maxLabel) && (
        <div className="flex items-center justify-between text-xs font-semibold" style={{ color: '#94A3B8' }}>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}

      <div className="flex justify-center" style={{ gap }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => {
          const active = n <= (hovered || selected)
          return (
            <button
              key={n}
              onPointerEnter={() => { if (!disabled && !submitted) setHovered(n) }}
              onPointerLeave={() => setHovered(0)}
              onClick={() => { if (!disabled && !submitted) setSelected(n) }}
              disabled={disabled || submitted}
              className={`transition-all duration-150 active:scale-90 disabled:cursor-default ${starSize}`}
              style={{ transform: active ? 'scale(1.15)' : 'scale(1)' }}
            >
              <svg viewBox="0 0 24 24" className="w-full h-full"
                style={{ filter: active ? 'drop-shadow(0 0 6px rgba(250,204,21,0.5))' : 'none' }}>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={active ? '#FACC15' : 'rgba(255,255,255,0.1)'}
                  stroke={active ? '#EAB308' : 'rgba(255,255,255,0.25)'}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )
        })}
      </div>

      <div className="text-center">
        <span className="text-3xl font-black tabular-nums"
          style={{ color: selected > 0 ? '#FACC15' : 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-heading)' }}>
          {selected > 0 ? `${selected} / ${max}` : 'Tap a star'}
        </span>
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || submitted || selected === 0}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-default"
        style={{ background: '#F5E642', color: '#0D0D0D' }}
      >
        {submitted ? 'Submitted ✓' : 'Submit'}
      </button>
    </div>
  )
}
