'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const QUESTIONS = [
  {
    q: 'What percentage of the Earth is covered by water?',
    options: ['51%', '71%', '81%', '91%'],
    correct: 1,
  },
  {
    q: 'Which element has the chemical symbol "Au"?',
    options: ['Silver', 'Aluminium', 'Gold', 'Argon'],
    correct: 2,
  },
  {
    q: 'How many bones are in the adult human body?',
    options: ['186', '206', '246', '306'],
    correct: 1,
  },
]

const OPTION_COLORS = ['#F3EEFF', '#EEF2FF', '#FFF0FA', '#FAFAFE']
const CORRECT_COLOR = '#F3EEFF'
const WRONG_COLOR = '#FFF0F0'

// ─── Constellation panel ───────────────────────────────────────────────────

// 3 stars forming a triangle constellation — one per correct answer
const C_STARS = [
  { cx: 150, cy: 55,  r: 5.5, name: 'α Lucis', color: '#fde68a' },
  { cx: 74,  cy: 192, r: 5,   name: 'β Vira',  color: '#A78BFA' },
  { cx: 226, cy: 192, r: 5,   name: 'γ Telos', color: '#F472B6' },
]
const C_LINES: [number, number][] = [[0, 1], [1, 2], [2, 0]]

// Faint background stars (static, no animation — keeps it lightweight)
const BG_STARS = [
  { x: 20,  y: 14,  s: 0.9 }, { x: 78,  y: 8,   s: 1.2 }, { x: 135, y: 22,  s: 0.7 },
  { x: 198, y: 16,  s: 1.0 }, { x: 254, y: 32,  s: 0.8 }, { x: 42,  y: 52,  s: 0.7 },
  { x: 272, y: 64,  s: 1.1 }, { x: 14,  y: 118, s: 0.8 }, { x: 288, y: 108, s: 0.9 },
  { x: 58,  y: 148, s: 0.7 }, { x: 244, y: 144, s: 1.0 }, { x: 32,  y: 222, s: 0.8 },
  { x: 282, y: 220, s: 0.9 }, { x: 112, y: 242, s: 0.7 }, { x: 188, y: 248, s: 0.8 },
  { x: 160, y: 130, s: 0.6 }, { x: 100, y: 90,  s: 0.7 }, { x: 210, y: 100, s: 0.6 },
]

