'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'

// ── Bloom's Flower Visual ────────────────────────────────────────────────────

function BloomsFlowerVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  const [hovered, setHovered] = useState<number | null>(null)

  const petals = [
    { label: 'Remember',   color: '#DC2626', desc: 'Recall, list, identify' },
    { label: 'Understand', color: '#EA580C', desc: 'Explain, summarize, classify' },
    { label: 'Apply',      color: '#CA8A04', desc: 'Use, execute, implement' },
    { label: 'Analyse',    color: '#16A34A', desc: 'Compare, organize, deconstruct' },
    { label: 'Evaluate',   color: '#2563EB', desc: 'Judge, critique, justify' },
    { label: 'Create',     color: '#7C3AED', desc: 'Design, construct, produce' },
  ]

  return (
    <div ref={ref} className="flex flex-col items-center select-none">
      <svg viewBox="0 0 200 200" width="320" height="320" overflow="visible">
        <defs>
          {petals.map((p, i) => (
            <radialGradient key={i} id={`pg-${i}`} cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor={p.color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={p.color} stopOpacity="1" />
            </radialGradient>
          ))}
        </defs>

        {petals.map((petal, i) => (
          <g
            key={petal.label}
            transform={`rotate(${i * 60} 100 100)`}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <motion.ellipse
              cx="100" cy="50" rx="26" ry="54"
              fill={`url(#pg-${i})`}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: hovered === null ? 1 : hovered === i ? 1 : 0.3 } : { opacity: 0 }}
              transition={{ duration: hovered !== null ? 0.18 : 0.5, delay: isInView ? (hovered !== null ? 0 : 0.1 + i * 0.1) : 0 }}
              style={{
                filter: hovered === i ? `drop-shadow(0 0 14px ${petal.color}bb)` : 'none',
                transition: 'filter 0.2s',
              }}
            />
          </g>
        ))}

        {/* Center disc */}
        <circle cx="100" cy="100" r="30" fill="white" stroke="#E2E8F0" strokeWidth="2" />
        <text x="100" y="97" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4361EE" fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
          BLOOM&apos;S
        </text>
        <text x="100" y="116" textAnchor="middle" fontSize="18">🌸</text>
      </svg>

      {/* Hover label */}
      <div className="h-10 -mt-2 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {hovered !== null ? (
            <motion.span
              key={hovered}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-bold px-5 py-2 rounded-full text-white shadow"
              style={{ background: petals[hovered].color }}
            >
              {petals[hovered].label} — {petals[hovered].desc}
            </motion.span>
          ) : (
            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-sm font-semibold" style={{ color: '#64748B' }}>
              Hover a petal to explore all six levels
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Level chips */}
      <div className="mt-3 flex flex-wrap gap-2 justify-center max-w-[340px]">
        {petals.map((p, i) => (
          <span
            key={p.label}
            className="text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-all"
            style={{
              background: hovered === i ? p.color : `${p.color}22`,
              color: hovered === i ? 'white' : p.color,
              border: `1.5px solid ${p.color}88`,
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Confidence Grid Visual ───────────────────────────────────────────────────

function ConfidenceGridVisual() {
  const [hovered, setHovered] = useState<string | null>(null)

  const cells = [
    {
      key: 'sure-correct', rowLabel: 'Sure', colLabel: 'Correct',
      bg: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)',
      border: '#86EFAC', color: '#15803D',
      pct: '58%', label: 'Solid knowledge',
      icon: '✓',
      tooltip: 'Learners who are sure AND correct — they truly understand the material.',
      danger: false,
    },
    {
      key: 'sure-wrong', rowLabel: 'Sure', colLabel: 'Wrong',
      bg: 'linear-gradient(135deg, #FEF9C3, #FDE68A)',
      border: '#FCD34D', color: '#92400E',
      pct: '12%', label: 'Dangerous gap',
      icon: '⚠️',
      tooltip: "Confident but wrong — the most dangerous gap. They won't seek help unless corrected.",
      danger: true,
    },
    {
      key: 'unsure-correct', rowLabel: 'Unsure', colLabel: 'Correct',
      bg: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
      border: '#6EE7B7', color: '#065F46',
      pct: '15%', label: 'Lucky guess',
      icon: '~',
      tooltip: 'Got it right but unsure why — emerging understanding, needs reinforcement.',
      danger: false,
    },
    {
      key: 'unsure-wrong', rowLabel: 'Unsure', colLabel: 'Wrong',
      bg: 'linear-gradient(135deg, #F1F5F9, #E2E8F0)',
      border: '#94A3B8', color: '#334155',
      pct: '15%', label: 'Knows the gap',
      icon: '?',
      tooltip: 'Wrong and knows it — the easiest to help. Already motivated to learn.',
      danger: false,
    },
  ]

  return (
    <div className="flex flex-col items-center w-full max-w-[420px] mx-auto">
      <div className="grid grid-cols-[80px_1fr_1fr] gap-3 w-full">
        <div />
        <div className="text-center text-sm font-bold uppercase tracking-wider pb-2" style={{ color: '#1B2559' }}>Correct ✓</div>
        <div className="text-center text-sm font-bold uppercase tracking-wider pb-2" style={{ color: '#1B2559' }}>Wrong ✗</div>

        {/* Row: Sure */}
        <div className="flex items-center justify-end pr-3 text-sm font-bold uppercase tracking-wider" style={{ color: '#1B2559' }}>Sure</div>
        {cells.filter(c => c.rowLabel === 'Sure').map(cell => (
          <div key={cell.key} className="relative" style={{ minHeight: 120 }}>
            <div
              className="absolute inset-0 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer"
              style={{
                background: cell.bg,
                border: `2px solid ${cell.border}`,
                boxShadow: hovered === cell.key ? `0 8px 24px ${cell.border}80` : '0 2px 8px rgba(0,0,0,0.06)',
                transform: hovered === cell.key ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                zIndex: hovered === cell.key ? 10 : 1,
              }}
              onMouseEnter={() => setHovered(cell.key)}
              onMouseLeave={() => setHovered(null)}
            >
              {cell.danger && (
                <span className="absolute -top-3 -right-3 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow">
                  WATCH
                </span>
              )}
              <span className="text-2xl mb-1">{cell.icon}</span>
              <p className="text-3xl font-black leading-none" style={{ color: cell.color, fontFamily: 'var(--font-heading)' }}>
                {cell.pct}
              </p>
              <p className="text-sm font-bold mt-1 text-center" style={{ color: cell.color }}>
                {cell.label}
              </p>
            </div>
          </div>
        ))}

        {/* Row: Unsure */}
        <div className="flex items-center justify-end pr-3 text-sm font-bold uppercase tracking-wider" style={{ color: '#1B2559' }}>Unsure</div>
        {cells.filter(c => c.rowLabel === 'Unsure').map(cell => (
          <div key={cell.key} className="relative" style={{ minHeight: 120 }}>
            <div
              className="absolute inset-0 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer"
              style={{
                background: cell.bg,
                border: `2px solid ${cell.border}`,
                boxShadow: hovered === cell.key ? `0 8px 24px ${cell.border}80` : '0 2px 8px rgba(0,0,0,0.06)',
                transform: hovered === cell.key ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                zIndex: hovered === cell.key ? 10 : 1,
              }}
              onMouseEnter={() => setHovered(cell.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="text-2xl mb-1">{cell.icon}</span>
              <p className="text-3xl font-black leading-none" style={{ color: cell.color, fontFamily: 'var(--font-heading)' }}>
                {cell.pct}
              </p>
              <p className="text-sm font-bold mt-1 text-center" style={{ color: cell.color }}>
                {cell.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip area */}
      <div className="mt-4 min-h-[52px] flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          {hovered ? (
            <motion.p
              key={hovered}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-semibold text-center px-5 py-3 rounded-xl w-full"
              style={{ background: '#EEF2FF', color: '#1B2559', border: '1.5px solid #C7D7FD' }}
            >
              {cells.find(c => c.key === hovered)?.tooltip}
            </motion.p>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-sm font-semibold text-center" style={{ color: '#475569' }}>
              Hover any quadrant to understand what it means
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Spaced Retrieval Curve ───────────────────────────────────────────────────

function SpacedRetrievalCurve() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  const curvePath = 'M 15,14 C 38,14 64,96 80,96 L 80,30 C 100,30 152,64 172,64 L 172,16 C 196,16 272,28 295,28'
  const areaPath = curvePath + ' L 295,130 L 15,130 Z'

  const practices = [
    { x: 80, yTop: 30, label: 'Session 2', day: 'Day 7' },
    { x: 172, yTop: 16, label: 'Session 3', day: 'Day 30' },
  ]

  return (
    <div ref={ref} className="w-full max-w-[400px] mx-auto">
      <svg viewBox="0 0 310 145" className="w-full overflow-visible">
        <defs>
          <linearGradient id="curve-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4361EE" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4361EE" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map(pct => {
          const y = 120 - (pct / 100) * 110
          return (
            <g key={pct}>
              <line x1="10" y1={y} x2="300" y2={y} stroke="#CBD5E1" strokeWidth="1" />
              <text x="6" y={y + 3} fontSize="10" fill="#475569" textAnchor="end" fontFamily="system-ui" fontWeight="600">{pct}%</text>
            </g>
          )
        })}

        <motion.path
          d={areaPath}
          fill="url(#curve-area)"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />

        <motion.path
          d={curvePath}
          fill="none"
          stroke="url(#curveStroke)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.1 }}
        />
        <defs>
          <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4361EE" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#4361EE" />
          </linearGradient>
        </defs>

        {practices.map((p, i) => (
          <motion.g
            key={p.label}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.8 + i * 0.25 }}
          >
            <line x1={p.x} y1={p.yTop} x2={p.x} y2={96} stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            <circle cx={p.x} cy={p.yTop} r="6" fill="#7C3AED" />
            <circle cx={p.x} cy={p.yTop} r="10" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity="0.35" />
            <rect x={p.x - 28} y={p.yTop - 24} width={56} height={18} rx="6" fill="#EEF2FF" stroke="#C7D7FD" strokeWidth="1.5" />
            <text x={p.x} y={p.yTop - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#4361EE" fontFamily="system-ui">
              {p.label}
            </text>
          </motion.g>
        ))}

        <motion.circle
          cx="15" cy="14" r="6" fill="#4361EE"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.1 }}
        />

        {[
          { x: 15, label: 'Day 1' },
          { x: 80, label: 'Day 7' },
          { x: 172, label: 'Day 30' },
        ].map(d => (
          <text key={d.label} x={d.x} y={140} textAnchor="middle" fontSize="11" fill="#334155" fontWeight="700" fontFamily="system-ui">
            {d.label}
          </text>
        ))}

        <motion.line
          x1="172" y1="28" x2="295" y2="28"
          stroke="#16A34A" strokeWidth="1.5" strokeDasharray="5 3"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.8 } : { opacity: 0 }}
          transition={{ delay: 1.4 }}
        />

        <motion.text
          x="234" y="22"
          textAnchor="middle" fontSize="10" fill="#15803D" fontWeight="800" fontFamily="system-ui"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1.5 }}
        >
          Long-term memory
        </motion.text>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 rounded" style={{ background: 'linear-gradient(90deg, #4361EE, #7C3AED)' }} />
          <span className="text-sm font-semibold" style={{ color: '#334155' }}>Retention</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ background: '#7C3AED' }} />
          <span className="text-sm font-semibold" style={{ color: '#334155' }}>Practice session</span>
        </div>
      </div>
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 } as { opacity: number; y: number },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55 },
}

