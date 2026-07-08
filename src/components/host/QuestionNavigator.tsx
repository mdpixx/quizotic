'use client'

// "Q3 of 15" made clickable — opens a popover grid of every slide so the host
// can jump straight to any not-yet-played question (Wayground-style question
// navigator). Played questions render dimmed with a check; the current one is
// ringed. The server (goto_question) is the authority and refuses replays.

import { useEffect, useRef, useState } from 'react'

interface NavigatorQuestion {
  type: string
}

interface QuestionNavigatorProps {
  questions: NavigatorQuestion[]
  currentIndex: number
  playedIndexes: Set<number>
  answerableNumber: number
  answerableTotal: number
  onJump: (index: number) => Promise<{ success: boolean; reason?: string }>
}

const REASON_LABEL: Record<string, string> = {
  played: 'That question was already played.',
  paused: 'Resume the quiz before jumping.',
  not_active: 'The quiz is not live.',
  current: 'Already on that question.',
  out_of_range: 'That question does not exist.',
}

export function QuestionNavigator({ questions, currentIndex, playedIndexes, answerableNumber, answerableTotal, onJump }: QuestionNavigatorProps) {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleJump(index: number) {
    setNotice(null)
    const res = await onJump(index)
    if (res.success) {
      setOpen(false)
    } else {
      setNotice(REASON_LABEL[res.reason ?? ''] ?? 'Could not jump to that question.')
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setNotice(null) }}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#FBD13B]"
        title="Jump to another question"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="font-display text-2xl font-black tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)', color: '#FBD13B' }}>
          Q{answerableNumber}
        </span>
        <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.72)' }}>
          of {answerableTotal}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 ml-auto" style={{ transform: open ? 'rotate(180deg)' : undefined }} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 rounded-2xl p-3 w-[280px]"
          style={{ background: 'rgba(15,27,61,0.97)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 16px 48px -12px rgba(0,0,0,0.7)' }}
          role="dialog"
          aria-label="Jump to question"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Jump to question
          </p>
          <div className="grid grid-cols-6 gap-1.5 max-h-[40vh] overflow-y-auto">
            {questions.map((q, i) => {
              const isCurrent = i === currentIndex
              const isPlayed = playedIndexes.has(i) && !isCurrent
              const isLeaderboardSlide = q.type === 'leaderboard'
              return (
                <button
                  key={i}
                  onClick={() => !isCurrent && !isPlayed && handleJump(i)}
                  disabled={isCurrent || isPlayed}
                  className="relative h-9 rounded-lg text-[12px] font-black tabular-nums flex items-center justify-center transition-colors"
                  style={{
                    background: isCurrent ? '#FBD13B' : 'rgba(255,255,255,0.08)',
                    color: isCurrent ? '#0F1B3D' : isPlayed ? 'rgba(255,255,255,0.35)' : '#fff',
                    border: isCurrent ? '2px solid #FBD13B' : '1px solid rgba(255,255,255,0.14)',
                    cursor: isCurrent || isPlayed ? 'default' : 'pointer',
                  }}
                  title={isLeaderboardSlide ? `Slide ${i + 1}: standings` : `Question ${i + 1}${isPlayed ? ' (played)' : isCurrent ? ' (current)' : ''}`}
                >
                  {isLeaderboardSlide ? '🏆' : i + 1}
                  {isPlayed && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 absolute top-0.5 right-0.5" aria-hidden>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
          {notice && (
            <p className="mt-2 text-[11px] font-semibold" style={{ color: '#FCA5A5' }}>{notice}</p>
          )}
        </div>
      )}
    </div>
  )
}