function ConstellationPanel({ stage }: { stage: number }) {
  const stageLabels = [
    'Answer correctly to light a star!',
    'α Lucis — first star lit!',
    'β Vira — the constellation forms...',
    'Quizotic constellation — complete! ✨',
  ]

  // Lines to reveal progressively: 1st line at stage 2, all 3 at stage 3
  const visibleLines = stage >= 3 ? 3 : stage >= 2 ? 1 : 0

  return (
    <div className="relative rounded-3xl overflow-hidden flex flex-col items-center"
      style={{
        background: 'linear-gradient(180deg, #080720 0%, #0f0c3a 55%, #1a1640 100%)',
        minHeight: 340,
        padding: '20px 16px 24px',
      }}>

      {/* Stage label */}
      <p className="text-xs font-bold text-center mb-3 relative z-10"
        style={{ color: stage === 3 ? '#fde68a' : '#a5b4fc' }}>
        {stageLabels[stage]}
      </p>

      {/* SVG constellation */}
      <svg viewBox="0 0 300 268" style={{ width: '100%', maxWidth: 300, flex: 1, overflow: 'visible' }}>

        {/* Background faint stars */}
        {BG_STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s}
            fill="white" opacity={0.12 + (i % 4) * 0.04} />
        ))}

        {/* Constellation lines */}
        {C_LINES.slice(0, visibleLines).map(([a, b], i) => (
          <motion.line
            key={i}
            x1={C_STARS[a].cx} y1={C_STARS[a].cy}
            x2={C_STARS[b].cx} y2={C_STARS[b].cy}
            stroke="rgba(167,139,250,0.5)" strokeWidth={1.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}

        {/* Stars — appear one per correct answer */}
        {C_STARS.map((star, i) => {
          const visible = stage >= i + 1
          return (
            <motion.g key={star.name}>
              {/* Glow halo */}
              <motion.circle
                cx={star.cx} cy={star.cy} r={star.r * 3.8}
                fill={star.color}
                animate={{ opacity: visible ? [0.1, 0.2, 0.1] : 0 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
              />
              {/* Star core */}
              <motion.circle
                cx={star.cx} cy={star.cy} r={star.r}
                fill={star.color}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: visible ? 1 : 0, opacity: visible ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                style={{ transformOrigin: `${star.cx}px ${star.cy}px` }}
              />
              {/* Name label */}
              {visible && (
                <motion.text
                  x={star.cx} y={star.cy + star.r + 15}
                  fill="rgba(253,230,138,0.5)"
                  fontSize={9} textAnchor="middle"
                  fontFamily="monospace"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}>
                  {star.name}
                </motion.text>
              )}
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────
export function InteractiveDemo() {
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [constellationStage, setConstellationStage] = useState(0)

  const question = QUESTIONS[qIdx]
  const isLast = qIdx === QUESTIONS.length - 1

  function handleSelect(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    const correct = idx === question.correct
    if (correct) {
      setScore(s => s + 1)
      setConstellationStage(s => Math.min(s + 1, 3))
    }
    setTimeout(() => {
      if (isLast) {
        setShowResult(true)
      } else {
        setQIdx(q => q + 1)
        setSelected(null)
      }
    }, 1200)
  }

  function reset() {
    setQIdx(0)
    setSelected(null)
    setScore(0)
    setShowResult(false)
    setConstellationStage(0)
  }

  return (
    <section className="relative py-20 px-6 md:px-12 overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      <div className="max-w-[1280px] mx-auto relative z-10">
        <p className="text-sm font-bold uppercase tracking-widest mb-3"
          style={{ color: 'var(--color-primary)' }}>
          try it yourself
        </p>
        <h2 className="text-4xl sm:text-5xl font-black lowercase tracking-tight mb-3"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
          experience a live quiz
        </h2>
        <p className="text-base mb-10 max-w-lg" style={{ color: 'var(--color-text-muted)' }}>
          Answer 3 questions. Each correct answer lights a star — get them all right and complete the constellation!
        </p>

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          {/* Left: quiz (55%) */}
          <div className="w-full lg:w-[55%]">
            <AnimatePresence mode="wait">
              {showResult ? (
                <motion.div key="result"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="rounded-3xl p-8 text-center shadow-lg border h-full flex flex-col items-center justify-center"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="text-5xl mb-4">{score === 3 ? '✨' : score >= 2 ? '⭐' : '🌟'}</div>
                  <p className="text-3xl font-black mb-1"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
                    {score} / {QUESTIONS.length}
                  </p>
                  <p className="text-base mb-6" style={{ color: 'var(--color-text-muted)' }}>
                    {score === 3 ? 'Constellation complete! ✨' : score >= 2 ? 'Almost there — one more star to go!' : 'Keep answering — every star counts.'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={reset}
                      className="text-base font-bold px-5 py-2.5 rounded-full border-2 transition-colors"
                      style={{ fontFamily: 'var(--font-heading)', borderColor: '#d6d3d1', color: 'var(--color-dark)' }}>
                      try again
                    </button>
                    <a href="/host"
                      className="text-base font-bold px-5 py-2.5 rounded-full transition-all hover:-translate-y-0.5 hover:opacity-90"
                      style={{ fontFamily: 'var(--font-heading)', background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff' }}>
                      ✦ host your own
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={qIdx}
                  initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-3xl overflow-hidden shadow-lg border h-full"
                  style={{ background: '#fff', borderColor: 'var(--color-border)' }}>
                  <div className="h-1.5" style={{ background: '#f5f5f4' }}>
                    <div className="h-1.5 transition-all duration-500 rounded-r-full"
                      style={{ width: `${((qIdx + 1) / QUESTIONS.length) * 100}%`, background: 'linear-gradient(90deg,#7C3AED,#EC4899)' }} />
                  </div>
                  <div className="px-7 pt-6 pb-3">
                    <p className="text-sm font-bold uppercase tracking-wider mb-3"
                      style={{ color: 'var(--color-text-subtle)' }}>
                      Question {qIdx + 1} of {QUESTIONS.length}
                    </p>
                    <p className="text-xl font-extrabold leading-snug"
                      style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
                      {question.q}
                    </p>
                  </div>
                  <div className="px-7 pb-7 pt-3 flex flex-col gap-3">
                    {question.options.map((opt, idx) => {
                      let bg = OPTION_COLORS[idx]
                      if (selected !== null) {
                        if (idx === question.correct) bg = CORRECT_COLOR
                        else if (idx === selected) bg = WRONG_COLOR
                        else bg = '#f5f5f4'
                      }
                      return (
                        <button key={idx} onClick={() => handleSelect(idx)}
                          className="flex items-center gap-3 px-4 py-4 rounded-xl text-base font-semibold text-left transition-all"
                          style={{
                            background: bg, color: 'var(--color-dark)',
                            opacity: selected !== null && idx !== selected && idx !== question.correct ? 0.5 : 1,
                            cursor: selected !== null ? 'default' : 'pointer',
                          }}>
                          <span className="font-black text-base w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ fontFamily: 'var(--font-heading)', background: 'rgba(0,0,0,0.06)' }}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          {opt}
                          {selected !== null && idx === question.correct && (
                            <span className="ml-auto text-green-600 font-bold text-lg">✓</span>
                          )}
                          {selected === idx && idx !== question.correct && (
                            <span className="ml-auto text-red-500 font-bold text-lg">✗</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: constellation panel (45%) */}
          <div className="w-full lg:w-[45%]">
            <ConstellationPanel stage={constellationStage} />
          </div>
        </div>
      </div>
    </section>
  )
}
