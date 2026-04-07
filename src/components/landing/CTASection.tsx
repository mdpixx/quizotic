'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
export function CTASection() {
  return (
    <section className="py-24 md:py-32" style={{ background: '#FFFBF5' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Your next session{' '}
            <span style={{ backgroundImage: 'linear-gradient(90deg, #FF6B6B, #4361EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              starts here
            </span>
          </h2>
          <p className="text-lg mb-10" style={{ color: '#4A5568' }}>
            Create your first quiz or presentation in under a minute. No credit card, no signup, free forever.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <Link
              href="/host/create"
              className="inline-flex items-center gap-2 text-lg font-bold px-10 py-4 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #4361EE, #3A56D4)',
                fontFamily: 'var(--font-heading)',
                boxShadow: '0 8px 40px rgba(67,97,238,0.3)',
              }}
            >
              Create a Quiz
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <Link
              href="/host/present/create"
              className="inline-flex items-center gap-2 text-lg font-bold px-10 py-4 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #E05555)',
                fontFamily: 'var(--font-heading)',
                boxShadow: '0 8px 40px rgba(255,107,107,0.3)',
              }}
            >
              Build a Presentation
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>

          <div className="flex justify-center gap-6">
            {['No credit card', 'No signup', 'Free forever'].map(text => (
              <span key={text} className="text-sm font-semibold" style={{ color: '#718096' }}>{text}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
