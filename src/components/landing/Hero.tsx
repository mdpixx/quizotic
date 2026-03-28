'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
}

function PlayerJoinedNotification() {
  return (
    <motion.div
      animate={{ y: [-4, 4, -4] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      className="absolute -top-2 -right-8 z-10 rounded-2xl px-4 py-3 w-48 shadow-xl"
      style={{ background: '#F3EEFF', border: '1.5px solid #C4B5FD' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#7C3AED' }} />
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7C3AED' }}>
          live now
        </p>
      </div>
      <div className="flex items-center gap-1 mb-2">
        {(['#fbbf24', '#A78BFA', '#60a5fa', '#f472b6'] as string[]).map((c, i) => (
          <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: c }}>
            {['A', 'R', 'P', 'D'][i]}
          </div>
        ))}
        <span className="text-[10px] font-semibold ml-1" style={{ color: '#7C3AED' }}>+8</span>
      </div>
      <p className="text-[11px] font-semibold" style={{ color: '#5B21B6' }}>Priya just joined! ✦</p>
    </motion.div>
  )
}

function FloatingQuizCard() {
  return (
    <motion.div
      animate={{ y: [-5, 5, -5] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="rounded-3xl p-7 w-[340px] shadow-2xl relative z-20"
      style={{ background: '#fff', boxShadow: '0 20px 60px rgba(124,58,237,0.12)', border: '1.5px solid #E9E2FF' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: '#7C3AED' }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#7C3AED' }}>
          Live — Round 2 of 5
        </span>
      </div>
      <p className="text-base font-extrabold mb-5 leading-snug"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
        Which planet has the most moons in our solar system?
      </p>
      <div className="flex flex-col gap-2">
        {[
          { letter: 'A', text: 'Jupiter', bg: '#F3EEFF', color: '#4C1D95', border: '1.5px solid #C4B5FD' },
          { letter: 'B', text: 'Saturn ✓ ★', bg: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', border: 'none' },
          { letter: 'C', text: 'Uranus', bg: '#F9FAFB', color: 'var(--color-text-muted)', border: '1.5px solid #F3F4F6' },
          { letter: 'D', text: 'Neptune', bg: '#F9FAFB', color: 'var(--color-text-muted)', border: '1.5px solid #F3F4F6' },
        ].map(opt => (
          <div key={opt.letter} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: opt.bg, color: opt.color, border: opt.border }}>
            <span className="font-black text-[15px]" style={{ fontFamily: 'var(--font-heading)' }}>
              {opt.letter}
            </span>
            {opt.text}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function ScorePill() {
  return (
    <motion.div
      animate={{ y: [-4, 4, -4] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      className="absolute bottom-16 -left-8 z-10 flex items-center gap-3 rounded-full px-4 py-2.5 shadow-lg"
      style={{ background: '#fff', boxShadow: '0 8px 30px rgba(124,58,237,0.14)', border: '1.5px solid #E9E2FF' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff' }}>
        ★
      </div>
      <div>
        <p className="text-xs font-bold" style={{ color: 'var(--color-dark)' }}>Rohan — 1st place</p>
        <p className="text-[11px] font-semibold" style={{ color: '#F59E0B' }}>+960 pts this round</p>
      </div>
    </motion.div>
  )
}

function HeroStars() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <span style={{ position: 'absolute', top: '10%', right: '6%', color: 'rgba(124,58,237,0.15)', fontSize: 56 }}>✦</span>
      <span style={{ position: 'absolute', top: '42%', right: '2%', color: 'rgba(236,72,153,0.12)', fontSize: 32 }}>✦</span>
      <span style={{ position: 'absolute', top: '22%', right: '22%', color: 'rgba(245,158,11,0.18)', fontSize: 18 }}>★</span>
      <span style={{ position: 'absolute', bottom: '20%', left: '3%', color: 'rgba(124,58,237,0.10)', fontSize: 40 }}>✦</span>
      <span style={{ position: 'absolute', bottom: '38%', left: '10%', color: 'rgba(236,72,153,0.10)', fontSize: 16 }}>★</span>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden"
      style={{ background: 'var(--color-bg)' }}>
      <HeroStars />

      <div className="max-w-[1280px] mx-auto w-full px-6 md:px-12 flex flex-col lg:flex-row items-center gap-12 lg:gap-8 py-16 lg:py-0">
        {/* Left — copy */}
        <div className="flex-1 max-w-[560px] relative z-10">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 mb-6 text-[13px] font-bold"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              backgroundImage: 'linear-gradient(90deg, #7C3AED, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
            ✦ live quiz platform
          </motion.div>

          <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="text-5xl sm:text-6xl lg:text-[68px] font-black leading-[0.96] tracking-tight lowercase mb-5"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
            make<br />every quiz<br />feel like a{' '}
            <span style={{
              backgroundImage: 'linear-gradient(90deg, #7C3AED, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>game</span>
          </motion.h1>

          <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={2}
            className="text-lg leading-relaxed mb-9 max-w-[440px]"
            style={{ color: 'var(--color-text-muted)' }}>
            Create and host live quizzes that participants actually look forward to.
            No boring slides. No dead silences. Just energy.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
            className="flex flex-wrap items-center gap-3 mb-7">
            <Link href="/host"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[17px] font-extrabold transition-all hover:-translate-y-0.5 hover:opacity-90"
              style={{
                fontFamily: 'var(--font-heading)',
                background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(124,58,237,0.30)',
              }}>
              ✦ host a quiz free
            </Link>
            <Link href="/join"
              className="inline-flex items-center rounded-full px-7 py-3.5 text-base font-bold border-2 transition-colors"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-dark)',
                borderColor: '#D8CFFF',
              }}>
              join with a code →
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
            className="flex gap-6 text-[13px]" style={{ color: 'var(--color-text-subtle)' }}>
            <span><strong style={{ color: 'var(--color-text-secondary)' }}>2 min</strong> to create</span>
            <span><strong style={{ color: 'var(--color-text-secondary)' }}>No</strong> credit card</span>
            <span><strong style={{ color: '#7C3AED' }}>AI</strong> powered</span>
          </motion.div>
        </div>

        {/* Right — floating cards */}
        <div className="relative flex-1 flex items-center justify-center min-h-[420px] lg:min-h-[500px]">
          <FloatingQuizCard />
          <PlayerJoinedNotification />
          <ScorePill />
        </div>
      </div>
    </section>
  )
}
