'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const FEATURES = [
  { icon: '✦', text: 'AI builds your quiz from any PDF or link' },
  { icon: '⚡', text: 'Live leaderboard — no app install needed' },
  { icon: '🎯', text: 'Works on any phone, even 2G connections' },
  { icon: '✓',  text: 'Free forever for small quizzes' },
]

export function CTASection() {
  return (
    <section className="relative py-24 px-6 md:px-12"
      style={{ background: 'linear-gradient(145deg, #F3EEFF 0%, #FFF0FA 60%, #FAFAFE 100%)' }}>

      <div className="max-w-[640px] mx-auto text-center">

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-sm font-bold uppercase tracking-widest mb-5"
          style={{ color: 'var(--color-primary)' }}>
          ✦ free forever for small quizzes
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-4xl sm:text-5xl lg:text-[56px] font-black lowercase tracking-tight leading-[1.0] mb-6"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
          your next quiz<br />
          <span style={{ backgroundImage: 'linear-gradient(90deg,#7C3AED,#EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>starts here</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="text-lg mb-10"
          style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          Create, host, and run a live quiz in under 2 minutes.
          No credit card. No setup. Just energy in the room.
        </motion.p>

        {/* Feature bullets */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 text-left max-w-md mx-auto">
          {FEATURES.map(f => (
            <div key={f.text} className="flex items-start gap-2.5 text-base"
              style={{ color: 'var(--color-text-secondary)' }}>
              <span className="mt-0.5 font-bold flex-shrink-0" style={{ color: 'var(--color-primary)' }}>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <Link href="/host"
            className="inline-flex items-center gap-2 rounded-full px-9 py-4 text-[17px] font-extrabold transition-all hover:-translate-y-0.5"
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

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap gap-6 justify-center">
          {[
            { val: 'Free', label: 'forever for small quizzes' },
            { val: 'Zero', label: 'install needed' },
            { val: '60s', label: 'to go live' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center">
              <span className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                {item.val}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
