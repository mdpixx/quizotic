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
      {/* Mini question */}
      <p className="text-xs font-bold" style={{ color: '#1B2559' }}>What is the capital of France?</p>
      {/* Answer bars with vote results */}
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
      {/* Mini leaderboard strip */}
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
      {/* Mini poll slide */}
      <p className="text-xs font-bold" style={{ color: '#1B2559' }}>What topic should we cover next?</p>
      {/* Word cloud mockup */}
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
      {/* Rating bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-semibold" style={{ color: '#64748B' }}>How was today?</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className="text-sm" style={{ opacity: n <= 4 ? 1 : 0.3 }}>⭐</span>
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
              Speed scoring, AI generation, 5 question types, real-time leaderboards, and spaced retrieval follow-ups.
            </p>
            <QuizCard />
            <div className="mt-6 flex flex-wrap gap-2">
              {['Speed Scoring', 'AI Generation', 'Confidence Grid', 'Spaced Retrieval'].map(tag => (
                <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#F0F4FF', color: '#4361EE' }}>{tag}</span>
              ))}
            </div>
            <Link href="/host/create" className="mt-6 text-sm font-bold transition-colors hover:opacity-80" style={{ color: '#4361EE' }}>
              Create a Quiz →
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
              Live polls, word clouds, ratings, Q&A, emoji pulse, and 17 interactive slide types for any audience.
            </p>
            <PresentationCard />
            <div className="mt-6 flex flex-wrap gap-2">
              {['Word Cloud', 'Pinpoint', 'Live Race', '17 Slide Types'].map(tag => (
                <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FFF5F5', color: '#FF6B6B' }}>{tag}</span>
              ))}
            </div>
            <Link href="/host/present/create" className="mt-6 text-sm font-bold transition-colors hover:opacity-80" style={{ color: '#FF6B6B' }}>
              Build a Presentation →
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
