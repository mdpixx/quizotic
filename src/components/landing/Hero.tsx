'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { JoinCodeBox } from './JoinCodeBox'
import { FloatingElements } from './FloatingElements'
import { Reveal } from './motion'

const QUESTIONS = [
  { q: 'Which planet is closest to the Sun?', options: ['Mercury', 'Venus', 'Mars', 'Jupiter'], correct: 0 },
  { q: 'What is the chemical formula for water?', options: ['H₂O₂', 'CO₂', 'H₂O', 'NaCl'], correct: 2 },
  { q: 'Who wrote Hamlet?', options: ['Dickens', 'Shakespeare', 'Tolstoy', 'Austen'], correct: 1 },
]

// Word-cloud round shown after the MCQs — no scoring, demonstrates that
// Quizotic is more than multiple choice. Counts are the fictional room's
// baseline; the visitor's tap bumps their word live.
const CLOUD_PROMPT = 'One word — how should class feel?'
const CLOUD_SEED: Array<[string, number]> = [
  ['Fun', 14],
  ['Curious', 11],
  ['Alive', 9],
  ['Together', 8],
  ['Focused', 7],
  ['Loud', 5],
  ['Fast', 4],
]
const CLOUD_COLORS = ['#2D3A8C', '#FF8A47', '#0E7490', '#E07A5F', '#7C3AED', '#16A34A', '#CA8A04']

const OPTION_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']
const CONFETTI_COLORS = ['#FBD13B', '#16A34A', '#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F', '#DC2626', '#7C3AED']

function Confetti() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 10 }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: i % 3 === 0 ? 10 : 7,
          height: i % 3 === 0 ? 10 : 7,
          borderRadius: i % 4 === 0 ? '50%' : 2,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          left: `${(i * 3.5 + 3) % 94}%`,
          top: 0,
          animation: `confetti-fall ${0.8 + (i % 5) * 0.25}s ease-in ${(i % 7) * 0.1}s both`,
        }} />
      ))}
    </div>
  )
}

/** Deterministic pseudo-random offset so cloud words scatter without hydration mismatch. */
function scatter(i: number, salt: number) {
  return ((i * 137 + salt * 61) % 23) - 11
}

