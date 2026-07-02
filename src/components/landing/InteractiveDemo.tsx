'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const QUESTIONS = [
  {
    q: 'What percentage of the ocean floor has been mapped?',
    options: ['About 5%', 'About 25%', 'About 50%', 'About 80%'],
    correct: 1,
    explanation: 'Only about 25% of the ocean floor has been mapped with modern sonar technology.',
  },
  {
    q: 'Which country has the most time zones?',
    options: ['Russia', 'USA', 'France', 'China'],
    correct: 2,
    explanation: 'France has 12 time zones due to its overseas territories, more than any other country.',
  },
  {
    q: 'What is the hardest natural substance on Earth?',
    options: ['Titanium', 'Diamond', 'Graphene', 'Tungsten'],
    correct: 1,
    explanation: 'Diamond remains the hardest naturally occurring substance, scoring 10 on the Mohs scale.',
  },
]

const OPTION_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']

// Generated once at module scope: render must stay pure (react-hooks/purity),
// and the confetti only appears client-side after a quiz finishes, so a fixed
// particle layout is indistinguishable from a per-render one.
const CONFETTI_PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  delay: `${Math.random() * 0.5}s`,
  duration: `${1.5 + Math.random() * 1.5}s`,
  color: ['#0F1B3D', '#FBD13B', '#16A34A', '#2D3A8C', '#FF8A47', '#5BC0EB'][i % 6],
  size: 4 + Math.random() * 6,
  rotation: Math.random() * 360,
}))

