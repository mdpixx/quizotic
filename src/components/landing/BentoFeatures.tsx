'use client'

import { motion } from 'framer-motion'

const features = [
  {
    icon: '🤖',
    title: 'AI Quiz Generation',
    desc: 'Paste an article, URL, or topic. Get a complete quiz with explanations in seconds.',
    span: 'md:col-span-2',
    bg: '#F0F4FF',
    border: '#DBEAFE',
  },
  {
    icon: '📱',
    title: 'Works On Any Device',
    desc: 'Phone, tablet, laptop — no app install. Just open the link and join.',
    span: '',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    icon: '🔓',
    title: 'No Signup Required',
    desc: 'Participants join with a code — no accounts, no downloads, no friction.',
    span: '',
    bg: '#F0FDF4',
    border: '#BBF7D0',
  },
  {
    icon: '🏆',
    title: 'Gamification',
    desc: 'Speed scoring, streaks, podium animations, avatars, and team mode to keep energy high.',
    span: '',
    bg: '#FFF5F5',
    border: '#FECACA',
  },
  {
    icon: '📈',
    title: 'Real-Time Reports',
    desc: 'Per-question breakdown with accuracy, misconception detection, and downloadable PDF reports — all free.',
    span: '',
    bg: '#FAF5FF',
    border: '#E9D5FF',
  },
  {
    icon: '🏫',
    title: 'Classroom Mode',
    desc: 'Extra-large fonts, projector-optimized layout. Readable from the back of any room.',
    span: 'md:col-span-2',
    bg: '#FFF7ED',
    border: '#FED7AA',
  },
]

export function BentoFeatures() {
  return (
    <section id="features" className="py-20 md:py-28" style={{ background: '#FFFBF5' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#4361EE' }}>Features</p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Built for Engagement
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`rounded-2xl p-6 ${f.span}`}
              style={{ background: f.bg, border: `1.5px solid ${f.border}` }}
            >
              <span className="text-2xl mb-3 block">{f.icon}</span>
              <h3 className="text-base font-black mb-1.5" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                {f.title}
              </h3>
              <p className="text-base leading-relaxed" style={{ color: '#4A5568' }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