function WordCloudRound({ counts, chosen, onPick }: {
  counts: Array<[string, number]>
  chosen: string | null
  onPick: (word: string) => void
}) {
  const max = Math.max(...counts.map(([, n]) => n))
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, color: '#16A34A' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          24 participants live
        </div>
        <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: '3px 10px' }}>
          Word cloud · no wrong answers
        </span>
      </div>

      <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 15, color: '#0F1B3D', marginBottom: 10, lineHeight: 1.4 }}>
        {CLOUD_PROMPT}
      </div>

      {/* The cloud */}
      <div style={{ minHeight: 148, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '2px 14px', padding: '8px 4px', background: '#F8F9FA', borderRadius: 10, marginBottom: 14 }}>
        {counts.map(([word, n], i) => {
          const isChosen = word === chosen
          const size = 13 + (n / max) * 17
          return (
            <span key={word} style={{
              fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)',
              fontWeight: isChosen ? 800 : 700,
              fontSize: size,
              color: CLOUD_COLORS[i % CLOUD_COLORS.length],
              transform: `translateY(${scatter(i, n)}px)`,
              transition: 'font-size 0.4s ease, transform 0.4s ease',
              animation: isChosen ? 'bounce-in 0.5s ease-out' : undefined,
              textShadow: isChosen ? '0 0 12px rgba(251,209,59,0.7)' : undefined,
              lineHeight: 1.9,
            }}>
              {word}
            </span>
          )
        })}
      </div>

      {/* Tap chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {CLOUD_SEED.map(([word]) => (
          <button
            key={word}
            onClick={() => onPick(word)}
            disabled={chosen !== null}
            style={{
              fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, fontSize: 12,
              padding: '7px 14px', borderRadius: 16, cursor: chosen !== null ? 'default' : 'pointer',
              border: word === chosen ? '2px solid #0F1B3D' : '1.5px solid #E5E7EB',
              background: word === chosen ? '#FBD13B' : '#fff',
              color: '#0F1B3D',
              opacity: chosen !== null && word !== chosen ? 0.45 : 1,
              transition: 'all 0.2s',
            }}
          >
            {word}
          </button>
        ))}
      </div>
      <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: '10px 0 0' }}>
        {chosen ? 'Your word just joined the cloud ↑' : 'Tap a word — watch it grow in the cloud'}
      </p>
    </>
  )
}

function PodiumFinish({ score }: { score: number }) {
  // Place the visitor on the podium by MCQ score: 3/3 → 1st, 2/3 → 2nd, else 3rd.
  const rank = score === 3 ? 1 : score === 2 ? 2 : 3
  const others = ['Arjun S.', 'Priya K.']
  const names: Record<number, string> = { 1: '', 2: '', 3: '' }
  names[rank] = 'You'
  let o = 0
  for (const place of [1, 2, 3]) {
    if (!names[place]) names[place] = others[o++]
  }
  // Rendered left-to-right as 2nd · 1st · 3rd, classic podium.
  const columns = [
    { place: 2, height: 64, color: '#C0C8D8', emoji: '🥈' },
    { place: 1, height: 96, color: '#FBD13B', emoji: '🥇' },
    { place: 3, height: 44, color: '#E8B98A', emoji: '🥉' },
  ]
  return (
    <>
      {score === 3 && <Confetti />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 272, gap: 12, position: 'relative', zIndex: 20 }}>
        <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 24, color: '#0F1B3D', textAlign: 'center', lineHeight: 1.2, animation: 'bounce-in 0.5s ease-out' }}>
          {score === 3 ? 'Perfect score! 🎉' : `${score} of 3 correct`}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 4 }}>
          {columns.map((c, i) => (
            <div key={c.place} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 20, animation: `bounce-in 0.5s ease-out ${0.2 + i * 0.15}s both` }}>{c.emoji}</div>
              <div style={{
                fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: names[c.place] === 'You' ? 800 : 600,
                fontSize: 12, color: '#0F1B3D',
                background: names[c.place] === 'You' ? '#FBD13B' : 'transparent',
                borderRadius: 8, padding: '2px 8px',
              }}>
                {names[c.place]}
              </div>
              <div style={{
                width: 74, height: c.height, borderRadius: '8px 8px 0 0',
                background: c.color, border: '2px solid #0D0D0D', borderBottom: 'none',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6,
                fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 18, color: '#0D0D0D',
                animation: `podium-rise 0.6s ease-out ${0.1 + i * 0.15}s both`,
                transformOrigin: 'bottom',
              }}>
                {c.place}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '2px solid #0D0D0D', width: 262 }} />
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 1.6, maxWidth: 300, margin: 0 }}>
          {score === 3
            ? 'Your students will fight for this podium.'
            : 'Imagine your whole class racing for this podium.'}
        </p>
      </div>
    </>
  )
}

function BrowserQuiz() {
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(10)
  const [phase, setPhase] = useState<'playing' | 'cloud' | 'end'>('playing')
  const [score, setScore] = useState(0)
  const [cloudCounts, setCloudCounts] = useState(CLOUD_SEED)
  const [cloudChoice, setCloudChoice] = useState<string | null>(null)

  const qIndexRef  = useRef(0)
  const answeredRef = useRef(false)   // prevents timer race with click
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  function resetQuiz() {
    setPhase('playing')
    setQIndex(0)
    qIndexRef.current = 0
    setSelected(null)
    setScore(0)
    setTimeLeft(10)
    setCloudCounts(CLOUD_SEED)
    setCloudChoice(null)
    answeredRef.current = false
  }

  function advanceQuestion() {
    const next = qIndexRef.current + 1
    if (next < QUESTIONS.length) {
      qIndexRef.current = next
      setQIndex(next)
      setSelected(null)
      setTimeLeft(10)
      answeredRef.current = false
    } else {
      setPhase('cloud')
    }
  }

  function handleAnswer(i: number) {
    if (answeredRef.current) return
    answeredRef.current = true
    clearInterval(timerRef.current!)
    if (pendingRef.current) clearTimeout(pendingRef.current)
    if (i === QUESTIONS[qIndexRef.current].correct) setScore(s => s + 1)
    setSelected(i)
    pendingRef.current = setTimeout(advanceQuestion, 1600)
  }

  function handleCloudPick(word: string) {
    if (cloudChoice) return
    setCloudChoice(word)
    setCloudCounts(counts => counts.map(([w, n]) => (w === word ? [w, n + 1] : [w, n]) as [string, number]))
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(() => {
      setPhase('end')
      pendingRef.current = setTimeout(resetQuiz, 6000)
    }, 2400)
  }

  // Timer — loops back to 10 when it hits 0. Never auto-advances.
  // Questions only advance on user click (handleAnswer). The reset to 10
  // happens in resetQuiz/advanceQuestion; this effect only (re)starts the tick.
  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => (t <= 1 ? 10 : t - 1))
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [qIndex, phase])

  // Global cleanup
  useEffect(() => () => {
    clearInterval(timerRef.current!)
    if (pendingRef.current) clearTimeout(pendingRef.current)
  }, [])

  const timerPct = (timeLeft / 10) * 100
  const q        = QUESTIONS[qIndex]

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.15)', background: '#fff', maxWidth: 480, width: '100%' }}>
      {/* Browser bar */}
      <div style={{ background: '#1A1A2E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>quizotic.live/join?code=K7X9</span>
      </div>

      {/* Content area */}
      <div style={{ padding: '20px 20px 24px', background: '#fff', position: 'relative', minHeight: 320 }}>

        {phase === 'end' ? (
          <PodiumFinish score={score} />
        ) : phase === 'cloud' ? (
          <WordCloudRound counts={cloudCounts} chosen={cloudChoice} onPick={handleCloudPick} />
        ) : (
          /* ── QUIZ SCREEN ── */
          <>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, color: '#16A34A' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                24 participants live
              </div>
              <div style={{
                fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 18,
                color: '#fff',
                background: '#0F1B3D',
                border: '2px solid transparent',
                borderRadius: 7, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected !== null ? '✓' : String(timeLeft).padStart(2, '0')}
              </div>
            </div>

            {/* Question */}
            <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 15, color: '#0F1B3D', marginBottom: 10, lineHeight: 1.4 }}>
              {q.q}
            </div>

            {/* Timer bar */}
            <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#FBD13B', borderRadius: 2, width: `${timerPct}%`, transition: 'width 1s linear' }} />
            </div>

            {/* Answer buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {q.options.map((opt, i) => {
                let bg = OPTION_COLORS[i]
                let textColor = '#fff'
                if (selected !== null) {
                  if (i === q.correct) { bg = '#16A34A' }
                  else if (i === selected && i !== q.correct) { bg = '#DC2626' }
                  else { bg = '#E5E7EB'; textColor = '#aaa' }
                }
                return (
                  <button key={i} onClick={() => handleAnswer(i)}
                    style={{ background: bg, color: textColor, border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, cursor: selected !== null ? 'default' : 'pointer', textAlign: 'left', transition: 'background 0.25s', lineHeight: 1.3 }}>
                    <span style={{ opacity: 0.75, marginRight: 4 }}>{String.fromCharCode(65 + i)} ·</span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Mini leaderboard */}
            <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 11, color: '#0F1B3D', marginBottom: 6, letterSpacing: '0.05em' }}>
                🏆 LEADERBOARD
              </div>
              {[['1. Arjun S.', '1,420'], ['2. Priya K.', '1,280'], ['3. Riya M.', '1,150']].map(([name, score]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', padding: '3px 0', color: '#374151' }}>
                  <span>{name}</span>
                  <span style={{ fontWeight: 700, color: '#0F1B3D' }}>{score}</span>
                </div>
              ))}
            </div>

            {/* Round progress dots — 3 MCQs + word cloud */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {QUESTIONS.map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === qIndex ? '#FBD13B' : '#E5E7EB', border: i === qIndex ? '1.5px solid #0D0D0D' : 'none', transition: 'background 0.2s' }} />
              ))}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E5E7EB' }} title="Word cloud round" />
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes bounce-in { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes confetti-fall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(340px) rotate(720deg);opacity:0} }
        @keyframes podium-rise { 0%{transform:scaleY(0)} 100%{transform:scaleY(1)} }
      `}</style>
    </div>
  )
}

/** Subtle 3D tilt that follows the pointer. Skipped for reduced-motion users. */
function TiltFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const enabledRef = useRef(false)

  useEffect(() => {
    enabledRef.current = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && window.matchMedia('(hover: hover)').matches
  }, [])

  function onMove(e: React.PointerEvent) {
    const el = ref.current
    if (!el || !enabledRef.current) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${px * 6}deg) rotateX(${py * -6}deg)`
  }

  function onLeave() {
    const el = ref.current
    if (el) el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ transition: 'transform 0.25s ease-out', width: '100%', maxWidth: 480, willChange: 'transform' }}
    >
      {children}
    </div>
  )
}

