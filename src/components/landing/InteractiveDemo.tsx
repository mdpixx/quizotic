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

const OPTION_COLORS = ['#4361EE', '#FF6B6B', '#16A34A', '#F59E0B']

export function InteractiveDemo() {
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'done'>('playing')
  const [showExplanation, setShowExplanation] = useState(false)

  const question = QUESTIONS[qIdx]

  const handleSelect = useCallback((idx: number) => {
    if (selected !== null) return
    setSelected(idx)
    setShowExplanation(true)

    const isCorrect = idx === question.correct
    if (isCorrect) {
      const bonus = (streak + 1) * 50
      setScore(s => s + 100 + bonus)
      setStreak(s => s + 1)
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
      }
    }, 2200)
  }, [selected, qIdx, streak, question.correct])

  const restart = () => {
    setQIdx(0)
    setSelected(null)
    setScore(0)
    setStreak(0)
    setPhase('playing')
    setShowExplanation(false)
  }

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
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#F59E0B' }}>Try It Now</p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            See How It Feels
          </h2>
          <p className="text-base mt-3 max-w-md mx-auto" style={{ color: '#4A5568' }}>
            Answer 3 quick questions. This is exactly what your students experience.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: '#FFFBF5', border: '1.5px solid #DBEAFE' }}>
            <div className="flex items-center justify-between px-6 py-3" style={{ background: '#F0F4FF', borderBottom: '1px solid #DBEAFE' }}>
              <span className="text-xs font-bold" style={{ color: '#4361EE', fontFamily: 'var(--font-heading)' }}>Mini Quiz Demo</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold" style={{ color: '#1B2559' }}>Score: {score}</span>
                {streak > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    🔥 {streak}x streak
                  </motion.span>
                )}
              </div>
            </div>

            <div className="h-1" style={{ background: '#E2E8F0' }}>
              <motion.div className="h-full"
                animate={{ width: `${((qIdx + (phase === 'done' ? 1 : 0)) / QUESTIONS.length) * 100}%` }}
                style={{ background: 'var(--brand-gradient)' }} />
            </div>

            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {phase === 'done' ? (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                    <div className="text-5xl mb-4">{score >= 300 ? '🎉' : score >= 150 ? '👏' : '💪'}</div>
                    <h3 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                      {score >= 300 ? 'Perfect!' : score >= 150 ? 'Great job!' : 'Nice try!'}
                    </h3>
                    <p className="text-3xl font-black mb-1" style={{ color: '#4361EE', fontFamily: 'var(--font-heading)' }}>{score} points</p>
                    <p className="text-base mb-6" style={{ color: '#4A5568' }}>That&apos;s how it feels for your students.</p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={restart} className="text-sm font-bold px-5 py-2.5 rounded-xl" style={{ color: '#4361EE', border: '1.5px solid #4361EE' }}>Try Again</button>
                      <a href="/host" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ background: 'var(--brand-gradient)' }}>Create Your Own →</a>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={qIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                    <p className="text-xs font-bold mb-3" style={{ color: '#9CA3AF' }}>Question {qIdx + 1} of {QUESTIONS.length}</p>
                    <h3 className="text-xl md:text-2xl font-bold mb-6 leading-snug" style={{ color: '#1B2559' }}>{question.q}</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {question.options.map((opt, i) => {
                        const isCorrect = i === question.correct
                        const isSelected = selected === i
                        const showResult = selected !== null
                        let bg = '#fff'
                        let border = '1.5px solid #E2E8F0'
                        let textColor = '#1B2559'
                        if (showResult && isCorrect) { bg = '#F0FDF4'; border = '2px solid #16A34A'; textColor = '#166534' }
                        else if (showResult && isSelected && !isCorrect) { bg = '#FEF2F2'; border = '2px solid #EF4444'; textColor = '#991B1B' }

                        return (
                          <button key={i} onClick={() => handleSelect(i)} disabled={selected !== null}
                            className="flex items-center gap-3 rounded-xl px-4 py-4 text-left transition-all hover:shadow-md disabled:cursor-default"
                            style={{ background: bg, border }}>
                            <span className="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center text-white flex-shrink-0"
                              style={{ background: OPTION_COLORS[i] }}>{['A', 'B', 'C', 'D'][i]}</span>
                            <span className="text-sm font-semibold" style={{ color: textColor }}>
                              {opt}{showResult && isCorrect && ' ✓'}{showResult && isSelected && !isCorrect && ' ✗'}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <AnimatePresence>
                      {showExplanation && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="mt-4 rounded-xl px-4 py-3" style={{ background: '#F0F4FF', border: '1px solid #DBEAFE' }}>
                          <p className="text-xs font-semibold" style={{ color: '#4A5568' }}>💡 {question.explanation}</p>
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
