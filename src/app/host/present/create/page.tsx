'use client'

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  type Slide, type SlideType, type Presentation,
  SLIDE_TYPE_META, SLIDE_CATEGORIES, makeSlide,
} from '@/lib/presentation-types'

// ─── Slide type SVG icons ─────────────────────────────────────────────────────

const SLIDE_ICONS: Record<SlideType, React.ReactNode> = {
  multiple_choice: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="3" width="14" height="14" rx="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 10l2.5 2.5L13 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  open_text: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M4 6h12M4 10h8M4 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  word_cloud: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <ellipse cx="8" cy="11" rx="5" ry="3.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.3"/>
      <ellipse cx="13" cy="9" rx="4" ry="2.8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.3"/>
      <ellipse cx="10" cy="7" rx="3.5" ry="2.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  rating_scale: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M10 3l1.8 3.6 4 .6-2.9 2.8.7 4L10 12l-3.6 1.9.7-4L4.2 7.2l4-.6z" fill="currentColor" fillOpacity="0.8" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="4" width="14" height="2.5" rx="1.25" fill="currentColor"/>
      <rect x="3" y="8.5" width="10" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.65"/>
      <rect x="3" y="13" width="7" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.35"/>
    </svg>
  ),
  image_choice: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="3" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="11" y="3" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="3" y="11" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="11" y="11" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  scale_100: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="12" cy="10" r="3" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  pinpoint: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="10" cy="8" r="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="8" r="1.5" fill="currentColor"/>
      <path d="M10 12v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  grid_2x2: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <line x1="10" y1="3" x2="10" y2="17" stroke="currentColor" strokeWidth="1.3"/>
      <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="6" cy="6" r="1.5" fill="currentColor" fillOpacity="0.6"/>
      <circle cx="14" cy="14" r="1.5" fill="currentColor" fillOpacity="0.6"/>
      <circle cx="13" cy="7" r="1" fill="currentColor" fillOpacity="0.4"/>
    </svg>
  ),
  wheel: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="10" cy="10" r="7" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 3v7l4.95 4.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
    </svg>
  ),
  word_duel: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="7" width="5.5" height="6" rx="1.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="11.5" y="7" width="5.5" height="6" rx="1.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9.5 10h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  live_race: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="5" width="11" height="2.5" rx="1.25" fill="currentColor"/>
      <rect x="3" y="8.75" width="8" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.65"/>
      <rect x="3" y="12.5" width="14" height="2.5" rx="1.25" fill="currentColor" fillOpacity="0.4"/>
    </svg>
  ),
  emoji_pulse: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="10" cy="10" r="7" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="7.5" cy="8.5" r="1" fill="currentColor"/>
      <circle cx="12.5" cy="8.5" r="1" fill="currentColor"/>
      <path d="M7 12.5c.8 1.5 5.2 1.5 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  quick_fire: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M11 3l-4 7h5l-3 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  title: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M4 7h12M4 10h8M4 13h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4 5h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  bullets: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <circle cx="5" cy="7" r="1.5" fill="currentColor"/>
      <circle cx="5" cy="11" r="1.5" fill="currentColor" fillOpacity="0.6"/>
      <circle cx="5" cy="15" r="1.5" fill="currentColor" fillOpacity="0.35"/>
      <path d="M8 7h8M8 11h6M8 15h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M5 8c0-1.1.9-2 2-2h1v3H6v2c0 .55.45 1 1 1h1v2H7a3 3 0 01-3-3V8h1zm7 0c0-1.1.9-2 2-2h1v3h-2v2c0 .55.45 1 1 1h1v2h-1a3 3 0 01-3-3V8h1z" fill="currentColor" fillOpacity="0.7"/>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="5" width="11" height="10" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M14 8.5l3 2-3 2V8.5z" fill="currentColor"/>
    </svg>
  ),
  image: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
      <path d="M3 13l4-4 3 3 2-2 5 5H5a2 2 0 01-2-2v-0z" fill="currentColor" fillOpacity="0.5"/>
    </svg>
  ),
}

// ─── Gradient helpers for slide previews ──────────────────────────────────────

function getSlideGradient(slide: Slide): string {
  switch (slide.type) {
    case 'title': {
      const bg = (slide as { bgColor: string }).bgColor || '#0F1B3D'
      return `linear-gradient(135deg, ${bg}, ${bg}dd)`
    }
    case 'multiple_choice': return 'linear-gradient(135deg, #2563EB, #1D4ED8)'
    case 'open_text': return 'linear-gradient(135deg, #2D3A8C, #1E40AF)'
    case 'word_cloud': return 'linear-gradient(135deg, #1e293b, #0f172a)'
    case 'rating_scale': return 'linear-gradient(135deg, #7C3AED, #6366F1)'
    case 'ranking': return 'linear-gradient(135deg, #4F46E5, #4338CA)'
    case 'image_choice': return 'linear-gradient(135deg, #0891B2, #0E7490)'
    case 'scale_100': return 'linear-gradient(135deg, #16A34A, #15803D)'
    case 'pinpoint': return 'linear-gradient(135deg, #9333EA, #7C3AED)'
    case 'grid_2x2': return 'linear-gradient(135deg, #0D9488, #0F766E)'
    case 'wheel': return 'linear-gradient(135deg, #F59E0B, #D97706)'
    case 'word_duel': return 'linear-gradient(135deg, #DC2626, #B91C1C)'
    case 'live_race': return 'linear-gradient(135deg, #B45309, #92400E)'
    case 'emoji_pulse': return 'linear-gradient(135deg, #0F1B3D, #1e3a5f)'
    case 'quick_fire': return 'linear-gradient(135deg, #EF4444, #DC2626)'
    case 'bullets': return 'linear-gradient(135deg, #F8FAFC, #F1F5F9)'
    case 'quote': return 'linear-gradient(135deg, #1e293b, #0f172a)'
    case 'video': return 'linear-gradient(135deg, #0f172a, #1e293b)'
    case 'image': return 'linear-gradient(135deg, #F3F4F6, #E5E7EB)'
  }
}