function CSSConfetti() {
  const particles = CONFETTI_PARTICLES

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: p.left,
            top: '-10px',
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration} ease-out ${p.delay} forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(400px) rotate(720deg); }
        }
      `}</style>
    </div>
  )
}

function FloatingPoints({ points, isCorrect }: { points: number; isCorrect: boolean }) {
  if (!isCorrect) return null
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -50, scale: 0.5 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      className="absolute top-0 right-4 text-lg font-black z-30"
      style={{ color: '#FBD13B' }}
    >
      +{points}
    </motion.div>
  )
}

export function InteractiveDemo() {
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'done'>('playing')
  const [showExplanation, setShowExplanation] = useState(false)
  const [lastPoints, setLastPoints] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showFloatingPoints, setShowFloatingPoints] = useState(false)

  const question = QUESTIONS[qIdx]

  const handleSelect = useCallback((idx: number) => {
    if (selected !== null) return
    setSelected(idx)
    setShowExplanation(true)

    const isCorrect = idx === question.correct
    if (isCorrect) {
      const bonus = (streak + 1) * 50
      const pts = 100 + bonus
      setLastPoints(pts)
      setScore(s => s + pts)
      setStreak(s => s + 1)
      setShowFloatingPoints(true)
      setTimeout(() => setShowFloatingPoints(false), 1200)
    } else {
      setStreak(0)
    }

    setTimeout(() => {
      if (qIdx < QUESTIONS.length - 1) {
        setQIdx(q => q + 1)
        setSelected(null)
        setShowExplanation(false)
      } else {
        setPhase('done')
        if (score + (isCorrect ? 100 + (streak + 1) * 50 : 0) >= 300) {
          setShowConfetti(true)
        }
      }
    }, 2200)
  }, [selected, qIdx, streak, question.correct, score])

  const restart = () => {
    setQIdx(0)
    setSelected(null)
    setScore(0)
    setStreak(0)
    setPhase('playing')
    setShowExplanation(false)
    setShowConfetti(false)
  }

  const resultMessage = score >= 300
    ? "You're a genius!"
    : score >= 150
      ? 'Great job! Keep it up!'
      : 'Every expert was once a beginner!'

  return (
    <section className="py-20 md:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-sm font-bold uppercase tracking-widest mb-3 inline-block px-4 py-1.5 rounded-full" style={{ background: '#FBD13B', color: '#0F1B3D' }}>Try It Now</p>
          <h2 className="text-3xl md:text-4xl font-black mt-4" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            See How It Feels
          </h2>
          <p className="text-base mt-3 max-w-md mx-auto" style={{ color: '#374151' }}>
            Answer 3 quick questions. This is exactly what your students experience.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl overflow-hidden shadow-xl relative" style={{ background: '#fff', border: '3px solid #0F1B3D', boxShadow: '6px 6px 0 #0D0D0D' }}>
            {showConfetti && <CSSConfetti />}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3" style={{ background: '#0F1B3D' }}>
              <span className="text-xs font-bold" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>Mini Quiz Demo</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white">Score: {score}</span>
                {streak > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#FBD13B', color: '#0F1B3D' }}>
                    {streak}x streak
                  </motion.span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1" style={{ background: '#E2E8F0' }}>
              <motion.div className="h-full"
                animate={{ width: `${((qIdx + (phase === 'done' ? 1 : 0)) / QUESTIONS.length) * 100}%` }}
                style={{ background: '#FBD13B' }} />
            </div>

            <div className="p-6 md:p-8 relative">
              {showFloatingPoints && <FloatingPoints points={lastPoints} isCorrect />}

              <AnimatePresence mode="wait">
                {phase === 'done' ? (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      className="text-6xl mb-2"
                    >
                      {score >= 300 ? '🎉' : score >= 150 ? '👍' : '💪'}
                    </motion.div>
                    <p className="text-sm font-bold mb-3" style={{ color: '#374151' }}>{resultMessage}</p>
                    <p className="text-3xl font-black mb-1" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>{score} points</p>
                    <p className="text-base mb-6" style={{ color: '#374151' }}>That&apos;s how it feels for your students.</p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={restart} className="text-sm font-bold px-5 py-2.5 rounded-full transition-all" style={{ color: '#0F1B3D', border: '2px solid #0F1B3D' }}>Try Again</button>
                      <a href="/host" className="text-sm font-bold px-5 py-2.5 rounded-full transition-all hover:opacity-90" style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', boxShadow: '3px 3px 0 #0D0D0D' }}>Create Your Own</a>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={qIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                    <p className="text-xs font-bold mb-3" style={{ color: '#9CA3AF' }}>Question {qIdx + 1} of {QUESTIONS.length}</p>
                    <h3 className="text-xl md:text-2xl font-bold mb-6 leading-snug" style={{ color: '#0F1B3D' }}>{question.q}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {question.options.map((opt, i) => {
                        const isCorrect = i === question.correct
                        const isSelected = selected === i
                        const showResult = selected !== null
                        let bg = '#fff'
                        let border = '2px solid #E2E8F0'
                        let textColor = '#0F1B3D'
                        if (showResult && isCorrect) { bg = '#F0FDF4'; border = '2px solid #16A34A'; textColor = '#166534' }
                        else if (showResult && isSelected && !isCorrect) { bg = '#FEF2F2'; border = '2px solid #EF4444'; textColor = '#991B1B' }

                        return (
                          <motion.button
                            key={i}
                            onClick={() => handleSelect(i)}
                            disabled={selected !== null}
                            whileTap={selected === null ? { scale: 0.97 } : undefined}
                            animate={showResult && isSelected && !isCorrect ? { x: [0, -4, 4, -4, 4, 0] } : undefined}
                            transition={showResult && isSelected && !isCorrect ? { duration: 0.4 } : undefined}
                            className="flex items-center gap-3 rounded-xl px-4 py-4 text-left transition-all hover:shadow-md disabled:cursor-default"
                            style={{ background: bg, border }}>
                            <span className="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center text-white flex-shrink-0"
                              style={{ background: OPTION_COLORS[i] }}>{['A', 'B', 'C', 'D'][i]}</span>
                            <span className="text-sm font-semibold" style={{ color: textColor }}>
                              {opt}{showResult && isCorrect && ' ✓'}{showResult && isSelected && !isCorrect && ' ✗'}
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>

                    <AnimatePresence>
                      {showExplanation && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="mt-4 rounded-xl px-4 py-3" style={{ background: '#FFFDE6', border: '1.5px solid rgba(251,209,59,0.4)' }}>
                          <p className="text-xs font-semibold" style={{ color: '#374151' }}>{question.explanation}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
