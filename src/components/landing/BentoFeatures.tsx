'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

function AnimatedCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const duration = 1200
    const stepTime = 30
    const steps = duration / stepTime
    const increment = end / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, stepTime)
    return () => clearInterval(timer)
  }, [isInView, end])

  return <span ref={ref}>{count}{suffix}</span>
}

function TypingText() {
  const [text, setText] = useState('')
  const [showCheck, setShowCheck] = useState(false)
  const fullText = 'Generating quiz...'
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let i = 0
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setText(fullText.slice(0, i + 1))
        i++
      } else {
        setShowCheck(true)
        clearInterval(timer)
      }
    }, 80)
    return () => clearInterval(timer)
  }, [isInView])

  return (
    <div ref={ref} className="mb-3">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg" style={{ background: '#0F1B3D' }}>
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-b-lg" style={{ background: '#F8F9FA' }}>
        <div className="flex-1 h-7 rounded-md px-2 flex items-center text-[11px] font-mono" style={{ color: '#0F1B3D' }}>
          {text}<span className="animate-pulse">|</span>
        </div>
        {showCheck && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: '#16A34A' }}>
            ✓
          </motion.div>
        )}
      </div>
    </div>
  )
}

function MiniLeaderboard() {
  const names = [
    { name: 'Sarah', score: 840 },
    { name: 'Priya', score: 720 },
    { name: 'Kai', score: 680 },
  ]

  return (
    <div className="space-y-1.5 mb-3">
      {names.map((n, i) => (
        <div key={n.name} className="flex items-center gap-2 text-[11px]">
          <span className="w-5 text-center font-bold" style={{ color: i === 0 ? '#FBD13B' : '#94A3B8' }}>
            {i === 0 ? '1st' : `#${i + 1}`}
          </span>
          <span className="font-semibold w-12" style={{ color: '#0F1B3D' }}>{n.name}</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: '#E2E8F0' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(n.score / 840) * 100}%`, background: i === 0 ? '#FBD13B' : '#0F1B3D' }} />
          </div>
          <span className="font-bold w-8 text-right" style={{ color: '#64748B' }}>{n.score}</span>
        </div>
      ))}
    </div>
  )
}

function GrowingBars() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })
  const bars = [65, 42, 88, 55, 73, 38, 82]

  return (
    <div ref={ref} className="flex items-end gap-1.5 mb-3 h-16">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm"
          initial={{ height: 0 }}
          animate={isInView ? { height: `${h}%` } : { height: 0 }}
          transition={{ duration: 0.6, delay: i * 0.08 }}
          style={{ background: ['#0F1B3D', '#FBD13B', '#16A34A', '#2D3A8C', '#FF8A47', '#0F1B3D', '#FBD13B'][i] }}
        />
      ))}
    </div>
  )
}

function GameCodeType() {
  const [code, setCode] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })
  const fullCode = 'ASTRO-42'

  useEffect(() => {
    if (!isInView) return
    let i = 0
    const timer = setInterval(() => {
      if (i < fullCode.length) {
        setCode(fullCode.slice(0, i + 1))
        i++
      } else {
        clearInterval(timer)
      }
    }, 120)
    return () => clearInterval(timer)
  }, [isInView])

  return (
    <div ref={ref} className="text-center mb-3">
      <span className="text-xl font-black tracking-widest" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
        {code}<span className="animate-pulse text-gray-300">_</span>
      </span>
    </div>
  )
}

const showcaseFeatures = [
  {
    title: 'AI Quiz Generation',
    desc: 'Paste any content. Get a complete quiz with 9 question types in seconds.',
    gridClass: 'md:col-span-7',
    bg: '#F8F9FA',
    border: 'rgba(15,27,61,0.15)',
    color: '#0F1B3D',
    Viz: TypingText,
  },
  {
    title: 'No Student Account Needed',
    desc: 'Students join with a session code. No accounts, no friction.',
    gridClass: 'md:col-span-5',
    bg: '#F0FDF4',
    border: 'rgba(22,163,74,0.2)',
    color: '#16A34A',
    Viz: GameCodeType,
  },
  {
    title: 'Gamification',
    desc: 'Streaks, leaderboards, 4 session modes — competition drives learning.',
    gridClass: 'md:col-span-5',
    bg: '#FFFDE6',
    border: 'rgba(251,209,59,0.4)',
    color: '#0F1B3D',
    Viz: MiniLeaderboard,
  },
  {
    title: 'Real-Time Reports',
    desc: 'Per-question breakdown, confidence grid, misconception detection, CSV export.',
    gridClass: 'md:col-span-7',
    bg: '#F8F9FA',
    border: 'rgba(15,27,61,0.15)',
    color: '#0F1B3D',
    Viz: GrowingBars,
  },
]

const compactFeatures = [
  {
    title: 'Any Device',
    desc: 'No app install needed',
    color: '#0F1B3D',
    bg: '#F8F9FA',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="#0F1B3D" strokeWidth="2" />
        <circle cx="12" cy="17" r="1" fill="#0F1B3D" />
      </svg>
    ),
  },
  {
    title: 'Classroom Mode',
    desc: 'Projector-optimized, pause/resume',
    color: '#0F1B3D',
    bg: '#FFFDE6',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <rect x="2" y="4" width="20" height="14" rx="2" stroke="#0F1B3D" strokeWidth="2" />
        <path d="M8 21h8" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 18v3" stroke="#0F1B3D" strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: 'Template Gallery',
    desc: '50+ ready-to-use templates',
    color: '#0F1B3D',
    bg: '#F0FDF4',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#0F1B3D" strokeWidth="2" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#0F1B3D" strokeWidth="2" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#0F1B3D" strokeWidth="2" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#0F1B3D" strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: 'CSV Import',
    desc: 'Bulk upload question banks',
    color: '#0F1B3D',
    bg: '#F8F9FA',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function BentoFeatures() {
  return (
    <section id="features" className="py-20 md:py-28" style={{ background: '#F8F9FA' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-sm font-bold uppercase tracking-widest mb-3 inline-block px-4 py-1.5 rounded-full" style={{ background: '#0F1B3D', color: '#FBD13B' }}>Features</p>
          <h2 className="text-3xl md:text-4xl font-black mt-4" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Built for Engagement
          </h2>
        </motion.div>

        {/* Animated stat counters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap justify-center gap-6 md:gap-10 mb-12"
        >
          {[
            { num: 9, label: 'Question Types', suffix: '' },
            { num: 18, label: 'Slide Types', suffix: '' },
            { num: 4, label: 'Session Modes', suffix: '' },
            { num: 50, label: 'Templates', suffix: '+' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                <AnimatedCounter end={stat.num} suffix={stat.suffix} />
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: '#64748B' }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Zone 1: Showcase grid */}
        <div className="grid md:grid-cols-12 gap-4 mb-4">
          {showcaseFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`rounded-2xl p-5 flex flex-col transition-all hover:shadow-lg hover:-translate-y-1 ${f.gridClass}`}
              style={{ background: f.bg, border: `2px solid ${f.border}` }}
            >
              <f.Viz />
              <h3 className="text-base font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Zone 2: Compact shelf */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {compactFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
              className="rounded-xl px-4 py-3 flex items-center gap-3 transition-all hover:shadow-md"
              style={{ background: f.bg, borderLeft: '3px solid #0F1B3D' }}
            >
              <div className="flex-shrink-0">{f.icon}</div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>{f.title}</p>
                <p className="text-[11px]" style={{ color: '#64748B' }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
