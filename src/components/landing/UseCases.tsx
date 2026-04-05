'use client'

import { motion } from 'framer-motion'

const useCases = [
  {
    emoji: '🏫',
    title: 'Schools & Colleges',
    desc: 'Make revision sessions students actually want to attend. Works with classes of 5 or 500.',
    color: '#4361EE',
    bg: '#F0F4FF',
  },
  {
    emoji: '🏢',
    title: 'Corporate Training',
    desc: 'Replace boring slides with live interaction. Track comprehension with real-time analytics.',
    color: '#FF6B6B',
    bg: '#FFF5F5',
  },
  {
    emoji: '🎤',
    title: 'Events & Conferences',
    desc: 'Engage audiences of any size with live polls, word clouds, and interactive Q&A.',
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
            Built for Every Classroom
          </p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Who Uses Quizotic?
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-2xl p-7 text-center"
              style={{ background: uc.bg, border: `1.5px solid ${uc.color}22` }}
            >
              <span className="text-4xl mb-4 block">{uc.emoji}</span>
              <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                {uc.title}
              </h3>
              <p className="text-base leading-relaxed" style={{ color: '#4A5568' }}>
                {uc.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
