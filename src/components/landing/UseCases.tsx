'use client'

import { motion } from 'framer-motion'

const useCases = [
  {
    emoji: '🏫',
    title: 'Schools & Colleges',
    desc: 'Make revision sessions students actually want to attend. Pause mid-quiz when a hand goes up, export scores for records.',
    color: '#4361EE',
    bg: '#F0F4FF',
  },
  {
    emoji: '📚',
    title: 'Coaching Institutes',
    desc: 'Run timed assessments with leaderboards. Import question banks via CSV, track performance with confidence grids.',
    color: '#9333EA',
    bg: '#FAF5FF',
  },
  {
    emoji: '🏢',
    title: 'Corporate Training',
    desc: 'Replace boring slides with live interaction. Assessment mode with pass/fail, CSV attendance export for compliance.',
    color: '#FF6B6B',
    bg: '#FFF5F5',
  },
  {
    emoji: '🎤',
    title: 'Events & Conferences',
    desc: 'Engage audiences of any size with live polls, word clouds, emoji pulse, and interactive Q&A. No app install needed.',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
]

export function UseCases() {
  return (
    <section className="py-20 md:py-28" style={{ background: '#fff' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#FF6B6B' }}>
            Built for Every Audience
          </p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Who Uses Quizotic?
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-2xl p-7 text-center transition-all hover:shadow-lg hover:-translate-y-1"
              style={{ background: uc.bg, border: `1.5px solid ${uc.color}22` }}
            >
              <span className="text-4xl mb-4 block">{uc.emoji}</span>
              <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                {uc.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>
                {uc.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
