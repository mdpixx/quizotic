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
const VOTER_COLORS = ['#7C3AED','#DB2777','#0891B2','#16A34A','#EA580C','#9333EA','#DC2626']

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
        <span className="text-sm font-semibold" style={{ color: '#1A0A2E' }}>{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{count} <span className="text-xs font-normal opacity-60">({pct}%)</span></span>
      </div>
      <div className="h-8 rounded-full overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.06)' }}>
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
  const colors = ['#7C3AED','#DB2777','#0891B2','#16A34A','#EA580C','#9333EA']
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

// ─── Slide content renderer ───────────────────────────────────────────────────

function SlideContent({ slide, aggregate, showResults }: { slide: Slide; aggregate: AggregateData; showResults: boolean }) {
  const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-heading)', color: '#1A0A2E', fontWeight: 900 }

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
        : ['#7C3AED','#DB2777','#0891B2','#16A34A','#F59E0B']

      return (
        <div className="space-y-5">
          <h2 className="text-2xl leading-snug" style={headingStyle}>
            {(slide as { question: string }).question || <span className="opacity-30">Question text...</span>}
          </h2>
          {showResults && (
            <div className="space-y-3">
              {options.map((opt, i) => (
                <PollBar key={i}
                  label={opt || `Option ${i+1}`}
                  count={aggregate.counts?.[i] ?? 0}
                  total={aggregate.total}
                  color={barColors[i % barColors.length]}
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    case 'open_text':
      return (
        <div className="space-y-4">
          <h2 className="text-2xl leading-snug" style={headingStyle}>
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
          <h2 className="text-2xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          {showResults && aggregate.words && <WordCloud words={aggregate.words} />}
        </div>
      )

    case 'rating_scale':
      return (
        <div className="space-y-5">
          <h2 className="text-2xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <div className="flex items-center justify-between text-sm font-semibold" style={{ color: '#6B4FA0' }}>
            <span>{slide.minLabel}</span>
            <span>{slide.maxLabel}</span>
          </div>
          {showResults && aggregate.scores && aggregate.scores.length > 0 && (
            <div className="text-center">
              <p className="text-5xl font-black" style={{ color: '#7C3AED', fontFamily: 'var(--font-heading)' }}>
                {(aggregate.scores.reduce((a, b) => a + b, 0) / aggregate.scores.length).toFixed(1)}
              </p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>average rating · {aggregate.total} responses</p>
            </div>
          )}
        </div>
      )

    case 'emoji_pulse':
      return (
        <div className="space-y-5">
          <h2 className="text-2xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Prompt text...</span>}
          </h2>
          {showResults && aggregate.emojis && (
            <div className="flex flex-wrap gap-4 justify-center">
              {slide.emojis.map(em => (
                <div key={em} className="flex flex-col items-center gap-1">
                  <span className="text-4xl">{em}</span>
                  <span className="text-lg font-black" style={{ color: '#7C3AED' }}>
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
          <h2 className="text-2xl leading-snug" style={headingStyle}>
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
          <h2 className="text-2xl leading-snug" style={headingStyle}>
            {slide.question || <span className="opacity-30">Question text...</span>}
          </h2>
          <div className="flex items-center justify-between text-sm font-semibold" style={{ color: '#6B4FA0' }}>
            <span>0 · {slide.minLabel}</span>
            <span>{slide.maxLabel} · 100</span>
          </div>
          {showResults && aggregate.scores && aggregate.scores.length > 0 && (
            <div className="text-center">
              <p className="text-5xl font-black" style={{ color: '#7C3AED', fontFamily: 'var(--font-heading)' }}>
                {Math.round(aggregate.scores.reduce((a, b) => a + b, 0) / aggregate.scores.length)}
              </p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>average · {aggregate.total} responses</p>
            </div>
          )}
        </div>
      )

    case 'title':
      return (
        <div className="rounded-2xl p-8 text-center space-y-3" style={{ background: slide.bgColor + '18' }}>
          <h1 className="text-4xl font-black leading-tight" style={{ ...headingStyle, color: slide.bgColor }}>
            {slide.heading || 'Title'}
          </h1>
          {slide.subheading && (
            <p className="text-xl" style={{ color: slide.bgColor + 'cc' }}>{slide.subheading}</p>
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
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#7C3AED' }} />
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
            <p className="text-sm font-semibold" style={{ color: '#7C3AED' }}>{slide.attribution}</p>
          )}
        </div>
      )

    case 'video':
      return (
        <div className="space-y-3">
          {slide.url && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-black">
              <iframe src={slide.url.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen />
            </div>
          )}
          {slide.caption && <p className="text-sm text-center" style={{ color: '#6B7280' }}>{slide.caption}</p>}
        </div>
      )

    default:
      return (
        <div className="text-center py-12">
          <p className="text-lg font-bold" style={{ color: '#7C3AED' }}>{SLIDE_TYPE_META[slide.type].label}</p>
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

  const [phase, setPhase] = useState<'loading' | 'error' | 'idle' | 'live'>('loading')
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [slideIndex, setSlideIndex] = useState(0)
  const [participantCount, setParticipantCount] = useState(0)
  const [aggregate, setAggregate] = useState<AggregateData>({ total: 0 })
  const [showResults, setShowResults] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [floatingVoters, setFloatingVoters] = useState<FloatingVoter[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [waveformData, setWaveformData] = useState<number[]>(Array(20).fill(0))
  const [milestoneLabel, setMilestoneLabel] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)

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

  // Connect socket once presentation is loaded
  useEffect(() => {
    if (!presentation) return
    const socket = io()
    socketRef.current = socket

    socket.on('presenter_participant_joined', ({ count }: { count: number }) => {
      setParticipantCount(count)
    })

    socket.on('presenter_participant_left', ({ count }: { count: number }) => {
      setParticipantCount(count)
    })

    socket.on('presenter_aggregate_updated', (data: AggregateData) => {
      setAggregate(data)
      triggerVoteEffects(data.total)
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
    setFloatingVoters(prev => [...prev.slice(-12), voter])
    setTimeout(() => setFloatingVoters(prev => prev.filter(v => v.id !== voter.id)), 3500)

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
    socketRef.current?.emit('create_presenter_session',
      { presentationData: presentation },
      (res: { success: boolean; gameCode: string }) => {
        if (res.success) {
          setGameCode(res.gameCode)
          setPhase('live')
          setSlideIndex(0)
          setAggregate({ total: 0 })
        }
      }
    )
  }

  function nextSlide() {
    if (!presentation || slideIndex >= totalSlides - 1) return
    const newIndex = slideIndex + 1
    setSlideIndex(newIndex)
    setAggregate({ total: 0 })
    setShowResults(false)
    reachedMilestonesRef.current.clear()
    voteHistoryRef.current = Array(20).fill(0)
    socketRef.current?.emit('presenter_next_slide', { gameCode, slideIndex: newIndex })
  }

  function prevSlide() {
    if (slideIndex <= 0) return
    const newIndex = slideIndex - 1
    setSlideIndex(newIndex)
    setAggregate({ total: 0 })
    setShowResults(false)
    reachedMilestonesRef.current.clear()
    socketRef.current?.emit('presenter_prev_slide', { gameCode, slideIndex: newIndex })
  }

  function endSession() {
    socketRef.current?.emit('end_presenter_session', { gameCode })
    router.push('/host')
  }

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDFBFF' }}>
      <p style={{ color: '#7C3AED' }}>Loading...</p>
    </div>
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#FDFBFF' }}>
        <p style={{ color: '#6B7280' }}>No active presentation found.</p>
        <button onClick={() => router.push('/host/present/create')}
          className="px-6 py-3 rounded-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#DB2777)' }}>
          Create Presentation
        </button>
      </div>
    )
  }

  if (phase === 'idle' && presentation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: '#FDFBFF' }}>
        <h1 className="text-3xl font-black text-center" style={{ fontFamily: 'var(--font-heading)', color: '#1A0A2E' }}>
          {presentation.title}
        </h1>
        <p style={{ color: '#6B7280' }}>{presentation.slides.length} slides</p>
        <button onClick={createSession}
          className="px-8 py-4 rounded-2xl text-lg font-black text-white transition-all hover:scale-[1.03]"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#DB2777)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
          Start Presentation →
        </button>
        <button onClick={() => router.push('/host/present/create')} className="text-sm" style={{ color: '#9CA3AF' }}>
          ← Edit slides
        </button>
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
            style={{ background: 'linear-gradient(135deg,#7C3AED,#DB2777)', color: '#fff' }}>
            <p className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {milestoneLabel}
            </p>
            <p className="text-lg opacity-80">🎉</p>
          </div>
        </div>
      )}

      {/* ── Main projected slide area ─────────────────────────────────────── */}
      <div className="flex flex-1" style={{ minHeight: 0 }}>

        {/* LEFT: slide content */}
        <div className="flex-1 p-8 flex flex-col relative overflow-hidden">

          {/* Floating voter avatars */}
          <div className="absolute bottom-16 left-0 right-0 h-12 pointer-events-none overflow-hidden">
            {floatingVoters.map(v => (
              <div key={v.id} className="absolute bottom-0 text-2xl"
                style={{
                  left: `${v.x}%`,
                  animation: 'floatUp 3.5s ease-out forwards',
                }}>
                {v.emoji}
              </div>
            ))}
          </div>

          {/* Toast notifications */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            {toasts.map(t => (
              <div key={t.id} className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg text-white"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#DB2777)' }}>
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
          <div className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto">
            <SlideContent slide={currentSlide} aggregate={aggregate} showResults={showResults} />
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

        {/* RIGHT: QR panel (200px) */}
        <div className="w-52 flex-shrink-0 border-l flex flex-col items-center py-6 px-4 gap-5"
          style={{ borderColor: '#E9E2FF', background: '#F8F7FF' }}>

          {/* Vote counter ring */}
          <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
              <circle cx="48" cy="48" r="40" stroke="#E9E2FF" strokeWidth="8" fill="none"/>
              <circle cx="48" cy="48" r="40" fill="none"
                stroke="url(#voteGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min(aggregate.total, 100) / 100)}`}
                transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
              />
              <defs>
                <linearGradient id="voteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7C3AED"/>
                  <stop offset="100%" stopColor="#DB2777"/>
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#7C3AED' }}>
                {aggregate.total}
              </p>
              <p className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>votes</p>
            </div>
          </div>

          {/* Participant count */}
          <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>
            {participantCount} participant{participantCount !== 1 ? 's' : ''} joined
          </p>

          {/* QR code — 148×148 */}
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-[18px] p-2.5 bg-white" style={{ border: '1.5px solid #E9E2FF', boxShadow: '0 2px 12px rgba(124,58,237,0.08)' }}>
              <QRCode
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${gameCode}&mode=presenter`}
                size={128}
                bgColor="#ffffff"
                fgColor="#7C3AED"
                style={{ borderRadius: 8 }}
              />
            </div>
            <p className="text-xs font-bold tracking-[0.2em] font-mono" style={{ color: '#7C3AED' }}>
              {gameCode}
            </p>
            <p className="text-[10px]" style={{ color: '#9CA3AF' }}>scan to join</p>
          </div>
        </div>
      </div>

      {/* ── Presenter controls (below slide — NOT projected) ─────────────────── */}
      <div className="border-t flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderColor: '#E9E2FF', background: '#F8F7FF' }}>

        {/* Left: sound toggle */}
        <button
          onClick={() => setSoundOn(s => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: soundOn ? '#DCFCE7' : '#F3F4F6',
            color: soundOn ? '#16A34A' : '#9CA3AF',
            border: `1.5px solid ${soundOn ? '#86EFAC' : '#E5E7EB'}`,
          }}>
          {soundOn ? '🔊 Sound On' : '🔇 Sound Off'}
        </button>

        {/* Center: navigation */}
        <div className="flex items-center gap-3">
          <button onClick={prevSlide} disabled={slideIndex <= 0}
            className="px-5 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-30"
            style={{ borderColor: '#E9E2FF', color: '#7C3AED', background: '#fff' }}>
            ← Prev
          </button>
          <span className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>
            {slideIndex + 1} / {totalSlides}
          </span>
          <button onClick={nextSlide} disabled={slideIndex >= totalSlides - 1}
            className="px-5 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-30 hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#DB2777)', color: '#fff', border: 'none' }}>
            Next →
          </button>
        </div>

        {/* Right: show results + end */}
        <div className="flex items-center gap-2">
          {meta.hasAudienceInput && (
            <button
              onClick={() => setShowResults(s => !s)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: showResults ? '#F3EEFF' : '#fff',
                color: showResults ? '#7C3AED' : '#9CA3AF',
                border: `1.5px solid ${showResults ? '#C4B5FD' : '#E5E7EB'}`,
              }}>
              {showResults ? 'Hide Results' : 'Show Results'}
            </button>
          )}
          <button onClick={endSession}
            className="px-4 py-2 rounded-xl text-sm font-bold border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-500"
            style={{ borderColor: '#E9E2FF', color: '#9CA3AF', background: '#fff' }}>
            End
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(0.7); opacity: 0; }
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