const usbs = [
  {
    num: '01',
    icon: '🌸',
    title: "Bloom's Taxonomy",
    subtitle: 'Design questions that build real thinking, not just recall',
    description:
      "Tag every question by cognitive level — from basic recall to creating new knowledge. See at a glance whether your session challenges learners to think, or just to remember. AI tags questions automatically.",
    citation: "Anderson & Krathwohl, 2001 — Revised Bloom's Framework · Used in 150+ countries",
    color: '#7C3AED',
    bg: '#F5F3FF',
    Visual: BloomsFlowerVisual,
    visualFirst: true,
  },
  {
    num: '02',
    icon: '🧠',
    title: 'Confidence Grid',
    subtitle: 'Spot the misconceptions that scores miss entirely',
    description:
      "A learner who answers correctly and confidently understands the material. One who answers correctly but isn't sure is guessing. One who answers incorrectly but is confident has a dangerous misconception. Standard scores can't tell these apart. Quizotic can.",
    citation: 'Dunlosky et al., 2013 — Psychological Science in the Public Interest',
    color: '#4361EE',
    bg: '#EFF6FF',
    Visual: ConfidenceGridVisual,
    visualFirst: false,
  },
  {
    num: '03',
    icon: '🔄',
    title: 'Spaced Retrieval',
    subtitle: 'The science behind remembering longer',
    description:
      "Without revision, most learners forget 70% of new knowledge within a week. Quizotic auto-schedules follow-up sessions at the optimal intervals — Day 1, Day 7, Day 30 — moving knowledge from short-term to long-term memory.",
    citation: 'Ebbinghaus Forgetting Curve, 1885 — replicated in 100+ modern studies',
    color: '#059669',
    bg: '#ECFDF5',
    Visual: SpacedRetrievalCurve,
    visualFirst: true,
  },
]

