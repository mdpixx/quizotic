'use client'

import { CountdownPill } from './CountdownPill'

interface Props {
  qNum: number
  total: number
  totalScore: number
  // Epoch ms in server time, or null on an untimed quiz (no pill).
  deadlineAt: number | null
  nowOffsetMs?: number
  onExpire: () => void
}

// Sticky header for the self-paced player: progress track, question counter,
// running score, and the time-limit countdown.
//
// Every chip here holds a reserved width. The progress track is `flex-1`, so it
// absorbs any width change in its siblings — which meant a chip growing by one
// character resized the track and shifted the whole row sideways. The countdown
// did that once a SECOND. Reserved widths plus `shrink-0` keep the row geometry
// fixed no matter what the numbers do:
//   counter  — up to "99/99"
//   score    — up to "99999 pts"
//   pill     — constant MM:SS, see formatClock in CountdownPill
// Extracted from the page so it can be rendered in /dev/scheduled-preview and
// asserted in tests without duplicating the markup.
export function AsyncTopBar({ qNum, total, totalScore, deadlineAt, nowOffsetMs = 0, onExpire }: Props) {
  const progressPct = total > 0 ? Math.min(100, (qNum / total) * 100) : 0

  return (
    <div className="sticky top-0 z-10 px-4 pb-2 flex items-center gap-3"
      style={{ background: '#0F1B3D', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: '#FBD13B' }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums shrink-0 text-right min-w-[3rem]" style={{ color: '#94A3B8' }}>
        {qNum}/{total}
      </span>
      <span className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums shrink-0 text-center min-w-[5rem]"
        style={{ background: 'rgba(251,209,59,0.15)', color: '#FBD13B' }}>
        {totalScore} pts
      </span>
      {deadlineAt !== null && (
        <CountdownPill deadlineAt={deadlineAt} onExpire={onExpire} nowOffsetMs={nowOffsetMs} />
      )}
    </div>
  )
}
