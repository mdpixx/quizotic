'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

function QuizMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border" style={{ background: '#fff', borderColor: '#DBEAFE' }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: '#F8FAFC' }}>
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
        <span className="ml-3 text-[10px] font-mono text-gray-400">quizotic.live/host/session</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white" style={{ background: 'var(--brand-gradient)' }}>Q</div>
            <span className="text-xs font-bold" style={{ color: '#1B2559' }}>Science Quiz</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F0F4FF', color: '#4361EE' }}>Q 3/10</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: '#FEF2F2', color: '#EF4444' }}>12</div>
          </div>
        </div>
        <p className="text-sm font-bold leading-snug" style={{ color: '#1B2559' }}>
          Which planet in our solar system has the most moons?
        </p>
        <div className="space-y-2">
          {[
            { letter: 'A', text: 'Jupiter', votes: 8, color: '#3B82F6', pct: 35 },
            { letter: 'B', text: 'Saturn', votes: 14, color: '#4361EE', pct: 58, correct: true },
            { letter: 'C', text: 'Neptune', votes: 1, color: '#FF6B6B', pct: 4 },
            { letter: 'D', text: 'Uranus', votes: 1, color: '#FFD166', pct: 3 },
          ].map(opt => (
            <div key={opt.letter} className="relative rounded-lg overflow-hidden" style={{ background: '#F8FAFC' }}>
              <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${opt.pct}%`, background: opt.correct ? '#4361EE' : '#E2E8F0', opacity: opt.correct ? 0.15 : 0.5 }} />
              <div className="relative flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ background: opt.color }}>{opt.letter}</span>
                  <span className={`text-xs font-semibold ${opt.correct ? 'text-blue-700' : 'text-gray-600'}`}>{opt.text} {opt.correct && '✓'}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400">{opt.votes}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          {['🏆 Sarah 840', '🥈 Kai 720', '🥉 Priya 680'].map((entry, i) => (
            <span key={i} className="text-[10px] font-bold" style={{ color: i === 0 ? '#F59E0B' : '#9CA3AF' }}>{entry}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden" style={{ background: '#FFFBF5' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #4361EE 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #FF6B6B 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-[1280px] mx-auto px-6 md:px-12 relative">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: '#F0F4FF', border: '1px solid #DBEAFE' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4361EE' }} />
              <span className="text-xs font-bold" style={{ color: '#4361EE' }}>Free forever — no signup required</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black leading-[1.1] tracking-tight mb-6" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
              Live Quizzes &{' '}
              <span style={{ backgroundImage: 'linear-gradient(90deg, #FF6B6B, #4361EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Presentations
              </span>{' '}
              That Actually Engage
            </h1>

            <p className="text-lg md:text-xl leading-relaxed mb-8 max-w-lg" style={{ color: '#4A5568' }}>
              Create AI-powered quizzes and interactive presentations in minutes. Host them live for 2 or 2,000 participants.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/host"
                className="inline-flex items-center gap-2 text-base font-bold px-7 py-3.5 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #4361EE)', fontFamily: 'var(--font-heading)', boxShadow: '0 8px 32px rgba(67,97,238,0.25)' }}>
                Host a Quiz Free
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <Link href="/join"
                className="inline-flex items-center gap-2 text-base font-bold px-7 py-3.5 rounded-2xl transition-all hover:bg-blue-50"
                style={{ color: '#4361EE', border: '2px solid #4361EE' }}>
                Join with Code
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {['Free forever', 'No signup required', 'AI-powered'].map(text => (
                <span key={text} className="flex items-center gap-1.5 text-sm" style={{ color: '#718096' }}>
                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {text}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 32, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative">
            <motion.div animate={{ y: [-6, 6, -6] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 -right-2 md:-right-6 z-10 px-3 py-2 rounded-xl shadow-lg" style={{ background: '#fff', border: '1px solid #DBEAFE' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="text-[10px] font-bold" style={{ color: '#1B2559' }}>24 students joined</p>
                  <p className="text-[9px]" style={{ color: '#9CA3AF' }}>Game code: ASTRO-42</p>
                </div>
              </div>
            </motion.div>

            <motion.div animate={{ y: [5, -5, 5] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute -bottom-2 -left-4 md:-left-8 z-10 px-3 py-2 rounded-xl shadow-lg" style={{ background: '#fff', border: '1px solid #FED7AA' }}>
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
