'use client'

import { useState } from 'react'
import type { AsyncInputProps } from './types'

const MAX_CHARS = 2000

export function TextInput({ question, disabled, onSubmit }: AsyncInputProps) {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const label =
    question.type === 'wordcloud' ? 'Your word or phrase' :
    question.type === 'qa' ? 'Your answer' :
    'Your response'

  function handleSubmit() {
    const trimmed = value.trim()
    if (disabled || submitted || !trimmed) return
    setSubmitted(true)
    onSubmit(trimmed)
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
        {label}
      </label>
      <textarea
        rows={question.type === 'wordcloud' ? 2 : 4}
        maxLength={MAX_CHARS}
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled || submitted}
        placeholder={
          question.type === 'wordcloud' ? 'Enter one or a few words…' :
          question.type === 'qa' ? 'Type your answer here…' :
          'Share your thoughts…'
        }
        className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none focus:ring-2 transition-all disabled:opacity-50"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: '#64748B' }}>
          {value.length}/{MAX_CHARS}
        </span>
        <button
          onClick={handleSubmit}
          disabled={disabled || submitted || !value.trim()}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-default"
          style={{ background: '#6366F1', color: '#fff' }}
        >
          {submitted ? 'Submitted ✓' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
