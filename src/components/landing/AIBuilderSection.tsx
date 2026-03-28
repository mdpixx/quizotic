'use client'

import { motion } from 'framer-motion'

const STEPS = [
  {
    num: '01',
    label: 'paste your content',
    desc: 'Drop in a URL, PDF, slides, or plain text.',
    color: '#F3EEFF',
    accent: '#7C3AED',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
        <rect x="10" y="8" width="36" height="44" rx="5" fill="#DDD6FE" opacity="0.5" />
        <rect x="14" y="12" width="28" height="36" rx="3" fill="#F3EEFF" stroke="#7C3AED" strokeWidth="1.5" />
        <line x1="20" y1="22" x2="38" y2="22" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="28" x2="38" y2="28" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="34" x2="30" y2="34" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
        <circle cx="46" cy="44" r="10" fill="#7C3AED" />
        <line x1="43" y1="44" x2="49" y2="44" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <line x1="46" y1="41" x2="46" y2="47" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: '02',
    label: 'ai generates quiz',
    desc: 'Questions, options, and answers — ready in seconds.',
    color: '#FFF0FA',
    accent: '#EC4899',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
        <circle cx="32" cy="32" r="18" fill="#FBCFE8" opacity="0.4" />
        <circle cx="32" cy="32" r="12" fill="#FFF0FA" stroke="#EC4899" strokeWidth="1.5" />
        <path d="M26 32 L30 36 L38 28" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Sparkles */}
        <path d="M50 14 L51.5 18 L55.5 19.5 L51.5 21 L50 25 L48.5 21 L44.5 19.5 L48.5 18 Z" fill="#7C3AED" />
        <path d="M14 10 L15 13 L18 14 L15 15 L14 18 L13 15 L10 14 L13 13 Z" fill="#A78BFA" opacity="0.7" />
        <path d="M54 42 L55 44 L57 45 L55 46 L54 48 L53 46 L51 45 L53 44 Z" fill="#EC4899" opacity="0.8" />
      </svg>
    ),
  },
  {
    num: '03',
    label: 'host live',
    desc: 'Share a code or QR. Participants join. Hit play.',
    color: '#FAFAFE',
    accent: '#7C3AED',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
        <rect x="8" y="14" width="48" height="30" rx="5" fill="#DDD6FE" opacity="0.4" />
        <rect x="12" y="18" width="40" height="22" rx="3" fill="#F3EEFF" stroke="#7C3AED" strokeWidth="1.5" />
        <circle cx="32" cy="29" r="7" fill="#7C3AED" opacity="0.15" />
        <path d="M29 26 L37 29 L29 32 Z" fill="#7C3AED" />
        {/* WiFi/broadcast arcs */}
        <path d="M24 46 L26 50 L38 50 L40 46" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1="32" y1="44" x2="32" y2="46" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
        {/* Signal dots */}
        <circle cx="44" cy="12" r="3" fill="#EC4899" />
        <circle cx="44" cy="12" r="6" stroke="#EC4899" strokeWidth="1" opacity="0.4" fill="none" />
        <circle cx="44" cy="12" r="9" stroke="#EC4899" strokeWidth="0.8" opacity="0.2" fill="none" />
      </svg>
    ),
  },
]

const connectorVariants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.6, ease: 'easeInOut' } },
}

export function AIBuilderSection() {
  return (
    <section id="how-it-works" className="py-24 px-6 md:px-12 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #F3EEFF 0%, #FFF0FA 100%)' }}>

      <div className="max-w-[1280px] mx-auto relative z-10">
        <div className="mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-primary)' }}>
            how it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-black lowercase tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
            quiz ready in 60 seconds
          </h2>
        </div>

        <div className="relative flex flex-col md:flex-row gap-6 md:gap-0">
          {STEPS.map((step, i) => (
            <div key={step.num} className="flex-1 flex flex-col md:flex-row items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 rounded-3xl p-8 flex flex-col items-start relative"
                style={{ background: step.color, border: `1.5px solid ${step.accent}20` }}>

                {/* Step number */}
                <span className="text-[11px] font-black uppercase tracking-widest mb-5 px-2.5 py-1 rounded-full"
                  style={{ background: `${step.accent}18`, color: step.accent, fontFamily: 'var(--font-heading)' }}>
                  {step.num}
                </span>

                {/* Icon */}
                <div className="mb-5">
                  {step.icon}
                </div>

                {/* Label */}
                <h3 className="text-xl font-black lowercase mb-2"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-dark)' }}>
                  {step.label}
                </h3>

                {/* Description */}
                <p className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {step.desc}
                </p>
              </motion.div>

              {/* Connector arrow between steps (desktop only) */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:flex items-center px-3 self-center" aria-hidden>
                  <motion.svg
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.15 + 0.3 }}
                    viewBox="0 0 32 24" fill="none" className="w-8">
                    <path d="M2 12 H26 M20 6 L28 12 L20 18" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Supporting detail row */}
        <div className="mt-12 flex flex-wrap gap-x-10 gap-y-3">
          {[
            { icon: '📄', text: 'PDF, Google Slides, URL, or raw text' },
            { icon: '⚡', text: 'Questions ready in under 10 seconds' },
            { icon: '🔗', text: 'No app install — join via link or QR' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2.5 text-sm"
              style={{ color: 'var(--color-text-muted)' }}>
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