export function LearningScience() {
  return (
    <section id="learning-science">
      {/* Header */}
      <div className="py-16 md:py-20" style={{ background: '#fff' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <motion.div {...fadeUp} className="text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-sm font-bold uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: '#F0F4FF', color: '#4361EE', border: '1.5px solid #DBEAFE' }}>
                🎓 Research-Backed
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
              What makes Quizotic different
            </h2>
            <p className="text-lg max-w-xl mx-auto font-medium" style={{ color: '#374151' }}>
              Three features built on learning science that actually change outcomes — not just scores.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Full-width colored stripes — one per USB */}
      {usbs.map((usb) => (
        <div key={usb.title} style={{ background: usb.bg }}>
          <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-16 md:py-24">
            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="grid md:grid-cols-12 gap-10 md:gap-16 items-center"
            >
              {/* Visual column — no card wrapper */}
              <div className={`md:col-span-7 flex items-center justify-center ${!usb.visualFirst ? 'md:order-2' : ''}`}>
                <usb.Visual />
              </div>

              {/* Text column */}
              <div className={`md:col-span-5 ${!usb.visualFirst ? 'md:order-1' : ''}`}>
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-black px-3 py-1.5 rounded-lg"
                      style={{ background: `${usb.color}20`, color: usb.color }}
                    >
                      {usb.num}
                    </span>
                    <span className="text-2xl">{usb.icon}</span>
                  </div>

                  <h3
                    className="text-2xl md:text-3xl font-black leading-tight"
                    style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}
                  >
                    {usb.title}
                  </h3>

                  <p className="text-base font-bold" style={{ color: usb.color }}>
                    {usb.subtitle}
                  </p>

                  <p className="text-lg leading-relaxed text-justify font-medium" style={{ color: '#1E293B' }}>
                    {usb.description}
                  </p>

                  <div className="pt-1 px-4 py-3 rounded-xl" style={{ background: `${usb.color}12`, border: `1.5px solid ${usb.color}30` }}>
                    <p className="text-sm font-semibold" style={{ color: '#374151' }}>
                      📄 {usb.citation}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      ))}
    </section>
  )
}
