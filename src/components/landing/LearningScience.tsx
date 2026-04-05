'use client'

import { motion } from 'framer-motion'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
}

function ConfidenceGridVisual() {
  return (
    <div className="flex justify-center my-4">
      <div className="grid grid-cols-3 gap-0 text-[11px] font-semibold">
        {/* Header row */}
        <div />
        <div className="text-center px-3 py-1.5" style={{ color: '#64748B' }}>Correct</div>
        <div className="text-center px-3 py-1.5" style={{ color: '#64748B' }}>Wrong</div>
        {/* Sure row */}
        <div className="flex items-center pr-3 py-1.5" style={{ color: '#64748B' }}>Sure</div>
        <div className="flex items-center justify-center px-4 py-3 rounded-tl-lg" style={{ background: '#DCFCE7', color: '#16A34A' }}>
          <span className="text-lg font-black">12</span>
        </div>
        <div className="flex items-center justify-center px-4 py-3 rounded-tr-lg" style={{ background: '#FEF3C7', color: '#D97706' }}>
          <span className="text-lg font-black">3</span>
        </div>
        {/* Unsure row */}
        <div className="flex items-center pr-3 py-1.5" style={{ color: '#64748B' }}>Unsure</div>
        <div className="flex items-center justify-center px-4 py-3 rounded-bl-lg" style={{ background: '#F0FDF4', color: '#4ADE80' }}>
          <span className="text-lg font-black">5</span>
        </div>
        <div className="flex items-center justify-center px-4 py-3 rounded-br-lg" style={{ background: '#F8FAFC', color: '#94A3B8' }}>
          <span className="text-lg font-black">4</span>
        </div>
      </div>
    </div>
  )
}

function BloomsPyramidVisual() {
  const levels = [
    { label: 'Create', color: '#7C3AED', width: '45%' },
    { label: 'Evaluate', color: '#9333EA', width: '55%' },
    { label: 'Analyse', color: '#A855F7', width: '65%' },
    { label: 'Apply', color: '#F59E0B', width: '75%' },
    { label: 'Understand', color: '#3B82F6', width: '85%' },
    { label: 'Remember', color: '#60A5FA', width: '95%' },
  ]
  return (
    <div className="flex flex-col items-center gap-1 my-4">
      {levels.map(l => (
        <div key={l.label} className="rounded-md py-1 text-center text-[10px] font-bold text-white" style={{ background: l.color, width: l.width }}>
          {l.label}
        </div>
      ))}
    </div>
  )
}

function SpacedRetrievalVisual() {
  const points = [
    { day: 'Day 1', retention: 90, y: 10 },
    { day: 'Day 7', retention: 70, y: 30 },
    { day: 'Day 30', retention: 85, y: 15 },
  ]
  return (
    <div className="flex items-end justify-center gap-6 my-4 h-24">
      {points.map((p, i) => (
        <div key={p.day} className="flex flex-col items-center gap-1">
          <span className="text-xs font-black" style={{ color: '#4361EE' }}>{p.retention}%</span>
          <div
            className="rounded-t-md transition-all"
            style={{
              width: 32,
              height: `${p.retention * 0.8}px`,
              background: i === 2 ? 'linear-gradient(180deg, #4361EE, #7C3AED)' : `rgba(67, 97, 238, ${0.3 + i * 0.2})`,
            }}
          />
          <span className="text-[10px] font-semibold" style={{ color: '#64748B' }}>{p.day}</span>
        </div>
      ))}
    </div>
  )
}

const cards = [
  {
    icon: '🧠',
    title: 'Confidence Grid',
    description: 'After each answer, learners rate their confidence. Teachers spot misconceptions: students who are confident but wrong need targeted correction.',
    citation: 'Dunlosky et al., 2013',
    Visual: ConfidenceGridVisual,
  },
  {
    icon: '📊',
    title: "Bloom's Taxonomy",
    description: "Tag questions by cognitive level. See whether your session hits higher-order thinking or stays at recall. Balance your quiz across all six levels.",
    citation: 'Bloom 1956, Anderson & Krathwohl 2001',
    Visual: BloomsPyramidVisual,
  },
  {
    icon: '🔄',
    title: 'Spaced Retrieval',
    description: 'Auto-generated follow-up quizzes at scientifically optimal intervals move knowledge from short-term to long-term memory.',
    citation: 'Ebbinghaus Forgetting Curve',
    Visual: SpacedRetrievalVisual,
  },
]

export function LearningScience() {
  return (
    <section className="py-20 md:py-28" style={{ background: '#FFFBF5' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div {...fadeUp} className="text-center mb-14">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#4361EE' }}>Evidence-Based</p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Backed by Learning Science
          </h2>
          <p className="mt-3 text-base max-w-xl mx-auto" style={{ color: '#4A5568' }}>
            Every feature is grounded in proven research methods that actually improve learning outcomes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 * i }}
              className="rounded-2xl p-6 flex flex-col"
              style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{card.icon}</span>
                <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>{card.title}</h3>
              </div>

              <card.Visual />

              <p className="text-base leading-relaxed flex-1" style={{ color: '#4A5568' }}>
                {card.description}
              </p>

              <p className="mt-4 text-xs font-medium" style={{ color: '#94A3B8' }}>
                {card.citation}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
