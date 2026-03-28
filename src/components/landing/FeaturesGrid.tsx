'use client'

import { motion } from 'framer-motion'

const FEATURES = [
  {
    title: 'ai quiz builder',
    desc: 'Paste any content — URL, PDF, or text. AI generates a complete quiz in seconds.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <circle cx="24" cy="24" r="14" fill="#fde68a" opacity="0.4" />
        <circle cx="24" cy="24" r="9" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
        <path d="M20 24 L23 27 L29 21" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36 10 L37 13 L40 14 L37 15 L36 18 L35 15 L32 14 L35 13 Z" fill="#d97706" />
        <path d="M10 8 L10.8 10.5 L13 11 L10.8 11.5 L10 14 L9.2 11.5 L7 11 L9.2 10.5 Z" fill="#d97706" opacity="0.6" />
      </svg>
    ),
  },
  {
    title: 'live leaderboard',
    desc: 'Real-time rankings update after every answer. Speed and accuracy both count.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect x="6" y="28" width="8" height="14" rx="2" fill="#d1fae5" stroke="#059669" strokeWidth="1.5" />
        <rect x="20" y="18" width="8" height="24" rx="2" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />
        <rect x="34" y="22" width="8" height="20" rx="2" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.5" />
        <circle cx="10" cy="22" r="4" fill="#059669" opacity="0.2" stroke="#059669" strokeWidth="1.2" />
        <text x="10" y="25.5" fontSize="6" fill="#059669" textAnchor="middle" fontWeight="bold">3</text>
        <circle cx="24" cy="12" r="4" fill="#d97706" opacity="0.2" stroke="#d97706" strokeWidth="1.2" />
        <text x="24" y="15.5" fontSize="6" fill="#d97706" textAnchor="middle" fontWeight="bold">1</text>
        <circle cx="38" cy="16" r="4" fill="#2563eb" opacity="0.2" stroke="#2563eb" strokeWidth="1.2" />
        <text x="38" y="19.5" fontSize="6" fill="#2563eb" textAnchor="middle" fontWeight="bold">2</text>
      </svg>
    ),
  },
  {
    title: 'constellation scores',
    desc: 'Each right answer lights up a star. Watch your team\'s constellation form live.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" fill="#1e1b4b" opacity="0.08" />
        <line x1="12" y1="14" x2="24" y2="10" stroke="#a5b4fc" strokeWidth="1" opacity="0.6" />
        <line x1="24" y1="10" x2="36" y2="18" stroke="#a5b4fc" strokeWidth="1" opacity="0.6" />
        <line x1="24" y1="10" x2="20" y2="28" stroke="#a5b4fc" strokeWidth="1" opacity="0.4" />
        <line x1="20" y1="28" x2="32" y2="34" stroke="#a5b4fc" strokeWidth="1" opacity="0.4" />
        <circle cx="12" cy="14" r="2.5" fill="#c7d2fe" />
        <circle cx="24" cy="10" r="4" fill="#fde68a" />
        <circle cx="24" cy="10" r="7" fill="#fde68a" opacity="0.15" />
        <circle cx="36" cy="18" r="3" fill="#fde68a" />
        <circle cx="20" cy="28" r="2" fill="#a5b4fc" />
        <circle cx="32" cy="34" r="2.5" fill="#fde68a" opacity="0.8" />
      </svg>
    ),
  },
  {
    title: 'session analytics',
    desc: 'Per-question accuracy, time distribution, and participant engagement — post-session.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect x="6" y="6" width="36" height="36" rx="6" fill="#f0fdf4" stroke="#059669" strokeWidth="1.5" />
        <path d="M12 32 L18 22 L24 26 L30 16 L36 20" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="18" cy="22" r="2" fill="#059669" />
        <circle cx="24" cy="26" r="2" fill="#059669" />
        <circle cx="30" cy="16" r="2" fill="#059669" />
        <circle cx="36" cy="20" r="2" fill="#059669" />
      </svg>
    ),
  },
  {
    title: 'question types',
    desc: 'Multiple choice, true/false, image-based, and open-ended questions in one quiz.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect x="6" y="6" width="16" height="16" rx="4" fill="#fce7f3" stroke="#db2777" strokeWidth="1.5" />
        <path d="M11 14 L15 14 M13 11 L13 17" stroke="#db2777" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="26" y="6" width="16" height="16" rx="4" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.5" />
        <circle cx="34" cy="14" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
        <circle cx="34" cy="14" r="2" fill="#2563eb" />
        <rect x="6" y="26" width="16" height="16" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
        <path d="M11 31 L17 31 M11 34 L15 34" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="26" y="26" width="16" height="16" rx="4" fill="#d1fae5" stroke="#059669" strokeWidth="1.5" />
        <path d="M30 34 L33 37 L38 31" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'instant join — no app',
    desc: 'Participants join with a 6-digit code or QR scan. No download. No sign-up.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* QR code outline */}
        <rect x="6" y="6" width="16" height="16" rx="3" fill="none" stroke="#1e1a14" strokeWidth="1.5" />
        <rect x="10" y="10" width="8" height="8" rx="1" fill="#1e1a14" />
        <rect x="26" y="6" width="16" height="16" rx="3" fill="none" stroke="#1e1a14" strokeWidth="1.5" />
        <rect x="30" y="10" width="8" height="8" rx="1" fill="#1e1a14" />
        <rect x="6" y="26" width="16" height="16" rx="3" fill="none" stroke="#1e1a14" strokeWidth="1.5" />
        <rect x="10" y="30" width="8" height="8" rx="1" fill="#1e1a14" />
        {/* Bottom-right corner: signal/link dots */}
        <circle cx="30" cy="30" r="2" fill="#d97706" />
        <circle cx="38" cy="30" r="2" fill="#d97706" opacity="0.6" />
        <circle cx="30" cy="38" r="2" fill="#d97706" opacity="0.6" />
        <circle cx="38" cy="38" r="2" fill="#d97706" opacity="0.3" />
        <line x1="30" y1="30" x2="38" y2="38" stroke="#d97706" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
  },
]

