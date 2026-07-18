'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import type { Slide, Presentation } from '@/lib/presentation-types'
import { SLIDE_TYPE_META, shouldAutoShowResults, getSlideBg, getSlideTextColor } from '@/lib/presentation-types'
import { getQuizTheme } from '@/lib/quiz-themes'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { SlideImage } from '@/components/SlideImage'
import { SlideImageFrame } from '@/components/SlideImageFrame'
import { ANSWER_COLORS } from '@/lib/answer-colors'
import { PRESENTATION_SEQUENCE } from '@/lib/sequence-theme'
import { track } from '@/lib/analytics'
import { PostSessionHeader } from '@/components/PostSessionHeader'
import { PresentationSummary } from '@/components/PresentationSummary'
import { SpinWheel } from '@/components/presentation/SpinWheel'
import { useConfetti } from '@/hooks/useConfetti'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// Canonical Kahoot palette for answer/option rendering — shared with quiz
// host view and participant phone so colors match across every surface.
const OPTION_HEX = ANSWER_COLORS.map(c => c.hex)

// ─── Types ────────────────────────────────────────────────────────────────────

interface AggregateData {
  total: number
  counts?: number[]                 // bar chart types
  words?: Record<string, number>    // word cloud (frequency-bucketed)
  responses?: string[]              // open_text (full free-text strings)
  scores?: number[]                 // rating / scale
  emojis?: Record<string, number>   // emoji pulse
  pins?: { x: number; y: number }[] // pinpoint / grid_2x2
  rankings?: number[][]             // ranking (each entry is [first, second, …] option indices)
  ideas?: { id: string; text: string; votes: number }[]  // brainstorm (upvotable idea cards)
}

interface FloatingVoter { id: string; x: number; color: string; emoji: string }
interface Toast { id: string; message: string }
interface Milestone { count: number; label: string }

const MILESTONES: Milestone[] = [
  { count: 10, label: '10 votes!' },
  { count: 25, label: '25 votes!' },
  { count: 50, label: 'Half century!' },
  { count: 100, label: '100 votes!' },
]

const VOTER_EMOJIS = ['🦊','🐯','🐸','🦁','🐼','🐙','🦋','🐝','🦜','🐬']
const VOTER_COLORS = ['#0F1B3D','#FF8A47','#0891B2','#16A34A','#EA580C','#FFD166','#DC2626']

// ─── Web Audio sound engine ───────────────────────────────────────────────────

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try { return new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)() }
  catch { return null }
}

function playBubbleSound(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  const t = ctx.currentTime
  osc.frequency.setValueAtTime(600, t)
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.12)
  gain.gain.setValueAtTime(0.18, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  osc.type = 'sine'
  osc.start(t); osc.stop(t + 0.15)
}

function playMilestoneSound(ctx: AudioContext) {
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const t = ctx.currentTime + i * 0.1
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.22, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.type = 'triangle'
    osc.start(t); osc.stop(t + 0.4)
  })
}

// ─── Live poll bar ────────────────────────────────────────────────────────────

function PollBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className="space-y-1.5 relative overflow-visible">
      <div className="flex items-center justify-between">
        <span className="text-xl font-semibold" style={{ color: '#0F1B3D' }}>{label}</span>
        <span className="text-xl font-bold tabular-nums" style={{ color }}>{count} <span className="text-base font-normal opacity-60">({pct}%)</span></span>
      </div>
      <div className="h-10 rounded-full overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
        {/* key={count} remounts the overlay on every new vote so the fade-out
            animation replays — a stateless replacement for the old
            setState + setTimeout ripple. */}
        {count > 0 && (
          <div key={count} className="absolute inset-0 rounded-full"
            style={{ background: `${color}33`, animation: 'poll-ripple 0.6s ease-out both' }} />
        )}
      </div>
      <style>{`@keyframes poll-ripple { 0% { opacity: 1 } 100% { opacity: 0 } }`}</style>
    </div>
  )
}

// ─── Live word cloud ──────────────────────────────────────────────────────────

function WordCloud({ words }: { words: Record<string, number> }) {
  const entries = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 30)
  const max = entries[0]?.[1] ?? 1
  // Light, Mentimeter-style palette: muted but readable on white. All horizontal,
  // size scales with frequency, colour cycles by rank.
  const colors = ['#7C82FF', '#FF8A8A', '#5DB6E5', '#F4A582', '#B19CD9', '#FFB088', '#94B3D1', '#F2A9C0']
  // Interleave by rank so the biggest words land near the middle of the flex-wrap flow
  const ordered: [string, number, number][] = []
  entries.forEach(([w, c], i) => ordered.push([w, c, i]))
  const arranged: [string, number, number][] = []
  const mid = Math.floor(ordered.length / 2)
  ordered.forEach((item, idx) => {
    const offset = idx % 2 === 0 ? idx / 2 : -Math.ceil(idx / 2)
    arranged[mid + offset] = item
  })
  return (
    <div className="flex flex-wrap items-center justify-center w-full h-full gap-x-8 gap-y-3 px-6 py-4">
      {arranged.filter(Boolean).map(([word, count, rank]) => {
        const ratio = count / max
        const size = 24 + Math.round(ratio * 106) // 24px → 130px range for stronger hierarchy
        return (
          <span key={word} className="font-black leading-none transition-all duration-500"
            style={{ fontSize: size, color: colors[rank % colors.length], fontFamily: 'var(--font-heading)' }}>
            {word}
          </span>
        )
      })}
    </div>
  )
}

// ─── Speed waveform ───────────────────────────────────────────────────────────

