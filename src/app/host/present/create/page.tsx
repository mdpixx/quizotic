'use client'

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import {
  type Slide, type SlideType, type Presentation,
  SLIDE_TYPE_META, SLIDE_CATEGORIES, makeSlide,
} from '@/lib/presentation-types'
import QRCode from 'react-qr-code'
import { EnhanceWithAI } from '@/components/EnhanceWithAI'
import { ImageUpload } from '@/components/ImageUpload'
import { draftKey, readDraft, writeDraft, clearDraft, formatDraftAge } from '@/lib/draft-storage'
import { useAutosave } from '@/lib/use-autosave'

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


const SLIDE_TYPE_DESCRIPTIONS: Record<SlideType, string> = {
  multiple_choice: 'Audience picks one answer from up to 6 options. Show the correct answer live.',
  open_text: 'Audience types free-form responses. Great for collecting ideas or feedback.',
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

function getSlideGradient(slide: Slide): string {
  // Custom bgColor override for any slide
  if (slide.bgColor) return slide.bgColor
  switch (slide.type) {
    case 'title': return '#FAFAF8'
    case 'multiple_choice': return '#FFFFFF'
    case 'open_text': return '#FFFFFF'
    case 'word_cloud': return '#FFFFFF'
    case 'rating_scale': return '#FFFFFF'
    case 'ranking': return '#FFFFFF'
    case 'image_choice': return '#E0F2FE'
    case 'scale_100': return '#DCFCE7'
    case 'pinpoint': return '#F3E8FF'
    case 'grid_2x2': return '#CCFBF1'
    case 'wheel': return '#FEF3C7'
    case 'word_duel': return '#FEE2E2'
    case 'live_race': return '#FFEDD5'
    case 'emoji_pulse': return '#0F1B3D'
    case 'quick_fire': return '#FFE4E6'
    case 'bullets': return '#F8FAFC'
    case 'quote': return '#1E293B'
    case 'video': return '#0F172A'
    case 'image': return '#F3F4F6'
  }
}

function getBgLuminance(slide: Slide): number {
  const bg = slide.bgColor
  if (bg && bg.startsWith('#') && bg.length === 7) {
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }
  // Default luminance based on slide type defaults
  const darkTypes: SlideType[] = ['emoji_pulse', 'quote', 'video']
  return darkTypes.includes(slide.type) ? 0.2 : 0.9
}

function getSlideTextColor(slide: Slide): string {
  if (slide.vizTextColor) return slide.vizTextColor
  return getBgLuminance(slide) > 0.5 ? '#0F1B3D' : '#fff'
}

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
          <div className="w-full flex flex-col gap-2 items-center text-center">
            <span className="text-xs font-semibold leading-snug" style={{ color: '#0F1B3D' }}>
              {s.question || 'How would you rate...'}
            </span>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: stars }).map((_, i) => (
                <span key={i} className="text-base" style={{ color: i < Math.round(stars * 0.6) ? '#F59E0B' : '#E2E8F0' }}>★</span>
              ))}
            </div>
            <div className="flex justify-between w-full mt-1">
              <span className="text-[9px] font-medium" style={{ color: '#94A3B8' }}>{s.minLabel || '1'}</span>
              <span className="text-[9px] font-medium" style={{ color: '#94A3B8' }}>{s.maxLabel || String(stars)}</span>
            </div>
          </div>
        )
      }

      case 'word_cloud': {
        const wcWords = [
          { text: 'Ideas', size: 28, color: '#3B82F6' },
          { text: 'Creativity', size: 20, color: '#EF4444' },
          { text: 'Team', size: 34, color: '#0F1B3D' },
          { text: 'Growth', size: 18, color: '#16A34A' },
          { text: 'Vision', size: 22, color: '#8B5CF6' },
          { text: 'Focus', size: 14, color: '#F59E0B' },
          { text: 'Innovation', size: 16, color: '#EC4899' },
          { text: 'Leadership', size: 13, color: '#0891B2' },
        ]
        return (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 w-full">
            {wcWords.map((w, i) => (
              <span key={i} className="font-extrabold leading-tight" style={{
                color: w.color, fontSize: w.size, fontFamily: 'var(--font-heading)',
              }}>{w.text}</span>
            ))}
          </div>
        )
      }

      case 'ranking': {
        const items = (slide as { items: string[] }).items
        const rankColors = ['#4F46E5', '#3B82F6', '#0891B2', '#10B981', '#F59E0B', '#EF4444']
        return (
          <div className="w-full space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-4 text-right flex-shrink-0" style={{ color: '#94A3B8' }}>{i + 1}</span>
                <div className="flex-1 h-7 rounded-md overflow-hidden relative" style={{ background: '#F1F5F9' }}>
                  <div className="h-full rounded-md" style={{ width: 6, background: rankColors[i % 6] }} />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: '#0F1B3D' }}>
                    {item || `Item ${i + 1}`}
                  </span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: '#94A3B8' }}>0</span>
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
          <div className="w-full space-y-2">
            {opts.slice(0, 4).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-bold truncate w-20 text-right" style={{ color: textColor, opacity: 0.6 }}>{opt || `Option ${i + 1}`}</span>
                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: viz.track }}>
                  <div className="h-full rounded-full" style={{ width: 6, background: viz.fill }} />
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
            <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
              <div className="relative" style={{ width: '70%', maxWidth: 280, aspectRatio: '1' }}>
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

      case 'bullets': {
        const bullets = (slide as { bullets: string[] }).bullets
        return (
          <div className="w-full space-y-2">
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
        <div className="w-full aspect-video rounded-lg flex items-center justify-center"
          style={{ background: viz.subtle, border: `1px solid ${viz.track}` }}>
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
          <div className="w-full aspect-video rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.08)', border: '1px dashed rgba(0,0,0,0.2)' }}>
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
        return (
          <div className="w-full grid grid-cols-2 gap-2.5 h-full">
            {opts.slice(0, 6).map((opt, i) => (
              <div key={i} className="rounded-xl overflow-hidden flex flex-col min-h-0"
                style={{ background: '#F8FAFC', border: '2px solid #94A3B8', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden" style={{ background: '#E2E8F0' }}>
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

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden relative shadow-lg"
      style={{ background: gradient }}>

      {/* Background image layer */}
      {slide.backgroundImageUrl && (
        <img src={slide.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Question / heading + visualization */}
      <div className={`absolute inset-0 flex flex-col px-6${slide.type === 'title' ? ' justify-center items-center text-center gap-3' : ' py-5'}`}>
        {slide.type !== 'quote' && (
          <p className={`font-bold leading-snug flex-shrink-0${slide.type === 'title' ? ' text-2xl' : ' text-xl text-left'}`} style={{ color: textColor, fontFamily: 'var(--font-heading)' }}>
            {getQuestionText()}
          </p>
        )}

        {/* Title slide: subheading directly below heading */}
        {slide.type === 'title' && (
          <p className="text-sm opacity-60 flex-shrink-0" style={{ color: textColor }}>
            {(slide as { subheading: string }).subheading || 'Subtitle goes here'}
          </p>
        )}

        {/* Content image — shown on slide when uploaded */}
        {slide.contentImageUrl ? (
          <div className="flex-1 flex items-center justify-center min-h-0 mt-3">
            <img src={slide.contentImageUrl} alt="Content" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0 mt-3">
            {renderVisualization()}
          </div>
        )}
      </div>

      {/* QR code overlay */}
      {slide.showQrCode && (
        <div className="absolute bottom-3 right-3 rounded-lg p-1.5 shadow-lg"
          style={{ background: '#fff' }}>
          <QRCode value="https://quizotic.live/join" size={56} level="L" />
          <p className="text-[6px] font-bold text-center mt-0.5" style={{ color: '#64748B' }}>Scan to join</p>
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
        style={{ background: meta.bg, color: meta.color }}>
        {meta.label}
      </div>

      {/* Join bar — watermark for free plan */}
      {plan !== 'pro' && (
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
          <img src={slide.imageUrl} alt="" className="w-full rounded-xl border max-h-64 object-contain" style={{ borderColor: '#E2E8F0' }} />
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
          <img src={(slide as { imageUrl: string }).imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <p className="text-[9px] font-bold text-center leading-tight line-clamp-2" style={{ color: textColor }}>
            {getLabel()}
          </p>
        )}
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

function PresentCreatePageInner() {
  const router = useRouter()
  const [presentation, setPresentation] = useState<Presentation>(makePresentation)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [pptxImporting, setPptxImporting] = useState(false)
  const [pptxProgress, setPptxProgress] = useState('')
  const [pptxPercent, setPptxPercent] = useState(0)
  const [pptxImportedCount, setPptxImportedCount] = useState(0)
  const [enhanceOpen, setEnhanceOpen] = useState(false)
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false)
  const [addSlideOpen, setAddSlideOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [mobileSlideEditorOpen, setMobileSlideEditorOpen] = useState(false)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [bgHexInput, setBgHexInput] = useState('')
  const [recoveredDraft, setRecoveredDraft] = useState<{ savedAt: number } | null>(null)
  const hasLoadedRef = useRef(false)
  const lastSavedRef = useRef(JSON.stringify(makePresentation()))
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  // Stable ref to the current presentation id so autosave can write the draft key
  const presentationIdRef = useRef<string>('')

  // Load existing presentation when editing — runs ONCE on mount only.
  // Reading searchParams imperatively here avoids subscribing to the param as
  // a dep, which would re-run this effect on every Next.js re-render and
  // overwrite unsaved in-memory edits with the stale localStorage snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('id')
    if (editId) {
      // Prefer a newer draft over the saved copy
      const dk = draftKey('presentation', editId)
      const draft = readDraft<Presentation>(dk)
      try {
        const all = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
        const saved = all.find((p: Presentation) => p.id === editId) as Presentation | undefined
        if (draft && saved && draft.savedAt > new Date(saved.updatedAt).getTime()) {
          setPresentation(draft.value)
          setRecoveredDraft({ savedAt: draft.savedAt })
          setActiveIndex(0)
          return
        }
        if (saved) { setPresentation(saved); setActiveIndex(0); return }
      } catch { /* ignore */ }
      // Fallback: use draft if saved list failed
      if (draft) { setPresentation(draft.value); setActiveIndex(0) }
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

  async function savePresentation() {
    setSaving(true)
    // Write crash-safe draft FIRST (synchronous, always succeeds).
    // This ensures a refresh can recover work even if the API call fails.
    const dk = draftKey('presentation', presentation.id)
    writeDraft(dk, presentation)
    try {
      const res = await fetch('/api/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentation),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      const existing = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
      const idx = existing.findIndex((p: Presentation) => p.id === presentation.id)
      if (idx >= 0) existing[idx] = presentation
      else existing.unshift(presentation)
      localStorage.setItem('quizotic_presentations', JSON.stringify(existing))
      // Server save succeeded — draft is no longer needed
      clearDraft(dk)
      setRecoveredDraft(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Server save failed but draft is already persisted locally — surface nothing to the user
      // (the autosave loop will retry on the next change)
    } finally {
      setSaving(false)
    }
  }

  function startPresentation() {
    // Placeholder-text guard: warn before presenting with unfilled content
    const placeholderPrompts = new Set(['', 'Title Slide', 'Question text...', 'Prompt text...'])
    const placeholderOption = 'Option 1'
    let flagged = 0
    for (const s of presentation.slides) {
      const anyS = s as unknown as {
        question?: string; heading?: string; title?: string; quote?: string; caption?: string
        options?: string[]
      }
      const mainPrompt = (anyS.question ?? anyS.heading ?? anyS.title ?? anyS.quote ?? anyS.caption ?? '').trim()
      if (placeholderPrompts.has(mainPrompt)) {
        flagged++
        continue
      }
      if (Array.isArray(anyS.options) && anyS.options.length > 0
        && anyS.options.every((o, i) => (o ?? '').trim() === `Option ${i + 1}` || (o ?? '').trim() === placeholderOption)) {
        flagged++
      }
    }
    if (flagged > 0) {
      const ok = window.confirm(`${flagged} slides still have placeholder text. Present anyway?`)
      if (!ok) return
    }
    localStorage.setItem('quizotic_active_presentation', JSON.stringify(presentation))
    lastSavedRef.current = JSON.stringify(presentation)
    clearDraft(draftKey('presentation', presentation.id))
    router.push('/host/present/session')
  }

  async function handleSaveAndPresent() {
    if (starting) return
    setStarting(true)
    setStartError(null)
    try {
      await savePresentation()
      startPresentation()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      setStartError(msg)
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

  // Auto-save with 3s debounce (via shared hook)
  useAutosave(presentation, (snap) => {
    if (!hasLoadedRef.current) return
    if (JSON.stringify(snap) === lastSavedRef.current) return
    lastSavedRef.current = JSON.stringify(snap)
    savePresentation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { delayMs: 3000 })

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



  async function importPptx(file: File) {
    if (file.size > 20 * 1024 * 1024) { alert('PPTX must be under 20 MB'); return }
    setPptxImporting(true)
    setPptxPercent(5)
    setPptxProgress('Uploading file...')
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress while server processes (rendering takes time)
      setPptxPercent(10)
      setPptxProgress('Converting slides...')
      const progressTimer = setInterval(() => {
        setPptxPercent(prev => Math.min(prev + 2, 85))
      }, 1500)

      const res = await fetch('/api/parse-pptx', { method: 'POST', body: formData })
      clearInterval(progressTimer)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(err.error || 'PPTX import failed')
      }
      setPptxPercent(90)
      setPptxProgress('Loading slides...')
      const { slides: mappedSlides, title } = await res.json() as {
        slides: { suggestedType: 'image'; imageUrl: string; caption: string; aiContext?: string; originalIndex: number }[]
        title?: string
      }
      setPptxPercent(95)
      setPptxProgress(`Creating ${mappedSlides.length} slides...`)

      const newSlides: Slide[] = mappedSlides.map(ms => ({
        id: crypto.randomUUID(),
        type: 'image' as const,
        imageUrl: ms.imageUrl,
        caption: ms.caption,
        // Store extracted text as hidden metadata for AI enhancement
        ...(ms.aiContext ? { _aiContext: ms.aiContext } : {}),
      }))

      const insertAt = activeIndex + 1
      setPresentation(prev => {
        const slides = [...prev.slides]
        slides.splice(insertAt, 0, ...newSlides)
        const newTitle = title && prev.title === 'Untitled Presentation' ? title : prev.title
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

  return (
    <div className="h-screen flex flex-col" style={{ background: '#FAFBFC', fontFamily: 'var(--font-body)' }}>

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
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black" style={{ background: '#F5E642', color: '#0D0D0D' }}>Q</div>
            <span className="text-sm font-extrabold hidden sm:inline" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Quizotic</span>
          </div>
          {plan === 'free' && (
            <button onClick={() => router.push('/host/billing')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:scale-105 click-bounce-sm flex-shrink-0" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M2.5 12.5h11v1.5h-11zM1 7l3-4 4 3 4-5 3 6H1z"/></svg>
              Upgrade
            </button>
          )}
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
            {hasPptxContent && (
              <button onClick={() => setEnhanceOpen(true)} title="Enhance with AI"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02] click-bounce"
                style={{ background: '#EEF2FF', color: '#4F46E5', border: '1.5px solid #C7D2FE' }}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1zM3 11l.75 1.75L5.5 13.5l-1.75.75L3 16l-.75-1.75L.5 13.5l1.75-.75L3 11z"/></svg>
                Enhance with AI
              </button>
            )}
            <button onClick={() => setShareOpen(true)} title="Share"
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg border flex items-center justify-center transition-all hover:bg-gray-50 click-bounce"
              style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4"><path d="M15 7a3 3 0 100-6 3 3 0 000 6zM5 13a3 3 0 100-6 3 3 0 000 6zM15 19a3 3 0 100-6 3 3 0 000 6zM7.59 11.51l4.83 2.98M12.41 5.51L7.59 8.49" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={savePresentation} disabled={saving}
              className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-xl border-2 transition-all disabled:opacity-50 click-bounce"
              style={{ borderColor: saved ? '#16A34A' : '#E2E8F0', color: saved ? '#16A34A' : '#0F1B3D', background: saved ? '#F0FDF4' : '#fff' }}>
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving
                </span>
              ) : saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={handleSaveAndPresent} disabled={starting}
              className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-5 md:py-2 rounded-xl transition-all hover:scale-[1.02] click-bounce disabled:opacity-60"
              style={{ background: '#F5E642', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
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

      {/* ── Body — 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Slide thumbnails + actions */}
        <div className="hidden md:flex w-52 flex-shrink-0 border-r flex-col" style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>

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
                {pptxImportedCount > 0 ? `Import PPTX (${pptxImportedCount} added)` : 'Import PPTX'}
                <input type="file" accept=".pptx" className="hidden"
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

        {/* CENTER: WYSIWYG Preview */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto" style={{ background: '#E8ECF0' }}>
          {activeSlide ? (
            <div className="w-full max-w-4xl px-4 py-4">
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
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <SlideEditor slide={activeSlide} onChange={updateSlide} />

                {/* Background color picker (all slides) */}
                <div className="border-t pt-4 space-y-3" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Background</label>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...activeSlide }
                        if (activeSlide.type === 'title') {
                          updateSlide({ ...copy, bgColor: '#FAFAF8' } as Slide)
                        } else {
                          delete (copy as Record<string, unknown>).bgColor
                          updateSlide(copy as Slide)
                        }
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all"
                      style={
                        !activeSlide.bgColor || (activeSlide.type === 'title' && activeSlide.bgColor === '#FAFAF8')
                          ? { background: '#0F1B3D', color: '#F5E642', border: '1.5px solid #0F1B3D' }
                          : { background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }
                      }
                    >
                      Auto
                    </button>
                  </div>

                  {/* Preset swatches */}
                  <div className="flex flex-wrap gap-1.5">
                    {['#0F1B3D','#1E293B','#FFFFFF','#FAFAF8','#E8F0FE','#F3E8FF','#DCFCE7','#FEE2E2','#FEF3C7','#E0F2FE','#FFE4E6','#EEF2FF'].map(color => {
                      const isActive = activeSlide.bgColor?.toUpperCase() === color.toUpperCase()
                      return (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          onClick={() => updateSlide({ ...activeSlide, bgColor: color } as Slide)}
                          className="w-7 h-7 rounded-full transition-all hover:scale-110"
                          style={{
                            background: color,
                            border: isActive ? '2.5px solid #0F1B3D' : '1.5px solid #CBD5E1',
                            boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px #0F1B3D` : undefined,
                            outline: color === '#FFFFFF' || color === '#FAFAF8' ? '1px solid #E2E8F0' : undefined,
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Hex input + color picker */}
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                    <label className="w-5 h-5 rounded flex-shrink-0 cursor-pointer overflow-hidden relative" style={{ border: '1px solid #CBD5E1' }}>
                      <div className="absolute inset-0" style={{ background: activeSlide.bgColor || '#ffffff' }} />
                      <input
                        type="color"
                        value={activeSlide.bgColor || '#ffffff'}
                        onChange={e => updateSlide({ ...activeSlide, bgColor: e.target.value } as Slide)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <span className="text-xs font-mono font-bold" style={{ color: '#94A3B8' }}>#</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={bgHexInput !== '' ? bgHexInput : (activeSlide.bgColor || '#ffffff').replace('#', '').toUpperCase()}
                      onFocus={() => setBgHexInput((activeSlide.bgColor || '#ffffff').replace('#', '').toUpperCase())}
                      onBlur={() => setBgHexInput('')}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
                        setBgHexInput(raw.toUpperCase())
                        if (raw.length === 6) {
                          updateSlide({ ...activeSlide, bgColor: `#${raw}` } as Slide)
                          setBgHexInput('')
                        }
                      }}
                      className="flex-1 bg-transparent text-xs font-mono font-bold outline-none uppercase"
                      style={{ color: '#374151' }}
                      placeholder="000000"
                    />
                  </div>
                </div>

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

                {/* ── Background Image ── */}
                <div className="border-t pt-4 space-y-2.5" style={{ borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Background image</label>
                    {!activeSlide.backgroundImageUrl && (
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
                                updateSlide({ ...activeSlide, backgroundImageUrl: data.url } as Slide)
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
                  {activeSlide.backgroundImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: '1.5px solid #E2E8F0' }}>
                      <img src={activeSlide.backgroundImageUrl} alt="Background" className="w-full h-24 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = { ...activeSlide }
                          delete (copy as Record<string, unknown>).backgroundImageUrl
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
                          ? { background: '#0F1B3D', color: '#F5E642', border: '1.5px solid #0F1B3D' }
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
          onClick={() => setAddSlideOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-sm transition-all"
          style={{ background: '#0F1B3D', color: '#fff' }}>
          <span>+</span> Add Slide
        </button>
        {activeSlide && (
          <button
            onClick={() => setMobileSlideEditorOpen(true)}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
            style={{ background: '#F5E642', color: '#0D0D0D', border: '1.5px solid rgba(15,27,61,0.2)' }}>
            ✏️ Edit
          </button>
        )}
      </div>

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
                  style={{ background: '#0F1B3D', color: '#F5E642' }}
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
              style={{ background: '#0F1B3D', color: '#F5E642' }}
            >{starting ? 'Saving…' : <>&#9654; Save &amp; Present</>}</button>
          </div>
        </>
      )}

      {/* ── Post-Import Enhance Prompt ── */}
      {showEnhancePrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border"
          style={{ background: '#fff', borderColor: '#C7D2FE', maxWidth: 480 }}>
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
      )}

      {/* ── Enhance with AI Modal ── */}
      {enhanceOpen && (
        <EnhanceWithAI
          presentation={presentation}
          onComplete={handleEnhanceComplete}
          onCancel={() => setEnhanceOpen(false)}
        />
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
