'use client'

import { useState } from 'react'
import { DrawingCanvas } from '@/components/DrawingCanvas'
import type { AsyncInputProps } from './types'

export function DrawingInput({ disabled, onSubmit }: AsyncInputProps) {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(dataUrl: string) {
    if (disabled || submitted) return
    setSubmitted(true)
    onSubmit(dataUrl)
  }

  if (submitted) {
    return (
      <div className="rounded-xl px-4 py-6 text-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
        <p className="font-bold text-sm" style={{ color: '#A5B4FC' }}>Drawing submitted ✓</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
        Draw your response
      </p>
      <DrawingCanvas onSubmit={handleSubmit} disabled={disabled} />
    </div>
  )
}
