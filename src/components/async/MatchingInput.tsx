'use client'

import { useState } from 'react'
import type { AsyncInputProps } from './types'

// Self-paced matching input. Each left prompt gets a dropdown of the shuffled
// right options; the submitted answer is the array of chosen right values, one
// per left item, in left order — exactly what server-side checkAnswer expects.
export function MatchingInput({ question, disabled, onSubmit }: AsyncInputProps) {
  const lefts = question.matchLefts ?? []
  const rights = question.matchRights ?? []
  const [choices, setChoices] = useState<string[]>(() => lefts.map(() => ''))
  const [submitted, setSubmitted] = useState(false)

  const allChosen = lefts.length > 0 && choices.every(c => c !== '')

  function handleSubmit() {
    if (disabled || submitted || !allChosen) return
    setSubmitted(true)
    onSubmit(choices)
  }

  return (
    <div className="space-y-3">
      {lefts.map((leftText, i) => (
        <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-bold mb-2" style={{ color: '#fff' }}>{leftText}</p>
          <select
            value={choices[i]}
            disabled={disabled || submitted}
            onChange={e => setChoices(prev => {
              const next = lefts.map((_, j) => prev[j] ?? '')
              next[i] = e.target.value
              return next
            })}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-semibold outline-none disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
          >
            <option value="" style={{ color: '#0F1B3D' }}>Choose a match…</option>
            {rights.map((r, ri) => (
              <option key={ri} value={r} style={{ color: '#0F1B3D' }}>{r}</option>
            ))}
          </select>
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={disabled || submitted || !allChosen}
        className="w-full px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-default"
        style={{ background: '#DB2777', color: '#fff' }}
      >
        {submitted ? 'Submitted ✓' : 'Submit matches'}
      </button>
    </div>
  )
}