function SpeedWaveform({ recentVotes }: { recentVotes: number[] }) {
  const max = Math.max(...recentVotes, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {recentVotes.slice(-20).map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max(4, (v / max) * 32)}px`,
            background: `rgba(124,58,237,${0.3 + (v / max) * 0.7})`,
          }} />
      ))}
    </div>
  )
}

// ─── Live results chart (bar / donut / pie) ──────────────────────────────────

// Donut/pie geometry helpers.
function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarXY(cx, cy, r, startDeg)
  const e = polarXY(cx, cy, r, endDeg)
  const large = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`
}

type ChartVariant = 'bar' | 'donut' | 'pie'
type ChartMetric = 'count' | 'percent'

function ResultChart({
  options, counts, total, colors, showResults, correctIndex,
  variant = 'bar', metric = 'count',
}: {
  options: string[]
  counts: number[]
  total: number
  colors: string[]
  showResults: boolean
  correctIndex?: number
  variant?: ChartVariant
  metric?: ChartMetric
}) {
  const max = Math.max(...counts, 1)
  const correctActive = showResults && typeof correctIndex === 'number'
  const pctOf = (i: number) => (total > 0 ? Math.round(((counts[i] ?? 0) / total) * 100) : 0)
  const primary = (i: number) => (metric === 'percent' ? `${pctOf(i)}%` : `${counts[i] ?? 0}`)
  const secondary = (i: number) => (metric === 'percent' ? `${counts[i] ?? 0}` : `${pctOf(i)}%`)
  // Correct-answer reveal choreography: dim every non-correct option so the
  // spotlight lands on the right answer (the AhaSlides/Mentimeter reveal beat).
  const dimOpacity = (i: number) => (correctActive && correctIndex !== i ? 0.4 : 1)
  const segColor = (i: number) => (correctActive && correctIndex === i ? '#16A34A' : colors[i % colors.length])

  // ─ Donut / pie: proportional ring (or slices) + legend ────────────────────
  if (variant === 'donut' || variant === 'pie') {
    const r = 80
    const cx = 100
    const cy = 100
    const C = 2 * Math.PI * r
    const isDonut = variant === 'donut'
    const leadingIdx = counts.indexOf(Math.max(...counts))
    const focusIdx = correctActive ? (correctIndex as number) : total > 0 ? leadingIdx : -1

    // Fraction per option + cumulative sweep angles. Computed without
    // mutating a running accumulator inside the map so the render stays pure.
    const fracs = options.map((_, i) => (total > 0 ? (counts[i] ?? 0) / total : 0))
    const slices = options.map((opt, i) => {
      const startDeg = fracs.slice(0, i).reduce((a, b) => a + b, 0) * 360
      return { i, opt, f: fracs[i], startDeg, endDeg: startDeg + fracs[i] * 360 }
    })

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 md:flex-row md:gap-10">
        <div className="relative" style={{ width: 240, height: 240, flexShrink: 0 }}>
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {isDonut ? (
              <>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={26} />
                {slices.filter(s => s.f > 0).map(s => (
                  <circle key={s.i} cx={cx} cy={cy} r={r} fill="none"
                    stroke={segColor(s.i)}
                    strokeWidth={correctActive && correctIndex === s.i ? 32 : 26}
                    strokeDasharray={`${s.f * C} ${C}`}
                    strokeDashoffset={-(s.startDeg / 360) * C}
                    transform="rotate(-90 100 100)"
                    style={{
                      opacity: dimOpacity(s.i),
                      transition: 'stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease, stroke-width 0.3s ease',
                      filter: correctActive && correctIndex === s.i ? 'drop-shadow(0 0 6px #16A34A88)' : 'none',
                    }}
                  />
                ))}
              </>
            ) : (
              <>
                {total === 0 && <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.06)" />}
                {slices.filter(s => s.f > 0).map(s => (
                  // A single option with 100% spans 0→360°, where SVG treats the
                  // arc's identical start/end points as "omit the arc" (renders
                  // nothing). Draw a full circle for that case instead.
                  s.f >= 0.9999 ? (
                    <circle key={s.i} cx={cx} cy={cy} r={r} fill={segColor(s.i)}
                      stroke="#fff" strokeWidth={2}
                      style={{
                        opacity: dimOpacity(s.i),
                        transition: 'opacity 0.4s ease',
                        filter: correctActive && correctIndex === s.i ? 'drop-shadow(0 0 6px #16A34A88)' : 'none',
                      }}
                    />
                  ) : (
                  <path key={s.i} d={pieSlicePath(cx, cy, r, s.startDeg, s.endDeg)} fill={segColor(s.i)}
                    stroke="#fff" strokeWidth={2} strokeLinejoin="round"
                    style={{
                      opacity: dimOpacity(s.i),
                      transition: 'opacity 0.4s ease',
                      filter: correctActive && correctIndex === s.i ? 'drop-shadow(0 0 6px #16A34A88)' : 'none',
                    }}
                  />
                  )
                ))}
              </>
            )}
          </svg>

          {isDonut && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              {total > 0 ? (
                <>
                  <span className="text-4xl font-black tabular-nums" style={{ color: correctActive ? '#16A34A' : '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                    {focusIdx >= 0 ? primary(focusIdx) : '0'}
                  </span>
                  <span className="mt-1 inline-flex max-w-[150px] items-center gap-1 truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: '#6B7280' }}>
                    {correctActive && <span>✓</span>}
                    {correctActive ? 'correct' : focusIdx >= 0 ? (options[focusIdx] || 'leading') : 'responses'}
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>Waiting…</span>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex w-full max-w-xs flex-col justify-center gap-2 md:w-auto">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2.5"
              style={{ opacity: dimOpacity(i), transition: 'opacity 0.4s ease' }}>
              <span className="h-3.5 w-3.5 flex-shrink-0 rounded-[4px]" style={{ background: segColor(i) }} />
              <span className="flex-1 truncate text-sm font-semibold"
                style={{ color: correctActive && correctIndex === i ? '#16A34A' : '#0F1B3D' }}>
                {correctActive && correctIndex === i && <span className="mr-1">✓</span>}
                {opt || `Option ${i + 1}`}
              </span>
              <span className="text-sm font-black tabular-nums" style={{ color: segColor(i) }}>{primary(i)}</span>
              <span className="w-12 text-right text-xs tabular-nums" style={{ color: '#9CA3AF' }}>{secondary(i)}</span>
            </div>
          ))}
          <p className="mt-1 text-center text-[11px] font-semibold md:text-left" style={{ color: '#9CA3AF' }}>
            {total} {total === 1 ? 'response' : 'responses'}
          </p>
        </div>
      </div>
    )
  }

  // ─ Bar (default): vertical columns, count + % dual, correct-reveal dim ────
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 32, flex: 1, minHeight: 200 }}>
      {options.map((opt, i) => {
        const count = counts[i] ?? 0
        const heightPct = count > 0 ? Math.max(3, (count / max) * 100) : 0
        const isLeading = count > 0 && count === Math.max(...counts)
        const isCorrect = correctActive && correctIndex === i
        const color = segColor(i)

        return (
          <div key={i} style={{ flex: '1 1 0', minWidth: 0, maxWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', opacity: dimOpacity(i), transition: 'opacity 0.4s ease' }}>
            {/* Bar area: metric label sits directly above the bar */}
            <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              {isCorrect ? (
                <span style={{ color: '#16A34A', fontWeight: 900, fontSize: 22, lineHeight: 1, marginBottom: 4 }}>✓</span>
              ) : count > 0 ? (
                <span style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{primary(i)}</span>
              ) : null}
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  minHeight: count > 0 ? 6 : 0,
                  borderRadius: '10px 10px 4px 4px',
                  background: isCorrect
                    ? `linear-gradient(180deg, #16A34A 0%, #15803D 100%)`
                    : isLeading
                    ? `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`
                    : `linear-gradient(180deg, ${color}77 0%, ${color}44 100%)`,
                  boxShadow: isCorrect ? '0 0 20px #16A34A55' : isLeading ? `0 0 20px ${color}55, 0 -2px 10px ${color}33` : 'none',
                  border: isCorrect ? '2px solid #16A34A' : 'none',
                  transition: 'height 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>

            {/* Floor line — drawn at the same y across all columns because
                the label area below has a fixed min-height (2 lines worth)
                regardless of how many lines the actual label wraps to. */}
            <div style={{ width: '100%', height: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 1, margin: '3px 0' }} />

            {/* Option label + secondary metric — fixed height container so the
                floor line and bar baseline stay aligned across columns
                even when one label wraps to 2 lines. */}
            <div style={{
              textAlign: 'center',
              maxWidth: '100%',
              paddingTop: 4,
              minHeight: '3.6em',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 3,
            }}>
              <div style={{
                fontSize: options.length > 4 ? 15 : 18,
                fontWeight: 700,
                color: isCorrect ? '#16A34A' : '#0F1B3D',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                whiteSpace: options.length > 6 ? 'nowrap' : 'normal',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}>
                {opt || `Option ${i + 1}`}
              </div>
              {showResults && total > 0 && (
                <div style={{ fontSize: 15, color, fontWeight: 700 }}>
                  {secondary(i)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Wheel Spinner Component ─────────────────────────────────────────────────
//
// Wheel of Names. The host is the only one who spins; the SERVER is
// authoritative for the winner and target rotation, broadcasting
// `presenter_wheel_result` so every participant phone reveals the same name.
// This component receives the latest result via props and animates the SVG
// `<SpinWheel>` to `result.targetRotation`. No client-side `Math.random`.

export interface WheelResult {
  slideIndex: number
  winnerIndex: number
  winnerName: string
  names: string[]
  targetRotation: number
  durationMs: number
  at: number
}

function WheelSpinner({
  names,
  headingStyle,
  title,
  result,
  spinning,
  onSpin,
  slideId,
}: {
  names: string[]
  headingStyle: React.CSSProperties
  title: string
  result: WheelResult | null
  spinning: boolean
  onSpin: () => void
  slideId: string
}) {
  // Rotation is derived directly from the latest server result — no effect
  // needed to set it. The parent clears `result` when the slide changes, so
  // navigating away/back resets the wheel to 0 naturally.
  const rotation = result?.targetRotation ?? 0
  // Winner highlight is revealed only after the spin animation settles. We
  // stash the pending result in a ref and flip state from inside the timeout
  // (async setState is allowed by react-hooks/set-state-in-effect).
  const [revealed, setRevealed] = useState<{ name: string; idx: number } | null>(null)

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => {
      setRevealed({ name: result.winnerName, idx: result.winnerIndex })
    }, result.durationMs + 120)
    return () => clearTimeout(t)
  }, [result])

  const winnerName = result ? (revealed?.name ?? null) : null
  const highlightIdx = result ? revealed?.idx : undefined
  // slideId is part of the parent's reset contract (clears result on change).
  void slideId

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <h2 className="leading-tight flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(20px, 3cqw, 40px)' }}>
        {title || 'Wheel of Names'}
      </h2>
      {names.length === 0 ? (
        <p className="text-sm text-center" style={{ color: '#9CA3AF' }}>No names added to this wheel.</p>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <SpinWheel
              names={names}
              rotation={rotation}
              winnerIndex={highlightIdx}
              spinDurationMs={result?.durationMs ?? 5200}
              style={{ height: '100%', maxWidth: 'min(100%, 52cqw)' }}
            />
          </div>
          {winnerName && (
            <div className="text-center flex-shrink-0">
              <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: headingStyle.color }}>
                Winner
              </p>
              <p className="text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#FACC15' }}>
                {winnerName}
              </p>
            </div>
          )}
          <button onClick={onSpin} disabled={spinning || names.length === 0}
            className="w-full py-4 rounded-xl text-lg font-bold transition-all hover:scale-[1.02] disabled:opacity-50 flex-shrink-0"
            style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, fontFamily: 'var(--font-heading)' }}>
            {spinning ? 'Spinning…' : winnerName ? 'Spin Again' : 'Spin!'}
          </button>
        </>
      )}
    </div>
  )
}

function getVideoEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    const ytId = u.searchParams.get('v')
      || (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null)
      || (u.pathname.includes('/shorts/') ? u.pathname.split('/shorts/')[1] : null)
    if (ytId) return `https://www.youtube.com/embed/${ytId.split('?')[0]}`
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video${u.pathname}`
    return url.replace('watch?v=', 'embed/')
  } catch { return url }
}

// ─── Slide content renderer ───────────────────────────────────────────────────

function SlideContent({ slide, aggregate, showResults, correctRevealed, chartVariant = 'bar', chartMetric = 'count', wheelResult, wheelSpinning, onWheelSpin }: { slide: Slide; aggregate: AggregateData; showResults: boolean; correctRevealed: boolean; chartVariant?: ChartVariant; chartMetric?: ChartMetric; wheelResult?: WheelResult | null; wheelSpinning?: boolean; onWheelSpin?: () => void }) {
  const textColor = getSlideTextColor(slide)
  const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-heading)', color: textColor, fontWeight: 900 }

  switch (slide.type) {
    case 'multiple_choice':
    case 'quick_fire':
    case 'live_race':
    case 'word_duel': {
      const options = slide.type === 'word_duel'
        ? [slide.optionA, slide.optionB]
        : (slide as { options: string[] }).options
      const barColors = slide.type === 'word_duel'
        ? [OPTION_HEX[1], OPTION_HEX[0]] // duel: blue vs red (Kahoot B & A)
        : OPTION_HEX
      const counts = aggregate.counts ?? new Array(options.length).fill(0)
      const typedSlide = slide as { question?: string; showCorrect?: boolean; correctIndex?: number }

      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(20px, 3cqw, 40px)' }}>
            {typedSlide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex-1 min-h-0 flex flex-col justify-end">
            <ResultChart
              options={options}
              counts={counts}
              total={aggregate.total}
              colors={barColors}
              showResults={showResults}
              correctIndex={correctRevealed && typedSlide.showCorrect ? typedSlide.correctIndex : undefined}
              variant={chartVariant}
              metric={chartMetric}
            />
          </div>
        </div>
      )
    }

    case 'open_text': {
      // Free-text wall — render the most recent responses as colored cards.
      // Different from word_cloud (frequency bucket of single words) — open
      // text preserves full sentences with original casing.
      const responses = aggregate.responses ?? []
      // Stable per-card colors so re-renders don't flicker.
      const palette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
      const visible = responses.slice(-30) // last 30 fit comfortably; older scroll off
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex-1 flex items-start justify-center overflow-hidden p-2">
            {showResults && visible.length > 0 ? (
              <div className="flex flex-wrap gap-3 content-start justify-center max-h-full overflow-auto">
                {visible.map((text, i) => {
                  const color = palette[i % palette.length]
                  return (
                    <div
                      key={`${i}-${text.slice(0, 20)}`}
                      className="rounded-2xl px-4 py-3 text-sm sm:text-base font-medium max-w-[45%] break-words"
                      style={{ background: `${color}14`, color, border: `1px solid ${color}40` }}
                    >
                      {text}
                    </div>
                  )
                })}
              </div>
            ) : (
              showResults && (
                <p className="text-2xl opacity-40">Waiting for responses…</p>
              )
            )}
          </div>
        </div>
      )
    }

    case 'brainstorm': {
      // Idea board — cards sized + sorted by upvotes (highest first).
      const ideas = [...(aggregate.ideas ?? [])].sort((a, b) => b.votes - a.votes)
      const maxVotes = ideas.reduce((m, it) => Math.max(m, it.votes), 0)
      const palette = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4']
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Brainstorm prompt...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex-1 flex items-start justify-center overflow-hidden p-2">
            {showResults && ideas.length > 0 ? (
              <div className="flex flex-wrap gap-3 content-start justify-center max-h-full overflow-auto">
                {ideas.map((idea, i) => {
                  const color = palette[i % palette.length]
                  const isTop = idea.votes > 0 && idea.votes === maxVotes
                  return (
                    <div
                      key={idea.id}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold max-w-[45%] break-words transition-all"
                      style={{
                        background: `${color}14`, color,
                        border: `${isTop ? 2 : 1}px solid ${color}${isTop ? '' : '40'}`,
                        fontSize: 'clamp(13px, 1.4cqw, 20px)',
                      }}
                    >
                      <span className="flex items-center gap-1 font-black tabular-nums flex-shrink-0">▲ {idea.votes}</span>
                      <span>{idea.text}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              showResults && (
                <p className="text-2xl opacity-40">Waiting for ideas…</p>
              )
            )}
          </div>
        </div>
      )
    }

    case 'word_cloud':
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex-1 flex items-center justify-center">
            {showResults && aggregate.words && <WordCloud words={aggregate.words} />}
          </div>
        </div>
      )

    case 'rating_scale':
      return (
        <div className="flex flex-col h-full gap-5">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex items-center justify-between text-xl font-semibold flex-shrink-0" style={{ color: textColor, opacity: 0.6 }}>
            <span>{slide.minLabel}</span>
            <span>{slide.maxLabel}</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {showResults && aggregate.scores && aggregate.scores.length > 0 && (
              <div className="text-center">
                <p className="text-7xl font-black" style={{ color: textColor, fontFamily: 'var(--font-heading)' }}>
                  {(aggregate.scores.reduce((a, b) => a + b, 0) / aggregate.scores.length).toFixed(1)}
                </p>
                <p className="text-xl mt-2" style={{ color: textColor, opacity: 0.6 }}>average rating · {aggregate.total} responses</p>
              </div>
            )}
          </div>
        </div>
      )

    case 'emoji_pulse':
      return (
        <div className="flex flex-col h-full gap-5">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Prompt text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex-1 flex items-center justify-center">
            {showResults && aggregate.emojis && (
              <div className="flex flex-wrap gap-8 justify-center">
                {slide.emojis.map(em => (
                  <div key={em} className="flex flex-col items-center gap-2">
                    <span className="text-6xl">{em}</span>
                    <span className="text-2xl font-black" style={{ color: textColor }}>
                      {aggregate.emojis?.[em] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )

    case 'ranking': {
      // Borda count: each ordering [a, b, c, d] gives a=N, b=N-1, c=N-2, d=1.
      // Sum across all submissions, sort descending → consensus ranking.
      // Historical bug: server stored Number([0,1,2]) (=NaN) into counts,
      // so the bars never moved. Now the server stores the full ordering
      // array in `aggregate.rankings` and we compute the consensus here.
      const numItems = slide.items.length
      const rankings = aggregate.rankings ?? []
      const scoreByItem = new Array(numItems).fill(0)
      for (const ordering of rankings) {
        ordering.forEach((optionIdx, position) => {
          if (optionIdx >= 0 && optionIdx < numItems) {
            scoreByItem[optionIdx] += (numItems - position)
          }
        })
      }
      const ranked = slide.items
        .map((label, i) => ({ label: label || `Item ${i + 1}`, score: scoreByItem[i], originalIndex: i }))
        .sort((a, b) => b.score - a.score)
      const maxScore = Math.max(1, ...scoreByItem)
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex-1 flex flex-col justify-center">
            {showResults && rankings.length > 0 ? (
              <div className="space-y-3">
                {ranked.map((item, displayPos) => (
                  <PollBar
                    key={item.originalIndex}
                    label={`#${displayPos + 1} · ${item.label}`}
                    count={item.score}
                    total={maxScore}
                    color="#4F46E5"
                  />
                ))}
                <p className="text-sm opacity-60 text-center pt-2">
                  Consensus from {rankings.length} {rankings.length === 1 ? 'response' : 'responses'} (Borda count)
                </p>
              </div>
            ) : (
              showResults && <p className="text-2xl opacity-40 text-center">Waiting for rankings…</p>
            )}
          </div>
        </div>
      )
    }

    case 'scale_100':
      return (
        <div className="flex flex-col h-full gap-5">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(22px, 3.4cqw, 44px)' }}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <SlideImageFrame url={slide.contentImageUrl} />
          <div className="flex items-center justify-between text-xl font-semibold flex-shrink-0" style={{ color: textColor, opacity: 0.6 }}>
            <span>0 · {slide.minLabel}</span>
            <span>{slide.maxLabel} · 100</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {showResults && aggregate.scores && aggregate.scores.length > 0 && (
              <div className="text-center">
                <p className="text-7xl font-black" style={{ color: textColor, fontFamily: 'var(--font-heading)' }}>
                  {Math.round(aggregate.scores.reduce((a, b) => a + b, 0) / aggregate.scores.length)}
                </p>
                <p className="text-xl mt-2" style={{ color: textColor, opacity: 0.6 }}>average · {aggregate.total} responses</p>
              </div>
            )}
          </div>
        </div>
      )

    case 'title':
      // Heading color comes from `getSlideTextColor(slide)` so the live stage
      // matches the editor preview and the side-panel thumbnail.
      return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-4" style={{ containerType: 'inline-size' }}>
          <h1 className="font-black leading-tight break-words" style={{ ...headingStyle, fontSize: 'clamp(28px, 6cqw, 80px)' }}>
            {slide.heading || 'Title'}
          </h1>
          {slide.subheading && (
            <p className="break-words" style={{ ...headingStyle, opacity: 0.8, fontSize: 'clamp(16px, 2.6cqw, 32px)' }}>{slide.subheading}</p>
          )}
          <SlideImageFrame url={slide.contentImageUrl} />
        </div>
      )

    case 'bullets':
      return (
        <div className="flex flex-col h-full gap-4">
          {slide.heading && <h2 className="text-3xl flex-shrink-0" style={headingStyle}>{slide.heading}</h2>}
          <SlideImageFrame url={slide.contentImageUrl} />
          <ul className="space-y-3 flex-1 min-h-0 overflow-y-auto">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-xl" style={{ color: textColor }}>
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: textColor }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )

    case 'quote':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <p className="text-[28px] leading-relaxed italic" style={{ color: textColor }}>
            &ldquo;{slide.quote}&rdquo;
          </p>
          {slide.attribution && (
            <p className="text-base font-semibold" style={{ color: textColor, opacity: 0.8 }}>{slide.attribution}</p>
          )}
          <SlideImageFrame url={slide.contentImageUrl} />
        </div>
      )

    case 'video':
      return (
        <div className="space-y-3">
          {slide.url && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-black">
              <iframe src={getVideoEmbedUrl(slide.url)} className="w-full h-full" allowFullScreen />
            </div>
          )}
          {slide.caption && <p className="text-sm text-center" style={{ color: textColor, opacity: 0.7 }}>{slide.caption}</p>}
        </div>
      )

    case 'image': {
      const isImported = typeof (slide as unknown as Record<string, unknown>)._aiContext === 'string'
      const showCaption = !isImported && !!slide.caption && slide.caption.length <= 80
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          {slide.imageUrl && (
            <SlideImage
              src={slide.imageUrl}
              alt=""
              className="max-h-full max-w-full object-contain rounded-2xl flex-1 min-h-0"
              fallbackText={slide.caption || 'Slide image could not be loaded. If you are on a corporate network, please whitelist the Quizotic CDN.'}
              tone="light"
            />
          )}
          {showCaption && <p className="text-lg font-medium text-center flex-shrink-0" style={{ color: textColor, opacity: 0.8 }}>{slide.caption}</p>}
        </div>
      )
    }

    case 'pinpoint': {
      const pins = aggregate.pins ?? []
      return (
        <div className="flex flex-col h-full min-h-0 gap-3">
          <h2 className="text-2xl flex-shrink-0" style={headingStyle}>{slide.question}</h2>
          <div className="relative rounded-2xl overflow-hidden border flex-1 min-h-0 flex items-center justify-center"
            style={{ background: slide.imageUrl ? '#000' : '#F3F4F6', borderColor: '#DBEAFE' }}>
            {slide.imageUrl ? (
              <img src={slide.imageUrl} alt="" className="max-w-full max-h-full object-contain pointer-events-none" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-center px-6">
                <svg viewBox="0 0 24 24" className="w-12 h-12" style={{ color: '#94A3B8' }}>
                  <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: '#64748B' }}>No background image — edit the slide to upload one</p>
              </div>
            )}
            {showResults && pins.map((pin, i) => (
              <div key={i} className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 transition-all"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: VOTER_COLORS[i % VOTER_COLORS.length], opacity: 0.85 }} />
            ))}
          </div>
          <div className="flex-shrink-0 text-center">
            {showResults ? (
              <p className="text-sm" style={{ color: textColor, opacity: 0.6 }}>
                <span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1.5" style={{ background: VOTER_COLORS[0] }} />
                {pins.length} pin{pins.length !== 1 ? 's' : ''} placed
              </p>
            ) : slide.imageUrl ? (
              <p className="text-sm font-semibold" style={{ color: textColor, opacity: 0.7 }}>Participants: tap anywhere on the image to drop your pin</p>
            ) : null}
          </div>
        </div>
      )
    }

    case 'grid_2x2': {
      const pins = aggregate.pins ?? []
      return (
        <div className="space-y-3">
          <h2 className="text-2xl" style={headingStyle}>{slide.question}</h2>
          <div className="relative flex">
            {/* Y-axis label */}
            <div className="flex flex-col justify-between items-center py-2 mr-2" style={{ width: 24 }}>
              <span className="text-[10px] font-bold" style={{ color: textColor, opacity: 0.6 }}>{slide.yMax || 'High'}</span>
              <span className="text-[10px] font-bold rotate-180" style={{ color: textColor, opacity: 0.6, writingMode: 'vertical-lr' }}>{slide.yLabel}</span>
              <span className="text-[10px] font-bold" style={{ color: textColor, opacity: 0.6 }}>{slide.yMin || 'Low'}</span>
            </div>
            <div className="flex-1">
              {/* Grid area */}
              <div className="relative rounded-xl overflow-hidden border" style={{ aspectRatio: '1', background: '#FAFAFE', borderColor: '#DBEAFE' }}>
                {/* Grid lines */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: '#E5E7EB' }} />
                <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: '#E5E7EB' }} />
                {/* Dots */}
                {showResults && pins.map((pin, i) => (
                  <div key={i} className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 transition-all"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: VOTER_COLORS[i % VOTER_COLORS.length], opacity: 0.85 }} />
                ))}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-bold" style={{ color: textColor, opacity: 0.6 }}>{slide.xMin || 'Low'}</span>
                <span className="text-[10px] font-bold" style={{ color: textColor, opacity: 0.6 }}>{slide.xLabel}</span>
                <span className="text-[10px] font-bold" style={{ color: textColor, opacity: 0.6 }}>{slide.xMax || 'High'}</span>
              </div>
            </div>
          </div>
          {showResults && <p className="text-sm text-center" style={{ color: textColor, opacity: 0.6 }}>{pins.length} response{pins.length !== 1 ? 's' : ''}</p>}
        </div>
      )
    }

    case 'wheel': {
      const names = (slide.names ?? []).map(n => n.trim()).filter(Boolean)
      return <WheelSpinner
        names={names}
        headingStyle={headingStyle}
        title={slide.title}
        result={wheelResult ?? null}
        spinning={!!wheelSpinning}
        onSpin={() => onWheelSpin?.()}
        slideId={slide.id}
      />
    }

    case 'image_choice': {
      const options = slide.options ?? []
      const imageUrls = slide.imageUrls ?? []
      const counts = aggregate.counts ?? new Array(options.length).fill(0)
      const colors = OPTION_HEX
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="leading-snug flex-shrink-0 break-words" style={{ ...headingStyle, fontSize: 'clamp(20px, 3cqw, 40px)' }}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <div className="flex-1 min-h-0 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`, gridAutoRows: '1fr', alignItems: 'stretch' }}>
            {options.map((opt, i) => {
              const count = counts[i] ?? 0
              const pct = aggregate.total > 0 ? Math.round((count / aggregate.total) * 100) : 0
              const color = colors[i % colors.length]
              return (
                <div key={i} className="flex flex-col gap-2 min-h-0">
                  <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border flex items-center justify-center"
                    style={{ background: '#F3F4F6', borderColor: '#E2E8F0' }}>
                    {imageUrls[i] ? (
                      <img src={imageUrls[i]} alt={opt} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs" style={{ color: '#94A3B8' }}>No image</span>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: textColor }}>{opt || `Option ${i + 1}`}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color }}>
                        {showResults ? count : 0} <span className="text-xs font-normal opacity-60">({showResults ? pct : 0}%)</span>
                      </span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: `${showResults ? pct : 0}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                          transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
                        }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    default: {
      const fallback = slide as Slide
      return (
        <div className="text-center py-12">
          <p className="text-lg font-bold" style={{ color: textColor }}>{SLIDE_TYPE_META[fallback.type].label}</p>
          <p className="text-sm mt-2" style={{ color: textColor, opacity: 0.6 }}>Live view coming soon</p>
        </div>
      )
    }
  }
}

// ─── Intro slide (synthetic pre-slide shown before slide 0) ───────────────────

function IntroSlide({ title, gameCode }: { title: string; gameCode: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
  const joinUrl = `${appUrl}/join?code=${gameCode}&mode=presenter`
  const joinHost = (() => {
    try { return new URL(appUrl).host + '/join' } catch { return 'quizotic.live/join' }
  })()
  return (
    <div className="absolute inset-0 flex flex-col p-8" style={{ background: '#fff' }}>
      <div className="flex-shrink-0 flex items-center justify-between">
        <QuizoticLogo variant="onLight" />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
          Welcome
        </span>
      </div>

      <div className="flex-1 flex items-center justify-between gap-10 min-h-0">
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#8B5CF6' }}>
            We&apos;ll begin shortly
          </p>
          <h1 className="text-5xl font-black leading-tight" style={{ color: '#0F1B3D' }}>
            {title}
          </h1>
          <p className="text-lg mt-5" style={{ color: '#6B7280' }}>
            Engage — respond to polls, quizzes and Q&amp;A in real time.
          </p>
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-3 p-6 rounded-3xl"
             style={{ background: '#F8F9FA', border: '1.5px solid #E5E7EB' }}>
          <QRCode value={joinUrl} size={220} />
          <div className="text-center">
            <p className="font-mono text-sm" style={{ color: '#6B7280' }}>{joinHost}</p>
            <p className="text-4xl font-black tracking-[0.3em] mt-1" style={{ color: '#0F1B3D' }}>
              {gameCode}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 text-center text-sm font-semibold uppercase tracking-widest pt-3"
           style={{ color: '#9CA3AF' }}>
        Scan the QR or visit {joinHost} — enter PIN {gameCode}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PresentSessionPage() {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const voteHistoryRef = useRef<number[]>(Array(20).fill(0))
  const lastVoteSecRef = useRef(0)
  const reachedMilestonesRef = useRef(new Set<number>())
  const sessionStartTimeRef = useRef<number>(0)

  const [phase, setPhase] = useState<'loading' | 'error' | 'idle' | 'live' | 'ended'>('loading')
  const [summaryRecord, setSummaryRecord] = useState<{
    presentationTitle: string
    participantCount: number
    duration: number
    totalSlides: number
    interactiveSlides: number
    slidesWithResponses: number
    totalResponses: number
    engagementRate: number
    avgResponsesPerSlide: number
  } | null>(null)
  const [summaryAggregates, setSummaryAggregates] = useState<Record<number, AggregateData>>({})
  const [summarySlides, setSummarySlides] = useState<Slide[]>([])
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [slideIndex, setSlideIndex] = useState(0)
  const [showIntro, setShowIntro] = useState(false)
  const [skipIntro, setSkipIntro] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  const [aggregate, setAggregate] = useState<AggregateData>({ total: 0 })
  const [showResults, setShowResults] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [correctRevealed, setCorrectRevealed] = useState(false)
  // Wheel of Names: authoritative winner comes from the server
  // (`presenter_wheel_result`) so the host projector and every participant phone
  // reveal the same name. `wheelSpinning` gates the Spin button.
  const [wheelResult, setWheelResult] = useState<WheelResult | null>(null)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [floatingVoters, setFloatingVoters] = useState<FloatingVoter[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [waveformData, setWaveformData] = useState<number[]>(Array(20).fill(0))
  const [milestoneLabel, setMilestoneLabel] = useState<string | null>(null)
  const fireConfetti = useConfetti()
  const [socketConnected, setSocketConnected] = useState(false)
  const [showWave, setShowWave] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [mirrorOn, setMirrorOn] = useState(false)
  const waveTriggeredRef = useRef(false)
  const endingRef = useRef(false)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  // Results-chart view controls (host preference, persists across slides).
  const [chartVariant, setChartVariant] = useState<ChartVariant>('bar')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('count')
  // Direction-aware slide paging — forward/back animate from opposite sides.
  const [slideDir, setSlideDir] = useState(1)
  const reduceMotion = useReducedMotion()

  const currentSlide = presentation?.slides[slideIndex] ?? null
  const totalSlides = presentation?.slides.length ?? 0

  // Load presentation from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('quizotic_active_presentation')
    if (!raw) { setPhase('error'); return }
    try {
      setPresentation(JSON.parse(raw))
      setPhase('idle')
    } catch { setPhase('error') }
    setSkipIntro(localStorage.getItem('quizotic_skip_intro') === 'true')
  }, [])

  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
  }, [])

  // Keyboard shortcuts — 'Q' toggles the focus-mode QR overlay, Esc closes it
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault()
        setShowQR(s => !s)
      } else if (e.key === 'Escape') {
        setShowQR(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Connect socket ONCE after presentation is loaded
  const socketInitialized = useRef(false)
  useEffect(() => {
    if (!presentation || socketInitialized.current) return
    socketInitialized.current = true
    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => setSocketConnected(true))
    socket.on('disconnect', () => setSocketConnected(false))

    socket.on('presenter_participant_joined', ({ count }: { count: number }) => {
      setParticipantCount(count)
    })

    socket.on('presenter_participant_left', ({ count }: { count: number }) => {
      setParticipantCount(count)
    })

    socket.on('presenter_results_revealed', (data: AggregateData) => {
      setAggregate(data)
      setShowResults(true)
      setRevealed(true)
      setCorrectRevealed(true)
    })

    // Wheel of Names result (authoritative, server-computed).
    socket.on('presenter_wheel_result', (data: WheelResult) => {
      if (!data || typeof data.winnerIndex !== 'number') return
      setWheelResult(data)
      setWheelSpinning(true)
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = setTimeout(() => setWheelSpinning(false), (data.durationMs ?? 5200) + 200)
    })

    socket.on('presenter_aggregate_updated', (data: AggregateData) => {
      setAggregate(data)
      triggerVoteEffects(data.total)

      // Audience wave: detect 80%+ consensus with >=5 total votes
      if (!waveTriggeredRef.current && data.total >= 5 && data.counts && data.counts.length > 0) {
        const maxVotes = Math.max(...data.counts)
        if (maxVotes / data.total >= 0.8) {
          waveTriggeredRef.current = true
          setShowWave(true)
          setTimeout(() => setShowWave(false), 2500)
        }
      }
    })

    socket.on('presenter_session_summary', ({ aggregates, participantCount, slides }: {
      aggregates: Record<number, AggregateData>
      participantCount: number
      slides: Slide[]
    }) => {
      if (!presentation) return

      let interactiveCount = 0
      let slidesWithResponses = 0
      let totalResponses = 0

      for (let i = 0; i < slides.length; i++) {
        const meta = SLIDE_TYPE_META[slides[i].type]
        if (!meta?.hasAudienceInput) continue
        interactiveCount++
        const agg = aggregates[i]
        const count = agg?.total ?? 0
        if (count > 0) slidesWithResponses++
        totalResponses += count
      }

      const duration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
      const engagementRate = interactiveCount > 0
        ? Math.round((slidesWithResponses / interactiveCount) * 100)
        : 0
      const avgResponsesPerSlide = interactiveCount > 0
        ? Math.round(totalResponses / interactiveCount)
        : 0

      const record = {
        id: crypto.randomUUID(),
        presentationId: presentation.id,
        presentationTitle: presentation.title,
        date: new Date().toISOString(),
        participantCount,
        duration,
        totalSlides: slides.length,
        interactiveSlides: interactiveCount,
        slidesWithResponses,
        totalResponses,
        engagementRate,
        avgResponsesPerSlide,
      }

      try {
        const existing = JSON.parse(localStorage.getItem('quizotic_presentation_sessions') || '[]')
        localStorage.setItem('quizotic_presentation_sessions', JSON.stringify([record, ...existing]))
      } catch { /* localStorage full or unavailable */ }

      // Instead of auto-redirecting to /host (which stranded hosts with no
      // review screen), transition into an 'ended' phase showing the summary.
      // The safety timeout in endSession() no longer fires once endingRef
      // is cleared here.
      setSummaryRecord({
        presentationTitle: record.presentationTitle,
        participantCount: record.participantCount,
        duration: record.duration,
        totalSlides: record.totalSlides,
        interactiveSlides: record.interactiveSlides,
        slidesWithResponses: record.slidesWithResponses,
        totalResponses: record.totalResponses,
        engagementRate: record.engagementRate,
        avgResponsesPerSlide: record.avgResponsesPerSlide,
      })
      setSummaryAggregates(aggregates)
      setSummarySlides(slides)
      endingRef.current = false
      setPhase('ended')
    })

    return () => { socket.disconnect() }
  }, [presentation])

  const triggerVoteEffects = useCallback((total: number) => {
    // Bubble sound
    if (soundOn) {
      if (!audioCtxRef.current) audioCtxRef.current = createAudioContext()
      if (audioCtxRef.current) playBubbleSound(audioCtxRef.current)
    }

    // Floating voter avatar
    const voter: FloatingVoter = {
      id: Math.random().toString(36).slice(2),
      x: 10 + Math.random() * 80,
      color: VOTER_COLORS[Math.floor(Math.random() * VOTER_COLORS.length)],
      emoji: VOTER_EMOJIS[Math.floor(Math.random() * VOTER_EMOJIS.length)],
    }
    setFloatingVoters(prev => [...prev.slice(-20), voter])
    setTimeout(() => setFloatingVoters(prev => prev.filter(v => v.id !== voter.id)), 4000)

    // Toast every 5 votes
    if (total > 0 && total % 5 === 0) {
      const toast: Toast = { id: Math.random().toString(36).slice(2), message: `${total} votes so far!` }
      setToasts(prev => [...prev.slice(-2), toast])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 2500)
    }

    // Waveform
    const now = Math.floor(Date.now() / 1000)
    if (now !== lastVoteSecRef.current) {
      lastVoteSecRef.current = now
      voteHistoryRef.current = [...voteHistoryRef.current.slice(1), 1]
    } else {
      voteHistoryRef.current[voteHistoryRef.current.length - 1]++
    }
    setWaveformData([...voteHistoryRef.current])

    // Milestones
    const milestone = MILESTONES.find(m => m.count === total && !reachedMilestonesRef.current.has(m.count))
    if (milestone) {
      reachedMilestonesRef.current.add(milestone.count)
      setMilestoneLabel(milestone.label)
      fireConfetti('milestone')
      if (soundOn) {
        if (!audioCtxRef.current) audioCtxRef.current = createAudioContext()
        if (audioCtxRef.current) playMilestoneSound(audioCtxRef.current)
      }
      setTimeout(() => { setMilestoneLabel(null) }, 3000)
    }
  }, [soundOn, fireConfetti])

  function createSession() {
    track('presentation_session_started', { slideCount: presentation?.slides.length ?? 0 })
    if (!presentation) return
    const socket = socketRef.current
    if (!socket?.connected) {
      const toast: Toast = { id: Date.now().toString(), message: 'Connecting… please try again.' }
      setToasts(prev => [...prev.slice(-2), toast])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 2500)
      return
    }
    const timeout = setTimeout(() => {
      if (phase === 'idle') {
        const toast: Toast = { id: Date.now().toString(), message: 'Server not responding. Please try again.' }
        setToasts(prev => [...prev.slice(-2), toast])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 3000)
      }
    }, 8000)

    socket.emit('create_presenter_session',
      { presentationData: presentation },
      (res: { success: boolean; gameCode: string; error?: string }) => {
        clearTimeout(timeout)
        if (res.success) {
          sessionStartTimeRef.current = Date.now()
          setGameCode(res.gameCode)
          setPhase('live')
          setSlideIndex(0)
          setShowIntro(!skipIntro)
          setAggregate({ total: 0 })
          const firstSlide = presentation!.slides[0]
          const firstMode = firstSlide?.responseMode || 'instant'
          setShowResults(firstMode === 'instant' || shouldAutoShowResults(firstSlide?.type))
          setRevealed(false)
          setCorrectRevealed(false)
        } else {
          const toast: Toast = { id: Date.now().toString(), message: res.error ?? 'Failed to create session.' }
          setToasts(prev => [...prev.slice(-2), toast])
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 3000)
        }
      }
    )
  }

  function nextSlide() {
    if (showIntro) {
      setShowIntro(false)
      return
    }
    if (!presentation || slideIndex >= totalSlides - 1) return
    setSlideDir(1)
    const newIndex = slideIndex + 1
    const nextSlide = presentation.slides[newIndex]
    const nextMode = nextSlide?.responseMode || 'instant'
    setSlideIndex(newIndex)
    setAggregate({ total: 0 })
    setShowResults(nextMode === 'instant' || shouldAutoShowResults(nextSlide?.type))
    setRevealed(false)
    setCorrectRevealed(false)
    setShowWave(false)
    waveTriggeredRef.current = false
    reachedMilestonesRef.current.clear()
    voteHistoryRef.current = Array(20).fill(0)
    // Reset any prior wheel result when leaving a wheel slide.
    setWheelResult(null)
    setWheelSpinning(false)
    if (wheelTimerRef.current) { clearTimeout(wheelTimerRef.current); wheelTimerRef.current = null }
    socketRef.current?.emit('presenter_next_slide', { gameCode, slideIndex: newIndex })
  }

  function prevSlide() {
    if (showIntro) return
    if (slideIndex <= 0) {
      setShowIntro(true)
      return
    }
    setSlideDir(-1)
    const newIndex = slideIndex - 1
    const prevSlide = presentation!.slides[newIndex]
    const prevMode = prevSlide?.responseMode || 'instant'
    setSlideIndex(newIndex)
    setAggregate({ total: 0 })
    setShowResults(prevMode === 'instant' || shouldAutoShowResults(prevSlide?.type))
    setRevealed(false)
    setCorrectRevealed(false)
    setShowWave(false)
    waveTriggeredRef.current = false
    reachedMilestonesRef.current.clear()
    setWheelResult(null)
    setWheelSpinning(false)
    if (wheelTimerRef.current) { clearTimeout(wheelTimerRef.current); wheelTimerRef.current = null }
    socketRef.current?.emit('presenter_prev_slide', { gameCode, slideIndex: newIndex })
  }

  function endSession() {
    endingRef.current = true
    socketRef.current?.emit('end_presenter_session', { gameCode })
    // Safety fallback if summary doesn't arrive within 3s
    setTimeout(() => { if (endingRef.current) router.push('/host') }, 3000)
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-svh flex items-center justify-center" style={{ background: '#F8F9FA' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
            style={{ borderColor: PRESENTATION_SEQUENCE.accent, borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold" style={{ color: '#9CA3AF', fontFamily: 'var(--font-body)' }}>
            Loading presentation…
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-svh flex items-center justify-center px-6" style={{ background: '#F8F9FA' }}>
        <div className="max-w-sm w-full rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl"
            style={{ background: '#F8F9FA' }}>
            📋
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            No presentation found
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            Create a new presentation or go back to your dashboard.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push('/host/present/create')}
              className="w-full px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
              style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, fontFamily: 'var(--font-heading)' }}>
              Create Presentation
            </button>
            <button onClick={() => router.push('/host')}
              className="w-full px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
              style={{ color: '#9CA3AF', border: '1.5px solid #E5E7EB' }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'idle' && presentation) {
    const interactiveCount = presentation.slides.filter(
      s => SLIDE_TYPE_META[s.type]?.hasAudienceInput
    ).length

    return (
      <div className="min-h-svh flex items-center justify-center px-6" style={{ background: '#F8F9FA' }}>
        <div className="max-w-md w-full">
          {/* Presentation card */}
          <div className="rounded-2xl p-8 text-center" style={{
            background: '#fff',
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          }}>
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{ background: '#F8F9FA' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" style={{ color: '#0F1B3D' }}>
                <rect x="3" y="3" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 10l2 1.5L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
              {presentation.title}
            </h1>

            {/* Slide stats */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span className="text-base font-medium px-4 py-1.5 rounded-full"
                style={{ background: '#F8F9FA', color: '#9CA3AF' }}>
                {presentation.slides.length} slide{presentation.slides.length !== 1 ? 's' : ''}
              </span>
              {interactiveCount > 0 && (
                <span className="text-base font-medium px-4 py-1.5 rounded-full"
                  style={{ background: '#FEF3C7', color: '#92400E' }}>
                  {interactiveCount} interactive
                </span>
              )}
            </div>

            {/* Connection status */}
            {!socketConnected && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-base font-medium" style={{ color: '#6B7280' }}>Establishing connection…</p>
              </div>
            )}

            {/* CTA */}
            <button onClick={createSession}
              disabled={!socketConnected}
              className="w-full px-8 py-5 rounded-xl text-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: PRESENTATION_SEQUENCE.accent,
                color: PRESENTATION_SEQUENCE.accentText,
                fontFamily: 'var(--font-heading)',
                boxShadow: socketConnected ? '0 4px 20px rgba(15,27,61,0.25)' : 'none',
              }}>
              {socketConnected ? 'Start Presentation' : 'Connecting…'}
            </button>

            <label className="flex items-center justify-center gap-2 mt-4 text-xs font-medium cursor-pointer" style={{ color: '#9CA3AF' }}>
              <input
                type="checkbox"
                checked={skipIntro}
                onChange={e => {
                  setSkipIntro(e.target.checked)
                  localStorage.setItem('quizotic_skip_intro', e.target.checked ? 'true' : 'false')
                }}
                className="w-3.5 h-3.5"
              />
              Skip welcome screen
            </label>
          </div>

          {/* Actions below card */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <button onClick={() => router.push('/host/present/create?edit=active')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: '#9CA3AF' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              Edit slides
            </button>
            <span style={{ color: '#E5E7EB' }}>|</span>
            <button onClick={() => router.push('/host')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: '#9CA3AF' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'ended' && summaryRecord) {
    return (
      <div style={{ background: 'var(--color-paper, #F8F9FA)', minHeight: '100vh' }}>
        <PostSessionHeader
          title={summaryRecord.presentationTitle}
          subtitle={`${summaryRecord.participantCount} participant${summaryRecord.participantCount === 1 ? '' : 's'} · Session complete`}
          onBack={() => router.push('/host')}
        />
        <PresentationSummary record={summaryRecord} slides={summarySlides} aggregates={summaryAggregates} />
      </div>
    )
  }

  if (phase !== 'live' || !currentSlide) return null

  const meta = SLIDE_TYPE_META[currentSlide.type]
  const isChartSlide = currentSlide.type === 'multiple_choice' || currentSlide.type === 'quick_fire' || currentSlide.type === 'live_race' || currentSlide.type === 'word_duel'
  // Direction-aware slide transition. Forward pages enter from the right,
  // back from the left — reads as flipping through a deck. Collapses to a
  // pure fade under prefers-reduced-motion.
  const slideVariants = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 80 : -80 }),
        center: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -80 : 80 }),
      }
  const slideTransition = reduceMotion ? { duration: 0.15 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div
      className="min-h-svh md:h-screen flex flex-col md:overflow-hidden overflow-y-auto"
      style={{
        background: getQuizTheme(presentation?.theme).background,
        color: getQuizTheme(presentation?.theme).textColor,
        fontFamily: 'var(--font-body)',
      }}
      data-theme={getQuizTheme(presentation?.theme).id}
    >

      {/* Confetti is fired via useConfetti('milestone') in the milestone
          handler — see fireConfetti call near reachedMilestonesRef. */}

      {/* ── Milestone badge ──────────────────────────────────────────────────── */}
      {milestoneLabel && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="rounded-3xl px-8 py-5 text-center shadow-2xl"
            style={{ background: '#0F1B3D', color: '#fff' }}>
            <p className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {milestoneLabel}
            </p>
            <p className="text-lg opacity-80">🎉</p>
          </div>
        </div>
      )}

      {/* ── Audience Wave overlay ─────────────────────────────────────────── */}
      {showWave && (
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(90deg, transparent, rgba(67,97,238,0.15), rgba(124,58,237,0.15), transparent)',
            animation: 'waveSweep 2s ease-in-out forwards',
          }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <p className="text-5xl font-black text-center" style={{
              color: '#0F1B3D',
              textShadow: '0 2px 20px rgba(67,97,238,0.4)',
              animation: 'waveSweep 2s ease-in-out forwards',
            }}>
              Audience Wave!
            </p>
          </div>
        </div>
      )}

      {/* ── Main projected slide area ─────────────────────────────────────── */}
      {/* Per-slide bgColor wins over the theme background. Without this,
          colors picked in the editor showed in the preview but vanished
          on the projector. See getSlideBg() for the per-type fallback. */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0, background: getSlideBg(currentSlide) }}>

        {/* Floating top-right bar: votes + participants + always-visible join pill */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
          {meta.hasAudienceInput && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(15,27,61,0.85)' }}>
              <span className="text-sm font-black text-white">{aggregate.total}</span>
              <span className="text-xs text-white/60">votes</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(15,27,61,0.85)' }}>
            <span className="text-sm font-bold text-white">{participantCount}</span>
            <span className="text-xs text-white/60">joined</span>
          </div>
          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-md px-2.5 py-1.5 transition-all hover:scale-[1.02]"
            title="Scan or click to enlarge"
          >
            <div className="p-0.5 bg-white rounded-md">
              <QRCode
                value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}&mode=presenter`}
                size={44}
                bgColor="#ffffff"
                fgColor="#0F1B3D"
                level="L"
              />
            </div>
            <div className="flex flex-col leading-tight text-left">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Join</span>
              <span className="text-base font-black tabular-nums" style={{ color: '#0F1B3D', letterSpacing: '0.08em' }}>
                {gameCode}
              </span>
            </div>
          </button>
        </div>

        {/* QR Focus mode — full-screen scannable from the back of the room */}
        {showQR && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(15,23,42,0.96)' }}
            onClick={() => setShowQR(false)}>
            <div className="flex flex-col items-center gap-6 px-8"
              onClick={e => e.stopPropagation()}>
              <p className="text-2xl font-bold uppercase tracking-[0.3em]" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>
                Scan to join
              </p>
              <div className="rounded-3xl p-6 shadow-2xl" style={{ background: '#fff' }}>
                <QRCode
                  value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}&mode=presenter`}
                  size={480}
                  bgColor="#ffffff"
                  fgColor="#0F1B3D"
                  level="M"
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-2xl font-semibold" style={{ color: '#94A3B8' }}>
                  or visit <span className="font-bold" style={{ color: '#fff' }}>quizotic.live/join</span>
                </p>
                <p className="text-[88px] font-black tabular-nums leading-none" style={{ color: PRESENTATION_SEQUENCE.accentOnDark, letterSpacing: '0.12em', fontFamily: 'var(--font-heading)' }}>
                  {gameCode}
                </p>
              </div>
              <p className="text-sm mt-4" style={{ color: '#64748B' }}>
                Press <kbd className="px-2 py-0.5 rounded-md font-mono text-xs" style={{ background: '#334155', color: '#fff' }}>Q</kbd> or click anywhere to close
              </p>
            </div>
          </div>
        )}

        {/* Full-width slide content */}
        <div className="h-full p-8 flex flex-col relative">

          {/* Floating voter avatars — no overflow clip, so emojis rise freely */}
          <div className="absolute bottom-16 left-0 right-0 pointer-events-none" style={{ height: 0 }}>
            {floatingVoters.map(v => (
              <div key={v.id} className="absolute bottom-0"
                style={{
                  left: `${v.x}%`,
                  fontSize: '3rem',
                  filter: `drop-shadow(0 0 8px ${v.color})`,
                  animation: 'voterFloat 4s ease-out forwards',
                }}>
                {v.emoji}
              </div>
            ))}
          </div>

          {/* Toast notifications */}
          <div className="absolute top-16 right-4 flex flex-col gap-2 z-20">
            {toasts.map(t => (
              <div key={t.id} className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg text-white"
                style={{ background: '#0F1B3D' }}>
                {t.message}
              </div>
            ))}
          </div>

          {/* Slide number */}
          <div className="flex items-center gap-2 mb-5 flex-shrink-0">
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div key={i} className="rounded-full transition-all"
                  style={{
                    width: !showIntro && i === slideIndex ? 20 : 6,
                    height: 6,
                    background: !showIntro && i === slideIndex ? meta.color : `${meta.color}33`,
                  }} />
              ))}
            </div>
            <span className="text-xs font-semibold ml-1" style={{ color: '#9CA3AF' }}>
              {showIntro ? `Intro · 0 / ${totalSlides}` : `${slideIndex + 1} / ${totalSlides}`}
            </span>
          </div>

          {/* Slide content */}
          <div className="flex-1 flex flex-col w-full mx-auto relative min-h-0"
            style={{ maxWidth: 'min(1600px, 92vw)', containerType: 'inline-size' }}>
            <AnimatePresence mode="wait" initial={false} custom={slideDir}>
              <motion.div
                key={showIntro ? 'intro' : `slide-${slideIndex}`}
                custom={slideDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className="flex-1 min-h-0 relative"
              >
                {showIntro ? (
                  <IntroSlide title={presentation?.title || 'Presentation'} gameCode={gameCode} />
                ) : (
                  <SlideContent slide={currentSlide} aggregate={aggregate} showResults={showResults} correctRevealed={correctRevealed} chartVariant={chartVariant} chartMetric={chartMetric}
                    wheelResult={currentSlide?.type === 'wheel' ? wheelResult : null}
                    wheelSpinning={currentSlide?.type === 'wheel' ? wheelSpinning : false}
                    onWheelSpin={() => {
                      if (!gameCode || wheelSpinning) return
                      // Reset winner while the wheel spins.
                      setWheelSpinning(true)
                      socketRef.current?.emit('presenter_spin_wheel', { gameCode, slideIndex, durationMs: 5200 })
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            {plan === 'free' && (
              <div className="absolute bottom-2 right-3 z-10">
                <span className="text-[10px] font-bold opacity-30" style={{ color: '#fff' }}>quizotic.live</span>
              </div>
            )}
          </div>

          {/* Speed waveform — pinned at bottom, tight under bars */}
          {!showIntro && meta.hasAudienceInput && (
            <div className="flex-shrink-0 mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#C4B5FD' }}>
                Vote velocity
              </p>
              <SpeedWaveform recentVotes={waveformData} />
            </div>
          )}
        </div>
      </div>

      {/* ── Presenter controls (below slide — NOT projected) ─────────────────── */}
      <div className="border-t flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 md:px-6 md:py-4 flex-shrink-0"
        style={{ borderColor: '#E5E7EB', background: '#F8F9FA', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>

        {/* Left: sound toggle + mirror toggle + Q shortcut hint */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(s => !s)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold transition-all"
            style={{
              background: soundOn ? '#DCFCE7' : '#fff',
              color: soundOn ? '#16A34A' : '#6B7280',
              border: `1.5px solid ${soundOn ? '#86EFAC' : '#E5E7EB'}`,
            }}>
            {soundOn ? '🔊 Sound On' : '🔇 Sound Off'}
          </button>
          <button
            onClick={() => {
              const next = !mirrorOn
              setMirrorOn(next)
              socketRef.current?.emit('toggle_mirror_to_participants', { gameCode, mirror: next })
            }}
            title={mirrorOn ? 'Participants see this slide on their phones' : 'Participants see a "waiting" screen on content slides (interactive slides always show input)'}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold transition-all"
            style={{
              background: mirrorOn ? '#DBEAFE' : '#fff',
              color: mirrorOn ? '#1D4ED8' : '#6B7280',
              border: `1.5px solid ${mirrorOn ? '#93C5FD' : '#E5E7EB'}`,
            }}>
            {mirrorOn ? '📱 Mirror On' : '📱 Mirror Off'}
          </button>
          {isChartSlide && (
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
              {([['bar', 'Bars'], ['donut', 'Donut'], ['pie', 'Pie']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setChartVariant(v)}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: chartVariant === v ? '#0F1B3D' : 'transparent', color: chartVariant === v ? '#fff' : '#6B7280' }}>
                  {label}
                </button>
              ))}
              <span style={{ width: 1, height: 22, background: '#E5E7EB', margin: '0 3px' }} />
              {([['count', '123'], ['percent', '%']] as const).map(([m, label]) => (
                <button key={m} onClick={() => setChartMetric(m)}
                  title={m === 'percent' ? 'Emphasise percentages' : 'Emphasise counts'}
                  className="px-2.5 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: chartMetric === m ? '#0F1B3D' : 'transparent', color: chartMetric === m ? '#fff' : '#6B7280' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: navigation */}
        <div className="flex items-center gap-3">
          <button onClick={prevSlide} disabled={showIntro}
            className="px-7 py-3 rounded-xl text-base font-bold border transition-all disabled:opacity-30"
            style={{ borderColor: '#E5E7EB', color: '#0F1B3D', background: '#fff' }}>
            Prev
          </button>
          <span className="text-lg font-bold tabular-nums" style={{ color: '#6B7280', minWidth: 56, textAlign: 'center' }}>
            {showIntro ? `Intro` : `${slideIndex + 1} / ${totalSlides}`}
          </span>
          <button onClick={nextSlide} disabled={!showIntro && slideIndex >= totalSlides - 1}
            className="px-7 py-3 rounded-xl text-base font-bold transition-all disabled:opacity-30 hover:scale-[1.02]"
            style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: 'none', fontFamily: 'var(--font-heading)' }}>
            Next
          </button>
        </div>

        {/* Right: show results + end */}
        <div className="flex items-center gap-2">
          {meta.hasAudienceInput && (() => {
            const mode = currentSlide?.responseMode || 'instant'
            const hasCorrectAnswer = (currentSlide as { showCorrect?: boolean })?.showCorrect
            if (mode === 'instant') {
              // In instant mode, results are live but correct answer needs explicit reveal
              if (!hasCorrectAnswer) return null
              return (
                <button
                  onClick={() => setCorrectRevealed(true)}
                  disabled={correctRevealed}
                  className="px-5 py-3 rounded-xl text-base font-bold transition-all"
                  style={{
                    background: correctRevealed ? '#DCFCE7' : '#16A34A',
                    color: correctRevealed ? '#16A34A' : '#fff',
                    border: correctRevealed ? '1.5px solid #86EFAC' : '1.5px solid #16A34A',
                    cursor: correctRevealed ? 'default' : 'pointer',
                    opacity: correctRevealed ? 0.8 : 1,
                  }}>
                  {correctRevealed ? 'Answer Revealed' : 'Reveal Answer'}
                </button>
              )
            }
            if (mode === 'on_click') {
              return (
                <button
                  onClick={() => {
                    if (!revealed) {
                      socketRef.current?.emit('presenter_reveal_results', { gameCode })
                      setShowResults(true)
                      setRevealed(true)
                      setCorrectRevealed(true)
                    }
                  }}
                  disabled={revealed}
                  className="px-5 py-3 rounded-xl text-base font-bold transition-all"
                  style={{
                    background: revealed ? '#DCFCE7' : PRESENTATION_SEQUENCE.accent,
                    color: revealed ? '#16A34A' : PRESENTATION_SEQUENCE.accentText,
                    border: revealed ? '1.5px solid #86EFAC' : '1.5px solid transparent',
                    cursor: revealed ? 'default' : 'pointer',
                    opacity: revealed ? 0.8 : 1,
                  }}>
                  {revealed ? 'Results Revealed' : 'Reveal Results'}
                </button>
              )
            }
            // private mode — host-only toggle
            return (
              <button
                onClick={() => setShowResults(s => !s)}
                className="px-5 py-3 rounded-xl text-base font-bold transition-all"
                style={{
                  background: showResults ? '#F8F9FA' : '#fff',
                  color: showResults ? '#0F1B3D' : '#6B7280',
                  border: `1.5px solid ${showResults ? '#0F1B3D' : '#E5E7EB'}`,
                }}>
                {showResults ? 'Hide Results (Host Only)' : 'Show Results (Host Only)'}
              </button>
            )
          })()}
          <button onClick={endSession}
            className="px-5 py-3 rounded-xl text-base font-bold border transition-colors hover:scale-[1.02]"
            style={{
              borderColor: slideIndex >= totalSlides - 1 ? '#FCA5A5' : '#E5E7EB',
              color: slideIndex >= totalSlides - 1 ? '#fff' : '#6B7280',
              background: slideIndex >= totalSlides - 1 ? '#EF4444' : '#fff',
            }}>
            End Session
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes voterFloat {
          0% { transform: translateY(0) scale(0.3); opacity: 0; }
          10% { transform: translateY(-10px) scale(1.2); opacity: 1; }
          20% { transform: translateY(-20px) scale(1.0); opacity: 1; }
          50% { transform: translateY(-60px) scale(1.0) translateX(8px); opacity: 0.9; }
          75% { transform: translateY(-100px) scale(0.95) translateX(-6px); opacity: 0.6; }
          100% { transform: translateY(-140px) scale(0.8) translateX(4px); opacity: 0; }
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes waveSweep {
          0% { transform: translateX(-100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
