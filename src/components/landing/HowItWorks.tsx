'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const steps = [
  {
    num: '1',
    title: 'Paste any content',
    desc: 'Drop a URL, paste text, or describe your topic. Our AI reads it and understands the key concepts.',
    color: '#4361EE',
    bg: '#F0F4FF',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="6" y="4" width="20" height="24" rx="4" fill="#DBEAFE" />
        <path d="M11 12h10M11 16h6M11 20h8" stroke="#4361EE" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: '2',
    title: 'AI builds your quiz',
    desc: "In seconds, get a complete quiz with explanations, Bloom's taxonomy tagging, and multiple question types.",
    color: '#FF6B6B',
    bg: '#FFF5F5',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <circle cx="16" cy="16" r="12" fill="#FECACA" />
        <path d="M11 15l4 4 6-8" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    num: '3',
    title: 'Host it live!',
    desc: 'Share the session code or QR. Students join from any device — no app install, no signup required.',
    color: '#F59E0B',
    bg: '#FFFBEB',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="8" y="4" width="16" height="24" rx="3" fill="#FEF3C7" />
        <rect x="11" y="10" width="10" height="6" rx="1.5" fill="#FDE68A" />
        <circle cx="16" cy="22" r="2" fill="#F59E0B" />
      </svg>
    ),
  },
]

function ConnectingLine() {
  const ref = useRef<SVGSVGElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <>
      {/* Desktop: horizontal straight line */}
      <svg ref={ref} viewBox="0 0 1280 160" className="hidden md:block absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Shadow line */}
        <line x1="213" y1="48" x2="1067" y2="48" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
        {/* Animated gradient line */}
        <line
          x1="213" y1="48" x2="1067" y2="48"
          stroke="url(#lineGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="854"
          strokeDashoffset={isInView ? '0' : '854'}
          style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
        />
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4361EE" />
            <stop offset="50%" stopColor="#FF6B6B" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>

      {/* Mobile: vertical straight line */}
      <svg viewBox="0 0 200 540" className="md:hidden absolute left-0 top-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <line x1="100" y1="50" x2="100" y2="490" stroke="#E2E8F0" strokeWidth="4" strokeLinecap="round" />
        <line
          x1="100" y1="50" x2="100" y2="490"
          stroke="url(#lineGradientMobile)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="440"
          strokeDashoffset={isInView ? '0' : '440'}
          style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
        />
        <defs>
          <linearGradient id="lineGradientMobile" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4361EE" />
            <stop offset="50%" stopColor="#FF6B6B" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>
    </>
  )
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28" style={{ background: '#FFFBF5' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#FF6B6B' }}>
            Ridiculously Simple
          </p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Three Steps. That&apos;s It.
          </h2>
        </motion.div>

        {/* Steps with connecting line */}
        <div className="relative" style={{ minHeight: 160 }}>
          <ConnectingLine />

          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
                className="relative text-center"
              >
                {/* Step bubble */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5 relative z-10 shadow-lg"
                  style={{ background: step.bg, border: `3px solid ${step.color}40` }}>
                  {step.icon}
                </div>

                {/* Number badge */}
                <div className="absolute top-0 right-[calc(50%-44px)] w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white z-20 shadow-md"
                  style={{ background: step.color }}>
                  {step.num}
                </div>

                <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
                  {step.title}
                </h3>
                <p className="text-base leading-relaxed max-w-xs mx-auto" style={{ color: '#4A5568' }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
