'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ConstellationCanvas = dynamic(() => import('./ConstellationCanvas'), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
})

// ─── Sunrise animation — solo learning card ───────────────────────────────────
const SKY_STEPS = [
  { sky: 'linear-gradient(180deg,#0f0c29 0%,#1e1b4b 100%)', stars: 1.0, sun: 0 },
  { sky: 'linear-gradient(180deg,#0f0c29 0%,#2d1b69 100%)', stars: 0.8, sun: 0 },
  { sky: 'linear-gradient(180deg,#1e1b4b 0%,#4c1d95 100%)', stars: 0.6, sun: 0.05 },
  { sky: 'linear-gradient(180deg,#2e1065 0%,#7c3aed 100%)', stars: 0.4, sun: 0.15 },
  { sky: 'linear-gradient(180deg,#4c1d95 0%,#c2410c 100%)', stars: 0.2, sun: 0.35 },
  { sky: 'linear-gradient(180deg,#7c3aed 0%,#ea580c 100%)', stars: 0.08, sun: 0.6 },
  { sky: 'linear-gradient(180deg,#b45309 0%,#f59e0b 100%)', stars: 0,   sun: 0.85 },
  { sky: 'linear-gradient(180deg,#f59e0b 0%,#fef3c7 100%)', stars: 0,   sun: 1.0 },
]