const AUDIENCES = [
  { label: 'Teachers', href: '/for/teachers' },
  { label: 'Coaching Institutes', href: '/for/coaching-institutes' },
  { label: 'Colleges', href: '/for/colleges' },
  { label: 'Corporate Trainers', href: '/for/corporate-trainers' },
]

export function Hero() {
  return (
    <section style={{ background: '#0F1B3D', paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))', overflow: 'hidden', position: 'relative' }}>
      {/* Breathing gold glow */}
      <div style={{ position: 'absolute', top: -120, right: -80, width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,209,59,0.09) 0%, transparent 70%)', pointerEvents: 'none', animation: 'hero-glow 9s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: -160, left: -120, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,192,235,0.07) 0%, transparent 70%)', pointerEvents: 'none', animation: 'hero-glow 12s ease-in-out 3s infinite' }} />
      <FloatingElements />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(44px, 8vw, 80px) 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', position: 'relative', zIndex: 1 }} className="hero-inner">
        <div>
          <Reveal on="mount" y={18}>
            <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#FBD13B', letterSpacing: '0.1em', border: '1px solid rgba(251,209,59,0.4)', borderRadius: 20, padding: '6px 14px', marginBottom: 24, textTransform: 'uppercase' }}>
              Quiz + Presentations Platform
            </div>
          </Reveal>
          <Reveal on="mount" delay={0.12} y={26}>
            <h1 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(36px, 4.6vw, 58px)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.12, marginBottom: 20 }}>
              Live quizzes where <span style={{ color: '#FBD13B' }}>every student answers</span> — not just the one who raises a hand.
            </h1>
          </Reveal>
          <Reveal on="mount" delay={0.24} y={26}>
            <p className="prose-justify" style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
              Free to start, nothing to install — students join in their phone browser in seconds. And it&apos;s the only platform built on learning science: Bloom&apos;s Taxonomy, Confidence Grid &amp; Spaced Retrieval.
            </p>
          </Reveal>

          <Reveal on="mount" delay={0.36} y={22}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/auth/signin?intent=signup" className="btn-hero-primary"
                style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 17, color: '#0D0D0D', textDecoration: 'none', padding: '16px 32px', borderRadius: 12, background: '#FBD13B', border: '3px solid #0D0D0D', boxShadow: '5px 5px 0 #0D0D0D', display: 'inline-block' }}>
                Start Teaching Free →
              </Link>
            </div>

            {/* Audience row — every ICP gets a path above the fold */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 10px', marginTop: 22 }}>
              <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
                Built for
              </span>
              {AUDIENCES.map(a => (
                <Link key={a.href} href={a.href} className="hero-audience-chip"
                  style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 16, padding: '5px 13px', transition: 'all 0.2s' }}>
                  {a.label}
                </Link>
              ))}
            </div>

            {/* Trust strip — honest early-stage proof until real usage numbers exist */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 24 }}>
              {['Free forever plan', 'No app — join in the browser', 'Works on slow connections', 'No credit card required'].map(item => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden>
                    <path d="M4 10.5l4 4 8-9" stroke="#FBD13B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </span>
              ))}
            </div>

            {/* Participant entry — students arriving with a session code */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 26, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.12)' }} id="join-code">
              <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                Joining a session?
              </span>
              <JoinCodeBox variant="hero" />
            </div>
          </Reveal>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} className="hero-browser">
          <Reveal on="mount" delay={0.3} y={34} style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'blink-live 1.6s ease-in-out infinite' }} />
              This is the real participant view — go ahead, play it.
            </div>
            <TiltFrame>
              <BrowserQuiz />
            </TiltFrame>
          </Reveal>
        </div>
      </div>

      <style>{`
        .btn-hero-primary { transition: transform 0.15s, box-shadow 0.15s; }
        .btn-hero-primary:hover { transform: translate(2px,2px); box-shadow: 3px 3px 0 #0D0D0D !important; }
        .hero-audience-chip:hover { color: #0D0D0D !important; background: #FBD13B; border-color: #FBD13B !important; }
        @keyframes hero-glow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.12); }
        }
        @media (max-width: 768px) {
          .hero-inner { grid-template-columns: 1fr !important; gap: 40px !important; padding: 48px 24px 48px !important; }
          .hero-browser { justify-content: stretch !important; }
        }
      `}</style>
    </section>
  )
}
