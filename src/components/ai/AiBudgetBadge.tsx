'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'

type Bucket = 'questions' | 'enhancements'

interface BucketState {
  used: number
  limit: number
}

export interface AiBudgetBadgeHandle {
  refresh: () => void
}

interface AiBudgetBadgeProps {
  bucket: Bucket
  className?: string
}

const LABELS: Record<Bucket, string> = {
  questions: 'questions',
  enhancements: 'enhancements',
}

function normaliseLimit(v: number | null | undefined): number {
  return v === null || v === undefined ? Infinity : v
}

async function fetchBucket(bucket: Bucket): Promise<BucketState | null> {
  try {
    const res = await fetch('/api/user/ai-usage')
    if (!res.ok) return null
    const data = await res.json()
    const b = data?.[bucket]
    if (!b) return null
    return { used: b.used, limit: normaliseLimit(b.limit) }
  } catch {
    return null
  }
}

export const AiBudgetBadge = forwardRef<AiBudgetBadgeHandle, AiBudgetBadgeProps>(
  function AiBudgetBadge({ bucket, className }, ref) {
    const [state, setState] = useState<BucketState | null>(null)

    const refresh = useCallback(() => {
      fetchBucket(bucket).then(s => {
        if (s) setState(s)
      })
    }, [bucket])

    useEffect(() => {
      let cancelled = false
      fetchBucket(bucket).then(s => {
        if (!cancelled && s) setState(s)
      })
      return () => { cancelled = true }
    }, [bucket])

    useImperativeHandle(ref, () => ({ refresh }), [refresh])

    if (!state) return null

    const { used, limit } = state
    const unlimited = limit === Infinity
    const exhausted = !unlimited && used >= limit
    const warning = !unlimited && !exhausted && used >= limit * 0.8

    const background = exhausted ? '#FEE2E2' : warning ? '#FEF3C7' : '#F3F4F6'
    const color = exhausted ? '#B91C1C' : warning ? '#B45309' : '#374151'
    const display = unlimited ? 'Unlimited' : `${used} / ${limit}`

    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${className ?? ''}`}
        style={{ background, color }}
        title={exhausted ? 'Monthly AI limit reached. Resets on the 1st.' : `AI ${LABELS[bucket]} used this month`}
      >
        AI: {display} {LABELS[bucket]}
      </span>
    )
  },
)