export function FeaturesGrid() {
  return (
    <section id="features" className="py-24 px-6 md:px-12 relative overflow-hidden"
      style={{ background: 'var(--color-amber-tint)' }}>

      {/* Faint star particles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {[
          { top: '8%', left: '12%', size: 3, op: 0.4 },
          { top: '18%', left: '82%', size: 4, op: 0.3 },
          { top: '55%', left: '6%', size: 2, op: 0.35 },
          { top: '72%', left: '88%', size: 3, op: 0.25 },
          { top: '40%', left: '95%', size: 2, op: 0.3 },
          { top: '90%', left: '25%', size: 4, op: 0.2 },
          { top: '85%', left: '70%', size: 3, op: 0.3 },
        ].map((s, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              top: s.top, left: s.left,
              width: s.size, height: s.size,
              background: '#d97706',
              opacity: s.op,
            }} />
        ))}
      </div>

      <div className="max-w-[1280px] mx-auto relative z-10">
        <div className="mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-amber)' }}>
            everything you need
          </p>
          <h2 className="text-3xl sm:text-4xl font-black lowercase tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
            built for rooms that<br />come alive
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group rounded-2xl p-7 border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              style={{
                background: '#fff',
                borderColor: '#e7e5e4',
              }}>
              <div className="mb-5">
                {feature.icon}
              </div>
              <h3 className="text-lg font-black lowercase mb-2"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}>
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Mid-page CTA nudge */}
        <div className="mt-14 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl px-8 py-6 border"
          style={{ background: '#fff', borderColor: '#e7e5e4' }}>
          <div>
            <p className="text-base font-black lowercase"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
              seen enough? your first quiz is free.
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              No credit card. No install. Start in 2 minutes.
            </p>
          </div>
          <a href="/host"
            className="flex-shrink-0 text-sm font-bold px-6 py-3 rounded-full transition-all hover:-translate-y-0.5 whitespace-nowrap"
            style={{
              fontFamily: 'var(--font-heading)',
              background: 'var(--color-dark)',
              color: 'var(--color-cream)',
              boxShadow: '0 4px 16px rgba(30,26,20,0.2)',
            }}>
            ✦ create a quiz now
          </a>
        </div>
      </div>
    </section>
  )
}
