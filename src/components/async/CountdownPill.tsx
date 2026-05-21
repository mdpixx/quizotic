'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  deadlineAt: number // epoch ms — server-authoritative
  onExpire: () => void
}

export function CountdownPill({ deadlineAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadlineAt - Date.now()))
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    const tick = () => {
      const ms = Math.max(0, deadlineAt - Date.now())
      setRemaining(ms)
      if (ms === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [deadlineAt, onExpire])

  const totalSec = Math.ceil(remaining / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  const urgent = totalSec <= 60

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold tabular-nums transition-colors ${
        urgent ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-200'
      }`}
    >
      <span className="text-xs">⏱</span>
      {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${totalSec}s`}
    </div>
  )
}
