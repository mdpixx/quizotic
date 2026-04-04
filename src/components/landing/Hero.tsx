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

// ─── Star field data ──────────────────────────────────────────────────────────
const STARS = [
  // Sparkle bursts (sparkle-burst animation — rotate + scale)
  { char: '✦', top: '8%',  left: '5%',  size: 28, color: 'rgba(124,58,237,0.55)',  anim: 'sparkle-burst', dur: '4.2s', delay: '0s' },
  { char: '✦', top: '18%', right: '8%', size: 36, color: 'rgba(236,72,153,0.55)',  anim: 'sparkle-burst', dur: '5s',   delay: '1.2s' },
  { char: '✦', top: '62%', left: '7%',  size: 22, color: 'rgba(245,158,11,0.60)',  anim: 'sparkle-burst', dur: '4.6s', delay: '2.5s' },
  { char: '✦', top: '80%', right: '6%', size: 30, color: 'rgba(124,58,237,0.50)',  anim: 'sparkle-burst', dur: '5.5s', delay: '0.8s' },

  // Filled stars (twinkle + drift)
  { char: '★', top: '14%', right: '18%', size: 20, color: 'rgba(245,158,11,0.50)',  anim: 'twinkle', dur: '3.8s', delay: '0.3s',  drift: true, driftDur: '6s', driftDelay: '0s' },
  { char: '★', top: '35%', left: '3%',   size: 14, color: 'rgba(124,58,237,0.35)', anim: 'twinkle', dur: '4.5s', delay: '1.5s',  drift: true, driftDur: '7s', driftDelay: '1s' },
  { char: '★', top: '55%', right: '3%',  size: 18, color: 'rgba(236,72,153,0.40)', anim: 'twinkle', dur: '5.2s', delay: '0.7s',  drift: true, driftDur: '8s', driftDelay: '2s' },
  { char: '★', top: '72%', left: '12%',  size: 12, color: 'rgba(245,158,11,0.45)', anim: 'twinkle', dur: '3.5s', delay: '2.1s',  drift: true, driftDur: '6.5s', driftDelay: '0.5s' },
  { char: '★', top: '88%', right: '15%', size: 16, color: 'rgba(124,58,237,0.30)', anim: 'twinkle', dur: '4.8s', delay: '1.8s',  drift: true, driftDur: '7.5s', driftDelay: '1.5s' },
  { char: '★', top: '28%', left: '18%',  size: 10, color: 'rgba(236,72,153,0.35)', anim: 'twinkle', dur: '6s',   delay: '3s',    drift: true, driftDur: '9s', driftDelay: '3s' },

  // Small dots (pure twinkle, no drift — for texture)
  { char: '·', top: '10%', left: '22%',  size: 44, color: 'rgba(124,58,237,0.25)', anim: 'twinkle', dur: '5s',   delay: '0.5s' },
  { char: '·', top: '45%', right: '20%', size: 44, color: 'rgba(245,158,11,0.22)', anim: 'twinkle', dur: '4.2s', delay: '2s' },
  { char: '·', top: '65%', left: '28%',  size: 38, color: 'rgba(236,72,153,0.20)', anim: 'twinkle', dur: '3.8s', delay: '1.1s' },
  { char: '·', top: '85%', left: '35%',  size: 44, color: 'rgba(124,58,237,0.18)', anim: 'twinkle', dur: '6.5s', delay: '0s' },
  { char: '·', top: '22%', right: '30%', size: 32, color: 'rgba(245,158,11,0.28)', anim: 'twinkle', dur: '4.8s', delay: '3.5s' },

  // Extra small sparkles for richness
  { char: '✦', top: '48%', left: '2%',   size: 12, color: 'rgba(245,158,11,0.40)', anim: 'twinkle', dur: '3.2s', delay: '1.8s' },
  { char: '✦', top: '32%', right: '2%',  size: 10, color: 'rgba(124,58,237,0.35)', anim: 'twinkle', dur: '4s',   delay: '2.8s' },
  { char: '✦', top: '92%', left: '20%',  size: 14, color: 'rgba(236,72,153,0.38)', anim: 'twinkle', dur: '5.5s', delay: '0.4s' },
  { char: '★', top: '96%', right: '28%', size: 10, color: 'rgba(245,158,11,0.35)', anim: 'twinkle', dur: '4.4s', delay: '1.3s' },
  { char: '✦', top: '5%',  left: '45%',  size: 16, color: 'rgba(124,58,237,0.28)', anim: 'twinkle', dur: '5.8s', delay: '2.2s' },
  { char: '★', top: '75%', right: '22%', size: 11, color: 'rgba(236,72,153,0.30)', anim: 'twinkle', dur: '3.6s', delay: '4s' },
  { char: '✦', top: '58%', left: '40%',  size: 9,  color: 'rgba(245,158,11,0.35)', anim: 'twinkle', dur: '4.7s', delay: '0.9s' },
] as const