function getSlideTextColor(slide: Slide): string {
  if (slide.type === 'bullets' || slide.type === 'image') return '#0F1B3D'
  return '#fff'
}

// ─── Slide WYSIWYG preview (center panel) ─────────────────────────────────────

function SlidePreview({ slide }: { slide: Slide }) {
  const meta = SLIDE_TYPE_META[slide.type]
  const gradient = getSlideGradient(slide)
  const textColor = getSlideTextColor(slide)

  const getQuestionText = (): string => {
    switch (slide.type) {
      case 'title': return (slide as { heading: string }).heading || 'Title Slide'
      case 'bullets': return (slide as { heading: string }).heading || 'Key Points'
      case 'quote': return ''
      case 'video': return (slide as { caption: string }).caption || 'Video'
      case 'image': return (slide as { caption: string }).caption || 'Image Slide'
      case 'wheel': return (slide as { title: string }).title || 'Spin the Wheel'
      default: return (slide as { question?: string }).question || 'Your question here...'
    }
  }

  const renderVisualization = () => {
    switch (slide.type) {
      case 'title': return (
        <p className="text-sm opacity-60" style={{ color: textColor }}>
          {(slide as { subheading: string }).subheading || 'Subtitle goes here'}
        </p>
      )

      case 'multiple_choice':
      case 'quick_fire': {
        const opts = (slide as { options: string[] }).options
        const colors = ['#3B82F6', '#F59E0B', '#EF4444', '#10B981']
        return (
          <div className="w-4/5 grid grid-cols-2 gap-2">
            {opts.slice(0, 4).map((opt, i) => (
              <div key={i} className="rounded-lg px-3 py-2 text-xs font-bold truncate"
                style={{ background: `${colors[i]}30`, color: textColor, border: `1.5px solid ${colors[i]}60` }}>
                {opt || `Option ${['A', 'B', 'C', 'D'][i]}`}
              </div>
            ))}
          </div>
        )
      }

      case 'rating_scale': {
        const s = slide as { maxRating: number; minLabel: string; maxLabel: string }
        const heights = [20, 35, 60, 80, 45]
        return (
          <div className="w-4/5 flex flex-col items-center gap-2">
            <div className="flex items-end gap-1.5" style={{ height: 60 }}>
              {heights.slice(0, s.maxRating === 10 ? 5 : s.maxRating === 7 ? 5 : 5).map((h, i) => (
                <div key={i} className="rounded-t-md" style={{ width: 24, height: `${h}%`, background: `rgba(255,255,255,${0.2 + i * 0.15})` }} />
              ))}
            </div>
            <div className="flex justify-between w-full">
              <span className="text-[9px] opacity-50" style={{ color: textColor }}>{s.minLabel || 'Low'}</span>
              <span className="text-[9px] opacity-50" style={{ color: textColor }}>{s.maxLabel || 'High'}</span>
            </div>
          </div>
        )
      }

      case 'word_cloud': return (
        <div className="flex flex-wrap justify-center gap-2 w-4/5">
          {['Ideas', 'Creativity', 'Team', 'Growth', 'Vision', 'Focus'].map((w, i) => (
            <span key={i} className="font-bold opacity-70" style={{
              color: textColor, fontSize: [18, 14, 22, 12, 16, 10][i],
            }}>{w}</span>
          ))}
        </div>
      )

      case 'ranking': {
        const items = (slide as { items: string[] }).items
        return (
          <div className="w-4/5 space-y-1.5">
            {items.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{ background: `rgba(255,255,255,${0.15 - i * 0.03})` }}>
                <span className="text-xs font-black opacity-60" style={{ color: textColor }}>{i + 1}</span>
                <span className="text-xs font-semibold truncate" style={{ color: textColor }}>{item || `Item ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )
      }

      case 'scale_100': {
        const s = slide as { minLabel: string; maxLabel: string }
        return (
          <div className="w-4/5 space-y-2">
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full rounded-full" style={{ width: '65%', background: 'rgba(255,255,255,0.6)' }} />
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] opacity-50" style={{ color: textColor }}>{s.minLabel || '0'}</span>
              <span className="text-xs font-bold opacity-80" style={{ color: textColor }}>65</span>
              <span className="text-[9px] opacity-50" style={{ color: textColor }}>{s.maxLabel || '100'}</span>
            </div>
          </div>
        )
      }

      case 'grid_2x2': {
        const s = slide as { xLabel: string; yLabel: string; xMin: string; xMax: string; yMin: string; yMax: string }
        return (
          <div className="w-3/5 flex flex-col items-center">
            <span className="text-[8px] font-bold opacity-50 mb-1" style={{ color: textColor }}>{s.yMax || 'High'}</span>
            <div className="grid grid-cols-2 gap-0.5 w-full aspect-square">
              {[0.2, 0.15, 0.15, 0.2].map((op, i) => (
                <div key={i} className="rounded-sm" style={{ background: `rgba(255,255,255,${op})` }} />
              ))}
            </div>
            <div className="flex justify-between w-full mt-1">
              <span className="text-[8px] font-bold opacity-50" style={{ color: textColor }}>{s.xMin || 'Low'}</span>
              <span className="text-[8px] font-bold opacity-50" style={{ color: textColor }}>{s.xMax || 'High'}</span>
            </div>
          </div>
        )
      }

      case 'word_duel': {
        const s = slide as { optionA: string; optionB: string }
        return (
          <div className="w-4/5 flex items-center gap-3">
            <div className="flex-1 rounded-lg px-3 py-3 text-center text-sm font-bold"
              style={{ background: 'rgba(59,130,246,0.3)', color: textColor }}>
              {s.optionA || 'Side A'}
            </div>
            <span className="text-xs font-black opacity-40" style={{ color: textColor }}>VS</span>
            <div className="flex-1 rounded-lg px-3 py-3 text-center text-sm font-bold"
              style={{ background: 'rgba(239,68,68,0.3)', color: textColor }}>
              {s.optionB || 'Side B'}
            </div>
          </div>
        )
      }

      case 'live_race': {
        const opts = (slide as { options: string[] }).options
        return (
          <div className="w-4/5 space-y-2">
            {opts.slice(0, 4).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] font-bold truncate w-16 text-right opacity-60" style={{ color: textColor }}>{opt || `Option ${i + 1}`}</span>
                <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: `${[75, 50, 90, 30][i]}%`, background: `rgba(255,255,255,${0.5 - i * 0.1})` }} />
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'emoji_pulse': {
        const emojis = (slide as { emojis: string[] }).emojis
        return (
          <div className="flex gap-4">
            {emojis.map((em, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{em}</span>
                <span className="text-[9px] font-bold opacity-40" style={{ color: textColor }}>{[12, 8, 18, 5][i] ?? 0}</span>
              </div>
            ))}
          </div>
        )
      }

      case 'wheel': {
        const names = (slide as { names: string[] }).names
        const colors = ['#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']
        return (
          <div className="relative" style={{ width: 100, height: 100 }}>
            <div className="w-full h-full rounded-full overflow-hidden" style={{
              background: `conic-gradient(${names.map((_, i) => `${colors[i % 5]} ${(i / names.length) * 100}% ${((i + 1) / names.length) * 100}%`).join(', ')})`,
            }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </div>
          </div>
        )
      }

      case 'open_text': return (
        <div className="w-4/5 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)' }}>
          <span className="text-xs opacity-40" style={{ color: textColor }}>Audience responses will appear here...</span>
        </div>
      )

      case 'bullets': {
        const bullets = (slide as { bullets: string[] }).bullets
        return (
          <div className="w-4/5 space-y-2">
            {bullets.slice(0, 5).map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0F1B3D' }} />
                <span className="text-xs" style={{ color: textColor }}>{b || `Point ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )
      }

      case 'quote': {
        const s = slide as { quote: string; attribution: string }
        return (
          <div className="w-4/5 text-center space-y-3">
            <p className="text-lg font-bold italic leading-relaxed" style={{ color: textColor }}>
              &ldquo;{s.quote || 'Your quote here...'}&rdquo;
            </p>
            {s.attribution && (
              <p className="text-xs opacity-50" style={{ color: textColor }}>&mdash; {s.attribution}</p>
            )}
          </div>
        )
      }

      case 'video': return (
        <div className="w-3/5 aspect-video rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <svg viewBox="0 0 20 20" fill="white" className="w-6 h-6 ml-1"><path d="M6.5 4.5v11l9-5.5z"/></svg>
          </div>
        </div>
      )

      case 'image': {
        const url = (slide as { imageUrl: string }).imageUrl
        if (url) return <img src={url} alt="" className="max-w-[70%] max-h-[60%] rounded-lg object-contain" />
        return (
          <div className="w-3/5 aspect-video rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.08)', border: '1px dashed rgba(0,0,0,0.2)' }}>
            <span className="text-xs opacity-40" style={{ color: textColor }}>No image yet</span>
          </div>
        )
      }

      case 'pinpoint': {
        const url = (slide as { imageUrl?: string }).imageUrl
        return (
          <div className="w-3/5 aspect-video rounded-lg relative overflow-hidden"
            style={{ background: url ? undefined : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
            {url && <img src={url} alt="" className="w-full h-full object-cover" />}
            <div className="absolute" style={{ top: '30%', left: '40%', width: 10, height: 10, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff' }} />
            <div className="absolute" style={{ top: '55%', left: '60%', width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', border: '2px solid #fff' }} />
          </div>
        )
      }

      case 'image_choice': {
        const opts = (slide as { options: string[] }).options
        return (
          <div className="w-4/5 grid grid-cols-2 gap-2">
            {opts.slice(0, 4).map((opt, i) => (
              <div key={i} className="rounded-lg p-2 text-center"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div className="w-full aspect-square rounded-md mb-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-[9px] font-semibold truncate block" style={{ color: textColor }}>{opt || `Choice ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )
      }

      default: return null
    }
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden relative shadow-lg"
      style={{ background: gradient }}>
      {/* Question / heading */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 py-6 gap-4">
        {slide.type !== 'quote' && (
          <p className="text-lg font-bold text-center leading-snug" style={{ color: textColor, fontFamily: 'var(--font-heading)' }}>
            {getQuestionText()}
          </p>
        )}
        {renderVisualization()}
      </div>

      {/* Type badge */}
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
        style={{ background: meta.bg, color: meta.color }}>
        {meta.label}
      </div>

      {/* Join bar */}
      <div className="absolute bottom-0 inset-x-0 px-4 py-2 flex items-center justify-between"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}>
        <span className="text-[10px] font-bold opacity-70" style={{ color: '#fff' }}>quizotic.live &middot; Code: ----</span>
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <span className="text-[7px] font-bold text-white opacity-60">QR</span>
        </div>
      </div>
    </div>
  )
}

// ─── Slide editor fields per type ─────────────────────────────────────────────

function SlideEditor({ slide, onChange }: { slide: Slide; onChange: (s: Slide) => void }) {
  const update = (patch: Partial<Slide>) => onChange({ ...slide, ...patch } as Slide)

  const inputClass = "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]/20 transition-colors"
  const inputStyle = { borderColor: '#E2E8F0', color: '#1A0A2E', background: '#fff' }
  const labelClass = "block text-xs font-semibold mb-1.5"
  const labelStyle = { color: '#64748B' }

  switch (slide.type) {
    case 'multiple_choice': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Ask your audience..." />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Options</label>
          {slide.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: ['#3B82F6', '#0F1B3D', '#FF8A47', '#16A34A'][i] }}>
                {['A', 'B', 'C', 'D'][i]}
              </span>
              <input className={inputClass} style={inputStyle} value={opt}
                onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
                placeholder={`Option ${['A', 'B', 'C', 'D'][i]}`} />
            </div>
          ))}
        </div>
      </div>
    )

    case 'open_text': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={3} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="What's on your mind?" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Max characters per response</label>
          <input type="number" className={inputClass} style={inputStyle} value={slide.maxChars} min={50} max={500}
            onChange={e => update({ maxChars: Number(e.target.value) })} />
        </div>
      </div>
    )

    case 'word_cloud': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="What word comes to mind?" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Words per participant</label>
          <select className={inputClass} style={inputStyle} value={slide.maxWords}
            onChange={e => update({ maxWords: Number(e.target.value) })}>
            {[1, 2, 3].map(n => <option key={n} value={n}>{n} word{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
    )

    case 'rating_scale': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="How would you rate..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Low label</label>
            <input className={inputClass} style={inputStyle} value={slide.minLabel}
              onChange={e => update({ minLabel: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>High label</label>
            <input className={inputClass} style={inputStyle} value={slide.maxLabel}
              onChange={e => update({ maxLabel: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Scale</label>
          <select className={inputClass} style={inputStyle} value={slide.maxRating}
            onChange={e => update({ maxRating: Number(e.target.value) as 5 | 7 | 10 })}>
            <option value={5}>1-5 stars</option>
            <option value={7}>1-7 scale</option>
            <option value={10}>1-10 scale</option>
          </select>
        </div>
      </div>
    )

    case 'ranking': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Rank these items..." />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Items to rank</label>
          {slide.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: '#F3F4F6', color: '#0F1B3D' }}>{i + 1}</span>
              <input className={inputClass} style={inputStyle} value={item}
                onChange={e => { const items = [...slide.items]; items[i] = e.target.value; update({ items }) }}
                placeholder={`Item ${i + 1}`} />
              {slide.items.length > 2 && (
                <button type="button" onClick={() => update({ items: slide.items.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">x</button>
              )}
            </div>
          ))}
          {slide.items.length < 6 && (
            <button type="button"
              onClick={() => update({ items: [...slide.items, ''] })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#0F1B3D', background: '#F3F4F6' }}>
              + Add item
            </button>
          )}
        </div>
      </div>
    )

    case 'scale_100': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="On a scale of 0-100..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Left label (0)</label>
            <input className={inputClass} style={inputStyle} value={slide.minLabel}
              onChange={e => update({ minLabel: e.target.value })} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Right label (100)</label>
            <input className={inputClass} style={inputStyle} value={slide.maxLabel}
              onChange={e => update({ maxLabel: e.target.value })} />
          </div>
        </div>
      </div>
    )

    case 'word_duel': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Which side wins?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Option A</label>
            <input className={inputClass} style={{ ...inputStyle, borderColor: '#BFDBFE', background: '#EFF6FF' }}
              value={slide.optionA} onChange={e => update({ optionA: e.target.value })} placeholder="Side A" />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Option B</label>
            <input className={inputClass} style={{ ...inputStyle, borderColor: '#FECDD3', background: '#FFF1F2' }}
              value={slide.optionB} onChange={e => update({ optionB: e.target.value })} placeholder="Side B" />
          </div>
        </div>
      </div>
    )

    case 'live_race': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Which option wins?" />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Race options</label>
          {slide.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: ['#3B82F6', '#0F1B3D', '#FF8A47', '#16A34A', '#F59E0B'][i % 5] }} />
              <input className={inputClass} style={inputStyle} value={opt}
                onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
                placeholder={`Option ${i + 1}`} />
              {slide.options.length > 2 && (
                <button type="button" onClick={() => update({ options: slide.options.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">x</button>
              )}
            </div>
          ))}
          {slide.options.length < 5 && (
            <button type="button" onClick={() => update({ options: [...slide.options, ''] })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: '#0F1B3D', background: '#F3F4F6' }}>
              + Add option
            </button>
          )}
        </div>
      </div>
    )

    case 'emoji_pulse': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question / prompt</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="How are you feeling?" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Emoji options</label>
          <div className="flex gap-3 flex-wrap">
            {slide.emojis.map((em, i) => (
              <input key={i} className="text-center text-2xl border rounded-xl w-14 h-14 focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]/20"
                style={{ borderColor: '#E2E8F0' }}
                value={em} onChange={e => { const emojis = [...slide.emojis]; emojis[i] = e.target.value; update({ emojis }) }} />
            ))}
          </div>
        </div>
      </div>
    )

    case 'quick_fire': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Quick - vote fast!" />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Options</label>
          {slide.options.map((opt, i) => (
            <input key={i} className={inputClass} style={inputStyle} value={opt}
              onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
              placeholder={`Option ${i + 1}`} />
          ))}
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Time limit</label>
          <select className={inputClass} style={inputStyle} value={slide.durationSeconds}
            onChange={e => update({ durationSeconds: Number(e.target.value) })}>
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
            <option value={15}>15 seconds</option>
          </select>
        </div>
      </div>
    )

    case 'wheel': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Title</label>
          <input className={inputClass} style={inputStyle} value={slide.title}
            onChange={e => update({ title: e.target.value })} placeholder="Spin the wheel..." />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Names / options</label>
          {slide.names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={inputClass} style={inputStyle} value={name}
                onChange={e => { const names = [...slide.names]; names[i] = e.target.value; update({ names }) }}
                placeholder={`Name ${i + 1}`} />
              {slide.names.length > 2 && (
                <button type="button" onClick={() => update({ names: slide.names.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600">x</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => update({ names: [...slide.names, ''] })}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: '#0F1B3D', background: '#F3F4F6' }}>
            + Add name
          </button>
        </div>
      </div>
    )

    case 'title': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Heading</label>
          <input className={inputClass} style={inputStyle} value={slide.heading}
            onChange={e => update({ heading: e.target.value })} placeholder="Main title..." />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Subheading</label>
          <input className={inputClass} style={inputStyle} value={slide.subheading}
            onChange={e => update({ subheading: e.target.value })} placeholder="Subtitle or context..." />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Background color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={slide.bgColor} onChange={e => update({ bgColor: e.target.value })}
              className="w-10 h-10 rounded-lg border cursor-pointer" style={{ borderColor: '#E2E8F0' }} />
            <span className="text-sm font-mono" style={{ color: '#6B7280' }}>{slide.bgColor}</span>
          </div>
        </div>
      </div>
    )

    case 'bullets': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Heading</label>
          <input className={inputClass} style={inputStyle} value={slide.heading}
            onChange={e => update({ heading: e.target.value })} placeholder="Section title..." />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Bullet points</label>
          {slide.bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0F1B3D' }} />
              <input className={inputClass} style={inputStyle} value={b}
                onChange={e => { const bullets = [...slide.bullets]; bullets[i] = e.target.value; update({ bullets }) }}
                placeholder={`Point ${i + 1}`} />
              {slide.bullets.length > 1 && (
                <button type="button" onClick={() => update({ bullets: slide.bullets.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600">x</button>
              )}
            </div>
          ))}
          {slide.bullets.length < 8 && (
            <button type="button" onClick={() => update({ bullets: [...slide.bullets, ''] })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: '#0F1B3D', background: '#F3F4F6' }}>
              + Add bullet
            </button>
          )}
        </div>
      </div>
    )

    case 'quote': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Quote</label>
          <textarea className={inputClass} style={inputStyle} rows={4} value={slide.quote}
            onChange={e => update({ quote: e.target.value })} placeholder="Type the quote here..." />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Attribution</label>
          <input className={inputClass} style={inputStyle} value={slide.attribution}
            onChange={e => update({ attribution: e.target.value })} placeholder="- Author name" />
        </div>
      </div>
    )

    case 'video': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>YouTube / Vimeo URL</label>
          <input className={inputClass} style={inputStyle} value={slide.url}
            onChange={e => update({ url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Caption (optional)</label>
          <input className={inputClass} style={inputStyle} value={slide.caption}
            onChange={e => update({ caption: e.target.value })} placeholder="Context or topic..." />
        </div>
      </div>
    )

    case 'pinpoint': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Where on the image is...?" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Background image (optional)</label>
          <div className="flex gap-2">
            <input className={inputClass} style={{ ...inputStyle, flex: 1 }} value={slide.imageUrl?.startsWith('data:') ? '(uploaded image)' : slide.imageUrl ?? ''}
              onChange={e => update({ imageUrl: e.target.value || undefined })}
              placeholder="https://example.com/diagram.jpg"
              readOnly={slide.imageUrl?.startsWith('data:')} />
            <label className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all hover:scale-[1.02] flex items-center gap-1.5 flex-shrink-0"
              style={{ background: '#F3F4F6', color: '#0F1B3D', border: '1.5px solid #DBEAFE' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); return }
                const reader = new FileReader()
                reader.onload = () => update({ imageUrl: reader.result as string })
                reader.readAsDataURL(file)
                e.target.value = ''
              }} />
            </label>
            {slide.imageUrl && (
              <button onClick={() => update({ imageUrl: undefined })}
                className="px-3 py-2 rounded-lg text-sm font-bold transition-colors hover:bg-red-50 flex-shrink-0"
                style={{ color: '#EF4444', border: '1.5px solid #FCA5A5' }}>
                x
              </button>
            )}
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#9CA3AF' }}>
            Paste a URL or upload an image (max 2 MB). Leave blank for a plain canvas.
          </p>
        </div>
        {slide.imageUrl && (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E2E8F0' }}>
            <img src={slide.imageUrl} alt="Pinpoint background" className="w-full object-contain max-h-40" />
          </div>
        )}
      </div>
    )

    case 'grid_2x2': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question / prompt</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Place yourself on the grid..." />
        </div>
        <div className="space-y-3">
          <label className={labelClass} style={labelStyle}>Axis labels</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>X axis label</label>
              <input className={inputClass} style={inputStyle} value={slide.xLabel}
                onChange={e => update({ xLabel: e.target.value })} placeholder="e.g. Difficulty" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Y axis label</label>
              <input className={inputClass} style={inputStyle} value={slide.yLabel}
                onChange={e => update({ yLabel: e.target.value })} placeholder="e.g. Enjoyment" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>X left label</label>
              <input className={inputClass} style={inputStyle} value={slide.xMin}
                onChange={e => update({ xMin: e.target.value })} placeholder="Low" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>X right label</label>
              <input className={inputClass} style={inputStyle} value={slide.xMax}
                onChange={e => update({ xMax: e.target.value })} placeholder="High" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Y bottom label</label>
              <input className={inputClass} style={inputStyle} value={slide.yMin}
                onChange={e => update({ yMin: e.target.value })} placeholder="Low" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Y top label</label>
              <input className={inputClass} style={inputStyle} value={slide.yMax}
                onChange={e => update({ yMax: e.target.value })} placeholder="High" />
            </div>
          </div>
        </div>
      </div>
    )

    case 'image': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Image URL</label>
          <input className={inputClass} style={inputStyle} value={slide.imageUrl}
            onChange={e => update({ imageUrl: e.target.value })} placeholder="https://..." />
        </div>
        {slide.imageUrl && (
          <img src={slide.imageUrl} alt="" className="w-full rounded-xl border max-h-64 object-contain" style={{ borderColor: '#E2E8F0' }} />
        )}
        <div>
          <label className={labelClass} style={labelStyle}>Caption (optional)</label>
          <input className={inputClass} style={inputStyle} value={slide.caption}
            onChange={e => update({ caption: e.target.value })} placeholder="Slide title or context..." />
        </div>
      </div>
    )

    case 'image_choice': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Question</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="Pick the right image..." />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Options</label>
          {slide.options.map((opt, i) => (
            <input key={i} className={inputClass} style={inputStyle} value={opt}
              onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
              placeholder={`Option ${i + 1}`} />
          ))}
        </div>
      </div>
    )

    default: return (
      <div className="text-sm text-gray-400 text-center py-8">
        Editor for this slide type coming soon.
      </div>
    )
  }
}

// ─── Slide thumbnail (left panel) ─────────────────────────────────────────────

function SlideThumbnail({ slide, index, active, onClick }: {
  slide: Slide; index: number; active: boolean; onClick: () => void
}) {
  const meta = SLIDE_TYPE_META[slide.type]
  const gradient = getSlideGradient(slide)
  const textColor = getSlideTextColor(slide)

  const getLabel = () => {
    switch (slide.type) {
      case 'title': return (slide as { heading: string }).heading || 'Title Slide'
      case 'bullets': return (slide as { heading: string }).heading || 'Bullet Points'
      case 'quote': return (slide as { quote: string }).quote || 'Quote'
      case 'video': return 'Video'
      case 'image': return (slide as { caption?: string }).caption || 'Image'
      case 'wheel': return (slide as { title: string }).title || 'Wheel'
      default: return (slide as { question?: string }).question || meta.label
    }
  }

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl overflow-hidden transition-all group"
      style={{
        border: active ? `2px solid ${meta.color}` : '2px solid transparent',
        boxShadow: active ? `0 0 0 2px ${meta.color}30` : 'none',
      }}>
      {/* Mini 16:9 preview */}
      <div className="w-full aspect-video rounded-t-lg flex items-center justify-center px-2 py-1.5 relative"
        style={{ background: gradient }}>
        <p className="text-[9px] font-bold text-center leading-tight line-clamp-2" style={{ color: textColor }}>
          {getLabel()}
        </p>
        <span className="absolute top-1 left-1.5 text-[8px] font-black px-1 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.85)', color: '#0F1B3D' }}>
          {index + 1}
        </span>
        <span className="absolute bottom-1 right-1.5 text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
          style={{ background: meta.bg, color: meta.color }}>
          {meta.label.split(' ')[0]}
        </span>
      </div>
    </button>
  )
}

// ─── Slide type picker (dropdown) ─────────────────────────────────────────────

function SlideTypePicker({ onPick }: { onPick: (type: SlideType) => void }) {
  const allByCategory = SLIDE_CATEGORIES.map(cat => ({
    ...cat,
    types: (Object.keys(SLIDE_TYPE_META) as SlideType[]).filter(t => SLIDE_TYPE_META[t].category === cat.id),
  }))

  return (
    <div className="space-y-1">
      {allByCategory.map((cat, ci) => (
        <div key={cat.id}>
          {ci > 0 && <div className="h-px my-1.5" style={{ background: '#F3F4F6' }} />}
          <p className="text-[10px] font-black uppercase tracking-widest px-2 py-1" style={{ color: cat.color }}>
            {cat.label}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {cat.types.map(type => {
              const meta = SLIDE_TYPE_META[type]
              return (
                <button key={type} onClick={() => onPick(type)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all hover:scale-[1.02]"
                  style={{ background: meta.bg, color: meta.color }}>
                  <span className="flex-shrink-0">{SLIDE_ICONS[type]}</span>
                  <span className="text-[10px] font-semibold truncate">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function makePresentation(): Presentation {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Presentation',
    slides: [makeSlide('title')],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function PresentCreatePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [presentation, setPresentation] = useState<Presentation>(makePresentation)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pdfImporting, setPdfImporting] = useState(false)
  const [pdfProgress, setPdfProgress] = useState('')
  const [pdfCurrent, setPdfCurrent] = useState(0)
  const [pdfTotal, setPdfTotal] = useState(0)
  const [pdfImportedCount, setPdfImportedCount] = useState(0)
  const [addSlideOpen, setAddSlideOpen] = useState(false)
  const hasLoadedRef = useRef(false)
  const lastSavedRef = useRef(JSON.stringify(makePresentation()))
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const addSlideRef = useRef<HTMLDivElement>(null)

  // Load existing presentation when editing
  useEffect(() => {
    const editId = searchParams.get('id')
    if (editId) {
      try {
        const all = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
        const found = all.find((p: Presentation) => p.id === editId)
        if (found) { setPresentation(found); setActiveIndex(0); return }
      } catch { /* ignore */ }
    }
    const editFlag = searchParams.get('edit')
    if (editFlag === 'active') {
      try {
        const raw = localStorage.getItem('quizotic_active_presentation')
        if (raw) { setPresentation(JSON.parse(raw)); setActiveIndex(0) }
      } catch { /* ignore */ }
    }
  }, [searchParams])

  const activeSlide = presentation.slides[activeIndex] ?? null

  const updateSlide = useCallback((slide: Slide) => {
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides[activeIndex] = slide
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
  }, [activeIndex])

  function addSlide(type: SlideType, atIndex?: number) {
    const newSlide = makeSlide(type)
    const insertAt = atIndex ?? activeIndex + 1
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(insertAt, 0, newSlide)
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
    setActiveIndex(insertAt)
    setAddSlideOpen(false)
  }

  function deleteSlide(i: number) {
    if (presentation.slides.length <= 1) return
    setPresentation(prev => {
      const slides = prev.slides.filter((_, j) => j !== i)
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
    setActiveIndex(prev => Math.min(prev, presentation.slides.length - 2))
  }

  function moveSlide(from: number, direction: 'up' | 'down') {
    const to = direction === 'up' ? from - 1 : from + 1
    if (to < 0 || to >= presentation.slides.length) return
    setPresentation(prev => {
      const slides = [...prev.slides]
      ;[slides[from], slides[to]] = [slides[to], slides[from]]
      return { ...prev, slides }
    })
    setActiveIndex(to)
  }

  async function savePresentation() {
    setSaving(true)
    try {
      await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentation),
      })
      const existing = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
      const idx = existing.findIndex((p: Presentation) => p.id === presentation.id)
      if (idx >= 0) existing[idx] = presentation
      else existing.unshift(presentation)
      localStorage.setItem('quizotic_presentations', JSON.stringify(existing))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function startPresentation() {
    localStorage.setItem('quizotic_active_presentation', JSON.stringify(presentation))
    lastSavedRef.current = JSON.stringify(presentation)
    router.push('/host/present/session')
  }

  // Mark as loaded
  useEffect(() => {
    hasLoadedRef.current = true
    lastSavedRef.current = JSON.stringify(presentation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save with 3s debounce
  useEffect(() => {
    if (!hasLoadedRef.current) return
    if (JSON.stringify(presentation) === lastSavedRef.current) return
    const timer = setTimeout(() => {
      lastSavedRef.current = JSON.stringify(presentation)
      savePresentation()
    }, 3000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(presentation) !== lastSavedRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [presentation])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => Math.min(prev + 1, presentation.slides.length - 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [presentation.slides.length])

  // Auto-scroll sidebar
  useEffect(() => {
    if (!sidebarScrollRef.current) return
    const el = sidebarScrollRef.current.querySelector<HTMLElement>(`[data-slide-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  // Close Add Slide dropdown on click outside
  useEffect(() => {
    if (!addSlideOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (addSlideRef.current && !addSlideRef.current.contains(e.target as Node)) {
        setAddSlideOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [addSlideOpen])

  async function importPdf(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert('PDF must be under 10 MB')
      return
    }
    setPdfImporting(true)
    setPdfProgress('Loading PDF...')
    setPdfCurrent(0)
    setPdfTotal(0)

    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const pageCount = pdf.numPages

      if (pageCount > 50) {
        alert('PDF must have 50 pages or fewer')
        setPdfImporting(false)
        return
      }

      setPdfTotal(pageCount)
      const newSlides: Slide[] = []

      for (let i = 1; i <= pageCount; i++) {
        setPdfCurrent(i)
        setPdfProgress(`Rendering page ${i} of ${pageCount}`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2 })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvas, canvasContext: ctx, viewport }).promise

        const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85))

        setPdfProgress(`Uploading page ${i} of ${pageCount}`)
        const formData = new FormData()
        formData.append('file', blob, `page-${i}.jpg`)

        const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(err.error || `Failed to upload page ${i}`)
        }
        const { url } = await res.json()

        newSlides.push({
          id: crypto.randomUUID(),
          type: 'image' as const,
          imageUrl: url,
          caption: `Slide ${i}`,
        })
      }

      const insertAt = activeIndex + 1
      setPresentation(prev => {
        const slides = [...prev.slides]
        slides.splice(insertAt, 0, ...newSlides)
        return { ...prev, slides, updatedAt: new Date().toISOString() }
      })
      setActiveIndex(insertAt)
      setPdfImportedCount(prev => prev + pageCount)
      setPdfProgress('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF import failed')
    } finally {
      setPdfImporting(false)
      setPdfProgress('')
      setPdfCurrent(0)
      setPdfTotal(0)
    }
  }

  const interactiveCount = presentation.slides.filter(s => SLIDE_TYPE_META[s.type].hasAudienceInput).length

  return (
    <div className="h-screen flex flex-col" style={{ background: '#FAFBFC', fontFamily: 'var(--font-body)' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b" style={{ background: 'rgba(250,251,252,0.96)', backdropFilter: 'blur(8px)', borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-3 px-3 h-12 md:px-5 md:h-14">
          <button onClick={() => router.push('/host')}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-gray-100"
            style={{ color: '#9CA3AF' }}>
            <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-5 w-px" style={{ background: '#E2E8F0' }} />

          {/* Editable title */}
          <div className="flex-1 min-w-0">
            <input
              value={presentation.title}
              onChange={e => setPresentation(prev => ({ ...prev, title: e.target.value }))}
              className="w-full text-sm font-bold bg-transparent focus:outline-none"
              style={{ color: '#0F1B3D' }}
            />
            <p className="text-[11px]" style={{ color: '#94A3B8' }}>
              {presentation.slides.length} slide{presentation.slides.length !== 1 ? 's' : ''} &middot; {interactiveCount} interactive
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Auto-save indicator */}
            <span className="text-xs font-medium flex items-center gap-1.5 mr-1" style={{ color: saving ? '#0F1B3D' : saved ? '#16A34A' : 'transparent' }}>
              {saving && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#0F1B3D' }} />}
              {saving ? 'Saving...' : saved ? 'Saved' : ''}
            </span>
            <button onClick={savePresentation} disabled={saving}
              className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-xl border-2 transition-all disabled:opacity-50"
              style={{ borderColor: saved ? '#16A34A' : '#E2E8F0', color: saved ? '#16A34A' : '#0F1B3D', background: saved ? '#F0FDF4' : '#fff' }}>
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving
                </span>
              ) : saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={() => { savePresentation(); startPresentation() }}
              className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
              <span className="hidden sm:inline">Save & </span>Present
            </button>
          </div>
        </div>
      </header>

      {/* ── Body — 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Slide thumbnails + actions */}
        <div className="hidden md:flex w-52 flex-shrink-0 border-r flex-col" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>

          {/* Top action bar */}
          <div className="flex-shrink-0 border-b p-2.5 space-y-2" style={{ borderColor: '#E2E8F0' }}>
            {/* PDF Import */}
            {pdfImporting ? (
              <div className="rounded-xl border p-2.5" style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#0F1B3D' }}>{pdfProgress}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                  <div className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: pdfTotal > 0 ? `${(pdfCurrent / pdfTotal) * 100}%` : '0%', background: '#0F1B3D' }} />
                </div>
                <p className="text-[9px] mt-1 text-center" style={{ color: '#94A3B8' }}>
                  {pdfCurrent} of {pdfTotal} pages
                </p>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-[11px] cursor-pointer transition-all hover:scale-[1.02]"
                style={{ background: '#0F1B3D', color: '#fff' }}>
                <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
                  <path d="M10 3v10m0 0l-3-3m3 3l3-3M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {pdfImportedCount > 0 ? `Import PDF (${pdfImportedCount} added)` : 'Import PDF'}
                <input type="file" accept=".pdf" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) importPdf(file)
                    e.target.value = ''
                  }} />
              </label>
            )}

            {/* Add Slide dropdown */}
            <div className="relative" ref={addSlideRef}>
              <button onClick={() => setAddSlideOpen(o => !o)}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-[11px] transition-all hover:scale-[1.02]"
                style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #0F1B3D' }}>
                <span className="text-sm leading-none">+</span>
                Add Slide
              </button>
              {addSlideOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl p-2 max-h-80 overflow-y-auto z-50"
                  style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                  <SlideTypePicker onPick={(type) => addSlide(type)} />
                </div>
              )}
            </div>
          </div>

          {/* Scrollable slide list */}
          <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {presentation.slides.map((slide, i) => (
              <div key={slide.id} data-slide-index={i} className="relative group">
                <SlideThumbnail
                  slide={slide}
                  index={i}
                  active={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                />
                {/* Slide actions overlay */}
                {presentation.slides.length > 1 && (
                  <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {i > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 'up') }}
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-white/90 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-600"
                        style={{ color: '#64748B' }}>
                        ^
                      </button>
                    )}
                    {i < presentation.slides.length - 1 && (
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 'down') }}
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-white/90 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-600"
                        style={{ color: '#64748B' }}>
                        v
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteSlide(i) }}
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-white/90 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500"
                      style={{ color: '#94A3B8' }}>
                      x
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: WYSIWYG Preview */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto" style={{ background: '#E8ECF0' }}>
          {activeSlide ? (
            <div className="w-full max-w-2xl px-6 py-6">
              {/* Slide preview */}
              <SlidePreview slide={activeSlide} />

              {/* Slide controls */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                  disabled={activeIndex === 0}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #E2E8F0' }}
                  title="Previous slide">
                  &lsaquo;
                </button>
                <span className="text-sm font-bold px-4 py-2 rounded-xl"
                  style={{ background: '#0F1B3D', color: '#F5E642' }}>
                  Slide {activeIndex + 1} of {presentation.slides.length}
                </span>
                <button onClick={() => setActiveIndex(i => Math.min(i + 1, presentation.slides.length - 1))}
                  disabled={activeIndex === presentation.slides.length - 1}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #E2E8F0' }}
                  title="Next slide">
                  &rsaquo;
                </button>
              </div>

              {/* Slide type info */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="flex items-center justify-center w-5 h-5 rounded" style={{ color: SLIDE_TYPE_META[activeSlide.type].color }}>
                  {SLIDE_ICONS[activeSlide.type]}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#64748B' }}>
                  {SLIDE_TYPE_META[activeSlide.type].label}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: SLIDE_TYPE_META[activeSlide.type].hasAudienceInput ? '#ECFDF5' : '#F3F4F6',
                    color: SLIDE_TYPE_META[activeSlide.type].hasAudienceInput ? '#059669' : '#9CA3AF',
                  }}>
                  {SLIDE_TYPE_META[activeSlide.type].hasAudienceInput ? 'Interactive' : 'Display only'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Select a slide to preview</p>
          )}
        </div>

        {/* RIGHT: Editor panel */}
        <div className="hidden md:flex md:w-80 flex-shrink-0 border-l flex-col overflow-hidden" style={{ borderColor: '#E2E8F0', background: '#fff' }}>
          {activeSlide ? (
            <>
              {/* Editor header */}
              <div className="flex-shrink-0 border-b px-4 py-3" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg"
                    style={{ background: SLIDE_TYPE_META[activeSlide.type].bg, color: SLIDE_TYPE_META[activeSlide.type].color }}>
                    {SLIDE_ICONS[activeSlide.type]}
                  </span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                      {SLIDE_TYPE_META[activeSlide.type].label}
                    </p>
                    <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                      Slide {activeIndex + 1} &middot; Edit content below
                    </p>
                  </div>
                </div>
              </div>

              {/* Editor form */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <SlideEditor slide={activeSlide} onChange={updateSlide} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Select a slide to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom bar ── */}
      <div className="md:hidden flex-shrink-0 border-t flex items-center gap-2 px-3 py-2.5" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
            disabled={activeIndex === 0}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold disabled:opacity-30 transition-colors"
            style={{ color: '#0F1B3D', background: '#fff', border: '1.5px solid #E2E8F0' }}>
            &lsaquo;
          </button>
          <span className="text-sm font-bold px-2 py-2 rounded-xl text-center"
            style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #E2E8F0', minWidth: 56 }}>
            {activeIndex + 1}/{presentation.slides.length}
          </span>
          <button
            onClick={() => setActiveIndex(i => Math.min(i + 1, presentation.slides.length - 1))}
            disabled={activeIndex === presentation.slides.length - 1}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold disabled:opacity-30 transition-colors"
            style={{ color: '#0F1B3D', background: '#fff', border: '1.5px solid #E2E8F0' }}>
            &rsaquo;
          </button>
        </div>
        <div className="relative flex-1" ref={addSlideRef}>
          <button
            onClick={() => setAddSlideOpen(o => !o)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-sm transition-all"
            style={{ background: '#0F1B3D', color: '#fff' }}>
            <span>+</span> Add Slide
          </button>
          {addSlideOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border shadow-xl p-2 max-h-64 overflow-y-auto z-50"
              style={{ borderColor: '#E2E8F0', background: '#fff' }}>
              <SlideTypePicker onPick={(type) => addSlide(type)} />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default function PresentCreatePage() {
  return (
    <Suspense>
      <PresentCreatePageInner />
    </Suspense>
  )
}