function SunriseSoloCard() {
  const [step, setStep] = useState(0)
  const total = 8

  function handleAnswer() {
    setStep(s => s < total - 1 ? s + 1 : 0)
  }

  const sky = SKY_STEPS[step]

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: '#09071a',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Sky viewport */}
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        {/* Animated sky */}
        <motion.div
          className="absolute inset-0 transition-all duration-[1200ms]"
          style={{ background: sky.sky }}
        />

        {/* Stars — fade out as sun rises */}
        <div className="absolute inset-0" style={{ opacity: sky.stars, transition: 'opacity 1.2s' }}>
          {[
            { x: 15, y: 18, s: 1.5 }, { x: 35, y: 8, s: 2 }, { x: 55, y: 20, s: 1 },
            { x: 72, y: 12, s: 1.5 }, { x: 85, y: 22, s: 1 }, { x: 25, y: 35, s: 1 },
            { x: 65, y: 30, s: 1.2 }, { x: 90, y: 15, s: 1.8 }, { x: 45, y: 42, s: 1 },
          ].map((st, i) => (
            <div key={i} className="absolute rounded-full" style={{
              left: `${st.x}%`, top: `${st.y}%`,
              width: st.s * 2, height: st.s * 2,
              background: '#fff',
              opacity: 0.8,
            }} />
          ))}
        </div>

        {/* Sun — rises from bottom */}
        <motion.div
          className="absolute rounded-full"
          style={{
            left: '50%', transform: 'translateX(-50%)',
            bottom: `${-60 + sky.sun * 80}%`,
            width: 64, height: 64,
            background: 'radial-gradient(circle, #fff 20%, #fbbf24 50%, #f59e0b 70%, transparent 100%)',
            boxShadow: `0 0 ${30 + sky.sun * 60}px ${20 + sky.sun * 40}px rgba(251,191,36,${0.15 + sky.sun * 0.35})`,
            opacity: 0.15 + sky.sun * 0.85,
            transition: 'all 1.2s ease',
          }}
        />

        {/* Horizon glow */}
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{
          background: `linear-gradient(0deg, rgba(251,191,36,${sky.sun * 0.4}) 0%, transparent 100%)`,
          transition: 'all 1.2s',
        }} />

        {/* Progress indicator */}
        <div className="absolute top-3 left-3 right-3">
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full transition-all duration-500"
                style={{ background: i <= step ? '#fbbf24' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
        </div>

        {/* Step label */}
        <div className="absolute top-6 right-3 text-[10px] font-bold"
          style={{ color: step >= 6 ? '#1e1a14' : '#fde68a' }}>
          {step + 1} / {total}
        </div>
      </div>

      {/* Question area */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold mb-3" style={{ color: '#94a3b8' }}>
          {step < total - 1 ? 'Answer correctly to watch the sunrise...' : '✨ Full sunrise! Quiz complete.'}
        </p>
        <button
          onClick={handleAnswer}
          className="w-full rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90"
          style={{
            background: step < total - 1 ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)',
            color: step < total - 1 ? '#fbbf24' : '#4ade80',
            border: `1px solid ${step < total - 1 ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
          }}>
          {step < total - 1 ? '✓ correct answer →' : '↺ try again'}
        </button>
      </div>
    </div>
  )
}

// ─── Group quiz mock card ─────────────────────────────────────────────────────
function GroupConstellationCard() {
  return (
    <div className="rounded-2xl overflow-hidden relative" style={{
      height: 280,
      background: '#09071a',
      border: '1px solid rgba(165,180,252,0.15)',
      boxShadow: '0 0 40px rgba(99,102,241,0.12)',
    }}>
      <Suspense fallback={null}>
        <ConstellationCanvas />
      </Suspense>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#fde68a' }} />
        <span className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'rgba(253,230,138,0.7)' }}>
          shared live sky
        </span>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function ConstellationPreview() {
  const [mode, setMode] = useState<'group' | 'solo'>('group')

  return (
    <section className="py-24 px-6 md:px-12"
      style={{ background: 'linear-gradient(180deg,#0f0c29 0%,#1e1b4b 100%)' }}>
      <div className="max-w-[1280px] mx-auto">

        {/* Header */}
        <div className="mb-12">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: '#a5b4fc' }}>
            built for every kind of quiz
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-3xl sm:text-4xl font-black lowercase tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: '#f8fafc' }}>
            group energy. solo growth.<br />
            <span style={{ color: '#fde68a' }}>same sky.</span>
          </motion.h2>
        </div>

        {/* Two cards side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Group card ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-3xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(165,180,252,0.15)',
            }}>
            <div className="px-7 pt-7 pb-4 flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold mb-3"
                  style={{ background: 'rgba(165,180,252,0.12)', color: '#a5b4fc' }}>
                  ★ group quiz
                </div>
                <h3 className="text-xl font-black lowercase mb-1"
                  style={{ fontFamily: 'var(--font-heading)', color: '#f8fafc' }}>
                  shared constellation
                </h3>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Every correct answer lights a star in the shared night sky. Watch your class constellation form live.
                </p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <GroupConstellationCard />
            </div>
            <div className="px-7 pb-6 flex flex-col gap-2">
              {[
                { dot: '#fde68a', text: 'Real-time stars as answers come in' },
                { dot: '#c7d2fe', text: 'Leaderboard + shared scoreboard on big screen' },
                { dot: '#86efac', text: 'Unique constellation per session, saved forever' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-2.5 text-sm"
                  style={{ color: '#64748b' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: item.dot, boxShadow: `0 0 5px ${item.dot}` }} />
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Solo card ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="rounded-3xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(251,191,36,0.15)',
            }}>
            <div className="px-7 pt-7 pb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold mb-3"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                ◐ solo learning
              </div>
              <h3 className="text-xl font-black lowercase mb-1"
                style={{ fontFamily: 'var(--font-heading)', color: '#f8fafc' }}>
                your personal sunrise
              </h3>
              <p className="text-sm" style={{ color: '#64748b' }}>
                Studying alone? Each right answer advances the dawn. Complete the quiz and watch the sun rise — your personal moment of enlightenment.
              </p>
            </div>
            <div className="px-4 pb-4">
              <SunriseSoloCard />
            </div>
            <div className="px-7 pb-6 flex flex-col gap-2">
              {[
                { dot: '#fbbf24', text: 'Sky brightens with every correct answer' },
                { dot: '#f97316', text: 'Works for self-study — no group needed' },
                { dot: '#fde68a', text: 'Full sunrise = quiz complete. Try it above.' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-2.5 text-sm"
                  style={{ color: '#64748b' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: item.dot, boxShadow: `0 0 5px ${item.dot}` }} />
                  {item.text}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