function AnimatedStarField() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {STARS.map((s, i) => {
        const pos: Record<string, string> = {}
        if ('top' in s)    pos.top    = s.top
        if ('left' in s)   pos.left   = s.left
        if ('right' in s)  pos.right  = s.right
        if ('bottom' in s) pos.bottom = (s as { bottom: string }).bottom

        const hasDrift = 'drift' in s && s.drift
        const animationValue = hasDrift
          ? `${s.anim} ${'dur' in s ? s.dur : '4s'} ${'delay' in s ? s.delay : '0s'} ease-in-out infinite, drift ${'driftDur' in s ? (s as {driftDur: string}).driftDur : '7s'} ${'driftDelay' in s ? (s as {driftDelay: string}).driftDelay : '0s'} ease-in-out infinite`
          : `${s.anim} ${'dur' in s ? s.dur : '4s'} ${'delay' in s ? s.delay : '0s'} ease-in-out infinite`

        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              ...pos,
              color: s.color,
              fontSize: s.size,
              lineHeight: 1,
              animation: animationValue,
            }}
          >
            {s.char}
          </span>
        )
      })}
    </div>
  )
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
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7C3AED', fontFamily: 'var(--font-heading)' }}>
          live now
        </p>
      </div>
      <div className="flex items-center gap-1 mb-2">
        {(['#fbbf24', '#A78BFA', '#60a5fa', '#f472b6'] as string[]).map((c, i) => (
          <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: c, fontFamily: 'var(--font-heading)' }}>
            {['A', 'R', 'P', 'D'][i]}
          </div>
        ))}
        <span className="text-[10px] font-semibold ml-1" style={{ color: '#7C3AED' }}>+8</span>
      </div>
      <p className="text-[11px] font-semibold" style={{ color: '#5B21B6', fontFamily: 'var(--font-heading)' }}>Priya just joined! ✦</p>
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

      {/* Header row: live indicator + streak */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#7C3AED' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#7C3AED', fontFamily: 'var(--font-heading)' }}>
            Live — Round 2 of 5
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #F59E0B)', boxShadow: '0 2px 8px rgba(245,158,11,0.35)' }}>
          <span style={{ fontSize: 12 }}>🔥</span>
          <span className="text-[11px] font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>5 streak</span>
        </div>
      </div>

      <p className="text-base font-extrabold mb-5 leading-snug"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)', fontSize: 17 }}>
        Which planet has the most moons in our solar system?
      </p>

      <div className="flex flex-col gap-2">
        {[
          { letter: 'A', text: 'Jupiter',    bg: '#F3EEFF',   color: '#4C1D95',  border: '1.5px solid #C4B5FD', shine: false },
          { letter: 'B', text: 'Saturn ✓ ★', bg: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', border: 'none', shine: true },
          { letter: 'C', text: 'Uranus',     bg: '#F9FAFB',   color: 'var(--color-text-muted)', border: '1.5px solid #F3F4F6', shine: false },
          { letter: 'D', text: 'Neptune',    bg: '#F9FAFB',   color: 'var(--color-text-muted)', border: '1.5px solid #F3F4F6', shine: false },
        ].map(opt => (
          <div key={opt.letter} className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium overflow-hidden"
            style={{ background: opt.bg, color: opt.color, border: opt.border }}>
            {opt.shine && (
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
                  animation: 'shimmer 2.8s ease-in-out infinite',
                }} />
            )}
            <span className="font-black text-[15px] relative z-10" style={{ fontFamily: 'var(--font-heading)' }}>
              {opt.letter}
            </span>
            <span className="relative z-10">{opt.text}</span>
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
        <p className="text-xs font-bold" style={{ color: 'var(--color-dark)', fontFamily: 'var(--font-heading)' }}>Rohan — 1st place</p>
        <p className="text-[11px] font-semibold" style={{ color: '#F59E0B' }}>+960 pts this round</p>
      </div>
    </motion.div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden"
      style={{ background: 'var(--color-bg)' }}>
      <AnimatedStarField />

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
              fontFamily: 'var(--font-heading)',
            }}>
            ✦ live quiz platform
          </motion.div>

          <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="text-5xl sm:text-6xl lg:text-[68px] font-bold leading-[1.0] mb-5"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)', letterSpacing: '-0.01em' }}>
            Make every quiz<br />feel like a{' '}
            <span style={{
              backgroundImage: 'linear-gradient(90deg, #7C3AED, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Game!</span>
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
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[17px] font-bold transition-all hover:-translate-y-0.5 hover:opacity-90"
              style={{
                fontFamily: 'var(--font-heading)',
                background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
                color: '#fff',
                animation: 'glow-pulse 2.5s ease-in-out infinite',
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
            <span><strong style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}>2 min</strong> to create</span>
            <span><strong style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}>No</strong> credit card</span>
            <span><strong style={{ color: '#7C3AED', fontFamily: 'var(--font-heading)' }}>AI</strong> powered</span>
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
