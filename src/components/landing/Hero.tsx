'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

function QuizMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border" style={{ background: '#fff', borderColor: '#DBEAFE' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: '#F8FAFC' }}>
        <span className="w-2 h-2 rounded-full bg-red-300" />
        <span className="w-2 h-2 rounded-full bg-amber-300" />
        <span className="w-2 h-2 rounded-full bg-green-300" />
        <span className="ml-2 text-[9px] font-mono text-gray-400">quizotic.live</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs font-bold" style={{ color: '#1B2559' }}>Which planet has the most moons?</p>
        <div className="space-y-1.5">
          {[
            { letter: 'A', text: 'Jupiter', pct: 35, color: '#3B82F6' },
            { letter: 'B', text: 'Saturn', pct: 58, color: '#4361EE', correct: true },
            { letter: 'C', text: 'Neptune', pct: 4, color: '#FF6B6B' },
            { letter: 'D', text: 'Uranus', pct: 3, color: '#FFD166' },
          ].map(opt => (
            <div key={opt.letter} className="relative rounded-md overflow-hidden" style={{ background: '#F8FAFC' }}>
              <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${opt.pct}%`, background: opt.correct ? '#4361EE' : '#E2E8F0', opacity: opt.correct ? 0.15 : 0.5 }} />
              <div className="relative flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center text-white" style={{ background: opt.color }}>{opt.letter}</span>
                  <span className={`text-[10px] font-semibold ${opt.correct ? 'text-blue-700' : 'text-gray-600'}`}>{opt.text} {opt.correct && '✓'}</span>
                </div>
                <span className="text-[9px] font-bold text-gray-400">{opt.pct}%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          {['🏆 Sarah 840', '🥈 Kai 720', '🥉 Priya 680'].map((entry, i) => (
            <span key={i} className="text-[9px] font-bold" style={{ color: i === 0 ? '#F59E0B' : '#9CA3AF' }}>{entry}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden" style={{ background: '#FFFBF5' }}>
      {/* Gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #4361EE 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #FF6B6B 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-[1280px] mx-auto px-6 md:px-12 relative">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left — copy */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: '#F0F4FF', border: '1px solid #DBEAFE' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4361EE' }} />
              <span className="text-xs font-bold" style={{ color: '#4361EE' }}>Free forever — no signup required</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black leading-[1.1] tracking-tight mb-6" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
              Learning that{' '}
              <span style={{ backgroundImage: 'linear-gradient(90deg, #FF6B6B, #4361EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                lasts,
              </span>{' '}
              not just answers that score.
            </h1>

            <p className="text-lg md:text-xl leading-relaxed mb-8 max-w-lg" style={{ color: '#4A5568' }}>
              Create AI-powered live quizzes and presentations in minutes. Real engagement, real outcomes — for 2 or 2,000 participants.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/host/create"
                className="inline-flex items-center gap-2 text-base font-bold px-7 py-3.5 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #4361EE, #3A56D4)', fontFamily: 'var(--font-heading)', boxShadow: '0 8px 32px rgba(67,97,238,0.25)' }}>
                Create a Quiz
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <Link href="/host/present/create"
                className="inline-flex items-center gap-2 text-base font-bold px-7 py-3.5 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #E05555)', fontFamily: 'var(--font-heading)', boxShadow: '0 8px 32px rgba(255,107,107,0.25)' }}>
                Build a Presentation
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <Link href="/join"
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:bg-blue-50"
                style={{ color: '#4361EE', border: '2px solid #4361EE' }}>
                Join with Code
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {['Free forever', 'No signup required', 'AI-powered', '9 question types'].map(text => (
                <span key={text} className="flex items-center gap-1.5 text-sm" style={{ color: '#718096' }}>
                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {text}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — Genie + mini mockup */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative flex items-center justify-center"
          >
            {/* Floating badges */}
            <motion.div animate={{ y: [-6, 6, -6] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 -right-2 md:-right-4 z-10 px-3 py-2 rounded-xl shadow-lg" style={{ background: '#fff', border: '1px solid #DBEAFE' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="text-[10px] font-bold" style={{ color: '#1B2559' }}>24 students joined</p>
                  <p className="text-[9px]" style={{ color: '#9CA3AF' }}>Session code: ASTRO-42</p>
                </div>
              </div>
            </motion.div>

            <motion.div animate={{ y: [5, -5, 5] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute -bottom-2 -left-4 md:-left-6 z-10 px-3 py-2 rounded-xl shadow-lg" style={{ background: '#fff', border: '1px solid #FED7AA' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🔥</span>
                <div>
                  <p className="text-[10px] font-bold" style={{ color: '#1B2559' }}>3x Streak!</p>
                  <p className="text-[9px]" style={{ color: '#F59E0B' }}>+150 bonus points</p>
                </div>
              </div>
            </motion.div>

            <QuizMockup />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
