'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
}

function QuizCard() {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <p className="text-xs font-bold" style={{ color: '#1B2559' }}>What is the capital of France?</p>
      <div className="space-y-1.5">
        {[
          { letter: 'A', text: 'London', pct: 12 },
          { letter: 'B', text: 'Paris', pct: 72, correct: true },
          { letter: 'C', text: 'Berlin', pct: 8 },
          { letter: 'D', text: 'Madrid', pct: 8 },
        ].map(o => (
          <div key={o.letter} className="flex items-center gap-2">
            <span className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center text-white flex-shrink-0"
              style={{ background: o.correct ? '#4361EE' : '#CBD5E1' }}>{o.letter}</span>
            <div className="flex-1 h-5 rounded-md relative overflow-hidden" style={{ background: '#E2E8F0' }}>
              <div className="h-full rounded-md" style={{ width: `${o.pct}%`, background: o.correct ? '#4361EE' : '#94A3B8' }} />
            </div>
            <span className="text-[9px] font-bold w-6 text-right" style={{ color: '#64748B' }}>{o.pct}%</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>🏆 Sarah 840</span>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>🥈 Liam 720</span>
      </div>
    </div>
  )
}

function PresentationCard() {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <p className="text-xs font-bold" style={{ color: '#1B2559' }}>What topic should we cover next?</p>
      <div className="flex flex-wrap gap-1.5 justify-center py-2">
        {[
          { word: 'Machine Learning', size: 16, color: '#4361EE' },
          { word: 'Robotics', size: 13, color: '#FF6B6B' },
          { word: 'Climate', size: 14, color: '#16A34A' },
          { word: 'Space', size: 12, color: '#F59E0B' },
          { word: 'AI Ethics', size: 15, color: '#0891B2' },
          { word: 'Quantum', size: 11, color: '#9333EA' },
          { word: 'Blockchain', size: 10, color: '#EA580C' },
        ].map(w => (
          <span key={w.word} className="font-bold" style={{ fontSize: w.size, color: w.color }}>{w.word}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-semibold" style={{ color: '#64748B' }}>How was today?</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className="text-sm" style={{ opacity: n <= 4 ? 1 : 0.3 }}>&#9733;</span>
          ))}
        </div>
        <span className="text-[9px] font-bold" style={{ color: '#F59E0B' }}>4.2 avg</span>
      </div>
    </div>
  )
}

export function ProductShowcase() {
  return (
    <section id="showcase" className="py-20 md:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div {...fadeUp} className="text-center mb-14">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#4361EE' }}>Two Powerful Modes</p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Everything You Need to Engage
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Quiz card */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="rounded-3xl p-8 flex flex-col"
            style={{ background: '#FFFBF5', border: '1.5px solid #DBEAFE' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#F0F4FF' }}>🎯</div>
              <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>Live Quizzes</h3>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: '#4A5568' }}>
              Speed scoring, AI generation, 9 question types, real-time leaderboards, CSV import, and spaced retrieval follow-ups.
            </p>
            <QuizCard />
            <div className="mt-6 flex flex-wrap gap-2">
              {['Speed Scoring', 'AI Generation', 'Confidence Grid', '9 Question Types', 'CSV Import'].map(tag => (
                <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#F0F4FF', color: '#4361EE' }}>{tag}</span>
              ))}
            </div>
            <Link href="/host/create"
              className="mt-auto pt-6 inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #4361EE, #3A56D4)', fontFamily: 'var(--font-heading)' }}>
              Create a Quiz
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </motion.div>

          {/* Presentation card */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="rounded-3xl p-8 flex flex-col"
            style={{ background: '#FFFBF5', border: '1.5px solid #FECACA' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#FFF5F5' }}>📊</div>
              <h3 className="text-xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>Interactive Presentations</h3>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: '#4A5568' }}>
              Live polls, word clouds, ratings, Q&A, emoji pulse, pinpoint, and 18 interactive slide types for any audience.
            </p>
            <PresentationCard />
            <div className="mt-6 flex flex-wrap gap-2">
              {['Word Cloud', 'Pinpoint', 'Live Race', 'Emoji Pulse', '18 Slide Types'].map(tag => (
                <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FFF5F5', color: '#FF6B6B' }}>{tag}</span>
              ))}
            </div>
            <Link href="/host/present/create"
              className="mt-auto pt-6 inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #E05555)', fontFamily: 'var(--font-heading)' }}>
              Build a Presentation
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </motion.div>
        </div>

        {/* Quick comparison helper */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}
          className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { emoji: '📝', text: 'Want to test knowledge?', action: 'Use a Quiz', color: '#4361EE' },
            { emoji: '💡', text: 'Want to gather opinions?', action: 'Use a Presentation', color: '#FF6B6B' },
            { emoji: '🎯', text: 'Not sure which one?', action: 'Try both — it\'s free!', color: '#F59E0B' },
          ].map(item => (
            <div key={item.action} className="text-center rounded-2xl px-5 py-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span className="text-2xl block mb-2">{item.emoji}</span>
              <p className="text-sm mb-1" style={{ color: '#4A5568' }}>{item.text}</p>
              <p className="text-sm font-bold" style={{ color: item.color }}>{item.action}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
