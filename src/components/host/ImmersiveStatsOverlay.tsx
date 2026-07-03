'use client'

// Full-screen immersive stats view for the host. A dedicated, projector-friendly
// breakdown of the current question's results — big accuracy donut, large
// per-option vote bars with counts, and the "X% got it right" headline.
//
// This is the answer to "where do we place the stats screen?" — it's NOT forced
// after every question. The host opens it on demand (button in the stats rail,
// the 'S' key, or an optional per-session auto-show toggle) and dismisses it
// (Esc / click-out / close button). It does not auto-advance the quiz.

import { useEffect } from 'react'
import { ANSWER_COLORS } from '@/lib/answer-colors'

export interface ImmersiveOptionStat {
  letter: string
  text: string
  votes: number
  isCorrect: boolean
}

interface ImmersiveStatsOverlayProps {
  open: boolean
  onClose: () => void
  questionNumber: number | string
  questionTotal: number | string
  questionText?: string
  answered: number
  connectedCount: number
  optionCounts: number[]
  options: ImmersiveOptionStat[]
  correctRevealed: boolean
  isScored: boolean
  /** Host preference: open this overlay automatically after each reveal. */
  autoOpenAfterReveal?: boolean
  /** Flips (and persists) the auto-open preference. */
  onToggleAutoOpen?: () => void
}

export function ImmersiveStatsOverlay({
  open,
  onClose,
  questionNumber,
  questionTotal,
  questionText,
  answered,
  connectedCount,
  optionCounts,
  options,
  correctRevealed,
  isScored,
  autoOpenAfterReveal,
  onToggleAutoOpen,
}: ImmersiveStatsOverlayProps) {
  // Esc closes (defense-in-depth — the page-level key handler also clears `open`).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const revealCorrect = correctRevealed && isScored
    ? optionCounts.reduce((sum, _c, i) => sum + (options[i]?.isCorrect ? (optionCounts[i] ?? 0) : 0), 0)
    : 0
  const revealIncorrect = correctRevealed && isScored ? Math.max(0, answered - revealCorrect) : 0
  const revealUnattempted = correctRevealed && isScored ? Math.max(0, connectedCount - answered) : 0
  const accuracyPct = connectedCount > 0 ? Math.round((revealCorrect / connectedCount) * 100) : 0
  const total = Math.max(0, revealCorrect) + Math.max(0, revealIncorrect) + Math.max(0, revealUnattempted)

  // Donut geometry
  const size = 220
  const stroke = 22
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const arc = total > 0 ? (revealCorrect / total) * circumference : 0

  const rows = [
    { label: 'Correct', value: revealCorrect, color: '#16A34A' },
    { label: 'Incorrect', value: revealIncorrect, color: '#DC2626' },
    { label: 'Unattempted', value: revealUnattempted, color: '#9CA3AF' },
  ]

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center p-6 lg:p-10"
      style={{ background: 'rgba(7,17,38,0.96)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Question ${questionNumber} results`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
        aria-label="Close stats (Esc)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
      </button>

      <div className="w-full max-w-5xl flex flex-col items-center gap-6 lg:gap-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Question {questionNumber} of {questionTotal} · Results
          </p>
          {questionText && (
            <p className="mt-2 text-xl lg:text-2xl font-display font-bold max-w-3xl mx-auto" style={{ color: '#fff', fontFamily: 'var(--font-display)' }}>
              {questionText}
            </p>
          )}
        </div>

        {/* Donut + accuracy headline */}
        {isScored && correctRevealed ? (
          <div className="flex flex-col items-center gap-4">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${accuracyPct}% accuracy`}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
              <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#16A34A"
                strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${arc} ${circumference - arc}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dasharray 700ms ease' }}
              />
              <text x="50%" y="46%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="52" fontWeight="900" fontFamily="var(--font-heading)">
                {accuracyPct}%
              </text>
              <text x="50%" y="62%" dominantBaseline="central" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="16" fontWeight="700" fontFamily="var(--font-heading)">
                accuracy
              </text>
            </svg>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {rows.map(row => (
                <div key={row.label} className="flex items-center gap-2 text-base font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: row.color }} />
                  {row.label}
                  <span className="tabular-nums font-black" style={{ color: '#fff' }}>{row.value}/{total}</span>
                </div>
              ))}
            </div>
            <p className="text-3xl lg:text-4xl font-display font-black" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>
              {connectedCount > 0 ? `${accuracyPct}% got it right` : 'Waiting for answers'}
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-2xl font-display font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {correctRevealed ? 'Live results' : 'Reveal the answer to see results'}
            </p>
            <p className="mt-2 text-lg tabular-nums" style={{ color: '#FBD13B' }}>
              {answered}/{connectedCount} answered
            </p>
          </div>
        )}

        {/* Per-option bars */}
        {options.length > 0 && correctRevealed && (
          <div className="w-full max-w-3xl space-y-3">
            {options.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = connectedCount > 0 ? Math.round((votes / connectedCount) * 100) : 0
              const color = ANSWER_COLORS[i % ANSWER_COLORS.length]
              const correct = opt.isCorrect && isScored
              return (
                <div
                  key={i}
                  className="rounded-2xl p-3 lg:p-4 flex items-center gap-3"
                  style={{
                    background: correct ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${correct ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.14)'}`,
                  }}
                >
                  <span
                    className="w-11 h-11 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center text-xl lg:text-2xl font-black text-white flex-shrink-0"
                    style={{ background: color.hex, boxShadow: '0 4px 0 rgba(0,0,0,0.16)' }}
                  >
                    {opt.letter}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-black text-base lg:text-lg truncate" style={{ color: '#fff' }}>
                        {opt.text}
                        {correct && <span className="ml-2 text-green-400">✓</span>}
                      </span>
                      <span className="tabular-nums font-black flex-shrink-0" style={{ color: '#fff' }}>
                        {pct}% <span style={{ color: 'rgba(255,255,255,0.55)' }}>· {votes}</span>
                      </span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: correct ? '#16A34A' : color.hex }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
          {onToggleAutoOpen && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <input
                type="checkbox"
                checked={Boolean(autoOpenAfterReveal)}
                onChange={onToggleAutoOpen}
                className="w-4 h-4 rounded accent-[#FBD13B]"
              />
              Open automatically after each reveal
            </label>
          )}
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Press <kbd className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(255,255,255,0.12)' }}>Esc</kbd> or tap outside to close
          </p>
        </div>
      </div>
    </div>
  )
}
