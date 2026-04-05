'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    num: '1',
    title: 'Paste any content',
    desc: 'Drop a URL, paste text, or describe your topic. Our AI reads it and understands the key concepts.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="6" y="6" width="28" height="28" rx="6" fill="#F0F4FF" stroke="#4361EE" strokeWidth="1.5" />
        <path d="M14 16h12M14 20h8M14 24h10" stroke="#4361EE" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: '2',
    title: 'AI builds your quiz',
    desc: 'In seconds, get a complete quiz with questions, options, explanations, and Bloom\'s taxonomy tagging.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="14" fill="#FFF5F5" stroke="#FF6B6B" strokeWidth="1.5" />
        <path d="M15 18l3 3 7-7" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 27h12" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: '3',
    title: 'Host it live',
    desc: 'Share the game code or QR. Students join from any device — no app install, no signup required.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect x="8" y="4" width="24" height="32" rx="4" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
        <rect x="12" y="12" width="16" height="8" rx="2" fill="#FEF3C7" />
        <circle cx="20" cy="30" r="2" fill="#F59E0B" />
        <text x="15" y="18" fontSize="6" fontWeight="bold" fill="#92400E">QUIZ</text>
      </svg>
    ),
  },
]

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

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-16 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-[2px]"
            style={{ background: 'linear-gradient(90deg, #4361EE, #FF6B6B, #F59E0B)' }} />

          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative text-center"
            >
              {/* Step circle */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 relative z-10" style={{ background: '#fff', border: '2px solid #DBEAFE', boxShadow: '0 4px 16px rgba(67,97,238,0.08)' }}>
                {step.icon}
              </div>

              {/* Number badge */}
              <div className="absolute top-0 right-[calc(50%-40px)] w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white z-20"
                style={{ background: 'var(--brand-gradient)' }}>
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
    </section>
  )
}
