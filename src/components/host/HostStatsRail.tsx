'use client'

// Left rail of the host's live question stage — the single at-a-glance source
// of truth for "what's happening right now."
//
//   • Pre-reveal: live answered/total, a progress bar, and a muted placeholder
//     where the accuracy donut will appear. Reserves the space so the rail
//     never grows/jumps when the host reveals.
//   • Post-reveal (scored questions): the RevealStatsDonut (correct / incorrect
//     / unattempted) + per-option vote bars. Both were previously inlined in
//     the center stage, where their appearance caused the question/options to
//     reflow (the "stutter"). Living in the rail, they push nothing.
//
// The rail is purely presentational — all state (answered, optionCounts,
// questionEnded, correctRevealed, …) is owned by the session page and passed in.

import { ANSWER_COLORS } from '@/lib/answer-colors'
import { RevealStatsDonut } from './RevealStatsDonut'

export interface OptionStat {
  letter: string
  text: string
  votes: number
  isCorrect: boolean
}

interface HostStatsRailProps {
  answered: number
  connectedCount: number
  /** Per-option vote counts (indexed by option position). */
  optionCounts: number[]
  /** Option display data (letter + text + correctness), in display order. */
  options: OptionStat[]
  /** True once the host has revealed the correct answer for this question. */
  correctRevealed: boolean
  /** True for scored questions (MCQ/true-false/case…), false for polls/etc. */
  isScored: boolean
  /** "Expand to full-screen" affordance — wired to the ImmersiveStatsOverlay. */
  onExpand?: () => void
}

export function HostStatsRail({
  answered,
  connectedCount,
  optionCounts,
  options,
  correctRevealed,
  isScored,
  onExpand,
}: HostStatsRailProps) {
  const pctAnswered = connectedCount > 0 ? Math.round((answered / connectedCount) * 100) : 0

  // Reveal math — only meaningful for scored questions after the host reveals.
  const revealCorrect = correctRevealed && isScored
    ? optionCounts.reduce((sum, _c, i) => sum + (options[i]?.isCorrect ? (optionCounts[i] ?? 0) : 0), 0)
    : 0
  const revealIncorrect = correctRevealed && isScored ? Math.max(0, answered - revealCorrect) : 0
  const revealUnattempted = correctRevealed && isScored ? Math.max(0, connectedCount - answered) : 0

  return (
    <aside
      className="host-rail host-stats-rail flex flex-col rounded-2xl overflow-hidden h-full"
      style={{
        background: 'rgba(15,27,61,0.92)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: '#fff' }}>
          Live stats
        </h3>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Expand to full-screen stats (press S)"
            aria-label="Expand stats to full screen"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.82)',
              border: '1px solid rgba(255,255,255,0.16)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
              <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Answered / total + progress — always visible */}
      <div className="px-4 pb-3">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-black tabular-nums" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>
            {answered}
            <span className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>/{connectedCount}</span>
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {pctAnswered}% answered
          </span>
        </div>
        <div className="mt-2 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.14)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pctAnswered}%`,
              background: 'linear-gradient(90deg, #FBD13B 0%, #22C55E 100%)',
            }}
          />
        </div>
      </div>

      {/* Reveal block — reserved space so the rail never reflows on reveal.
          Pre-reveal shows a muted placeholder of the SAME total height
          (donut row + headline line); post-reveal swaps in the donut +
          breakdown. No height change = no stutter. */}
      {isScored ? (
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {correctRevealed ? (
            <RevealStatsDonut correct={revealCorrect} incorrect={revealIncorrect} unattempted={revealUnattempted} />
          ) : (
            <div className="flex items-center gap-3 py-1 opacity-60">
              <div className="w-[96px] h-[96px] rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} aria-hidden />
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <div className="h-3 w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <div className="h-3 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <span className="sr-only">Stats appear here after you reveal the answer</span>
            </div>
          )}
          {/* Headline keeps its line reserved in both states. */}
          <p
            className={`mt-2 text-[13px] font-black transition-opacity duration-300 ${correctRevealed && connectedCount > 0 ? 'opacity-100' : 'opacity-0'}`}
            style={{ color: '#fff' }}
            aria-hidden={!correctRevealed || connectedCount === 0}
          >
            {connectedCount > 0 ? `${Math.round((revealCorrect / connectedCount) * 100)}% got it right` : ' '}
          </p>
        </div>
      ) : null}

      {/* Per-option vote bars — ALWAYS mounted so the rail's layout is
          identical before and after the reveal. Pre-reveal the rows are
          masked (0% bars, counts hidden) so the projector never leaks the
          live distribution while participants are still answering; on reveal
          only the fills animate and the numbers fade in. */}
      {options.length > 0 && (
        <div className="px-4 py-3 flex-1 min-h-0 overflow-y-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Votes
            {!correctRevealed && (
              <span className="ml-1.5 normal-case tracking-normal font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                · after reveal
              </span>
            )}
          </p>
          <div className="space-y-2">
            {options.map((opt, i) => {
              const votes = optionCounts[i] ?? 0
              const pct = connectedCount > 0 ? Math.round((votes / connectedCount) * 100) : 0
              const color = ANSWER_COLORS[i % ANSWER_COLORS.length]
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[12px] font-bold mb-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                        style={{ background: color.hex }}
                      >
                        {opt.letter}
                      </span>
                      {/* Check slot reserved on EVERY row (not just the correct
                          one) — a single indented row before reveal would
                          silently give the answer away on the projector. */}
                      {isScored && (
                        <svg
                          viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity duration-300 ${correctRevealed && opt.isCorrect ? 'opacity-100' : 'opacity-0'}`}
                          aria-label={correctRevealed && opt.isCorrect ? 'Correct answer' : undefined}
                          aria-hidden={!(correctRevealed && opt.isCorrect)}
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                      <span className="truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{opt.text}</span>
                    </span>
                    <span
                      className={`tabular-nums flex-shrink-0 ml-2 transition-opacity duration-300 ${correctRevealed ? 'opacity-100' : 'opacity-0'}`}
                      style={{ color: '#fff' }}
                      aria-hidden={!correctRevealed}
                    >
                      {pct}% <span style={{ color: 'rgba(255,255,255,0.5)' }}>· {votes}</span>
                    </span>
                  </div>
                  {/* Fixed-height track — the fill animates width only. */}
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: correctRevealed ? `${pct}%` : '0%', background: opt.isCorrect && correctRevealed ? '#16A34A' : color.hex }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
