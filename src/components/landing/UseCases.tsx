'use client'

import { motion } from 'framer-motion'

const useCases = [
  {
    title: 'Schools & Colleges',
    desc: 'Make revision sessions students actually want to attend. Pause mid-quiz when a hand goes up, export scores for records.',
    color: '#0F1B3D',
    bg: '#F8F9FA',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
        <path d="M16 4L4 10l12 6 12-6L16 4z" fill="rgba(15,27,61,0.1)" stroke="#0F1B3D" strokeWidth="1.5" />
        <path d="M4 16l12 6 12-6" stroke="#0F1B3D" strokeWidth="1.5" />
        <path d="M4 22l12 6 12-6" stroke="#0F1B3D" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'Coaching Institutes',
    desc: 'Run timed assessments with leaderboards. Import question banks via CSV, track performance with confidence grids.',
    color: '#0F1B3D',
    bg: '#FFFDE6',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
        <rect x="6" y="6" width="20" height="20" rx="3" fill="rgba(245,230,66,0.2)" stroke="#0F1B3D" strokeWidth="1.5" />
        <path d="M11 16l3 3 7-7" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Corporate Training',
    desc: 'Replace boring slides with live interaction. Assessment mode with pass/fail, CSV attendance export for compliance.',
    color: '#0F1B3D',
    bg: '#F0FDF4',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
        <rect x="4" y="8" width="24" height="16" rx="2" fill="rgba(22,163,74,0.1)" stroke="#0F1B3D" strokeWidth="1.5" />
        <path d="M12 24v4M20 24v4M8 28h16" stroke="#0F1B3D" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Events & Conferences',
    desc: 'Engage audiences of any size with live polls, word clouds, emoji pulse, and interactive Q&A. No app install needed.',
    color: '#0F1B3D',
    bg: '#F8F9FA',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
        <circle cx="16" cy="12" r="8" fill="rgba(15,27,61,0.08)" stroke="#0F1B3D" strokeWidth="1.5" />
        <path d="M8 26c0-4 3.5-7 8-7s8 3 8 7" stroke="#0F1B3D" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
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
          <p className="text-sm font-bold uppercase tracking-widest mb-3 inline-block px-4 py-1.5 rounded-full" style={{ background: '#0F1B3D', color: '#F5E642' }}>
            Built for Every Audience
          </p>
          <h2 className="text-3xl md:text-4xl font-black mt-4" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
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
              style={{ background: uc.bg, border: '2px solid rgba(15,27,61,0.1)' }}
            >
              <div className="flex justify-center mb-4">{uc.icon}</div>
              <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
                {uc.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                {uc.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
