'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
}

interface SlideTypeCard {
  id: string
  label: string
  category: 'interactive' | 'spatial' | 'energy' | 'content'
  color: string
  bg: string
  description: string
  exclusive?: boolean
  icon: React.ReactNode
}

const CATEGORIES = [
  { id: 'interactive' as const, label: 'Audience Input', color: '#4361EE' },
  { id: 'spatial' as const, label: 'Spatial', color: '#0891B2' },
  { id: 'energy' as const, label: 'Energy', color: '#DC2626' },
  { id: 'content' as const, label: 'Content', color: '#374151' },
]

const SLIDE_TYPES: SlideTypeCard[] = [
  // Interactive
  {
    id: 'multiple_choice', label: 'Multiple Choice', category: 'interactive', color: '#2563EB', bg: '#EFF6FF',
    description: 'Classic A/B/C/D with live vote bars',
    icon: (
      <div className="space-y-1">
        {['A', 'B', 'C', 'D'].map((l, i) => (
          <div key={l} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm text-[7px] font-bold flex items-center justify-center text-white" style={{ background: i === 1 ? '#2563EB' : '#CBD5E1' }}>{l}</span>
            <div className="h-2 rounded-sm" style={{ width: `${i === 1 ? 60 : 15 + i * 5}%`, background: i === 1 ? '#2563EB' : '#E2E8F0' }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'open_text', label: 'Open Text', category: 'interactive', color: '#4361EE', bg: '#F0F4FF',
    description: 'Free-text responses from participants',
    icon: (
      <div className="space-y-1">
        {[70, 50, 40].map((w, i) => (
          <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: '#DBEAFE' }} />
        ))}
        <div className="mt-1 border border-dashed rounded px-1 py-0.5 text-[7px]" style={{ borderColor: '#93C5FD', color: '#60A5FA' }}>Type here...</div>
      </div>
    ),
  },
  {
    id: 'word_cloud', label: 'Word Cloud', category: 'interactive', color: '#FF6B6B', bg: '#FFF5F5',
    description: 'Crowd-sourced words displayed by frequency',
    icon: (
      <div className="flex flex-wrap gap-0.5 justify-center">
        {[
          { w: 'AI', s: 14 }, { w: 'Data', s: 11 }, { w: 'Cloud', s: 12 },
          { w: 'Code', s: 10 }, { w: 'ML', s: 13 }, { w: 'API', s: 9 },
        ].map(t => (
          <span key={t.w} className="font-bold" style={{ fontSize: t.s, color: '#FF6B6B', opacity: 0.6 + t.s / 30 }}>{t.w}</span>
        ))}
      </div>
    ),
  },
  {
    id: 'rating_scale', label: 'Rating Scale', category: 'interactive', color: '#EA580C', bg: '#FFF7ED',
    description: 'Star ratings with live average',
    icon: (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{ fontSize: 12, opacity: n <= 4 ? 1 : 0.3 }}>&#9733;</span>
        ))}
        <span className="text-[9px] font-bold ml-1" style={{ color: '#EA580C' }}>4.2</span>
      </div>
    ),
  },
  {
    id: 'ranking', label: 'Ranking', category: 'interactive', color: '#4F46E5', bg: '#EEF2FF',
    description: 'Drag items into preferred order',
    icon: (
      <div className="space-y-1">
        {['1st', '2nd', '3rd'].map((r, i) => (
          <div key={r} className="flex items-center gap-1">
            <span className="text-[8px] font-bold" style={{ color: '#4F46E5' }}>{r}</span>
            <div className="flex-1 h-2 rounded-sm" style={{ background: `rgba(79, 70, 229, ${0.3 - i * 0.08})` }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'scale_100', label: '100-Point Scale', category: 'interactive', color: '#16A34A', bg: '#F0FDF4',
    description: 'Precise slider from 0 to 100',
    icon: (
      <div>
        <div className="h-1.5 rounded-full relative" style={{ background: '#DCFCE7' }}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: '68%', background: '#16A34A' }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ left: '68%', background: '#16A34A' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px]" style={{ color: '#94A3B8' }}>0</span>
          <span className="text-[9px] font-bold" style={{ color: '#16A34A' }}>68</span>
          <span className="text-[8px]" style={{ color: '#94A3B8' }}>100</span>
        </div>
      </div>
    ),
  },
  // Spatial
  {
    id: 'pinpoint', label: 'Pinpoint', category: 'spatial', color: '#9333EA', bg: '#FAF5FF',
    description: 'Tap on an image to mark a location',
    exclusive: true,
    icon: (
      <div className="relative w-full h-10 rounded" style={{ background: '#F3E8FF' }}>
        <div className="absolute w-2 h-2 rounded-full" style={{ top: '25%', left: '60%', background: '#9333EA', boxShadow: '0 0 0 3px rgba(147,51,234,0.2)' }} />
        <div className="absolute w-2 h-2 rounded-full" style={{ top: '55%', left: '30%', background: '#9333EA', boxShadow: '0 0 0 3px rgba(147,51,234,0.2)' }} />
        <div className="absolute w-2 h-2 rounded-full" style={{ top: '40%', left: '75%', background: '#9333EA', boxShadow: '0 0 0 3px rgba(147,51,234,0.2)' }} />
      </div>
    ),
  },
  {
    id: 'grid_2x2', label: '2x2 Grid', category: 'spatial', color: '#0D9488', bg: '#F0FDFA',
    description: 'Place responses on a 2-axis matrix',
    exclusive: true,
    icon: (
      <div className="relative w-full h-10">
        <div className="absolute inset-0 border rounded" style={{ borderColor: '#99F6E4' }} />
        <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: '#99F6E4' }} />
        <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: '#99F6E4' }} />
        <div className="absolute w-1.5 h-1.5 rounded-full" style={{ top: '20%', left: '70%', background: '#0D9488' }} />
        <div className="absolute w-1.5 h-1.5 rounded-full" style={{ top: '65%', left: '25%', background: '#0D9488' }} />
        <div className="absolute w-1.5 h-1.5 rounded-full" style={{ top: '35%', left: '40%', background: '#0D9488' }} />
      </div>
    ),
  },
  {
    id: 'wheel', label: 'Wheel of Names', category: 'spatial', color: '#F59E0B', bg: '#FFFBEB',
    description: 'Spin a wheel to pick a random name',
    icon: (
      <div className="flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 relative" style={{ borderColor: '#FCD34D', background: 'conic-gradient(#FBBF24 0% 33%, #F59E0B 33% 66%, #D97706 66% 100%)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white shadow" />
          </div>
        </div>
      </div>
    ),
  },
  // Energy
  {
    id: 'word_duel', label: 'Word Duel', category: 'energy', color: '#DC2626', bg: '#FEF2F2',
    description: 'Two choices battle head-to-head live',
    exclusive: true,
    icon: (
      <div className="flex items-center gap-1">
        <div className="flex-1 rounded-l-md py-1 text-center text-[8px] font-bold text-white" style={{ background: '#DC2626' }}>A</div>
        <span className="text-[9px] font-black" style={{ color: '#94A3B8' }}>VS</span>
        <div className="flex-1 rounded-r-md py-1 text-center text-[8px] font-bold text-white" style={{ background: '#2563EB' }}>B</div>
      </div>
    ),
  },
  {
    id: 'live_race', label: 'Live Race', category: 'energy', color: '#B45309', bg: '#FFFBEB',
    description: 'Watch options race in real-time as votes come in',
    exclusive: true,
    icon: (
      <div className="space-y-1">
        {[{ w: 75, c: '#B45309' }, { w: 55, c: '#D97706' }, { w: 40, c: '#F59E0B' }].map((b, i) => (
          <div key={i} className="h-2 rounded-full" style={{ width: `${b.w}%`, background: b.c }} />
        ))}
      </div>
    ),
  },
  {
    id: 'emoji_pulse', label: 'Emoji Pulse', category: 'energy', color: '#4361EE', bg: '#F0F4FF',
    description: 'Quick emoji reaction check',
    exclusive: true,
    icon: (
      <div className="flex justify-center gap-1.5">
        {['❤️', '😂', '🔥', '😮'].map(e => (
          <span key={e} style={{ fontSize: 14 }}>{e}</span>
        ))}
      </div>
    ),
  },
  {
    id: 'quick_fire', label: 'Quick Fire', category: 'energy', color: '#EF4444', bg: '#FFF1F2',
    description: 'Fast-paced timed rounds',
    exclusive: true,
    icon: (
      <div className="flex items-center justify-center gap-1">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: '#EF4444' }}>5s</div>
        <div className="space-y-0.5">
          {[65, 45].map((w, i) => (
            <div key={i} className="h-1.5 rounded-sm" style={{ width: w, background: i === 0 ? '#FCA5A5' : '#FECDD3' }} />
          ))}
        </div>
      </div>
    ),
  },
  // Content
  {
    id: 'title', label: 'Title Slide', category: 'content', color: '#1E1B4B', bg: '#F8F7FF',
    description: 'Full-screen heading for sections',
    icon: (
      <div className="space-y-1 px-1">
        <div className="h-2 rounded-sm" style={{ width: '80%', background: '#1E1B4B' }} />
        <div className="h-1 rounded-sm" style={{ width: '50%', background: '#C7D2FE' }} />
      </div>
    ),
  },
  {
    id: 'bullets', label: 'Bullet Points', category: 'content', color: '#374151', bg: '#F9FAFB',
    description: 'Structured text with bullet list',
    icon: (
      <div className="space-y-1 px-1">
        {[65, 55, 45].map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#374151' }} />
            <div className="h-1.5 rounded-sm" style={{ width: `${w}%`, background: '#D1D5DB' }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'quote', label: 'Quote', category: 'content', color: '#6B7280', bg: '#F3F4F6',
    description: 'Display an inspiring quote',
    icon: (
      <div className="text-center px-1">
        <span className="text-xl font-serif leading-none" style={{ color: '#9CA3AF' }}>&ldquo;</span>
        <div className="h-1.5 rounded-sm mx-auto" style={{ width: '70%', background: '#D1D5DB' }} />
      </div>
    ),
  },
  {
    id: 'video', label: 'Video', category: 'content', color: '#1D4ED8', bg: '#EFF6FF',
    description: 'Embed a video in your presentation',
    icon: (
      <div className="flex items-center justify-center">
        <div className="w-10 h-7 rounded relative flex items-center justify-center" style={{ background: '#DBEAFE' }}>
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-b-[5px] border-b-transparent" style={{ borderLeftColor: '#1D4ED8' }} />
        </div>
      </div>
    ),
  },
]

export function SlideTypeShowcase() {
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]['id']>('interactive')
  const filtered = SLIDE_TYPES.filter(s => s.category === activeCategory)

  return (
    <section className="py-20 md:py-28" style={{ background: '#FFFBF5' }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <motion.div {...fadeUp} className="text-center mb-10">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#4361EE' }}>Slide Types</p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            17 Interactive Slide Types
          </h2>
          <p className="mt-3 text-base max-w-xl mx-auto" style={{ color: '#4A5568' }}>
            More ways to engage than any other platform.
          </p>
        </motion.div>

        {/* Category tabs */}
        <motion.div {...fadeUp} className="flex flex-wrap justify-center gap-2 mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-5 py-2 rounded-full text-sm font-bold transition-all"
              style={{
                background: activeCategory === cat.id ? cat.color : '#F1F5F9',
                color: activeCategory === cat.id ? '#fff' : '#64748B',
              }}
            >
              {cat.label}
            </button>
          ))}
        </motion.div>

        {/* Cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {filtered.map(slide => (
              <div
                key={slide.id}
                className="group rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 relative"
                style={{ background: slide.bg, border: `1.5px solid ${slide.color}20` }}
              >
                {slide.exclusive && (
                  <span className="absolute -top-2 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: 'linear-gradient(135deg, #FF6B6B, #4361EE)' }}>
                    Only on Quizotic
                  </span>
                )}
                <div className="h-12 flex items-center justify-center mb-3">
                  <div className="w-full max-w-[100px]">
                    {slide.icon}
                  </div>
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: slide.color }}>{slide.label}</p>
                <p className="text-xs leading-snug" style={{ color: '#64748B' }}>{slide.description}</p>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Exclusive callout */}
        <motion.div {...fadeUp} className="mt-10 text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, rgba(255,107,107,0.1), rgba(67,97,238,0.1))', color: '#4A5568' }}>
            <span style={{ background: 'linear-gradient(135deg, #FF6B6B, #4361EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} className="font-bold">
              6 exclusive slide types
            </span>
            you won&apos;t find anywhere else
          </p>
        </motion.div>
      </div>
    </section>
  )
}
