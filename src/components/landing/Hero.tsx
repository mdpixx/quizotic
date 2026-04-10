'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const QUESTIONS = [
  {
    q: 'Which planet is closest to the Sun?',
    options: ['Mercury', 'Venus', 'Mars', 'Jupiter'],
    correct: 0,
  },
  {
    q: 'What is the chemical formula for water?',
    options: ['H₂O₂', 'CO₂', 'H₂O', 'NaCl'],
    correct: 2,
  },
  {
    q: 'Who wrote Hamlet?',
    options: ['Dickens', 'Shakespeare', 'Tolstoy', 'Austen'],
    correct: 1,
  },
]

const OPTION_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']

function BrowserQuiz() {
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(10)
  const [celebrating, setCelebrating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const q = QUESTIONS[qIndex]

  useEffect(() => {
    if (selected !== null) return
    setTimeLeft(10)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [qIndex, selected])

  function handleAnswer(i: number) {
    if (selected !== null) return
    clearInterval(timerRef.current!)
    setSelected(i)
    setTimeout(() => {
      if (qIndex < QUESTIONS.length - 1) {
        setQIndex(qi => qi + 1)
        setSelected(null)
      } else {
        setCelebrating(true)
        setTimeout(() => {
          setQIndex(0)
          setSelected(null)
          setCelebrating(false)
        }, 3000)
      }
    }, 1500)
  }

  const timerPct = (timeLeft / 10) * 100

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.1)', background: '#fff', maxWidth: 420, width: '100%' }}>
      {/* Browser bar */}
      <div style={{ background: '#1A1A2E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>quizotic.live/join?code=K7X9</span>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 20px 24px', background: '#fff', position: 'relative', minHeight: 280 }}>
        {celebrating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12 }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 28, color: '#0F1B3D' }}>Perfect!</div>
            <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: '#666' }}>All 3 correct!</div>
          </div>
        ) : (
          <>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, color: '#16A34A' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                24 participants live
              </div>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 22, color: '#0F1B3D', minWidth: 32, textAlign: 'center' }}>
                {selected !== null ? '✓' : String(timeLeft).padStart(2, '0')}
              </div>
            </div>

            {/* Question */}
            <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 15, color: '#0F1B3D', marginBottom: 10, lineHeight: 1.4 }}>
              {q.q}
            </div>

            {/* Timer bar */}
            <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: timeLeft <= 3 ? '#DC2626' : '#F5E642', borderRadius: 2, width: `${timerPct}%`, transition: 'width 1s linear, background 0.3s' }} />
            </div>

            {/* Answer buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {q.options.map((opt, i) => {
                let bg = OPTION_COLORS[i]
                let border = 'none'
                let scale = 1
                if (selected !== null) {
                  if (i === q.correct) { bg = '#16A34A'; border = '2px solid #16A34A' }
                  else if (i === selected && i !== q.correct) { bg = '#DC2626'; border = '2px solid #DC2626' }
                  else { bg = '#E5E7EB' }
                }
                return (
                  <button key={i} onClick={() => handleAnswer(i)}
                    style={{ background: bg, color: '#fff', border, borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, cursor: selected !== null ? 'default' : 'pointer', textAlign: 'left', transform: `scale(${scale})`, transition: 'background 0.2s, transform 0.1s', lineHeight: 1.3 }}>
                    <span style={{ opacity: 0.8, marginRight: 4 }}>{String.fromCharCode(65 + i)} ·</span>
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

            {/* Question indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {QUESTIONS.map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === qIndex ? '#F5E642' : '#E5E7EB', border: i === qIndex ? '1.5px solid #0D0D0D' : 'none', transition: 'background 0.2s' }} />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  )
}

export function Hero() {
  return (
    <section style={{ background: '#0F1B3D', paddingTop: 64, overflow: 'hidden' }}>
      {/* Subtle bg decoration */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,230,66,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-inner">
        {/* Left */}
        <div>
          <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#F5E642', letterSpacing: '0.1em', border: '1px solid rgba(245,230,66,0.4)', borderRadius: 20, padding: '6px 14px', marginBottom: 24, textTransform: 'uppercase' }}>
            Quiz + Presentations Platform
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(36px, 4.5vw, 56px)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20 }}>
            Turn every <span style={{ color: '#F5E642' }}>session</span> into a learning moment.
          </h1>
          <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
            The only platform built on evidence-based learning science — Bloom&apos;s Taxonomy, Confidence Grid &amp; Spaced Retrieval. Run live quizzes and interactive presentations from one place.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/auth/signin" className="btn-hero-primary"
              style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 17, color: '#0D0D0D', textDecoration: 'none', padding: '16px 32px', borderRadius: 12, background: '#F5E642', border: '3px solid #0D0D0D', boxShadow: '5px 5px 0 #0D0D0D', display: 'inline-block' }}>
              Start Teaching Free →
            </Link>
            <a href="#how" className="btn-hero-ghost"
              style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, fontSize: 16, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', padding: '16px 28px', borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)', display: 'inline-block' }}>
              See How It Works ↓
            </a>
          </div>
        </div>

        {/* Right — interactive quiz */}
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
