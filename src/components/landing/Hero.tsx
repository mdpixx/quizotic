'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { JoinCodeBox } from './JoinCodeBox'

const QUESTIONS = [
  { q: 'Which planet is closest to the Sun?', options: ['Mercury', 'Venus', 'Mars', 'Jupiter'], correct: 0 },
  { q: 'What is the chemical formula for water?', options: ['H₂O₂', 'CO₂', 'H₂O', 'NaCl'], correct: 2 },
  { q: 'Who wrote Hamlet?', options: ['Dickens', 'Shakespeare', 'Tolstoy', 'Austen'], correct: 1 },
]

const OPTION_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']
const CONFETTI_COLORS = ['#F5E642', '#16A34A', '#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F', '#DC2626', '#7C3AED']

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

function BrowserQuiz() {
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(10)
  const [phase, setPhase] = useState<'playing' | 'end'>('playing')

  const scoreRef   = useRef(0)
  const qIndexRef  = useRef(0)
  const answeredRef = useRef(false)   // prevents timer race with click
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)

  function resetQuiz() {
    setPhase('playing')
    setQIndex(0)
    qIndexRef.current = 0
    setSelected(null)
    scoreRef.current = 0
  }

  function advanceQuestion() {
    const next = qIndexRef.current + 1
    if (next < QUESTIONS.length) {
      qIndexRef.current = next
      setQIndex(next)
      setSelected(null)
    } else {
      setPhase('end')
      pendingRef.current = setTimeout(resetQuiz, 4500)
    }
  }

  function handleAnswer(i: number) {
    if (answeredRef.current) return
    answeredRef.current = true
    clearInterval(timerRef.current!)
    if (pendingRef.current) clearTimeout(pendingRef.current)
    if (i === QUESTIONS[qIndexRef.current].correct) scoreRef.current++
    setSelected(i)
    pendingRef.current = setTimeout(advanceQuestion, 1600)
  }

  // Timer — loops back to 10 when it hits 0. Never auto-advances.
  // Questions only advance on user click (handleAnswer).
  useEffect(() => {
    answeredRef.current = false
    setTimeLeft(10)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => (t <= 1 ? 10 : t - 1))
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [qIndex]) // eslint-disable-line

  // Global cleanup
  useEffect(() => () => {
    clearInterval(timerRef.current!)
    if (pendingRef.current) clearTimeout(pendingRef.current)
  }, [])

  const timerPct   = (timeLeft / 10) * 100
  const allCorrect = scoreRef.current === QUESTIONS.length
  const q          = QUESTIONS[qIndex]

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

        {/* ── END SCREEN ── */}
        {phase === 'end' ? (
          <>
            {allCorrect && <Confetti />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 272, gap: 14, position: 'relative', zIndex: 20 }}>
              <div style={{ fontSize: 52, animation: 'bounce-in 0.5s ease-out' }}>
                {allCorrect ? '🎉' : '💪'}
              </div>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 26, color: '#0F1B3D', textAlign: 'center', lineHeight: 1.2 }}>
                {allCorrect ? 'Perfect Score!' : `${scoreRef.current} of 3 correct`}
              </div>
              <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 1.6, maxWidth: 290 }}>
                {allCorrect
                  ? 'Outstanding! You got every question right. Your students will love this.'
                  : scoreRef.current === 2
                    ? 'Great effort! One slip — review it and you\'ll nail it next time.'
                    : 'Keep practising — every attempt builds stronger recall. You\'ve got this! 🚀'}
              </div>
              {/* Score dots */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {QUESTIONS.map((_, i) => (
                  <div key={i} style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: i < scoreRef.current ? '#16A34A' : '#F3F4F6',
                    border: `2px solid ${i < scoreRef.current ? '#16A34A' : '#E5E7EB'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: i < scoreRef.current ? '#fff' : '#CBD5E1',
                    animation: i < scoreRef.current ? `bounce-in 0.4s ease-out ${i * 0.15}s both` : 'none',
                  }}>
                    {i < scoreRef.current ? '✓' : '✗'}
                  </div>
                ))}
              </div>
            </div>
          </>
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
              <div style={{ height: '100%', background: '#F5E642', borderRadius: 2, width: `${timerPct}%`, transition: 'width 1s linear' }} />
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

            {/* Question progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {QUESTIONS.map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === qIndex ? '#F5E642' : '#E5E7EB', border: i === qIndex ? '1.5px solid #0D0D0D' : 'none', transition: 'background 0.2s' }} />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes bounce-in { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes confetti-fall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(340px) rotate(720deg);opacity:0} }
      `}</style>
    </div>
  )
}

export function Hero() {
  return (
    <section style={{ background: '#0F1B3D', paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,230,66,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(44px, 8vw, 80px) 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-inner">
        <div>
          <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#F5E642', letterSpacing: '0.1em', border: '1px solid rgba(245,230,66,0.4)', borderRadius: 20, padding: '6px 14px', marginBottom: 24, textTransform: 'uppercase' }}>
            Quiz + Presentations Platform
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(40px, 5vw, 64px)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20 }}>
            Live quizzes your class joins from their <span style={{ color: '#F5E642' }}>phones</span>.
          </h1>
          <p className="prose-justify" style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
            Free to start, nothing to install — students join in their phone browser in seconds. And it&apos;s the only platform built on learning science: Bloom&apos;s Taxonomy, Confidence Grid &amp; Spaced Retrieval.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/auth/signin" className="btn-hero-primary"
              style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 17, color: '#0D0D0D', textDecoration: 'none', padding: '16px 32px', borderRadius: 12, background: '#F5E642', border: '3px solid #0D0D0D', boxShadow: '5px 5px 0 #0D0D0D', display: 'inline-block' }}>
              Start Teaching Free →
            </Link>
            <Link href="/demo" className="btn-hero-ghost"
              style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, fontSize: 16, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', padding: '16px 28px', borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)', display: 'inline-block' }}>
              Try a Live Demo →
            </Link>
          </div>

          {/* Trust strip — honest early-stage proof until real usage numbers exist */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 28 }}>
            {['Free forever plan', 'No app — join in the browser', 'Works on slow connections', 'UPI & cards accepted'].map(item => (
              <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden>
                  <path d="M4 10.5l4 4 8-9" stroke="#F5E642" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </span>
            ))}
          </div>

          {/* Participant entry — students arriving with a session code */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 28, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
              Joining a session?
            </span>
            <JoinCodeBox variant="hero" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }} className="hero-browser">
          <BrowserQuiz />
        </div>
      </div>

      <style>{`
        .btn-hero-primary { transition: transform 0.15s, box-shadow 0.15s; }
        .btn-hero-primary:hover { transform: translate(2px,2px); box-shadow: 3px 3px 0 #0D0D0D !important; }
        .btn-hero-ghost:hover { border-color: rgba(255,255,255,0.7) !important; color: #fff !important; }
        .btn-hero-ghost { transition: border-color 0.2s, color 0.2s; }
        @media (max-width: 768px) {
          .hero-inner { grid-template-columns: 1fr !important; gap: 40px !important; padding: 48px 24px 48px !important; }
          .hero-browser { justify-content: stretch !important; }
        }
      `}</style>
    </section>
  )
}
