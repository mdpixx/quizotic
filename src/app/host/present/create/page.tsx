'use client'

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import {
  type Slide, type SlideType, type Presentation,
  SLIDE_TYPE_META, SLIDE_CATEGORIES, makeSlide, getSlideBg,
  getBgLuminance, getSlideTextColor,
} from '@/lib/presentation-types'
import QRCode from 'react-qr-code'
import { QuizThemePicker } from '@/components/host/QuizThemePicker'
import { getQuizTheme, type QuizThemeId } from '@/lib/quiz-themes'
import { EnhanceWithAI } from '@/components/EnhanceWithAI'
import { ImageUpload } from '@/components/ImageUpload'
import { SlideBgPicker } from '@/components/SlideBgPicker'
import { SlideImage } from '@/components/SlideImage'
import { draftKey, readDraft, writeDraft, clearDraft, formatDraftAge } from '@/lib/draft-storage'
import { useAutosave } from '@/lib/use-autosave'
import { resolveHostBackNavigation } from '@/lib/host-navigation'

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
  brainstorm: (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M10 2.5a5 5 0 00-3 9v1.5a1 1 0 001 1h4a1 1 0 001-1V11.5a5 5 0 00-3-9z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 17h4M8.5 14.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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


const SLIDE_TYPE_DESCRIPTIONS: Record<SlideType, string> = {
  multiple_choice: 'Audience picks one answer from up to 6 options. Show the correct answer live.',
  open_text: 'Audience types free-form responses. Great for collecting ideas or feedback.',
  brainstorm: 'Audience submits ideas as cards and upvotes the best ones — they reorder live.',
  word_cloud: 'Audience submits words that form a real-time word cloud on screen.',
  rating_scale: 'Audience rates on a scale (1-5, 1-7, or 1-10). Perfect for sentiment checks.',
  ranking: 'Audience ranks items in their preferred order. Compare group priorities.',
  image_choice: 'Like multiple choice but with images. Audience picks their favorite visual.',
  scale_100: 'Audience places a marker on a 0-100 slider. See where the group lands.',
  pinpoint: 'Audience taps a spot on an image. Ideal for "find the location" questions.',
  grid_2x2: 'Audience plots themselves on a 2-axis grid. Map opinions across two dimensions.',
  wheel: 'Spin a colorful wheel to pick a random name. Fun for raffles and icebreakers.',
  word_duel: 'Two options go head-to-head. Audience votes and watches the battle live.',
  live_race: 'Options race across the screen as votes come in. High energy and competitive.',
  emoji_pulse: 'Audience reacts with emojis in real-time. Gauge the room\'s vibe instantly.',
  quick_fire: 'Timed rapid-fire question. Audience must answer before the clock runs out.',
  title: 'A simple title slide with heading and subheading. Use to open or transition sections.',
  bullets: 'Display key points as a bullet list. Great for agendas and summaries.',
  quote: 'Feature a memorable quote with attribution. Sets the tone for a section.',
  video: 'Embed a video from YouTube or Vimeo. Play it right inside the presentation.',
  image: 'Display a full image with an optional caption. Perfect for visual storytelling.',
}

// ─── Gradient helpers for slide previews ──────────────────────────────────────

// Slide background resolution lives in `@/lib/presentation-types` so the
// editor preview, the live presenter view, and the participant view all paint
// the same color. See `getSlideBg` import above.
const getSlideGradient = getSlideBg

// Returns colors for visualization elements (bars, fills, tracks) that contrast with background
function getVizColors(slide: Slide): { track: string; fill: string; subtle: string } {
  const isLight = getBgLuminance(slide) > 0.5
  return isLight
    ? { track: '#E2E8F0', fill: '#0F1B3D', subtle: 'rgba(15,27,61,0.08)' }
    : { track: 'rgba(255,255,255,0.15)', fill: 'rgba(255,255,255,0.6)', subtle: 'rgba(255,255,255,0.1)' }
}

// ─── Slide WYSIWYG preview (center panel) ─────────────────────────────────────

function SlidePreview({ slide, plan }: { slide: Slide; plan?: 'free' | 'pro' }) {
  const meta = SLIDE_TYPE_META[slide.type]
  const gradient = getSlideGradient(slide)
  const textColor = getSlideTextColor(slide)
  const viz = getVizColors(slide)

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
      case 'title': return null

      case 'multiple_choice':
      case 'quick_fire': {
        const opts = (slide as { options: string[] }).options
        const barColors = ['#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#EC4899']
        return (
          <div className="w-full flex flex-col gap-1 h-full">
            <div className="w-full flex items-end gap-2 flex-1 min-h-0">
              {opts.slice(0, 6).map((_, i) => (
                <div key={i} className="flex-1 rounded-t-md transition-all"
                  style={{ height: 6, background: barColors[i % 6] }} />
              ))}
            </div>
            <div className="w-full flex gap-2 flex-shrink-0">
              {opts.slice(0, 6).map((opt, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[9px] font-semibold truncate block" style={{ color: '#475569' }}>
                    {opt || `Option ${i + 1}`}
                  </span>
                  <span className="text-[8px] font-bold" style={{ color: barColors[i % 6] }}>0</span>
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'rating_scale': {
        const s = slide as { question?: string; maxRating: number; minLabel: string; maxLabel: string }
        const stars = s.maxRating || 5
        return (
          <div className="w-full h-full flex flex-col gap-[1.2cqw] items-center justify-center text-center px-[2cqw]">
            <span className="font-bold leading-snug" style={{ color: '#0F1B3D', fontSize: 'clamp(14px, 2.2cqw, 30px)' }}>
              {s.question || 'How would you rate...'}
            </span>
            <div className="flex gap-[0.8cqw] mt-[0.5cqw]">
              {Array.from({ length: stars }).map((_, i) => (
                <span key={i} style={{ color: i < Math.round(stars * 0.6) ? '#F59E0B' : '#E2E8F0', fontSize: 'clamp(18px, 4cqw, 64px)', lineHeight: 1 }}>★</span>
              ))}
            </div>
            <div className="flex justify-between w-full mt-[0.8cqw]">
              <span className="font-semibold" style={{ color: '#94A3B8', fontSize: 'clamp(10px, 1.4cqw, 20px)' }}>{s.minLabel || '1'}</span>
              <span className="font-semibold" style={{ color: '#94A3B8', fontSize: 'clamp(10px, 1.4cqw, 20px)' }}>{s.maxLabel || String(stars)}</span>
            </div>
          </div>
        )
      }

      case 'word_cloud': {
        // Placeholder that visually reads as a word cloud — varied sizes,
        // interleaved so the biggest words sit near the middle, colours
        // cycling so the density of a real cloud is obvious.
        const wcWords = [
          { text: 'Team', weight: 1.0 },
          { text: 'Ideas', weight: 0.85 },
          { text: 'Creativity', weight: 0.78 },
          { text: 'Vision', weight: 0.7 },
          { text: 'Growth', weight: 0.62 },
          { text: 'Innovation', weight: 0.55 },
          { text: 'Focus', weight: 0.48 },
          { text: 'Leadership', weight: 0.42 },
          { text: 'Energy', weight: 0.38 },
          { text: 'Curious', weight: 0.34 },
          { text: 'Open', weight: 0.3 },
          { text: 'Bold', weight: 0.26 },
          { text: 'Playful', weight: 0.24 },
          { text: 'Honest', weight: 0.22 },
          { text: 'Kind', weight: 0.2 },
        ]
        const palette = ['#7C82FF', '#FF8A8A', '#5DB6E5', '#F4A582', '#B19CD9', '#FFB088', '#94B3D1', '#F2A9C0']
        // Interleave: biggest in middle, smaller toward the edges.
        const arranged: typeof wcWords = []
        const mid = Math.floor(wcWords.length / 2)
        wcWords.forEach((w, idx) => {
          const offset = idx % 2 === 0 ? idx / 2 : -Math.ceil(idx / 2)
          arranged[mid + offset] = w
        })
        return (
          <div className="flex flex-wrap items-center justify-center gap-x-[2cqw] gap-y-[0.6cqw] w-full h-full px-[2cqw] py-[1cqw]">
            {arranged.filter(Boolean).map((w, i) => (
              <span key={w.text} className="font-black leading-none" style={{
                color: palette[i % palette.length],
                fontSize: `clamp(10px, ${1.2 + w.weight * 5}cqw, 56px)`,
                fontFamily: 'var(--font-heading)',
                opacity: 0.55 + w.weight * 0.45,
              }}>{w.text}</span>
            ))}
          </div>
        )
      }

      case 'ranking': {
        const items = (slide as { items: string[] }).items
        const rankColors = ['#4F46E5', '#3B82F6', '#0891B2', '#10B981', '#F59E0B', '#EF4444']
        return (
          <div className="w-full h-full flex flex-col justify-center gap-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-bold w-5 text-right flex-shrink-0" style={{ color: '#94A3B8' }}>{i + 1}</span>
                <div className="flex-1 h-8 rounded-md overflow-hidden relative" style={{ background: '#F1F5F9' }}>
                  <div className="h-full rounded-md" style={{ width: 6, background: rankColors[i % 6] }} />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: '#0F1B3D' }}>
                    {item || `Item ${i + 1}`}
                  </span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: '#94A3B8' }}>0</span>
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'scale_100': {
        const s = slide as { minLabel: string; maxLabel: string }
        return (
          <div className="w-full space-y-2">
            <div className="h-4 rounded-full overflow-hidden" style={{ background: viz.track }}>
              <div className="h-full rounded-full" style={{ width: 6, background: viz.fill }} />
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] font-medium" style={{ color: textColor, opacity: 0.6 }}>{s.minLabel || '0'}</span>
              <span className="text-xs font-bold" style={{ color: textColor, opacity: 0.8 }}>0</span>
              <span className="text-[9px] font-medium" style={{ color: textColor, opacity: 0.6 }}>{s.maxLabel || '100'}</span>
            </div>
          </div>
        )
      }

      case 'grid_2x2': {
        const s = slide as { xLabel: string; yLabel: string; xMin: string; xMax: string; yMin: string; yMax: string }
        const quadColors = ['#3B82F620', '#10B98120', '#F59E0B20', '#EF444420']
        const quadBorders = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
        return (
          <div className="w-full h-full flex items-center justify-center p-2">
            <div className="flex items-stretch gap-3 h-full w-full">
              {/* Y axis label */}
              <div className="flex flex-col items-center justify-between py-2 flex-shrink-0" style={{ width: 40 }}>
                <span className="text-sm font-bold" style={{ color: '#64748B' }}>{s.yMax || 'High'}</span>
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: '#94A3B8', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{s.yLabel || 'Y Axis'}</span>
                <span className="text-sm font-bold" style={{ color: '#64748B' }}>{s.yMin || 'Low'}</span>
              </div>
              {/* Grid column takes all remaining space */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                  {quadColors.map((bg, i) => (
                    <div key={i} className="rounded-xl" style={{ background: bg, border: `2px solid ${quadBorders[i]}40` }} />
                  ))}
                </div>
                {/* X axis labels */}
                <div className="flex justify-between mt-2 px-1 flex-shrink-0">
                  <span className="text-sm font-bold" style={{ color: '#64748B' }}>{s.xMin || 'Low'}</span>
                  <span className="text-sm font-bold" style={{ color: '#94A3B8' }}>{s.xLabel || 'X Axis'}</span>
                  <span className="text-sm font-bold" style={{ color: '#64748B' }}>{s.xMax || 'High'}</span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      case 'word_duel': {
        const s = slide as { optionA: string; optionB: string }
        return (
          <div className="w-full flex items-center gap-4">
            <div className="flex-1 rounded-xl px-4 py-5 text-center text-base font-bold"
              style={{ background: 'rgba(59,130,246,0.15)', color: textColor, border: '2px solid rgba(59,130,246,0.3)' }}>
              {s.optionA || 'Side A'}
            </div>
            <span className="text-sm font-black opacity-40" style={{ color: textColor }}>VS</span>
            <div className="flex-1 rounded-xl px-4 py-5 text-center text-base font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: textColor, border: '2px solid rgba(239,68,68,0.3)' }}>
              {s.optionB || 'Side B'}
            </div>
          </div>
        )
      }

      case 'live_race': {
        const opts = (slide as { options: string[] }).options
        return (
          <div className="w-full h-full flex flex-col justify-center gap-3">
            {opts.slice(0, 4).map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold truncate w-24 text-right" style={{ color: textColor, opacity: 0.7 }}>
                  {opt || `Option ${i + 1}`}
                </span>
                <div className="flex-1 h-8 rounded-full overflow-hidden" style={{ background: viz.track }}>
                  <div className="h-full rounded-full" style={{ width: '8%', background: viz.fill }} />
                </div>
              </div>
            ))}
          </div>
        )
      }

      case 'emoji_pulse': {
        const emojis = (slide as { emojis: string[] }).emojis
        return (
          <div className="w-full flex justify-center gap-6">
            {emojis.map((em, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-4xl">{em}</span>
                <span className="text-xs font-bold opacity-40" style={{ color: textColor }}>0</span>
              </div>
            ))}
          </div>
        )
      }

      case 'wheel': {
        const names = (slide as { names: string[] }).names
        const colors = ['#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
              {/* Height-driven sizing keeps the wheel a circle that fits inside
                  the card — width-driven sizing overflowed tall on wide cards. */}
              <div className="relative" style={{ height: '92%', maxWidth: '100%', aspectRatio: '1' }}>
                <div className="w-full h-full rounded-full overflow-hidden shadow-lg" style={{
                  background: `conic-gradient(${names.map((_, i) => `${colors[i % 5]} ${(i / names.length) * 100}% ${((i + 1) / names.length) * 100}%`).join(', ')})`,
                }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-white shadow-md" />
                </div>
                {/* Spin pointer */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid #fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }} />
              </div>
            </div>
            {/* Name labels */}
            <div className="flex flex-wrap justify-center gap-1.5 w-full flex-shrink-0">
              {names.filter(n => n.trim()).map((name, i) => (
                <span key={i} className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: `${colors[i % 5]}20`, color: colors[i % 5] }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )
      }

      case 'open_text': {
        const sampleResponses = [
          { text: 'I think we should focus on innovation', color: '#3B82F6' },
          { text: 'Better collaboration tools', color: '#10B981' },
          { text: 'More training sessions', color: '#F59E0B' },
          { text: 'Remote work flexibility', color: '#8B5CF6' },
        ]
        return (
          <div className="w-full flex flex-wrap gap-2 justify-center">
            {sampleResponses.map((r, i) => (
              <div key={i} className="rounded-xl px-3 py-2 text-[10px] font-medium max-w-[45%]"
                style={{ background: `${r.color}12`, color: r.color, border: `1px solid ${r.color}30` }}>
                {r.text}
              </div>
            ))}
          </div>
        )
      }

      case 'brainstorm': {
        const sampleIdeas = [
          { text: 'Faster onboarding', votes: 12, color: '#7C3AED' },
          { text: 'Mentor program', votes: 8, color: '#3B82F6' },
          { text: 'Better docs', votes: 5, color: '#10B981' },
        ]
        return (
          <div className="w-full flex flex-wrap gap-2 justify-center">
            {sampleIdeas.map((idea, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-semibold"
                style={{ background: `${idea.color}12`, color: idea.color, border: `1px solid ${idea.color}30` }}>
                <span>▲ {idea.votes}</span>
                <span>{idea.text}</span>
              </div>
            ))}
          </div>
        )
      }

      case 'bullets': {
        const bullets = (slide as { bullets: string[] }).bullets
        return (
          <div className="w-full h-full flex flex-col justify-start gap-3">
            {bullets.slice(0, 6).map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full flex-shrink-0" style={{ background: textColor, opacity: 0.6 }} />
                <span className="text-base md:text-lg font-medium leading-snug" style={{ color: textColor }}>
                  {b || `Point ${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        )
      }

      case 'quote': {
        const s = slide as { quote: string; attribution: string }
        return (
          <div className="w-full text-center space-y-3">
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
        <div className="w-full max-h-full aspect-video rounded-lg overflow-hidden flex items-center justify-center"
          style={{ background: viz.subtle, boxShadow: `inset 0 0 0 1px ${viz.track}` }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: viz.track }}>
            <svg viewBox="0 0 20 20" fill={textColor} className="w-7 h-7 ml-1" style={{ opacity: 0.6 }}><path d="M6.5 4.5v11l9-5.5z"/></svg>
          </div>
        </div>
      )

      case 'image': {
        const url = (slide as { imageUrl: string }).imageUrl
        if (url) return (
          <img src={url} alt="" className="max-w-full max-h-full rounded-lg object-contain"
            loading="eager"
            onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
            style={{ opacity: 0, transition: 'opacity 0.3s ease' }} />
        )
        return (
          <div className="w-full max-h-full aspect-video rounded-lg overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.08)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }}>
            <span className="text-xs opacity-40" style={{ color: textColor }}>No image yet</span>
          </div>
        )
      }

      case 'pinpoint': {
        const url = (slide as { imageUrl?: string }).imageUrl
        if (!url) {
          return (
            <div className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-2 p-4 text-center"
              style={{ background: viz.subtle, border: `1.5px dashed ${viz.track}` }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" style={{ color: textColor, opacity: 0.35 }}>
                <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <circle cx="12" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <p className="text-[11px] font-semibold" style={{ color: textColor, opacity: 0.7 }}>Upload a background image</p>
              <p className="text-[10px]" style={{ color: textColor, opacity: 0.45 }}>Participants tap the image to drop their pin</p>
            </div>
          )
        }
        return (
          <div className="w-full h-full rounded-lg relative overflow-hidden flex items-center justify-center"
            style={{ background: '#000', border: `1px solid ${viz.track}` }}>
            <img src={url} alt="" className="max-w-full max-h-full object-contain" />
            <div className="absolute bottom-1 left-1 right-1 text-center px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <span className="text-[9px] font-semibold text-white">Participants tap to drop a pin</span>
            </div>
          </div>
        )
      }

      case 'image_choice': {
        const opts = (slide as { options: string[]; imageUrls?: string[] }).options
        const imgs = (slide as { imageUrls?: string[] }).imageUrls || []
        // Equal-share rows + items-stretch keeps every card the same size
        // regardless of image presence. Without this, an uploaded image
        // expands its row and the empty-placeholder row collapses.
        return (
          <div className="w-full grid grid-cols-2 gap-2.5 h-full" style={{ gridAutoRows: '1fr', alignItems: 'stretch' }}>
            {opts.slice(0, 6).map((opt, i) => (
              <div key={i} className="rounded-xl overflow-hidden flex flex-col"
                style={{ background: '#F8FAFC', border: '2px solid #94A3B8', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minHeight: 0 }}>
                <div className="flex-1 flex items-center justify-center overflow-hidden" style={{ background: '#E2E8F0', minHeight: 0 }}>
                  {imgs[i] ? (
                    <img src={imgs[i]} alt={opt || `Choice ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" style={{ opacity: 0.35 }}>
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#475569" strokeWidth="1.5"/>
                      <circle cx="8.5" cy="8.5" r="2" stroke="#475569" strokeWidth="1.5"/>
                      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="px-2 py-1.5 text-center flex-shrink-0" style={{ background: '#F8FAFC', borderTop: '1px solid #CBD5E1' }}>
                  <span className="text-[10px] font-bold truncate block" style={{ color: '#0F1B3D' }}>
                    {opt || `Choice ${i + 1}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      }

      default: return null
    }
  }

  const fullBleedSrc: string | undefined = (() => {
    const imageUrl = (slide as { imageUrl?: string }).imageUrl
    if (slide.type === 'image' && imageUrl) return imageUrl
    return undefined
  })()

  // PPTX-imported slides render at the image's natural aspect ratio — portrait
  // FAQ pages and landscape title slides both show in full without cropping.
  // Other slide types keep the 16:9 card.
  const cardClassName = fullBleedSrc
    ? 'w-full rounded-2xl overflow-hidden relative shadow-lg bg-white'
    : 'w-full aspect-video rounded-2xl overflow-hidden relative shadow-lg'
  const cardStyle: React.CSSProperties = fullBleedSrc
    ? { maxHeight: '82vh', background: '#ffffff', containerType: 'inline-size' }
    : { background: gradient, containerType: 'inline-size' }

  return (
    <div className={cardClassName} style={cardStyle}>

      {/* Full-bleed image path — renders at the image's natural aspect so
          portrait PPTX pages (multi-paragraph FAQ layouts) never crop. The
          parent maxHeight caps the card so 1-page posters don't dominate. */}
      {fullBleedSrc && (
        <img src={fullBleedSrc} alt={(slide as { caption?: string }).caption || ''}
          className="block w-full h-auto max-h-[82vh] object-contain" loading="eager" />
      )}
      {!fullBleedSrc && (
        <div className={`absolute inset-0 flex flex-col px-6${slide.type === 'title' ? ' justify-center items-center text-center gap-3' : ' py-5'}`}>
          {slide.type !== 'quote' && (
            <p
              className={`font-bold flex-shrink-0 break-words w-full${slide.type === 'title' ? ' text-center' : ' text-left pr-24'}`}
              style={{
                color: textColor,
                fontFamily: 'var(--font-heading)',
                fontSize: slide.type === 'title'
                  ? 'clamp(20px, 5cqw, 44px)'
                  : 'clamp(16px, 3.4cqw, 26px)',
                lineHeight: 1.15,
              } as React.CSSProperties}>
              {getQuestionText()}
            </p>
          )}

          {slide.type === 'title' && (
            <p className="text-sm opacity-60 flex-shrink-0" style={{ color: textColor }}>
              {(slide as { subheading: string }).subheading || 'Subtitle goes here'}
            </p>
          )}

          {slide.type !== 'title' && (() => {
            // Visualizations split into "fill" (need to stretch vertically) vs
            // "centered" (small by nature — center them in the available space).
            // Without this split, bullets / live_race / ranking render as
            // compact clumps centered in the card with empty space above and
            // below. See plan: claude-plans-quizotic-session-handover-hashed-crab.md
            const stretchTypes = new Set([
              'bullets', 'live_race', 'ranking', 'image_choice', 'pinpoint',
              'wheel', 'grid_2x2', 'leaderboard',
            ])
            const wrapperClass = stretchTypes.has(slide.type)
              ? 'flex-1 flex flex-col min-h-0 mt-3 items-stretch justify-start'
              : 'flex-1 flex items-center justify-center min-h-0 mt-3'
            return slide.contentImageUrl ? (
              <div className="flex-1 flex flex-col min-h-0 mt-3 gap-2">
                <div className="flex-[1.1] flex items-center justify-center min-h-0">
                  <img src={slide.contentImageUrl} alt="Content" className="max-w-full max-h-full rounded-lg object-contain" />
                </div>
                <div className={`flex-[1] min-h-0 flex flex-col ${stretchTypes.has(slide.type) ? 'items-stretch justify-start' : 'items-center justify-center'}`}>
                  {renderVisualization()}
                </div>
              </div>
            ) : (
              <div className={wrapperClass}>
                {renderVisualization()}
              </div>
            )
          })()}
        </div>
      )}

      {/* QR code overlay */}
      {slide.showQrCode && (
        <div className="absolute bottom-3 right-3 rounded-lg p-1.5 shadow-lg"
          style={{ background: '#fff' }}>
          <QRCode value="https://www.quizotic.live/join" size={56} level="L" />
          <p className="text-[6px] font-bold text-center mt-0.5" style={{ color: '#64748B' }}>Scan to join</p>
        </div>
      )}

      {/* Type badge — hidden on full-bleed image slides so it doesn't cover
          the page header/logo that the PPTX rendered into the image. */}
      {!fullBleedSrc && (
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
          style={{ background: meta.bg, color: meta.color }}>
          {meta.label}
        </div>
      )}

      {/* Join bar — watermark for free plan. Hidden on full-bleed image
          slides in the BUILDER preview so it doesn't cover the actual slide
          content (PPTX footer, page numbers). Still shows during live play. */}
      {plan !== 'pro' && !fullBleedSrc && (
        <div className="absolute bottom-0 inset-x-0 px-4 py-2 flex items-center justify-between"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}>
          <span className="text-[10px] font-bold opacity-70" style={{ color: '#fff' }}>quizotic.live &middot; Code: ----</span>
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span className="text-[7px] font-bold text-white opacity-60">QR</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Slide editor fields per type ─────────────────────────────────────────────

function SlideEditor({ slide, onChange }: { slide: Slide; onChange: (s: Slide) => void }) {
  const update = (patch: Partial<Slide>) => onChange({ ...slide, ...patch } as Slide)

  const inputClass = "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1B3D]/20 transition-colors hover:border-blue-300 cursor-text"
  const inputStyle = { borderColor: '#E2E8F0', color: '#1A0A2E', background: '#FAFBFC' }
  const labelClass = "block text-xs font-semibold mb-1.5"
  const labelStyle = { color: '#64748B' }

  switch (slide.type) {
    case 'multiple_choice': {
      const optColors = ['#3B82F6', '#0F1B3D', '#FF8A47', '#16A34A', '#8B5CF6', '#EC4899']
      const optLabels = ['A', 'B', 'C', 'D', 'E', 'F']
      return (
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
                  style={{ background: optColors[i % 6] }}>
                  {optLabels[i] ?? i + 1}
                </span>
                <input className={inputClass} style={inputStyle} value={opt}
                  onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
                  placeholder={`Option ${optLabels[i] ?? i + 1}`} />
                {slide.options.length > 2 && (
                  <button type="button" onClick={() => update({ options: slide.options.filter((_, j) => j !== i) })}
                    className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">x</button>
                )}
              </div>
            ))}
            {slide.options.length < 6 && (
              <button type="button"
                onClick={() => update({ options: [...slide.options, ''] })}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: '#0F1B3D', background: '#F3F4F6' }}>
                + Add option
              </button>
            )}
          </div>
          <div className="border-t pt-3 mt-1 space-y-2" style={{ borderColor: '#E2E8F0' }}>
            <label className={labelClass} style={labelStyle}>Correct answer (optional)</label>
            <div className="flex items-center gap-2 flex-wrap">
              {slide.options.map((_, i) => (
                <button key={i} type="button"
                  onClick={() => update({ correctIndex: i, showCorrect: true })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: slide.correctIndex === i ? '#16A34A' : '#F3F4F6',
                    color: slide.correctIndex === i ? '#fff' : '#374151',
                    border: `1.5px solid ${slide.correctIndex === i ? '#16A34A' : '#E2E8F0'}`,
                  }}>
                  {['A','B','C','D','E','F'][i]}
                </button>
              ))}
              <button type="button"
                onClick={() => update({ correctIndex: undefined, showCorrect: false })}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: !slide.showCorrect ? '#0F1B3D' : '#F3F4F6', color: !slide.showCorrect ? '#fff' : '#374151', border: '1.5px solid #E2E8F0' }}>
                None
              </button>
            </div>
            {slide.showCorrect && slide.correctIndex !== undefined && (
              <p className="text-xs" style={{ color: '#16A34A' }}>✓ Correct answer will be highlighted after reveal</p>
            )}
          </div>
        </div>
      )
    }

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

    case 'brainstorm': return (
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={labelStyle}>Prompt</label>
          <textarea className={inputClass} style={inputStyle} rows={3} value={slide.question}
            onChange={e => update({ question: e.target.value })} placeholder="What ideas should we explore?" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Category hint (optional)</label>
          <input className={inputClass} style={inputStyle} value={slide.category ?? ''}
            onChange={e => update({ category: e.target.value })} placeholder="e.g. Quick wins" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Max characters per idea</label>
          <input type="number" className={inputClass} style={inputStyle} value={slide.maxChars} min={20} max={200}
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
            onChange={e => update({ question: e.target.value })} placeholder="e.g. Tap where the Taj Mahal is on this map" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Background image <span className="text-red-500">*</span></label>
          <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>
            Required — participants tap this image to drop their pin. Use a map, diagram, photo, or chart.
          </p>
          <ImageUpload
            imageUrl={slide.imageUrl}
            onUpload={url => update({ imageUrl: url })}
            onRemove={() => update({ imageUrl: undefined })}
          />
          {!slide.imageUrl && (
            <p className="text-xs mt-2 font-semibold" style={{ color: '#EF4444' }}>
              Add an image — pinpoint needs something to pin.
            </p>
          )}
        </div>
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
          <label className={labelClass} style={labelStyle}>Image</label>
          <div className="flex gap-2">
            <input className={inputClass} style={{ ...inputStyle, flex: 1 }} value={slide.imageUrl}
              onChange={e => update({ imageUrl: e.target.value })} placeholder="Paste URL or upload →" />
            <label className="px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex-shrink-0"
              style={{ background: '#F3F4F6', color: '#0F1B3D', border: '1.5px solid #E2E8F0' }}>
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return
                const form = new FormData(); form.append('file', file)
                try {
                  const res = await fetch('/api/upload-image', { method: 'POST', body: form })
                  const data = await res.json()
                  if (data.success) update({ imageUrl: data.url })
                  else alert('Upload failed')
                } catch { alert('Upload failed') }
                e.target.value = ''
              }} />
            </label>
          </div>
        </div>
        {slide.imageUrl && (
          <SlideImage
            src={slide.imageUrl}
            alt=""
            className="w-full rounded-xl border max-h-64 object-contain"
            style={{ borderColor: '#E2E8F0' }}
            fallbackText={slide.caption || 'Image could not be loaded from the CDN. Check your network or re-upload.'}
          />
        )}
        <div>
          <label className={labelClass} style={labelStyle}>Caption (optional)</label>
          <input className={inputClass} style={inputStyle} value={slide.caption}
            onChange={e => update({ caption: e.target.value })} placeholder="Slide title or context..." />
        </div>
      </div>
    )

    case 'image_choice': {
      const imgUrls = slide.imageUrls || []
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass} style={labelStyle}>Question</label>
            <textarea className={inputClass} style={inputStyle} rows={2} value={slide.question}
              onChange={e => update({ question: e.target.value })} placeholder="Pick the right image..." />
          </div>
          <div className="space-y-3">
            <label className={labelClass} style={labelStyle}>Options</label>
            {slide.options.map((opt, i) => (
              <div key={i} className="rounded-xl p-2.5 space-y-2" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                {/* Image upload area */}
                {imgUrls[i] ? (
                  <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    <img src={imgUrls[i]} alt={opt} className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const urls = [...imgUrls]; urls[i] = ''; update({ imageUrls: urls })
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>x</button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-16 rounded-lg cursor-pointer transition-colors hover:bg-white"
                    style={{ border: '1.5px dashed #CBD5E1' }}>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" style={{ color: '#94A3B8' }}>
                        <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
                        <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M3 13l4-4 3 3 2.5-2.5L17 14" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[9px] font-semibold" style={{ color: '#94A3B8' }}>Upload image</span>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const form = new FormData()
                        form.append('file', file)
                        try {
                          const res = await fetch('/api/upload-image', { method: 'POST', body: form })
                          const data = await res.json()
                          if (data.success) {
                            const urls = [...imgUrls]
                            while (urls.length <= i) urls.push('')
                            urls[i] = data.url
                            update({ imageUrls: urls })
                          } else { alert(data.error || 'Upload failed') }
                        } catch { alert('Upload failed') }
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
                {/* Label input */}
                <div className="flex items-center gap-2">
                  <input className={inputClass} style={inputStyle} value={opt}
                    onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
                    placeholder={`Label ${i + 1}`} />
                  {slide.options.length > 2 && (
                    <button type="button" onClick={() => {
                      const opts = slide.options.filter((_, j) => j !== i)
                      const urls = imgUrls.filter((_, j) => j !== i)
                      update({ options: opts, imageUrls: urls })
                    }} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">x</button>
                  )}
                </div>
              </div>
            ))}
            {slide.options.length < 6 && (
              <button type="button"
                onClick={() => update({ options: [...slide.options, ''], imageUrls: [...imgUrls, ''] })}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: '#0F1B3D', background: '#F3F4F6' }}>
                + Add option
              </button>
            )}
          </div>
        </div>
      )
    }

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
      className="w-full text-left rounded-xl overflow-hidden transition-all group click-bounce-sm"
      style={{
        border: active ? `2px solid ${meta.color}` : '2px solid transparent',
        boxShadow: active ? `0 0 0 2px ${meta.color}30` : 'none',
      }}>
      {/* Mini 16:9 preview */}
      <div className="w-full aspect-video rounded-t-lg flex items-center justify-center px-2 py-1.5 relative overflow-hidden"
        style={{ background: gradient }}>
        {slide.type === 'image' && (slide as { imageUrl?: string }).imageUrl ? (
          <SlideImage
            src={(slide as { imageUrl: string }).imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            fallbackText={(slide as { caption?: string }).caption || `Slide ${index + 1}`}
          />
        ) : slide.contentImageUrl ? (
          <>
            <img src={slide.contentImageUrl} alt="" className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
            <p className="relative text-[9px] font-bold text-center leading-tight line-clamp-2 px-1 py-0.5 rounded" style={{ color: '#0F1B3D', background: 'rgba(255,255,255,0.8)' }}>
              {getLabel()}
            </p>
          </>
        ) : (
          <p className="text-[9px] font-bold text-center leading-tight line-clamp-2" style={{ color: textColor }}>
            {getLabel()}
          </p>
        )}
        <span className="absolute top-1 left-1.5 text-[8px] font-black px-1 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.85)', color: '#0F1B3D' }}>
          {index + 1}
        </span>
        {meta.hasAudienceInput && (
          <span
            aria-label="Interactive slide"
            title="Interactive slide"
            className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none"
          >
            <svg viewBox="0 0 20 20" fill="#FACC15" className="w-3.5 h-3.5 drop-shadow" aria-hidden>
              <path d="M10 0l3.09 6.26L20 7.18l-5 4.87 1.18 6.88L10 15.77l-6.18 3.16L5 11.05 0 7.18l6.91-1.13z" />
            </svg>
          </span>
        )}
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
  const [hoveredType, setHoveredType] = useState<SlideType | null>(null)
  const [showBeta, setShowBeta] = useState(false)

  const allByCategory = SLIDE_CATEGORIES.map(cat => {
    const allTypes = (Object.keys(SLIDE_TYPE_META) as SlideType[]).filter(t => SLIDE_TYPE_META[t].category === cat.id)
    const visibleTypes = allTypes.filter(t => showBeta || SLIDE_TYPE_META[t].status !== 'coming_soon')
    const readyCount = allTypes.filter(t => SLIDE_TYPE_META[t].status !== 'coming_soon').length
    return { ...cat, types: visibleTypes, readyCount }
  })

  const hoveredMeta = hoveredType ? SLIDE_TYPE_META[hoveredType] : null
  const hoveredCat = hoveredType ? SLIDE_CATEGORIES.find(c => c.id === hoveredMeta?.category) : null

  return (
    <div className="flex gap-0 min-h-[420px]">
      {/* Left panel — type list */}
      <div className="flex-1 overflow-y-auto pr-3 space-y-2">
        <label className="flex items-center gap-2 px-1 py-1 text-xs font-semibold cursor-pointer select-none" style={{ color: '#64748B' }}>
          <input
            type="checkbox"
            checked={showBeta}
            onChange={e => setShowBeta(e.target.checked)}
            className="w-3.5 h-3.5 cursor-pointer"
          />
          Show beta slides
        </label>
        {allByCategory.map((cat, ci) => (
          <div key={cat.id}>
            {ci > 0 && <div className="h-px my-2" style={{ background: '#E2E8F0' }} />}
            <p className="text-xs font-black uppercase tracking-widest px-1 py-1.5" style={{ color: cat.color }}>
              {cat.label} ({cat.readyCount})
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {cat.types.map(type => {
                const meta = SLIDE_TYPE_META[type]
                const isHovered = hoveredType === type
                const isBeta = meta.status === 'coming_soon' || meta.status === 'beta'
                return (
                  <button key={type} onClick={() => onPick(type)}
                    onMouseEnter={() => setHoveredType(type)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all hover:scale-[1.03] hover:shadow-md relative"
                    style={{
                      background: isHovered ? meta.color : meta.bg,
                      color: isHovered ? '#fff' : meta.color,
                      border: `1.5px solid ${isHovered ? meta.color : 'transparent'}`,
                    }}>
                    <span className="flex-shrink-0 [&>svg]:w-6 [&>svg]:h-6">{SLIDE_ICONS[type]}</span>
                    <span className="text-xs font-bold truncate">{meta.label}</span>
                    {isBeta && (
                      <span className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider"
                        style={{ background: isHovered ? '#fff' : meta.color, color: isHovered ? meta.color : '#fff' }}>
                        BETA
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Right panel — hover preview (hidden on mobile) */}
      <div className="hidden md:flex w-[280px] flex-shrink-0 border-l pl-4 flex-col items-center justify-center text-center"
        style={{ borderColor: '#E2E8F0' }}>
        {hoveredType && hoveredMeta ? (
          <div className="flex flex-col items-center gap-4 px-3 py-6 rounded-2xl w-full"
            style={{ background: hoveredMeta.bg }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center [&>svg]:w-10 [&>svg]:h-10"
              style={{ background: hoveredMeta.color, color: '#fff' }}>
              {SLIDE_ICONS[hoveredType]}
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: hoveredMeta.color, fontFamily: 'var(--font-heading)' }}>
                {hoveredMeta.label}
              </p>
              {hoveredCat && (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${hoveredCat.color}15`, color: hoveredCat.color }}>
                  {hoveredCat.label}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              {SLIDE_TYPE_DESCRIPTIONS[hoveredType]}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#F1F5F9' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" style={{ color: '#94A3B8' }}>
                <path d="M15 15l5 5M10 4a6 6 0 100 12 6 6 0 000-12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>
              Hover over a slide type to see what it does
            </p>
          </div>
        )}
      </div>
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

// ─── Pre-present validation helpers ──────────────────────────────────────────
// Treat these as "not really filled in yet" — either the initial empty state
// or the default hint text the editor shows on a fresh slide.
const EMPTY_HEADINGS = new Set(['', 'Title Slide'])
const EMPTY_PROMPTS = new Set(['', 'Question text...', 'Prompt text...'])
const GENERIC_PRESENTATION_TITLES = new Set(['', 'Untitled Presentation'])

// If the first title slide has no heading but the presentation itself has a
// real name, copy the presentation name into the heading. Returns the original
// object (same reference) when nothing needed patching, so callers can cheaply
// detect a no-op.
function autoFillTitleHeading(pres: Presentation): Presentation {
  const topTitle = (pres.title ?? '').trim()
  if (GENERIC_PRESENTATION_TITLES.has(topTitle)) return pres
  let patched = false
  const slides = pres.slides.map((s) => {
    if (patched || s.type !== 'title') return s
    const heading = (s.heading ?? '').trim()
    if (!EMPTY_HEADINGS.has(heading)) return s
    patched = true
    return { ...s, heading: topTitle }
  })
  if (!patched) return pres
  return { ...pres, slides, updatedAt: new Date().toISOString() }
}

// Return every slide that still looks unfilled, with a human-readable reason.
function findIncompleteSlides(pres: Presentation): {
  index: number; id: string; typeLabel: string; issue: string
}[] {
  const flagged: { index: number; id: string; typeLabel: string; issue: string }[] = []
  pres.slides.forEach((s, i) => {
    const typeLabel = SLIDE_TYPE_META[s.type].label
    const anyS = s as unknown as {
      question?: string; heading?: string; title?: string; quote?: string; caption?: string
      options?: string[]
    }
    // Pick the most relevant text field for this slide type and describe it in plain words.
    let promptField: 'question' | 'heading' | 'title' | 'quote' | 'caption' | null = null
    if (anyS.question !== undefined) promptField = 'question'
    else if (anyS.heading !== undefined) promptField = 'heading'
    else if (anyS.title !== undefined) promptField = 'title'
    else if (anyS.quote !== undefined) promptField = 'quote'
    else if (anyS.caption !== undefined) promptField = 'caption'

    if (promptField) {
      const value = (anyS[promptField] ?? '').trim()
      const isEmpty = promptField === 'heading' ? EMPTY_HEADINGS.has(value) : EMPTY_PROMPTS.has(value)
      if (isEmpty) {
        const fieldLabel = promptField === 'question' ? 'question text'
          : promptField === 'heading' ? 'heading'
          : promptField === 'title' ? 'title'
          : promptField === 'quote' ? 'quote text'
          : 'caption'
        flagged.push({ index: i, id: s.id, typeLabel, issue: `${fieldLabel} is empty` })
        return
      }
    }

    if (Array.isArray(anyS.options) && anyS.options.length > 0
      && anyS.options.every((o, idx) => {
        const v = (o ?? '').trim()
        return v === '' || v === `Option ${idx + 1}` || v === 'Option 1'
      })) {
      flagged.push({ index: i, id: s.id, typeLabel, issue: 'answer options are still the defaults' })
    }
  })
  return flagged
}

function PresentCreatePageInner() {
  const router = useRouter()
  const [presentation, setPresentation] = useState<Presentation>(makePresentation)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [planLimitBlocked, setPlanLimitBlocked] = useState<string | null>(null) // message from API when 403 on save
  const [starting, setStarting] = useState(false)
  const [incompletePrompt, setIncompletePrompt] = useState<{
    slides: { index: number; id: string; typeLabel: string; issue: string }[]
    patched: Presentation
  } | null>(null)
  const [pptxImporting, setPptxImporting] = useState(false)
  const [pptxProgress, setPptxProgress] = useState('')
  const [pptxPercent, setPptxPercent] = useState(0)
  const [pptxImportedCount, setPptxImportedCount] = useState(0)
  // Dismissible PPT import banner — surfaces the hidden feature to fresh users.
  // Persists dismissal so we don't nag repeat visitors.
  const [pptBannerDismissed, setPptBannerDismissed] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('quizotic-ppt-banner-dismissed') === 'true') {
      setPptBannerDismissed(true)
    }
  }, [])
  const [enhanceOpen, setEnhanceOpen] = useState(false)
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false)
  const [addSlideOpen, setAddSlideOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [mobileSlideEditorOpen, setMobileSlideEditorOpen] = useState(false)
  const [mobileSlidesOpen, setMobileSlidesOpen] = useState(false)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [recoveredDraft, setRecoveredDraft] = useState<{ savedAt: number } | null>(null)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  // Tracks the initial load for `?id=xxx` editing — used to show a proper
  // spinner + inline error instead of silently rendering a blank new
  // presentation when server fetch fails (e.g. fresh browser, offline tab).
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null)
  const editIdRef = useRef<string>('')
  const hasLoadedRef = useRef(false)
  const lastSavedRef = useRef(JSON.stringify(makePresentation()))
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  // Blocks autosave (and suppresses its error toast) while PPTX import is in flight.
  // One explicit post-import save runs in importPptx's finally — so genuine errors still surface then.
  const importingRef = useRef(false)
  // Tracks the in-flight save fetch so a newer save (or unmount) can cancel
  // the older one. Without this, rapid edits stack up parallel requests
  // racing each other on classroom Wi-Fi, which surfaces as "Failed to fetch"
  // toasts that never clear.
  const saveAbortRef = useRef<AbortController | null>(null)
  // Stable ref to the current presentation id so autosave can write the draft key.
  // Pre-mint for new presentations so the hook has a key before the first save.
  const presentationIdRef = useRef<string>('')
  if (!presentationIdRef.current) {
    presentationIdRef.current = typeof crypto !== 'undefined' ? crypto.randomUUID() : `tmp-${Date.now()}`
  }
  const closePresentationCreateFlow = useCallback(() => {
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null
    const nav = resolveHostBackNavigation({
      returnTo: params?.get('returnTo') ?? null,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      fallback: editIdRef.current ? '/host/presentations' : '/host',
    })
    if (nav.kind === 'back') router.back()
    else router.push(nav.href)
  }, [router])

  // Load existing presentation when editing — runs ONCE on mount only.
  // Reading searchParams imperatively here avoids subscribing to the param as
  // a dep, which would re-run this effect on every Next.js re-render and
  // overwrite unsaved in-memory edits with the stale localStorage snapshot.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('id')
    if (editId) {
      const dk = draftKey('presentation', editId)
      const draft = readDraft<Presentation>(dk)

      // Try to get the cached copy from localStorage
      let localSaved: Presentation | undefined
      try {
        const all = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
        localSaved = all.find((p: Presentation) => p.id === editId) as Presentation | undefined
      } catch { /* ignore */ }

      // A local draft that is newer than the cached copy takes priority
      if (draft && (!localSaved || draft.savedAt > new Date(localSaved.updatedAt).getTime())) {
        setPresentation(draft.value)
        setRecoveredDraft({ savedAt: draft.savedAt })
        setActiveIndex(0)
        return
      }
      if (localSaved) {
        setPresentation(localSaved)
        setActiveIndex(0)
        // Also fetch from server in background to sync latest updatedAt
        fetch(`/api/presentations/${editId}`)
          .then(r => r.ok ? r.json() : null)
          .then((d: { success: boolean; data?: Presentation } | null) => {
            if (!d?.success || !d.data) return
            const serverPresentation = d.data
            const serverTime = new Date(serverPresentation.updatedAt).getTime()
            const localTime = localSaved ? new Date(localSaved.updatedAt).getTime() : 0
            // Only adopt server copy if it is strictly newer (another tab/device saved it)
            if (serverTime > localTime) {
              setPresentation(serverPresentation)
              const existing = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
              const idx = existing.findIndex((p: Presentation) => p.id === serverPresentation.id)
              if (idx >= 0) existing[idx] = serverPresentation
              else existing.unshift(serverPresentation)
              localStorage.setItem('quizotic_presentations', JSON.stringify(existing))
            }
          })
          .catch(() => {})
        return
      }
      // Nothing in localStorage — fetch from server directly
      editIdRef.current = editId
      setLoadState('loading')
      fetch(`/api/presentations/${editId}`)
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json() as Promise<{ success: boolean; data?: Presentation; error?: string }>
        })
        .then(d => {
          if (!d.success || !d.data) {
            throw new Error(d.error || 'Presentation not found')
          }
          setPresentation(d.data!)
          setActiveIndex(0)
          setLoadState('idle')
          try {
            const existing = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
            existing.unshift(d.data)
            localStorage.setItem('quizotic_presentations', JSON.stringify(existing))
          } catch { /* ignore */ }
        })
        .catch(err => {
          // If we have a local draft, prefer recovering from it over showing an error.
          if (draft) {
            setPresentation(draft.value)
            setRecoveredDraft({ savedAt: draft.savedAt })
            setActiveIndex(0)
            setLoadState('idle')
            return
          }
          setLoadErrorMsg(err instanceof Error ? err.message : 'Failed to load presentation')
          setLoadState('error')
        })
      return
    }
    const editFlag = params.get('edit')
    if (editFlag === 'active') {
      try {
        const raw = localStorage.getItem('quizotic_active_presentation')
        if (raw) { setPresentation(JSON.parse(raw)); setActiveIndex(0) }
      } catch { /* ignore */ }
    }
  }, []) // intentionally empty — one-shot load on mount

  useEffect(() => {
    fetch('/api/billing/status').then(r => r.json()).then(d => {
      if (d.plan === 'pro') setPlan('pro')
    }).catch(() => {})
  }, [])

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
      setActiveIndex(a => Math.min(a, slides.length - 1))
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
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

  function duplicateSlide(i: number) {
    const copy = { ...JSON.parse(JSON.stringify(presentation.slides[i])), id: crypto.randomUUID() }
    setPresentation(prev => {
      const slides = [...prev.slides]
      slides.splice(i + 1, 0, copy)
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
    setActiveIndex(i + 1)
  }

  async function savePresentation(isManual = false): Promise<boolean> {
    // Skip entirely if already blocked by plan limit — prevents autosave retry loop on 403
    if (planLimitBlocked) return true
    if (isManual) setSaving(true)
    setSaveError(null)
    // Coerce empty title to the default so the server's "title is required"
    // validator never trips when the user clears the field mid-edit.
    const payload = {
      ...presentation,
      title: presentation.title.trim() || 'Untitled Presentation',
    }
    // Write crash-safe draft FIRST (synchronous, always succeeds).
    // This ensures a refresh can recover work even if the API call fails.
    const dk = draftKey('presentation', presentation.id)
    writeDraft(dk, payload)

    // Cancel any save still in flight from a previous edit. On classroom
    // Wi-Fi, rapid edits would otherwise stack up parallel requests racing
    // each other; the slowest one's "Failed to fetch" surfaces as a toast.
    saveAbortRef.current?.abort()
    const controller = new AbortController()
    saveAbortRef.current = controller
    // 30s wall-clock cap. Cloudflare's edge timeout is ~100s, but anything
    // over 30s on save is almost certainly hung — fail fast and let the
    // hook's retry loop kick in instead of leaving the user staring at
    // a spinner.
    const timeoutId = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 30_000)

    try {
      const res = await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const json = await res.json() as { success: boolean; data?: Presentation; error?: string }
      if (res.status === 403) {
        // Plan-limit hit — stop autosave loop, surface upgrade modal
        setPlanLimitBlocked(json.error ?? 'You have exceeded your plan limit.')
        return true // return true so useAutosave does NOT retry
      }
      if (!res.ok || !json.success) throw new Error(json.error ?? `Save failed (${res.status})`)
      // Adopt server-returned id/timestamps so future autosaves update the correct row
      if (json.data) {
        setPresentation(prev => {
          if (prev.id === json.data!.id && prev.updatedAt === json.data!.updatedAt) return prev
          return { ...prev, id: json.data!.id, updatedAt: json.data!.updatedAt }
        })
        const saved = json.data
        const existing = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
        const idx = existing.findIndex((p: Presentation) => p.id === saved.id)
        if (idx >= 0) existing[idx] = saved
        else existing.unshift(saved)
        localStorage.setItem('quizotic_presentations', JSON.stringify(existing))
      }
      // Server save succeeded — draft is no longer needed
      clearDraft(dk)
      setRecoveredDraft(null)
      // Manual save: show "Saved" confirmation. Autosave stays silent — the button
      // does not flip text or color, matching Notion/Canva's background-save UX.
      if (isManual) setSaved(true)
      return true
    } catch (err: unknown) {
      // Aborted by a newer save — not an error, just stale. The newer save
      // owns the result; pretend success so the autosave hook doesn't retry.
      if (err instanceof DOMException && err.name === 'AbortError' && saveAbortRef.current !== controller) {
        return true
      }
      // Translate the opaque "Failed to fetch" / TimeoutError into something
      // a user can act on. Network errors are the dominant failure mode on
      // classroom Wi-Fi; saying so + reassuring them their work is local
      // is far more useful than the raw browser string.
      let msg: string
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        msg = 'Server took too long to respond. Your work is saved on this device — we\'ll keep retrying.'
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        msg = 'Save was interrupted. Your work is saved on this device — we\'ll keep retrying.'
      } else if (err instanceof TypeError) {
        // Browser fetch throws TypeError for network failures (offline, DNS,
        // CORS, dropped connection). Almost always a connectivity issue.
        msg = 'Couldn\'t reach the server — check your connection. Your work is saved on this device.'
      } else {
        msg = err instanceof Error ? err.message : 'Save failed'
      }
      // Suppress the error toast for autosaves that race with an ongoing PPTX import —
      // those transient failures clear themselves when the post-import manual save runs.
      if (importingRef.current && !isManual) {
        console.warn('[autosave suppressed during import]', msg)
      } else {
        setSaveError(msg)
      }
      return false
    } finally {
      clearTimeout(timeoutId)
      if (saveAbortRef.current === controller) saveAbortRef.current = null
      if (isManual) setSaving(false)
    }
  }

  function startPresentation() {
    // Step 1: silently auto-fill empty title-slide heading with the presentation name
    const patched = autoFillTitleHeading(presentation)
    if (patched !== presentation) {
      setPresentation(patched)
    }

    // Step 2: scan the (patched) slides for anything still incomplete and ask the user
    const incompletes = findIncompleteSlides(patched)
    if (incompletes.length > 0) {
      setIncompletePrompt({ slides: incompletes, patched })
      return
    }

    // Step 3: all good — persist the patched copy for the live session and go
    launchSession(patched)
  }

  function launchSession(pres: Presentation) {
    localStorage.setItem('quizotic_active_presentation', JSON.stringify(pres))
    lastSavedRef.current = JSON.stringify(pres)
    clearDraft(draftKey('presentation', pres.id))
    router.push('/host/present/session')
  }

  async function handleSaveAndPresent() {
    if (starting) return
    setStarting(true)
    try {
      await savePresentation()
      startPresentation()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      if (typeof window !== 'undefined') window.alert(msg)
    } finally {
      setStarting(false)
    }
  }

  // Mark as loaded and track presentation id for draft writes
  useEffect(() => {
    hasLoadedRef.current = true
    lastSavedRef.current = JSON.stringify(presentation)
    presentationIdRef.current = presentation.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep id ref in sync when presentation changes (e.g. after load)
  useEffect(() => {
    presentationIdRef.current = presentation.id
  }, [presentation.id])

  // Sync title to the live session (if any) on 500ms debounce.
  // The session page reads `quizotic_active_presentation` from localStorage;
  // we keep it in sync so the live header reflects title edits. We also emit
  // a `storage` event so any open session tab picks it up immediately.
  useEffect(() => {
    if (!hasLoadedRef.current) return
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem('quizotic_active_presentation')
        if (!raw) return // session not live
        const active = JSON.parse(raw)
        if (active?.id !== presentation.id) return
        if (active.title === presentation.title) return
        const next = { ...active, title: presentation.title }
        localStorage.setItem('quizotic_active_presentation', JSON.stringify(next))
      } catch { /* ignore */ }
    }, 500)
    return () => clearTimeout(timer)
  }, [presentation.title, presentation.id])

  // Auto-save with 5s debounce (matches Notion/Canva). Returns false on failure → hook retries.
  // Changed from 3s to 5s to reduce flashing and server load; the localStorage draft layer
  // still fires on every change so a crash loses 0 data regardless.
  useAutosave(presentation, (snap) => {
    if (!hasLoadedRef.current) return
    if (importingRef.current) return
    if (JSON.stringify(snap) === lastSavedRef.current) return
    lastSavedRef.current = JSON.stringify(snap)
    // Silent autosave — no button state flipping. Errors still surface via saveError.
    return savePresentation(false)
  }, { delayMs: 5000 })

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

  // The keyboard effect below only re-binds when slides.length changes, so it
  // must reach savePresentation through a ref to avoid saving a stale snapshot.
  const savePresentationRef = useRef(savePresentation)
  useEffect(() => { savePresentationRef.current = savePresentation })

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S works everywhere — including inside inputs — and replaces
      // the browser's save-page dialog with a manual save.
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void savePresentationRef.current(true)
        return
      }
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



  async function importPptx(file: File) {
    if (file.size > 20 * 1024 * 1024) { alert('File must be under 20 MB'); return }
    setPptxImporting(true)
    setPptxPercent(5)
    setPptxProgress('Uploading file...')
    importingRef.current = true
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Server does: slide-count pre-check (instant) → LibreOffice PDF
      // conversion (5-30s) → PDF→PNG rendering (10-60s) → R2 uploads (5-20s).
      // We can't stream real progress without SSE, so walk the user through
      // phased messages that match roughly when each phase would complete on
      // typical connections.
      setPptxPercent(10)
      setPptxProgress('Converting slides to images…')
      const phase2At = setTimeout(() => {
        setPptxProgress('Rendering slides (larger decks take a bit longer)…')
      }, 8_000)
      const phase3At = setTimeout(() => {
        setPptxProgress('Uploading images…')
      }, 30_000)
      const progressTimer = setInterval(() => {
        setPptxPercent(prev => Math.min(prev + 2, 85))
      }, 1500)

      const res = await fetch('/api/parse-pptx', { method: 'POST', body: formData })
      clearInterval(progressTimer)
      clearTimeout(phase2At)
      clearTimeout(phase3At)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(err.error || 'PPTX import failed')
      }
      setPptxPercent(90)
      setPptxProgress('Loading slides...')
      type MappedPptxSlide =
        | { suggestedType: 'image'; imageUrl: string; caption: string; aiContext?: string; originalIndex: number }
        | { suggestedType: 'bullets'; heading: string; bullets: string[]; aiContext?: string; originalIndex: number }
      const { slides: mappedSlides, title } = await res.json() as {
        slides: MappedPptxSlide[]
        title?: string
      }
      setPptxPercent(95)
      setPptxProgress(`Creating ${mappedSlides.length} slides...`)

      const newSlides: Slide[] = mappedSlides.map(ms => {
        if (ms.suggestedType === 'bullets') {
          return {
            id: crypto.randomUUID(),
            type: 'bullets' as const,
            heading: ms.heading,
            bullets: ms.bullets,
            ...(ms.aiContext ? { _aiContext: ms.aiContext } : {}),
          } as Slide
        }
        return {
          id: crypto.randomUUID(),
          type: 'image' as const,
          imageUrl: ms.imageUrl,
          caption: ms.caption,
          ...(ms.aiContext ? { _aiContext: ms.aiContext } : {}),
        } as Slide
      })

      const insertAt = activeIndex + 1
      setPresentation(prev => {
        const slides = [...prev.slides]
        slides.splice(insertAt, 0, ...newSlides)
        // Truncate imported title defensively in case a mashed title slipped through
        const cleanTitle = title ? title.slice(0, 80).trim() : undefined
        const newTitle = cleanTitle && prev.title === 'Untitled Presentation' ? cleanTitle : prev.title
        return { ...prev, title: newTitle, slides, updatedAt: new Date().toISOString() }
      })
      setActiveIndex(insertAt)
      setPptxImportedCount(prev => prev + newSlides.length)
      // Prompt to enhance with AI after import
      if (newSlides.length >= 3) setShowEnhancePrompt(true)
      setPptxPercent(100)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PPTX import failed')
    } finally {
      setPptxImporting(false)
      setPptxProgress('')
      setPptxPercent(0)
      // Release the guard, then do ONE explicit save. Any genuine persistence error
      // surfaces normally via setSaveError (isManual=false but importingRef is now false).
      importingRef.current = false
      void savePresentation(false)
    }
  }

  function handleEnhanceComplete(results: { afterIndex: number; slide: Slide; keepOriginal: boolean }[]) {
    setPresentation(prev => {
      const slides = [...prev.slides]
      const sorted = [...results].sort((a, b) => b.afterIndex - a.afterIndex)
      for (const { afterIndex, slide, keepOriginal } of sorted) {
        if (!keepOriginal) {
          slides.splice(afterIndex, 1, slide)
        } else {
          slides.splice(afterIndex + 1, 0, slide)
        }
      }
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
    setEnhanceOpen(false)
    setShowEnhancePrompt(false)
  }

  const interactiveCount = presentation.slides.filter(s => SLIDE_TYPE_META[s.type].hasAudienceInput).length
  const hasPptxContent = presentation.slides.some(s => {
    const ctx = (s as unknown as Record<string, unknown>)._aiContext
    return typeof ctx === 'string' && ctx.length > 20
  })

  // ── Presentation load states — show spinner / error overlay before the
  // editor UI so users don't stare at a blank canvas when the fetch fails.
  if (loadState === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#FAFBFC' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
            style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>Loading presentation…</p>
        </div>
      </div>
    )
  }

  if (loadState === 'error') {
    const retry = () => {
      const id = editIdRef.current
      if (!id) { router.push('/host'); return }
      setLoadState('loading')
      setLoadErrorMsg(null)
      fetch(`/api/presentations/${id}`)
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json() as Promise<{ success: boolean; data?: Presentation; error?: string }>
        })
        .then(d => {
          if (!d.success || !d.data) throw new Error(d.error || 'Presentation not found')
          setPresentation(d.data!)
          setActiveIndex(0)
          setLoadState('idle')
        })
        .catch(err => {
          setLoadErrorMsg(err instanceof Error ? err.message : 'Failed to load presentation')
          setLoadState('error')
        })
    }
    return (
      <div className="h-screen flex items-center justify-center px-6" style={{ background: '#FAFBFC' }}>
        <div className="max-w-sm w-full rounded-2xl p-8 text-center bg-white" style={{ border: '1px solid #E5E7EB' }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl" style={{ background: '#FEE2E2' }}>!</div>
          <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Could not load presentation
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            {loadErrorMsg ?? 'We could not fetch this presentation. Check your connection and try again.'}
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={retry}
              className="w-full px-6 py-3 rounded-xl font-bold text-sm transition-transform hover:scale-[1.02]"
              style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
              Try Again
            </button>
            <button onClick={() => router.push('/host')}
              className="w-full px-6 py-3 rounded-xl font-semibold text-sm"
              style={{ color: '#6B7280', border: '1.5px solid #E5E7EB' }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative" style={{ background: '#FAFBFC', fontFamily: 'var(--font-body)' }}>

      {/* ── Bottom save-error banner — shows the actual server message so
           users can see why autosave is failing (theme column missing,
           plan limit, network, etc.). Dismissable. ── */}
      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] px-4 py-3 rounded-xl shadow-xl flex items-start gap-3"
          style={{ background: '#FEF2F2', border: '1.5px solid #DC2626', color: '#991B1B' }}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4.5zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
          </svg>
          <div className="text-sm font-medium break-words min-w-0 flex-1">
            <p className="font-bold mb-0.5">Couldn&apos;t save to server</p>
            <p className="text-xs leading-relaxed">{saveError}</p>
          </div>
          <button
            onClick={() => { setSaveError(null); savePresentation(true) }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: '#DC2626', color: '#fff' }}
          >
            Retry
          </button>
          <button
            onClick={() => setSaveError(null)}
            className="text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-red-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Draft recovery banner ── */}
      {recoveredDraft && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium" style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
          <span>Unsaved draft recovered from {formatDraftAge(recoveredDraft.savedAt)}</span>
          <button
            onClick={() => {
              clearDraft(draftKey('presentation', presentation.id))
              setRecoveredDraft(null)
              // Reload saved version from localStorage
              try {
                const all = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
                const saved = all.find((p: Presentation) => p.id === presentation.id)
                if (saved) setPresentation(saved)
              } catch { /* ignore */ }
            }}
            className="underline text-xs opacity-75 hover:opacity-100 flex-shrink-0"
          >
            Discard draft
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b" style={{ background: 'rgba(250,251,252,0.96)', backdropFilter: 'blur(8px)', borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-3 px-3 h-12 md:px-5 md:h-14">
          <button
            type="button"
            onClick={closePresentationCreateFlow}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-gray-100"
            style={{ border: '1.5px solid #E5E7EB', color: '#374151' }}
            title="Back"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Editable title — visible edit affordance (dashed hover outline,
              solid focus outline, pencil icon) so it doesn't look like a
              static label. Empty + blur restores the default so the header is
              never blank. */}
          <div className="flex-1 min-w-0">
            <div className="group relative flex items-center gap-1.5">
              <input
                value={presentation.title}
                onChange={e => setPresentation(prev => ({ ...prev, title: e.target.value }))}
                onBlur={e => {
                  if (!e.target.value.trim()) {
                    setPresentation(prev => ({ ...prev, title: 'Untitled Presentation' }))
                  }
                }}
                placeholder="Name your presentation…"
                aria-label="Presentation title"
                className="w-full text-sm font-bold bg-transparent rounded-md px-2 py-1 -mx-2 border border-transparent hover:border-dashed hover:border-slate-300 focus:outline-none focus:bg-white focus:border-solid focus:border-slate-400 placeholder:font-normal placeholder:italic placeholder:text-slate-400 transition-colors"
                style={{ color: '#0F1B3D' }}
              />
              <svg viewBox="0 0 16 16" fill="none" aria-hidden className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 group-focus-within:opacity-100 pointer-events-none flex-shrink-0 transition-opacity" style={{ color: '#64748B' }}>
                <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="hidden sm:block text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              {presentation.slides.length} slide{presentation.slides.length !== 1 ? 's' : ''} &middot; {interactiveCount} interactive
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Auto-save indicator — quiet, no flashing (Notion/Canva style).
                Error state stays prominent. Normal state shows persistent muted text. */}
            {saveError ? (
              <span className="text-xs font-medium flex items-center gap-1.5 mr-1 max-w-[280px]" style={{ color: '#DC2626' }} title={saveError}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4.5zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                <span className="hidden sm:inline truncate">{saveError.length > 40 ? `${saveError.slice(0, 40)}…` : saveError}</span>
                <button onClick={() => { setSaveError(null); savePresentation(true) }} className="underline font-bold hover:no-underline flex-shrink-0">Retry</button>
              </span>
            ) : (saving || saved) ? (
              <span className="text-xs mr-1 hidden sm:inline" style={{ color: '#94A3B8' }}>
                {saving ? 'Saving…' : 'All changes saved'}
              </span>
            ) : null}
            {hasPptxContent && (
              <button onClick={() => setEnhanceOpen(true)} title="Enhance with AI"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02] click-bounce"
                style={{ background: '#EEF2FF', color: '#4F46E5', border: '1.5px solid #C7D2FE' }}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zM3 11l.75 1.75L5.5 13.5l-1.75.75L3 16l-.75-1.75L.5 13.5l1.75-.75L3 11z"/></svg>
                Enhance with AI
              </button>
            )}
            <button onClick={() => setShareOpen(true)} title="Share"
              className="hidden sm:flex w-8 h-8 md:w-9 md:h-9 rounded-lg border items-center justify-center transition-all hover:bg-gray-50 click-bounce"
              style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M15 7a3 3 0 100-6 3 3 0 000 6zM5 13a3 3 0 100-6 3 3 0 000 6zM15 19a3 3 0 100-6 3 3 0 000 6zM7.59 11.51l4.83 2.98M12.41 5.51L7.59 8.49" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={() => setThemePickerOpen(true)} title="Pick a theme"
              className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-bold border transition-all hover:bg-gray-50 click-bounce"
              style={{ borderColor: '#E2E8F0', color: '#0F1B3D' }}>
              <span aria-hidden className="w-4 h-4 rounded-md overflow-hidden border border-gray-200 inline-flex">
                {getQuizTheme(presentation.theme).swatch.map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="hidden sm:inline">Theme</span>
            </button>
            <button onClick={() => { setSaveError(null); savePresentation(true) }} disabled={saving}
              className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-xl border-2 transition-all disabled:opacity-50 click-bounce"
              style={{ borderColor: saveError ? '#DC2626' : saved ? '#16A34A' : '#E2E8F0', color: saveError ? '#DC2626' : saved ? '#16A34A' : '#0F1B3D', background: saveError ? '#FEF2F2' : saved ? '#F0FDF4' : '#fff' }}>
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving
                </span>
              ) : saveError ? 'Retry' : saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={handleSaveAndPresent} disabled={starting}
              className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-xl transition-all hover:scale-[1.02] click-bounce disabled:opacity-60"
              style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
              {starting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (<><span className="hidden sm:inline">Save & </span>Present</>)}
            </button>
          </div>
        </div>
      </header>

      {/* ── PPT import banner (Tier 3.5) ──
          Surfaces the hidden feature to fresh users. Dismissible; auto-hides
          when user starts editing (second slide added, title changed, or
          dismissed manually). Works on mobile too. */}
      {(() => {
        const isFresh =
          !pptBannerDismissed &&
          !pptxImporting &&
          presentation.slides.length === 1 &&
          presentation.slides[0]?.type === 'title' &&
          (presentation.slides[0] as { heading?: string })?.heading === '' &&
          (presentation.title === 'Untitled Presentation' || presentation.title === '')
        if (!isFresh) return null
        const dismiss = () => {
          setPptBannerDismissed(true)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('quizotic-ppt-banner-dismissed', 'true')
          }
        }
        return (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: '#E0F2FE', borderColor: '#BAE6FD' }}>
            <label className="btn-primary-teal cursor-pointer flex-shrink-0" style={{ padding: '7px 12px', fontSize: '12px' }}>
              <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
                <path d="M10 3v10m0 0l-3-3m3 3l3-3M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Import PDF / PPT
              <input type="file" accept=".pptx,.pdf" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) importPptx(file)
                  e.target.value = ''
                }} />
            </label>
            <p className="text-[12px] flex-1 min-w-0" style={{ color: '#0C4A6E' }}>
              <strong>New deck?</strong> Upload a .pptx or .pdf — we&apos;ll render each slide as an image. Then AI can add polls or quizzes between them.
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/60"
              style={{ color: '#0369A1' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/></svg>
            </button>
          </div>
        )
      })()}

      {/* ── Body — 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Slide thumbnails + actions */}
        <div className="hidden md:flex w-60 flex-shrink-0 border-r flex-col" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>

          {/* Top action bar */}
          <div className="flex-shrink-0 border-b p-2.5 space-y-2" style={{ borderColor: '#E2E8F0' }}>
            {/* PPTX Import */}
            {pptxImporting ? (
              <div className="rounded-xl border p-2.5" style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#4F46E5', borderTopColor: 'transparent' }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#0F1B3D' }}>{pptxProgress}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pptxPercent}%`, background: '#4F46E5' }} />
                </div>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-[11px] cursor-pointer transition-all hover:scale-[1.02]"
                style={{ background: '#4F46E5', color: '#fff' }}>
                <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
                  <path d="M10 3v10m0 0l-3-3m3 3l3-3M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {pptxImportedCount > 0 ? `Import PPTX/PDF (${pptxImportedCount} added)` : 'Import PPTX/PDF'}
                <input type="file" accept=".pptx,.pdf" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) importPptx(file)
                    e.target.value = ''
                  }} />
              </label>
            )}

            {/* Add Slide button */}
            <button onClick={() => setAddSlideOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold text-[11px] transition-all hover:scale-[1.02] click-bounce"
              style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #0F1B3D' }}>
              <span className="text-sm leading-none">+</span>
              Add Slide
            </button>
          </div>

          {/* Scrollable slide list */}
          <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {presentation.slides.map((slide, i) => (
              <div key={slide.id} data-slide-index={i} className="relative group"
                onContextMenu={e => { e.preventDefault(); setContextMenu({ index: i, x: e.clientX, y: e.clientY }) }}
              >
                <SlideThumbnail
                  slide={slide}
                  index={i}
                  active={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                />
                <button
                  onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setContextMenu({ index: i, x: r.right, y: r.bottom }) }}
                  className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 shadow-sm text-gray-400 hover:text-gray-700 text-[11px] font-bold z-10"
                >&#8230;</button>
              </div>
            ))}
          </div>

          {/* Quizotic brand pill */}
          <div className="flex-shrink-0 flex items-center justify-center py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wide select-none"
              style={{ background: '#FBD13B', color: '#0F1B3D' }}
            >
              <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-black flex-shrink-0" style={{ background: '#0F1B3D', color: '#FBD13B' }}>Q</div>
              QUIZOTIC
            </div>
          </div>
        </div>

        {/* Context menu dropdown */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null) }} />
            <div
              className="fixed z-50 w-44 py-1 bg-white rounded-xl shadow-xl border"
              style={{ left: contextMenu.x, top: Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight - 200 : 600)), borderColor: '#E2E8F0' }}
            >
              {[
                { label: 'Duplicate', icon: '\u2398', action: () => duplicateSlide(contextMenu.index), disabled: false, danger: false },
                { label: 'Move Up', icon: '\u2191', action: () => moveSlide(contextMenu.index, 'up'), disabled: contextMenu.index === 0, danger: false },
                { label: 'Move Down', icon: '\u2193', action: () => moveSlide(contextMenu.index, 'down'), disabled: contextMenu.index >= presentation.slides.length - 1, danger: false },
                { label: 'Delete', icon: '\u2715', action: () => deleteSlide(contextMenu.index), disabled: presentation.slides.length <= 1, danger: true },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setContextMenu(null) }}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold transition-colors click-bounce-sm disabled:opacity-30 disabled:cursor-not-allowed ${item.danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-gray-50'}`}
                  style={{ color: item.danger ? '#EF4444' : '#374151' }}
                >
                  <span className="w-4 text-center text-[11px]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* CENTER: WYSIWYG Preview — soft gradient + subtle dotted pattern so
            the preview area reads as a "stage" rather than a bland gray wall.
            Slide card gets more breathing room (max-w 1600). */}
        <div
          className="flex-1 flex flex-col items-center justify-center overflow-y-auto relative"
          style={{
            background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 45%, #DBEAFE 100%)',
            backgroundImage:
              'radial-gradient(rgba(15,27,61,0.06) 1.2px, transparent 1.2px), linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 45%, #DBEAFE 100%)',
            backgroundSize: '18px 18px, 100% 100%',
            backgroundPosition: '0 0, 0 0',
          }}
        >
          {activeSlide ? (
            <div className="w-full max-w-[1600px] px-4 md:px-8 lg:px-12 py-4">
              {/* Slide preview */}
              <SlidePreview slide={activeSlide} plan={plan} />

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
                  style={{ background: '#0F1B3D', color: '#FBD13B' }}>
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
        <div className="hidden md:flex md:w-96 flex-shrink-0 border-l flex-col overflow-hidden" style={{ borderColor: '#E2E8F0', background: '#fff' }}>
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
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <SlideEditor slide={activeSlide} onChange={updateSlide} />

                <SlideBgPicker slide={activeSlide} onChange={updateSlide} />

                {/* ── Show Responses (interactive slides only) ── */}
                {SLIDE_TYPE_META[activeSlide.type].hasAudienceInput && (
                  <div className="border-t pt-4 space-y-2.5" style={{ borderColor: '#E2E8F0' }}>
                    <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Show responses</label>
                    {([
                      { value: 'instant' as const, label: 'Instant responses', desc: 'Responses appear in real-time' },
                      { value: 'on_click' as const, label: 'Responses on click', desc: 'Host reveals results', recommended: true },
                      { value: 'private' as const, label: 'Private responses', desc: 'Only host sees results' },
                    ]).map(opt => {
                      const current = activeSlide.responseMode || 'instant'
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateSlide({ ...activeSlide, responseMode: opt.value } as Slide)}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                          style={{
                            background: current === opt.value ? '#EFF6FF' : '#FAFBFC',
                            border: current === opt.value ? '1.5px solid #3B82F6' : '1.5px solid #E2E8F0',
                          }}
                        >
                          <div className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                            style={{
                              border: current === opt.value ? '2px solid #3B82F6' : '2px solid #CBD5E1',
                            }}>
                            {current === opt.value && (
                              <div className="w-2 h-2 rounded-full" style={{ background: '#3B82F6' }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold" style={{ color: current === opt.value ? '#1D4ED8' : '#374151' }}>
                                {opt.label}
                              </span>
                              {opt.recommended && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                  style={{ background: '#DBEAFE', color: '#1D4ED8' }}>Recommended</span>
                              )}
                            </div>
                            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{opt.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* ── Content Image ── */}
                <div className="border-t pt-4 space-y-2.5" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Content image</label>
                    {!activeSlide.contentImageUrl && (
                      <label
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                        style={{ background: '#F3F4F6', color: '#64748B', border: '1.5px solid #E2E8F0' }}
                      >
                        <span className="text-sm font-bold">+</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const form = new FormData()
                            form.append('file', file)
                            try {
                              const res = await fetch('/api/upload-image', { method: 'POST', body: form })
                              const data = await res.json()
                              if (data.success) {
                                updateSlide({ ...activeSlide, contentImageUrl: data.url } as Slide)
                              } else {
                                alert(data.error || 'Upload failed')
                              }
                            } catch { alert('Upload failed') }
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {activeSlide.contentImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: '1.5px solid #E2E8F0' }}>
                      <img src={activeSlide.contentImageUrl} alt="Content" className="w-full h-24 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = { ...activeSlide }
                          delete (copy as Record<string, unknown>).contentImageUrl
                          updateSlide(copy as Slide)
                        }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      >
                        x
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-16 rounded-xl" style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1' }}>
                      <p className="text-[10px]" style={{ color: '#94A3B8' }}>No image added</p>
                    </div>
                  )}
                </div>

                {/* ── Visualization Text Color ── */}
                <div className="border-t pt-4 space-y-2.5" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Text color</label>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...activeSlide }
                        delete (copy as Record<string, unknown>).vizTextColor
                        updateSlide(copy as Slide)
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all"
                      style={
                        !activeSlide.vizTextColor
                          ? { background: '#0F1B3D', color: '#FBD13B', border: '1.5px solid #0F1B3D' }
                          : { background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }
                      }
                    >
                      Auto
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['#0F1B3D','#FFFFFF','#1E293B','#374151','#DC2626','#2563EB','#16A34A','#F59E0B'].map(color => {
                      const isActive = activeSlide.vizTextColor?.toUpperCase() === color.toUpperCase()
                      return (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          onClick={() => updateSlide({ ...activeSlide, vizTextColor: color } as Slide)}
                          className="w-6 h-6 rounded-full transition-all hover:scale-110"
                          style={{
                            background: color,
                            border: isActive ? '2.5px solid #0F1B3D' : '1.5px solid #CBD5E1',
                            boxShadow: isActive ? '0 0 0 2px #fff, 0 0 0 4px #0F1B3D' : undefined,
                            outline: color === '#FFFFFF' ? '1px solid #E2E8F0' : undefined,
                          }}
                        />
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                    <div className="w-3.5 h-3.5 rounded flex-shrink-0" style={{ background: activeSlide.vizTextColor || '#0F1B3D', border: '1px solid #CBD5E1' }} />
                    <span className="text-xs font-mono font-bold" style={{ color: '#94A3B8' }}>#</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={(activeSlide.vizTextColor || '').replace('#', '').toUpperCase()}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
                        if (raw.length === 6) {
                          updateSlide({ ...activeSlide, vizTextColor: `#${raw}` } as Slide)
                        }
                      }}
                      className="flex-1 bg-transparent text-xs font-mono font-bold outline-none uppercase"
                      style={{ color: '#374151' }}
                      placeholder="Auto"
                    />
                  </div>
                </div>

                {/* ── Display QR Code ── */}
                <div className="border-t pt-4 pb-2" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Show QR code</label>
                      <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Display join QR on slide</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!activeSlide.showQrCode}
                      onClick={() => updateSlide({ ...activeSlide, showQrCode: !activeSlide.showQrCode } as Slide)}
                      className="relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0"
                      style={{ background: activeSlide.showQrCode ? '#3B82F6' : '#CBD5E1' }}
                    >
                      <span
                        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform"
                        style={{ left: activeSlide.showQrCode ? '20px' : '2px' }}
                      />
                    </button>
                  </div>
                </div>
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
        <button
          onClick={() => setMobileSlidesOpen(true)}
          className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
          style={{ background: '#fff', color: '#0F1B3D', border: '1.5px solid #E2E8F0' }}>
          ☰ Slides
        </button>
        <button
          onClick={() => setAddSlideOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-sm transition-all"
          style={{ background: '#0F1B3D', color: '#fff' }}>
          <span>+</span> Add
        </button>
        {activeSlide && (
          <button
            onClick={() => setMobileSlideEditorOpen(true)}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
            style={{ background: '#FBD13B', color: '#0D0D0D', border: '1.5px solid rgba(15,27,61,0.2)' }}>
            ✏️ Edit
          </button>
        )}
      </div>

      {/* ── Mobile Slides List Bottom Sheet ── */}
      {mobileSlidesOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(15,27,61,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setMobileSlidesOpen(false) }}>
          <div className="rounded-t-2xl overflow-hidden flex flex-col" style={{ background: '#fff', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#E2E8F0' }}>
              <span className="font-black text-base" style={{ color: '#0F1B3D' }}>Slides ({presentation.slides.length})</span>
              <button
                onClick={() => setMobileSlidesOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F1F5F9' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#374151' }}>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {presentation.slides.map((s, i) => {
                const meta = SLIDE_TYPE_META[s.type]
                const isActive = i === activeIndex
                const title = 'title' in s && s.title ? s.title : 'question' in s && typeof s.question === 'string' ? s.question : meta.label
                return (
                  <div
                    key={s.id}
                    onClick={() => { setActiveIndex(i); setMobileSlidesOpen(false) }}
                    className="flex items-center gap-2 px-3 py-3 rounded-lg"
                    style={
                      isActive
                        ? { background: '#EEF2FF', border: '1.5px solid #6366F1' }
                        : { border: '1.5px solid #E2E8F0', background: '#fff' }
                    }
                  >
                    <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                      style={isActive ? { background: '#6366F1', color: '#fff' } : { background: meta.bg, color: meta.color }}>
                      {SLIDE_ICONS[s.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                        Slide {i + 1} &middot; {meta.label}
                      </div>
                      <p className="text-sm text-gray-700 truncate leading-tight">{String(title).slice(0, 60) || 'Untitled'}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteSlide(i); if (presentation.slides.length <= 1) setMobileSlidesOpen(false) }}
                      disabled={presentation.slides.length <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 flex-shrink-0 hover:bg-red-50 disabled:opacity-30"
                      aria-label="Delete slide">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M8.75 1a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5zM5 5a1 1 0 011-1h8a1 1 0 011 1v1H5V5zm.5 2.5a.5.5 0 00-.5.5v9a2 2 0 002 2h6a2 2 0 002-2v-9a.5.5 0 00-.5-.5h-9z"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex-shrink-0 border-t px-4 py-3" style={{ borderColor: '#E2E8F0' }}>
              <button
                onClick={() => { setAddSlideOpen(true); setMobileSlidesOpen(false) }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: '#0F1B3D', color: '#fff' }}>
                <span>+</span> Add slide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Slide Editor Bottom Sheet ── */}
      {mobileSlideEditorOpen && activeSlide && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(15,27,61,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setMobileSlideEditorOpen(false) }}>
          <div className="rounded-t-2xl overflow-y-auto p-4" style={{ background: '#fff', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ background: SLIDE_TYPE_META[activeSlide.type].bg, color: SLIDE_TYPE_META[activeSlide.type].color }}>
                  {SLIDE_ICONS[activeSlide.type]}
                </span>
                <span className="font-black text-base" style={{ color: '#0F1B3D' }}>
                  {SLIDE_TYPE_META[activeSlide.type].label}
                </span>
              </div>
              <button
                onClick={() => setMobileSlideEditorOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F1F5F9' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#374151' }}>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                </svg>
              </button>
            </div>
            <SlideEditor slide={activeSlide} onChange={updateSlide} />
            <SlideBgPicker slide={activeSlide} onChange={updateSlide} />
          </div>
        </div>
      )}

      {/* ── Add Slide Modal ── */}
      {addSlideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,27,61,0.55)' }}
          onClick={() => setAddSlideOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#E2E8F0' }}>
              <p className="text-lg font-bold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                Add a Slide
              </p>
              <button
                onClick={() => setAddSlideOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xl font-bold transition-colors hover:bg-gray-100"
                style={{ color: '#94A3B8' }}>
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <SlideTypePicker onPick={(type) => addSlide(type)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShareOpen(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Share Presentation</h3>
              <button onClick={() => setShareOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 text-sm">&times;</button>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
              <p className="text-2xl mb-2">🔗</p>
              <p className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>Share after starting</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>A 6-digit code is generated when you start a live session</p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Join Page</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/join` : 'quizotic.live/join'}
                  className="flex-1 text-sm font-medium px-3 py-2 rounded-lg border bg-gray-50 outline-none"
                  style={{ borderColor: '#E2E8F0', color: '#374151' }}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join`); }}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 click-bounce"
                  style={{ background: '#0F1B3D', color: '#FBD13B' }}
                >Copy</button>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2.5 text-xs text-gray-500 bg-amber-50 border border-amber-200">
              Start presenting first, then share the 6-digit code with participants.
            </div>
            <button
              onClick={async () => { setShareOpen(false); await handleSaveAndPresent() }}
              disabled={starting}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 click-bounce disabled:opacity-60"
              style={{ background: '#0F1B3D', color: '#FBD13B' }}
            >{starting ? 'Saving…' : <>&#9654; Save &amp; Present</>}</button>
          </div>
        </>
      )}

      {/* ── Post-Import Enhance Prompt ── */}
      {showEnhancePrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 px-5 py-3 rounded-2xl shadow-2xl border"
          style={{ background: '#fff', borderColor: '#C7D2FE', maxWidth: 540 }}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                {pptxImportedCount} slides imported!
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                Want to add interactive elements between your content slides?
              </p>
            </div>
            <button onClick={() => { setShowEnhancePrompt(false); setEnhanceOpen(true) }}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] flex-shrink-0"
              style={{ background: '#4F46E5', color: '#fff' }}>
              Enhance with AI
            </button>
            <button onClick={() => setShowEnhancePrompt(false)}
              className="text-xs font-medium flex-shrink-0" style={{ color: '#94A3B8' }}>
              No thanks
            </button>
          </div>
          {/* Video awareness — PPTX videos are rasterised to a poster image
              during import, so audio/motion is lost. Tell the host how to
              restore them as first-class Video slides (YouTube/Vimeo URL). */}
          <div className="flex items-start gap-2 pt-2 border-t" style={{ borderColor: '#E0E7FF' }}>
            <span className="text-sm flex-shrink-0" aria-hidden>🎬</span>
            <p className="text-[11px] leading-snug" style={{ color: '#6B7280' }}>
              Had videos in your deck? Slide imports capture them as still
              images — use <strong style={{ color: '#4F46E5' }}>Add Slide → Video</strong> to paste a YouTube/Vimeo URL at the right position.
            </p>
          </div>
        </div>
      )}

      {/* ── Enhance with AI Modal ── */}
      {enhanceOpen && (
        <EnhanceWithAI
          presentation={presentation}
          onComplete={handleEnhanceComplete}
          onCancel={() => setEnhanceOpen(false)}
        />
      )}

      {/* ── Theme picker ── */}
      <QuizThemePicker
        open={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        value={(presentation.theme as QuizThemeId) ?? undefined}
        onChange={(id) => setPresentation(prev => {
          const prevTheme = getQuizTheme(prev.theme)
          const nextTheme = getQuizTheme(id)
          // Cascade theme's slideBg to any slide still sitting on the previous
          // theme's default background. Slides with a user-picked custom color
          // keep their color so theme changes never stomp deliberate choices.
          const slides = prev.slides.map(s => {
            const usingDefault = !s.bgColor
              || s.bgColor === prevTheme.slideBg
              || s.bgColor === '#FAFAF8'
            return usingDefault ? ({ ...s, bgColor: nextTheme.slideBg }) : s
          })
          return { ...prev, theme: id, slides }
        })}
      />

      {/* ── Incomplete-slides warning Modal (shown on Present) ── */}
      {incompletePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(15,27,61,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FEF3C7' }}>
                <svg viewBox="0 0 20 20" fill="#D97706" className="w-5 h-5"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 3.5a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4A.75.75 0 0110 5.5zm0 9a1 1 0 110-2 1 1 0 010 2z"/></svg>
              </div>
              <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
                {incompletePrompt.slides.length === 1 ? 'One slide needs attention' : `${incompletePrompt.slides.length} slides need attention`}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
              Fill these in for a cleaner session, or present as-is:
            </p>
            <ul className="max-h-56 overflow-y-auto rounded-xl border divide-y text-sm" style={{ borderColor: '#E2E8F0', color: '#374151' }}>
              {incompletePrompt.slides.map((f) => (
                <li key={f.id} className="px-3 py-2 flex items-start gap-2">
                  <span className="font-bold flex-shrink-0" style={{ color: '#0F1B3D' }}>Slide {f.index + 1}</span>
                  <span style={{ color: '#6B7280' }}>·</span>
                  <span className="flex-shrink-0" style={{ color: '#0F1B3D' }}>{f.typeLabel}</span>
                  <span style={{ color: '#6B7280' }}>—</span>
                  <span className="flex-1" style={{ color: '#6B7280' }}>{f.issue}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
              <button
                onClick={() => setIncompletePrompt(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-gray-100"
                style={{ color: '#64748B' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const first = incompletePrompt.slides[0]
                  setActiveIndex(first.index)
                  setMobileSlidesOpen(false)
                  setIncompletePrompt(null)
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#E0E7FF', color: '#1E1B4B' }}>
                Fix now
              </button>
              <button
                onClick={() => {
                  const { patched } = incompletePrompt
                  setIncompletePrompt(null)
                  launchSession(patched)
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{ background: '#0F1B3D', color: '#FBD13B' }}>
                Present anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan-limit blocked Modal (403 on save) ── */}
      {planLimitBlocked && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(15,27,61,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FEF3C7' }}>
                <svg viewBox="0 0 20 20" fill="#D97706" className="w-5 h-5"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 3.5a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4A.75.75 0 0110 5.5zm0 9a1 1 0 110-2 1 1 0 010 2z"/></svg>
              </div>
              <h3 className="text-lg font-extrabold" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Plan limit reached</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
              {planLimitBlocked}
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Your work is safe — a local draft is preserved until you reduce the slide count or upgrade.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPlanLimitBlocked(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-gray-100"
                style={{ color: '#64748B' }}>
                Dismiss
              </button>
              <a
                href="/pricing"
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{ background: '#0F1B3D', color: '#FBD13B' }}>
                Upgrade to Pro
              </a>
            </div>
          </div>
        </div>
      )}

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
