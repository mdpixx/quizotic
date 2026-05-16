'use client'

import { useEffect, useState } from 'react'

// Personal feedback strip shown on the participant's `answered` screen
// instead of "Waiting for next question…". Driven by the server's
// `personal_result` event so each player sees data that's actually theirs:
// points earned, rank delta, streak, fastest-in-room badge, top-5 flip, etc.

export interface PersonalResult {
  questionIndex: number
  isCorrect: boolean | null
  pointsEarned: number
  basePoints: number
  streakBonus: number
  streakCount: number
  totalScore: number
  rank: number | null
  prevRank: number | null
  delta: number
  isFastest: boolean
  crossedTopFive: boolean
  teamContribution?: number
  correctPositions?: number
  totalPositions?: number
}

interface ResultBeatProps {
  result: PersonalResult | null
  // Visible label fallback for sessions where the server hasn't sent
  // a personal_result yet (e.g. mid-deploy or non-scored questions).
  fallback?: React.ReactNode
}

function CountUp({ to, duration = 700 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (to <= 0) { setVal(0); return }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(to * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return <>{val.toLocaleString()}</>
}

export function ResultBeat({ result, fallback }: ResultBeatProps) {
  if (!result) return <>{fallback ?? null}</>

  const { isCorrect, pointsEarned, streakCount, streakBonus, rank, delta, isFastest, crossedTopFive, totalScore, correctPositions, totalPositions } = result
  const correct = isCorrect === true
  const wrong = isCorrect === false
  const isSequenceRanking = correctPositions !== undefined && totalPositions !== undefined && totalPositions > 0

  const accent = correct ? '#16A34A' : wrong ? '#DC2626' : '#0F1B3D'

  return (
    <div className="w-full flex flex-col items-stretch gap-3">
      {/* Sequence ranking feedback */}
      {isSequenceRanking && (
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0F1B3D 0%, #1B2A5E 100%)', color: '#fff' }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">Your sequence</p>
            <p className="text-4xl font-black tabular-nums">
              <CountUp to={correctPositions!} /> of <CountUp to={totalPositions!} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">Points</p>
            <p className="text-2xl font-black tabular-nums">
              +<CountUp to={pointsEarned} />
            </p>
          </div>
        </div>
      )}

      {/* Headline points or wrong-but-okay state */}
      {!isSequenceRanking && correct && pointsEarned > 0 && (
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0F1B3D 0%, #1B2A5E 100%)', color: '#fff' }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">You earned</p>
            <p className="text-4xl font-black tabular-nums" style={{ color: '#F5E642' }}>
              +<CountUp to={pointsEarned} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">Total</p>
            <p className="text-2xl font-black tabular-nums">
              <CountUp to={totalScore} />
            </p>
          </div>
        </div>
      )}

      {/* Rank delta — the kinetic engagement hook for non-podium players */}
      {typeof rank === 'number' && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: '#fff', border: `1.5px solid ${accent}22` }}
        >
          <span
            className="text-3xl font-black tabular-nums"
            style={{ color: '#0F1B3D' }}
          >
            #{rank}
          </span>
          <span className="flex-1 text-xs" style={{ color: '#6B7280' }}>
            {delta > 0
              ? <>Up <strong style={{ color: '#16A34A' }}>{delta}</strong> place{delta === 1 ? '' : 's'} this round</>
              : delta < 0
                ? <>Down <strong style={{ color: '#DC2626' }}>{Math.abs(delta)}</strong> place{delta === -1 ? '' : 's'} — push harder next round</>
                : <>You held position — keep it up</>}
          </span>
          {delta !== 0 && (
            <span
              className="text-2xl font-black"
              style={{ color: delta > 0 ? '#16A34A' : '#DC2626' }}
              aria-hidden
            >
              {delta > 0 ? '↑' : '↓'}
            </span>
          )}
        </div>
      )}

      {/* Badges row — only renders when something earned */}
      <div className="flex flex-wrap gap-2">
        {streakCount >= 2 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black"
            style={{
              background: streakCount >= 4 ? 'linear-gradient(135deg,#F5E642,#FF8A47)' : '#0F1B3D',
              color: streakCount >= 4 ? '#0D0D0D' : '#F5E642',
            }}
          >
            🔥 {streakCount}-in-a-row
            {streakBonus > 0 && <span className="opacity-80 font-semibold">+{streakBonus}</span>}
          </span>
        )}
        {isFastest && correct && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            ⚡ Fastest in the room
          </span>
        )}
        {crossedTopFive && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black"
            style={{ background: '#DCFCE7', color: '#15803D' }}
          >
            🏆 Top 5
          </span>
        )}
        {wrong && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black"
            style={{ background: '#FEE2E2', color: '#991B1B' }}
          >
            Try the next one
          </span>
        )}
      </div>
    </div>
  )
}
