'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import QRCode from 'react-qr-code'
import type { Slide, Presentation } from '@/lib/presentation-types'
import { SLIDE_TYPE_META } from '@/lib/presentation-types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AggregateData {
  total: number
  counts?: number[]        // bar chart types
  words?: Record<string, number>  // word cloud
  scores?: number[]        // rating/scale
  emojis?: Record<string, number> // emoji pulse
  pins?: { x: number; y: number }[] // pinpoint / grid_2x2
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
  const [ripple, setRipple] = useState(false)
  const prevCount = useRef(count)

  useEffect(() => {
    if (count > prevCount.current) {
      setRipple(true)
      setTimeout(() => setRipple(false), 600)
      prevCount.current = count
    }
  }, [count])

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
        {ripple && (
          <div className="absolute inset-0 rounded-full animate-pulse"
            style={{ background: `${color}33`, animationDuration: '0.6s' }} />
        )}
      </div>
    </div>
  )
}

// ─── Live word cloud ──────────────────────────────────────────────────────────

function WordCloud({ words }: { words: Record<string, number> }) {
  const entries = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 30)
  const max = entries[0]?.[1] ?? 1
  const colors = ['#0F1B3D','#FF8A47','#0891B2','#16A34A','#EA580C','#6B8AFF']
  return (
    <div className="flex flex-wrap gap-2 items-center justify-center min-h-[80px]">
      {entries.map(([word, count], i) => {
        const size = 14 + Math.round((count / max) * 26)
        return (
          <span key={word} className="font-bold leading-tight transition-all duration-500"
            style={{ fontSize: size, color: colors[i % colors.length] }}>
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

// ─── Live vertical bar chart ──────────────────────────────────────────────────

function LiveVerticalBars({
  options, counts, total, colors, showResults, correctIndex,
}: {
  options: string[]
  counts: number[]
  total: number
  colors: string[]
  showResults: boolean
  correctIndex?: number
}) {
  const max = Math.max(...counts, 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 220 }}>
      {options.map((opt, i) => {
        const count = counts[i] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const heightPct = count > 0 ? Math.max(3, (count / max) * 100) : 0
        const isLeading = count > 0 && count === Math.max(...counts)
        const isCorrect = showResults && correctIndex === i
        const color = isCorrect ? '#16A34A' : colors[i % colors.length]

        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            {/* Correct badge or vote count */}
            <div style={{ height: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 4 }}>
              {isCorrect ? (
                <span style={{ color: '#16A34A', fontWeight: 900, fontSize: 16 }}>✓</span>
              ) : count > 0 && (
                <span style={{ color, fontWeight: 800, fontSize: 17, lineHeight: 1 }}>
                  {count}
                </span>
              )}
            </div>

            {/* Bar grows from bottom */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
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

            {/* Floor line */}
            <div style={{ width: '100%', height: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 1, margin: '3px 0' }} />

            {/* Option label */}
            <div style={{ textAlign: 'center', maxWidth: '100%', paddingTop: 2 }}>
              <div style={{
                fontSize: options.length > 4 ? 11 : 13,
                fontWeight: 700,
                color: isCorrect ? '#16A34A' : '#0F1B3D',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: options.length > 4 ? 'nowrap' : 'normal',
                maxWidth: '100%',
                lineHeight: 1.2,
              }}>
                {opt || `Option ${i + 1}`}
              </div>
              {showResults && total > 0 && (
                <div style={{ fontSize: 12, color, fontWeight: 700, marginTop: 2 }}>
                  {pct}%
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

function WheelSpinner({ names, headingStyle, title }: { names: string[]; headingStyle: React.CSSProperties; title: string }) {
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function spin() {
    if (spinning || names.length === 0) return
    setSpinning(true)
    setWinner(null)

    let tick = 0
    const totalTicks = 20 + Math.floor(Math.random() * 15)
    const winnerIdx = Math.floor(Math.random() * names.length)

    intervalRef.current = setInterval(() => {
      setHighlightIdx(tick % names.length)
      tick++
      if (tick >= totalTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setHighlightIdx(winnerIdx)
        setWinner(names[winnerIdx])
        setSpinning(false)
      }
    }, 60 + tick * 8) // decelerating

    // Fallback: force stop after 4s
    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setHighlightIdx(winnerIdx)
      setWinner(names[winnerIdx])
      setSpinning(false)
    }, 4000)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl" style={headingStyle}>{title || 'Wheel of Names'}</h2>
      {names.length === 0 ? (
        <p className="text-sm text-center" style={{ color: '#9CA3AF' }}>No names added to this wheel.</p>
      ) : (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(names.length, 4)}, 1fr)` }}>
            {names.map((name, i) => (
              <div key={i}
                className="px-4 py-3 rounded-xl text-center font-bold text-sm transition-all"
                style={{
                  background: highlightIdx === i
                    ? winner ? '#FACC15' : VOTER_COLORS[i % VOTER_COLORS.length]
                    : '#F3F4F6',
                  color: highlightIdx === i ? '#fff' : '#1E1B4B',
                  transform: highlightIdx === i ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: highlightIdx === i ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                }}>
                {name}
              </div>
            ))}
          </div>
          {winner && (
            <div className="text-center py-4">
              <p className="text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#FACC15' }}>
                {winner}
              </p>
            </div>
          )}
          <button onClick={spin} disabled={spinning}
            className="w-full py-4 rounded-xl text-lg font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
            {spinning ? 'Spinning...' : winner ? 'Spin Again' : 'Spin!'}
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

function SlideContent({ slide, aggregate, showResults, correctRevealed }: { slide: Slide; aggregate: AggregateData; showResults: boolean; correctRevealed: boolean }) {
  const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-heading)', color: '#0F1B3D', fontWeight: 900 }

  switch (slide.type) {
    case 'multiple_choice':
    case 'quick_fire':
    case 'live_race':
    case 'word_duel': {
      const options = slide.type === 'word_duel'
        ? [slide.optionA, slide.optionB]
        : (slide as { options: string[] }).options
      const barColors = slide.type === 'word_duel'
        ? ['#2563EB', '#DC2626']
        : ['#0F1B3D','#FF8A47','#0891B2','#16A34A','#F59E0B']
      const counts = aggregate.counts ?? new Array(options.length).fill(0)
      const typedSlide = slide as { question?: string; showCorrect?: boolean; correctIndex?: number }

      return (
        <div className="space-y-4">
          <h2 className="text-3xl leading-snug" style={headingStyle}>
            {typedSlide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <LiveVerticalBars
            options={options}
            counts={counts}
            total={aggregate.total}
            colors={barColors}
            showResults={showResults}
            correctIndex={correctRevealed && typedSlide.showCorrect ? typedSlide.correctIndex : undefined}
          />
        </div>
      )
    }

    case 'open_text':
      return (
        <div className="space-y-4">
          <h2 className="text-4xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          {showResults && aggregate.words && (
            <WordCloud words={aggregate.words} />
          )}
        </div>
      )

    case 'word_cloud':
      return (
        <div className="space-y-4">
          <h2 className="text-4xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          {showResults && aggregate.words && <WordCloud words={aggregate.words} />}
        </div>
      )

    case 'rating_scale':
      return (
        <div className="space-y-5">
          <h2 className="text-4xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <div className="flex items-center justify-between text-xl font-semibold" style={{ color: '#9CA3AF' }}>
            <span>{slide.minLabel}</span>
            <span>{slide.maxLabel}</span>
          </div>
          {showResults && aggregate.scores && aggregate.scores.length > 0 && (
            <div className="text-center">
              <p className="text-5xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                {(aggregate.scores.reduce((a, b) => a + b, 0) / aggregate.scores.length).toFixed(1)}
              </p>
              <p className="text-lg" style={{ color: '#6B7280' }}>average rating · {aggregate.total} responses</p>
            </div>
          )}
        </div>
      )

    case 'emoji_pulse':
      return (
        <div className="space-y-5">
          <h2 className="text-4xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Prompt text...</span>}
          </h2>
          {showResults && aggregate.emojis && (
            <div className="flex flex-wrap gap-4 justify-center">
              {slide.emojis.map(em => (
                <div key={em} className="flex flex-col items-center gap-1">
                  <span className="text-4xl">{em}</span>
                  <span className="text-lg font-black" style={{ color: '#0F1B3D' }}>
                    {aggregate.emojis?.[em] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )

    case 'ranking':
      return (
        <div className="space-y-4">
          <h2 className="text-4xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          {showResults && aggregate.counts && (
            <div className="space-y-3">
              {slide.items.map((item, i) => (
                <PollBar key={i} label={item || `Item ${i+1}`}
                  count={aggregate.counts?.[i] ?? 0} total={aggregate.total} color="#4F46E5" />
              ))}
            </div>
          )}
        </div>
      )

    case 'scale_100':
      return (
        <div className="space-y-5">
          <h2 className="text-4xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <div className="flex items-center justify-between text-xl font-semibold" style={{ color: '#9CA3AF' }}>
            <span>0 · {slide.minLabel}</span>
            <span>{slide.maxLabel} · 100</span>
          </div>
          {showResults && aggregate.scores && aggregate.scores.length > 0 && (
            <div className="text-center">
              <p className="text-5xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                {Math.round(aggregate.scores.reduce((a, b) => a + b, 0) / aggregate.scores.length)}
              </p>
              <p className="text-lg" style={{ color: '#6B7280' }}>average · {aggregate.total} responses</p>
            </div>
          )}
        </div>
      )

    case 'title':
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
          <h1 className="text-5xl font-black leading-tight" style={{ ...headingStyle, color: slide.bgColor || '#0F1B3D' }}>
            {slide.heading || 'Title'}
          </h1>
          {slide.subheading && (
            <p className="text-2xl" style={{ color: (slide.bgColor || '#0F1B3D') + 'cc' }}>{slide.subheading}</p>
          )}
        </div>
      )

    case 'bullets':
      return (
        <div className="space-y-4">
          {slide.heading && <h2 className="text-2xl" style={headingStyle}>{slide.heading}</h2>}
          <ul className="space-y-3">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-lg" style={{ color: '#1A0A2E' }}>
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#0F1B3D' }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )

    case 'quote':
      return (
        <div className="space-y-4 text-center">
          <p className="text-[22px] leading-relaxed italic" style={{ color: '#1A0A2E' }}>
            &ldquo;{slide.quote}&rdquo;
          </p>
          {slide.attribution && (
            <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>{slide.attribution}</p>
          )}
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
          {slide.caption && <p className="text-sm text-center" style={{ color: '#6B7280' }}>{slide.caption}</p>}
        </div>
      )

    case 'image':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          {slide.imageUrl && (
            <img src={slide.imageUrl} alt="" className="max-h-full max-w-full object-contain rounded-2xl flex-1 min-h-0" />
          )}
          {slide.caption && <p className="text-lg font-medium text-center flex-shrink-0" style={{ color: '#374151' }}>{slide.caption}</p>}
        </div>
      )

    case 'pinpoint': {
      const pins = aggregate.pins ?? []
      return (
        <div className="space-y-3">
          <h2 className="text-2xl" style={headingStyle}>{slide.question}</h2>
          <div className="relative rounded-2xl overflow-hidden border" style={{ aspectRatio: '4/3', background: slide.imageUrl ? '#000' : '#F3F4F6', borderColor: '#DBEAFE' }}>
            {slide.imageUrl && <img src={slide.imageUrl} alt="" className="w-full h-full object-contain pointer-events-none" />}
            {!slide.imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-12 h-12 opacity-10">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            )}
            {showResults && pins.map((pin, i) => (
              <div key={i} className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 transition-all"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: VOTER_COLORS[i % VOTER_COLORS.length], opacity: 0.85 }} />
            ))}
          </div>
          {showResults && <p className="text-sm text-center" style={{ color: '#9CA3AF' }}>{pins.length} pin{pins.length !== 1 ? 's' : ''} placed</p>}
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
              <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{slide.yMax || 'High'}</span>
              <span className="text-[10px] font-bold rotate-180" style={{ color: '#9CA3AF', writingMode: 'vertical-lr' }}>{slide.yLabel}</span>
              <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{slide.yMin || 'Low'}</span>
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
                <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{slide.xMin || 'Low'}</span>
                <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{slide.xLabel}</span>
                <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{slide.xMax || 'High'}</span>
              </div>
            </div>
          </div>
          {showResults && <p className="text-sm text-center" style={{ color: '#9CA3AF' }}>{pins.length} response{pins.length !== 1 ? 's' : ''}</p>}
        </div>
      )
    }

    case 'wheel': {
      const names = slide.names ?? []
      return <WheelSpinner names={names} headingStyle={headingStyle} title={slide.title} />
    }

    default:
      return (
        <div className="text-center py-12">
          <p className="text-lg font-bold" style={{ color: '#0F1B3D' }}>{SLIDE_TYPE_META[slide.type].label}</p>
          <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Live view coming soon</p>
        </div>
      )
  }
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

  const [phase, setPhase] = useState<'loading' | 'error' | 'idle' | 'live'>('loading')
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [slideIndex, setSlideIndex] = useState(0)
  const [participantCount, setParticipantCount] = useState(0)
  const [aggregate, setAggregate] = useState<AggregateData>({ total: 0 })
  const [showResults, setShowResults] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [correctRevealed, setCorrectRevealed] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [floatingVoters, setFloatingVoters] = useState<FloatingVoter[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [waveformData, setWaveformData] = useState<number[]>(Array(20).fill(0))
  const [milestoneLabel, setMilestoneLabel] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [showWave, setShowWave] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const waveTriggeredRef = useRef(false)
  const endingRef = useRef(false)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')

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
  }, [])

  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
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

      if (endingRef.current) {
        endingRef.current = false
        router.push('/host')
      }
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
      setConfetti(true)
      if (soundOn) {
        if (!audioCtxRef.current) audioCtxRef.current = createAudioContext()
        if (audioCtxRef.current) playMilestoneSound(audioCtxRef.current)
      }
      setTimeout(() => { setMilestoneLabel(null); setConfetti(false) }, 3000)
    }
  }, [soundOn])

  function createSession() {
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
          setAggregate({ total: 0 })
          const firstMode = presentation!.slides[0]?.responseMode || 'instant'
          setShowResults(firstMode === 'instant')
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
    if (!presentation || slideIndex >= totalSlides - 1) return
    const newIndex = slideIndex + 1
    const nextMode = presentation.slides[newIndex]?.responseMode || 'instant'
    setSlideIndex(newIndex)
    setAggregate({ total: 0 })
    setShowResults(nextMode === 'instant')
    setRevealed(false)
    setCorrectRevealed(false)
    setShowWave(false)
    waveTriggeredRef.current = false
    reachedMilestonesRef.current.clear()
    voteHistoryRef.current = Array(20).fill(0)
    socketRef.current?.emit('presenter_next_slide', { gameCode, slideIndex: newIndex })
  }

  function prevSlide() {
    if (slideIndex <= 0) return
    const newIndex = slideIndex - 1
    const prevMode = presentation!.slides[newIndex]?.responseMode || 'instant'
    setSlideIndex(newIndex)
    setAggregate({ total: 0 })
    setShowResults(prevMode === 'instant')
    setRevealed(false)
    setCorrectRevealed(false)
    setShowWave(false)
    waveTriggeredRef.current = false
    reachedMilestonesRef.current.clear()
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
            style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold" style={{ color: '#9CA3AF', fontFamily: 'var(--font-body)' }}>
            Loading presentation…
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#F8F9FA' }}>
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
              className="w-full px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-[1.02]"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
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
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#F8F9FA' }}>
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
                background: '#F5E642',
                color: '#0D0D0D',
                fontFamily: 'var(--font-heading)',
                boxShadow: socketConnected ? '0 4px 20px rgba(15,27,61,0.25)' : 'none',
              }}>
              {socketConnected ? 'Start Presentation' : 'Connecting…'}
            </button>
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

  if (phase !== 'live' || !currentSlide) return null

  const meta = SLIDE_TYPE_META[currentSlide.type]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FDFBFF', fontFamily: 'var(--font-body)' }}>

      {/* ── Confetti overlay ─────────────────────────────────────────────────── */}
      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-8px',
                background: VOTER_COLORS[i % VOTER_COLORS.length],
                animation: `fall ${1.5 + Math.random()}s ease-in ${Math.random() * 0.5}s forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }} />
          ))}
        </div>
      )}

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
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>

        {/* Floating top-right bar: votes + participants + game code + QR toggle */}
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
          <div className="rounded-full px-3 py-1.5 font-mono font-black text-sm tracking-[0.15em]"
            style={{ background: '#F5E642', color: '#0D0D0D' }}>
            {gameCode}
          </div>
          <button onClick={() => setShowQR(s => !s)}
            className="rounded-full px-3 py-1.5 text-sm font-bold transition-all hover:scale-105"
            style={{ background: showQR ? '#0F1B3D' : '#fff', color: showQR ? '#fff' : '#0F1B3D', border: '1.5px solid #0F1B3D' }}>
            {showQR ? 'Hide QR' : 'Show QR'}
          </button>
        </div>

        {/* QR overlay (on-demand) */}
        {showQR && (
          <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowQR(false)}>
            <div className="rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl"
              style={{ background: '#fff' }}
              onClick={e => e.stopPropagation()}>
              <p className="text-lg font-bold" style={{ color: '#0F1B3D' }}>Scan to join</p>
              <div className="rounded-2xl p-4" style={{ background: '#F8F7FF', border: '2px solid #E9E2FF' }}>
                <QRCode
                  value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/join?code=${gameCode}&mode=presenter`}
                  size={220}
                  bgColor="#F8F7FF"
                  fgColor="#0F1B3D"
                />
              </div>
              <p className="text-3xl font-black tracking-[0.2em] font-mono" style={{ color: '#0F1B3D' }}>
                {gameCode}
              </p>
              <p className="text-sm" style={{ color: '#6B7280' }}>or visit <span className="font-bold">quizotic.live/join</span></p>
              <button onClick={() => setShowQR(false)}
                className="mt-2 px-6 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Full-width slide content */}
        <div className="h-full p-8 flex flex-col relative">

          {/* Floating voter avatars */}
          <div className="absolute bottom-16 left-0 right-0 h-40 pointer-events-none overflow-hidden">
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
                    width: i === slideIndex ? 20 : 6,
                    height: 6,
                    background: i === slideIndex ? meta.color : `${meta.color}33`,
                  }} />
              ))}
            </div>
            <span className="text-xs font-semibold ml-1" style={{ color: '#9CA3AF' }}>
              {slideIndex + 1} / {totalSlides}
            </span>
          </div>

          {/* Slide content */}
          <div className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto relative">
            <SlideContent slide={currentSlide} aggregate={aggregate} showResults={showResults} correctRevealed={correctRevealed} />
            {plan === 'free' && (
              <div className="absolute bottom-2 right-3 z-10">
                <span className="text-[10px] font-bold opacity-30" style={{ color: '#fff' }}>quizotic.live</span>
              </div>
            )}
          </div>

          {/* Speed waveform */}
          {meta.hasAudienceInput && (
            <div className="flex-shrink-0 mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#C4B5FD' }}>
                Vote velocity
              </p>
              <SpeedWaveform recentVotes={waveformData} />
            </div>
          )}
        </div>
      </div>

      {/* ── Presenter controls (below slide — NOT projected) ─────────────────── */}
      <div className="border-t flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderColor: '#E5E7EB', background: '#F8F9FA' }}>

        {/* Left: sound toggle */}
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

        {/* Center: navigation */}
        <div className="flex items-center gap-3">
          <button onClick={prevSlide} disabled={slideIndex <= 0}
            className="px-7 py-3 rounded-xl text-base font-bold border transition-all disabled:opacity-30"
            style={{ borderColor: '#E5E7EB', color: '#0F1B3D', background: '#fff' }}>
            Prev
          </button>
          <span className="text-lg font-bold tabular-nums" style={{ color: '#6B7280', minWidth: 56, textAlign: 'center' }}>
            {slideIndex + 1} / {totalSlides}
          </span>
          <button onClick={nextSlide} disabled={slideIndex >= totalSlides - 1}
            className="px-7 py-3 rounded-xl text-base font-bold transition-all disabled:opacity-30 hover:scale-[1.02]"
            style={{ background: '#F5E642', color: '#0D0D0D', border: 'none', fontFamily: 'var(--font-heading)' }}>
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
                    background: revealed ? '#DCFCE7' : '#F5E642',
                    color: revealed ? '#16A34A' : '#0D0D0D',
                    border: revealed ? '1.5px solid #86EFAC' : '1.5px solid #0D0D0D',
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
