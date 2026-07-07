'use client'

/**
 * Dev-only preview: every interactive slide type rendered as
 * Host view (left) + Participant view (right), side by side.
 * No auth, no socket, no DB — static samples.
 * URL: http://localhost:4000/dev/slide-preview
 */

import React from 'react'
import { ANSWER_LETTERS } from '@/lib/answer-colors'

// ─── Sample data ──────────────────────────────────────────────────────────────

const OPTION_COLORS_P = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F', '#0F1B3D']
const BAR_COLORS = ['#0F1B3D', '#FF8A47', '#0891B2', '#16A34A', '#F59E0B']
const VOTER_COLORS = ['#0F1B3D', '#FF8A47', '#0891B2', '#16A34A', '#EA580C', '#FFD166', '#DC2626']

type SlideSample =
  | { type: 'multiple_choice'; question: string; options: string[]; counts: number[]; total: number }
  | { type: 'quick_fire'; question: string; options: string[]; counts: number[]; total: number; secondsLeft: number; durationSeconds: number }
  | { type: 'word_duel'; question: string; optionA: string; optionB: string; counts: [number, number]; total: number }
  | { type: 'live_race'; question: string; options: string[]; counts: number[]; total: number }
  | { type: 'image_choice'; question: string; options: string[]; imageUrls: string[]; counts: number[]; total: number }
  | { type: 'open_text'; question: string; words: Record<string, number>; total: number }
  | { type: 'word_cloud'; question: string; maxWords: number; words: Record<string, number>; total: number }
  | { type: 'rating_scale'; question: string; minLabel: string; maxLabel: string; maxRating: 5; avg: number; total: number }
  | { type: 'scale_100'; question: string; minLabel: string; maxLabel: string; avg: number; total: number }
  | { type: 'ranking'; question: string; items: string[]; counts: number[]; total: number }
  | { type: 'emoji_pulse'; question: string; emojis: string[]; counts: Record<string, number>; total: number }
  | { type: 'pinpoint'; question: string; imageUrl?: string; pins: { x: number; y: number }[] }
  | { type: 'grid_2x2'; question: string; xLabel: string; yLabel: string; xMin: string; xMax: string; yMin: string; yMax: string; pins: { x: number; y: number }[] }
  | { type: 'wheel'; title: string; names: string[] }

const SAMPLES: SlideSample[] = [
  { type: 'multiple_choice', question: "Which is India's largest port by cargo volume?", options: ['JNPT (Mumbai)', 'Mundra', 'Chennai', 'Kolkata'], counts: [8, 22, 12, 4], total: 46 },
  { type: 'quick_fire', question: 'Capital of Karnataka?', options: ['Chennai', 'Bengaluru', 'Hyderabad', 'Mumbai'], counts: [3, 28, 6, 1], total: 38, secondsLeft: 3, durationSeconds: 10 },
  { type: 'word_duel', question: 'Tea or Coffee?', optionA: 'Tea', optionB: 'Coffee', counts: [34, 19], total: 53 },
  { type: 'live_race', question: 'Name a state that borders Nepal', options: ['Bihar', 'UP', 'Uttarakhand', 'Sikkim', 'West Bengal'], counts: [9, 14, 5, 7, 11], total: 46 },
  { type: 'image_choice', question: 'Which one is the Taj Mahal?', options: ['Taj Mahal', 'Red Fort', 'Qutub Minar', 'India Gate'],
    imageUrls: [
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=400',
      'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400',
      'https://images.unsplash.com/photo-1548013146-72479768bada?w=400',
      'https://images.unsplash.com/photo-1597040663236-57a3ee5a0d06?w=400',
    ],
    counts: [30, 6, 4, 5], total: 45 },
  { type: 'open_text', question: 'Describe this session in a sentence', total: 27,
    words: { 'insightful': 6, 'engaging': 5, 'fast paced': 4, 'excellent': 4, 'eye opening': 3, 'useful': 3, 'fun': 2 } },
  { type: 'word_cloud', question: 'One word for monsoon?', maxWords: 1, total: 58,
    words: { chai: 18, pakora: 14, rain: 12, petrichor: 9, traffic: 8, umbrella: 7, muddy: 5, relief: 4, romance: 4 } },
  { type: 'rating_scale', question: 'Rate this session', minLabel: 'Not useful', maxLabel: 'Very useful', maxRating: 5, avg: 4.3, total: 41 },
  { type: 'scale_100', question: 'How ready is your team for AI adoption?', minLabel: 'Not at all', maxLabel: 'Fully ready', avg: 62, total: 35 },
  { type: 'ranking', question: 'Rank these cities by population (top choice)', items: ['Mumbai', 'Delhi', 'Bengaluru', 'Kolkata'], counts: [21, 15, 6, 4], total: 46 },
  { type: 'emoji_pulse', question: 'How are you feeling right now?', emojis: ['❤️', '😂', '🔥', '😮'],
    counts: { '❤️': 14, '😂': 9, '🔥': 22, '😮': 6 }, total: 51 },
  { type: 'pinpoint', question: 'Tap where you grew up',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/A_large_blank_world_map_with_oceans_marked_in_blue.svg/1280px-A_large_blank_world_map_with_oceans_marked_in_blue.svg.png',
    pins: [{ x: 72, y: 45 }, { x: 74, y: 48 }, { x: 71, y: 44 }, { x: 30, y: 38 }, { x: 52, y: 30 }, { x: 78, y: 52 }, { x: 20, y: 60 }] },
  { type: 'grid_2x2', question: 'Plot your priorities', xLabel: 'Urgency', yLabel: 'Importance', xMin: 'Low', xMax: 'High', yMin: 'Low', yMax: 'High',
    pins: [{ x: 75, y: 80 }, { x: 40, y: 55 }, { x: 85, y: 30 }, { x: 20, y: 75 }, { x: 60, y: 60 }, { x: 90, y: 90 }] },
  { type: 'wheel', title: 'Pick a team lead', names: ['Asha', 'Rohit', 'Priya', 'Vikram', 'Meera', 'Kabir'] },
]

// ─── Shared sub-renderers (mirror real code styles) ──────────────────────────

function LiveVerticalBars({ options, counts, total, colors }: { options: string[]; counts: number[]; total: number; colors: string[] }) {
  const max = Math.max(...counts, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 32, flex: 1, minHeight: 200 }}>
      {options.map((opt, i) => {
        const count = counts[i] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const heightPct = count > 0 ? Math.max(3, (count / max) * 100) : 0
        const isLeading = count > 0 && count === max
        const color = colors[i % colors.length]
        return (
          <div key={i} style={{ flex: '1 1 0', minWidth: 0, maxWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              {count > 0 && (
                <span style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{count}</span>
              )}
              <div style={{
                width: '100%', height: `${heightPct}%`, minHeight: count > 0 ? 6 : 0,
                borderRadius: '10px 10px 4px 4px',
                background: isLeading
                  ? `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`
                  : `linear-gradient(180deg, ${color}77 0%, ${color}44 100%)`,
                boxShadow: isLeading ? `0 0 20px ${color}55, 0 -2px 10px ${color}33` : 'none',
              }} />
            </div>
            <div style={{ width: '100%', height: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 1, margin: '3px 0' }} />
            <div style={{ textAlign: 'center', paddingTop: 4 }}>
              <div style={{ fontSize: options.length > 4 ? 15 : 18, fontWeight: 700, color: '#0F1B3D', lineHeight: 1.3 }}>
                {opt}
              </div>
              <div style={{ fontSize: 15, color, fontWeight: 700, marginTop: 3 }}>{pct}%</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WordCloud({ words }: { words: Record<string, number> }) {
  const entries = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 30)
  const max = entries[0]?.[1] ?? 1
  const colors = ['#0F1B3D', '#FF8A47', '#0891B2', '#16A34A', '#EA580C', '#6B8AFF']
  return (
    <div className="flex flex-wrap gap-2 items-center justify-center min-h-[80px]">
      {entries.map(([word, count], i) => {
        const size = 14 + Math.round((count / max) * 26)
        return (
          <span key={word} className="font-bold leading-tight" style={{ fontSize: size, color: colors[i % colors.length] }}>
            {word}
          </span>
        )
      })}
    </div>
  )
}

function PollBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xl font-semibold" style={{ color: '#0F1B3D' }}>{label}</span>
        <span className="text-xl font-bold tabular-nums" style={{ color }}>
          {count} <span className="text-base font-normal opacity-60">({pct}%)</span>
        </span>
      </div>
      <div className="h-10 rounded-full overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
      </div>
    </div>
  )
}

// ─── Host rendering (matches session/page.tsx SlideContent) ───────────────────

function HostView({ s }: { s: SlideSample }) {
  const h: React.CSSProperties = { fontFamily: 'var(--font-heading)', color: '#0F1B3D', fontWeight: 900 }

  switch (s.type) {
    case 'multiple_choice':
    case 'quick_fire':
    case 'live_race':
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="text-3xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex-1 min-h-0 flex flex-col justify-end">
            <LiveVerticalBars options={s.options} counts={s.counts} total={s.total} colors={BAR_COLORS} />
          </div>
        </div>
      )
    case 'word_duel':
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="text-3xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex-1 min-h-0 flex flex-col justify-end">
            <LiveVerticalBars options={[s.optionA, s.optionB]} counts={s.counts} total={s.total} colors={['#2563EB', '#DC2626']} />
          </div>
        </div>
      )
    case 'image_choice':
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="text-3xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex-1 min-h-0 grid grid-cols-4 gap-3">
            {s.options.map((opt, i) => (
              <div key={i} className="flex flex-col rounded-xl overflow-hidden border" style={{ borderColor: '#DBEAFE' }}>
                <img src={s.imageUrls[i]} alt={opt} className="w-full h-32 object-cover" />
                <div className="flex-1 flex flex-col items-center justify-center py-2 bg-white">
                  <div className="text-sm font-bold" style={{ color: '#0F1B3D' }}>{opt}</div>
                  <div className="text-2xl font-black" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                    {s.counts[i]} <span className="text-sm font-normal opacity-60">({Math.round((s.counts[i] / s.total) * 100)}%)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    case 'open_text':
    case 'word_cloud':
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="text-4xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex-1 flex items-center justify-center">
            <WordCloud words={s.words} />
          </div>
        </div>
      )
    case 'rating_scale':
      return (
        <div className="flex flex-col h-full gap-5">
          <h2 className="text-4xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex items-center justify-between text-xl font-semibold flex-shrink-0" style={{ color: '#9CA3AF' }}>
            <span>{s.minLabel}</span><span>{s.maxLabel}</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-7xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>{s.avg.toFixed(1)}</p>
              <p className="text-xl mt-2" style={{ color: '#6B7280' }}>average rating · {s.total} responses</p>
            </div>
          </div>
        </div>
      )
    case 'scale_100':
      return (
        <div className="flex flex-col h-full gap-5">
          <h2 className="text-4xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex items-center justify-between text-xl font-semibold flex-shrink-0" style={{ color: '#9CA3AF' }}>
            <span>0 · {s.minLabel}</span><span>{s.maxLabel} · 100</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-7xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>{Math.round(s.avg)}</p>
              <p className="text-xl mt-2" style={{ color: '#6B7280' }}>average · {s.total} responses</p>
            </div>
          </div>
        </div>
      )
    case 'ranking':
      return (
        <div className="flex flex-col h-full gap-4">
          <h2 className="text-4xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-3">
              {s.items.map((item, i) => (
                <PollBar key={i} label={item} count={s.counts[i]} total={s.total} color="#4F46E5" />
              ))}
            </div>
          </div>
        </div>
      )
    case 'emoji_pulse':
      return (
        <div className="flex flex-col h-full gap-5">
          <h2 className="text-4xl leading-snug flex-shrink-0" style={h}>{s.question}</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-wrap gap-8 justify-center">
              {s.emojis.map(em => (
                <div key={em} className="flex flex-col items-center gap-2">
                  <span className="text-6xl">{em}</span>
                  <span className="text-2xl font-black" style={{ color: '#0F1B3D' }}>{s.counts[em] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'pinpoint':
      return (
        <div className="space-y-3">
          <h2 className="text-2xl" style={h}>{s.question}</h2>
          <div className="relative rounded-2xl overflow-hidden border" style={{ aspectRatio: '4/3', background: '#000', borderColor: '#DBEAFE' }}>
            {s.imageUrl && <img src={s.imageUrl} alt="" className="w-full h-full object-contain pointer-events-none" />}
            {s.pins.map((p, i) => (
              <div key={i} className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60"
                style={{ left: `${p.x}%`, top: `${p.y}%`, background: VOTER_COLORS[i % VOTER_COLORS.length], opacity: 0.85 }} />
            ))}
          </div>
          <p className="text-sm text-center" style={{ color: '#9CA3AF' }}>{s.pins.length} pins placed</p>
        </div>
      )
    case 'grid_2x2':
      return (
        <div className="space-y-3">
          <h2 className="text-2xl" style={h}>{s.question}</h2>
          <div className="relative flex">
            <div className="flex flex-col justify-between items-center py-2 mr-2" style={{ width: 24 }}>
              <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{s.yMax}</span>
              <span className="text-[10px] font-bold" style={{ color: '#9CA3AF', writingMode: 'vertical-lr' as const }}>{s.yLabel}</span>
              <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{s.yMin}</span>
            </div>
            <div className="flex-1">
              <div className="relative rounded-xl overflow-hidden border" style={{ aspectRatio: '1', background: '#FAFAFE', borderColor: '#DBEAFE' }}>
                <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: '#E5E7EB' }} />
                <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: '#E5E7EB' }} />
                {s.pins.map((p, i) => (
                  <div key={i} className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80"
                    style={{ left: `${p.x}%`, top: `${100 - p.y}%`, background: VOTER_COLORS[i % VOTER_COLORS.length], opacity: 0.85 }} />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{s.xMin}</span>
                <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{s.xLabel}</span>
                <span className="text-[10px] font-bold" style={{ color: '#9CA3AF' }}>{s.xMax}</span>
              </div>
            </div>
          </div>
        </div>
      )
    case 'wheel':
      return (
        <div className="space-y-4">
          <h2 className="text-2xl" style={h}>{s.title}</h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(s.names.length, 4)}, 1fr)` }}>
            {s.names.map((name, i) => (
              <div key={i} className="px-4 py-3 rounded-xl text-center font-bold text-sm"
                style={{
                  background: i === 2 ? '#FACC15' : '#F3F4F6',
                  color: i === 2 ? '#fff' : '#1E1B4B',
                  transform: i === 2 ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: i === 2 ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                }}>
                {name}
              </div>
            ))}
          </div>
          <div className="text-center py-2">
            <p className="text-4xl font-black" style={{ fontFamily: 'var(--font-heading)', color: '#FACC15' }}>{s.names[2]}</p>
          </div>
          <button className="w-full py-4 rounded-xl text-lg font-bold"
            style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}>
            Spin Again
          </button>
        </div>
      )
  }
}

// ─── Participant rendering (matches join/page.tsx presenter branches) ────────

function ParticipantView({ s }: { s: SlideSample }) {
  const textLight = 'white'
  const title = 'title' in s ? s.title : ''
  const question = 'question' in s ? s.question : title

  return (
    <div className="h-full flex flex-col p-4 gap-4" style={{ background: '#0F1B3D' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold opacity-40" style={{ color: textLight }}>Slide 3 / 14</span>
        <span className="text-xs font-semibold" style={{ color: '#FBD13B' }}>AI Training Workshop</span>
      </div>
      <h2 className="text-xl font-black leading-snug" style={{ color: textLight }}>{question}</h2>

      <div className="flex-1 flex flex-col justify-center gap-3 overflow-auto">
        {s.type === 'image_choice' && (
          <div className="grid grid-cols-2 gap-3">
            {s.options.map((opt, i) => (
              <button key={i} className="rounded-2xl overflow-hidden border-2 border-transparent"
                style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length] }}>
                <img src={s.imageUrls[i]} alt={opt} className="w-full h-24 object-cover" />
                <div className="px-3 py-2 text-white font-bold text-sm text-center">{opt}</div>
              </button>
            ))}
          </div>
        )}

        {(s.type === 'multiple_choice' || s.type === 'quick_fire') && (
          <>
            {s.type === 'quick_fire' && (
              <div className="w-full text-center mb-2">
                <p className="text-4xl font-black" style={{ color: s.secondsLeft <= 2 ? '#EF4444' : '#FBD13B' }}>{s.secondsLeft}</p>
                <div className="h-2 rounded-full w-full mt-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(s.secondsLeft / s.durationSeconds) * 100}%`,
                    background: s.secondsLeft <= 2 ? '#EF4444' : '#FBD13B',
                  }} />
                </div>
              </div>
            )}
            {s.options.map((opt, i) => (
              <button key={i} className="w-full py-4 rounded-2xl text-left px-5 text-base font-bold"
                style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length], color: '#fff' }}>
                <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm mr-3 font-black"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {ANSWER_LETTERS[i % ANSWER_LETTERS.length]}
                </span>
                {opt}
              </button>
            ))}
          </>
        )}

        {s.type === 'word_duel' && (
          <div className="grid grid-cols-2 gap-3">
            {[s.optionA, s.optionB].map((opt, i) => (
              <button key={i} className="py-8 rounded-2xl text-center text-xl font-black"
                style={{ background: i === 0 ? '#2563EB' : '#DC2626', color: '#fff' }}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {(s.type === 'live_race' || s.type === 'ranking') && (
          <div className="space-y-2.5">
            {s.type === 'ranking' && (
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>Vote for your top choice</p>
            )}
            {(s.type === 'ranking' ? s.items : s.options).map((opt, i) => (
              <button key={i} className="w-full py-3 rounded-2xl text-left px-4 text-sm font-bold"
                style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length], color: '#fff' }}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {(s.type === 'word_cloud' || s.type === 'open_text') && (
          <div className="space-y-3">
            <input type="text"
              placeholder={s.type === 'word_cloud' ? (s.maxWords === 1 ? 'Type a word…' : `Type up to ${s.maxWords} words…`) : 'Type your response…'}
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#fff' }}
            />
            {s.type === 'word_cloud' && s.maxWords === 1 && (
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>One word only</p>
            )}
            <button className="w-full py-4 rounded-2xl text-lg font-black"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Submit</button>
          </div>
        )}

        {s.type === 'rating_scale' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs opacity-50" style={{ color: textLight }}>
              <span>{s.minLabel}</span><span>{s.maxLabel}</span>
            </div>
            <div className="flex justify-center gap-2">
              {Array.from({ length: s.maxRating }).map((_, i) => (
                <button key={i} className="text-4xl" style={{ color: i < 4 ? '#FACC15' : 'rgba(255,255,255,0.25)' }}>★</button>
              ))}
            </div>
            <button className="w-full py-4 rounded-2xl text-lg font-black"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Submit</button>
          </div>
        )}

        {s.type === 'scale_100' && (
          <div className="space-y-3">
            <input type="range" min={0} max={100} defaultValue={50} className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs opacity-50" style={{ color: textLight }}>
              <span>0 · {s.minLabel}</span><span>{s.maxLabel} · 100</span>
            </div>
            <button className="w-full py-4 rounded-2xl text-lg font-black"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Submit</button>
          </div>
        )}

        {s.type === 'emoji_pulse' && (
          <div className="grid grid-cols-2 gap-3">
            {s.emojis.map(em => (
              <button key={em} className="py-6 rounded-2xl text-4xl"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                {em}
              </button>
            ))}
          </div>
        )}

        {s.type === 'pinpoint' && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '4/3', background: '#000' }}>
              {s.imageUrl && <img src={s.imageUrl} alt="" className="w-full h-full object-contain" />}
              <div className="absolute w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2"
                style={{ left: '50%', top: '50%', background: '#FBD13B' }} />
            </div>
            <p className="text-xs text-center opacity-60" style={{ color: textLight }}>Tap the image to place your pin</p>
            <button className="w-full py-4 rounded-2xl text-lg font-black"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Submit</button>
          </div>
        )}

        {s.type === 'grid_2x2' && (
          <div className="space-y-3">
            <div className="relative flex">
              <div className="flex flex-col justify-between items-center py-1 mr-1.5" style={{ width: 18 }}>
                <span className="text-[9px] font-bold opacity-60" style={{ color: textLight }}>{s.yMax}</span>
                <span className="text-[9px] font-bold opacity-60" style={{ color: textLight, writingMode: 'vertical-lr' as const }}>{s.yLabel}</span>
                <span className="text-[9px] font-bold opacity-60" style={{ color: textLight }}>{s.yMin}</span>
              </div>
              <div className="flex-1">
                <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                  <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  <div className="absolute w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2"
                    style={{ left: '60%', top: '40%', background: '#FBD13B' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] font-bold opacity-60" style={{ color: textLight }}>{s.xMin}</span>
                  <span className="text-[9px] font-bold opacity-60" style={{ color: textLight }}>{s.xLabel}</span>
                  <span className="text-[9px] font-bold opacity-60" style={{ color: textLight }}>{s.xMax}</span>
                </div>
              </div>
            </div>
            <button className="w-full py-4 rounded-2xl text-lg font-black"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Submit</button>
          </div>
        )}

        {s.type === 'wheel' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-center opacity-60" style={{ color: textLight }}>
              Watch the host&apos;s screen — no input needed
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<SlideSample['type'], string> = {
  multiple_choice: 'Multiple Choice',
  quick_fire: 'Quick Fire (timed)',
  word_duel: 'Word Duel (A vs B)',
  live_race: 'Live Race',
  image_choice: 'Image Choice',
  open_text: 'Open Text',
  word_cloud: 'Word Cloud',
  rating_scale: 'Rating Scale (stars)',
  scale_100: '100-Point Scale',
  ranking: 'Ranking',
  emoji_pulse: 'Emoji Pulse',
  pinpoint: 'Pinpoint (map/image)',
  grid_2x2: '2×2 Grid',
  wheel: 'Wheel of Names',
}

export default function SlidePreviewPage() {
  return (
    <main className="min-h-screen px-8 py-10" style={{ background: '#F3F4F6' }}>
      <header className="max-w-7xl mx-auto mb-10">
        <h1 className="text-4xl font-black" style={{ color: '#0F1B3D' }}>Slide Preview — Host vs Participant</h1>
        <p className="text-base mt-2" style={{ color: '#6B7280' }}>
          Static preview of all {SAMPLES.length} interactive slide types, showing the presenter screen (left) and the participant phone (right) side-by-side with realistic sample data. Dev-only.
        </p>
      </header>

      <div className="max-w-7xl mx-auto space-y-12">
        {SAMPLES.map((s, idx) => (
          <section key={idx} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: '#0F1B3D', color: 'white' }}>{idx + 1}</span>
              <h2 className="text-2xl font-black" style={{ color: '#0F1B3D' }}>{TYPE_LABELS[s.type]}</h2>
              <code className="text-sm" style={{ color: '#9CA3AF' }}>{s.type}</code>
            </div>

            <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 380px' }}>
              {/* HOST (desktop 16:9) */}
              <div>
                <div className="text-[11px] uppercase font-black mb-2 tracking-wider" style={{ color: '#6B7280' }}>Host — presenter screen</div>
                <div className="rounded-2xl bg-white shadow-sm border overflow-hidden" style={{ borderColor: '#E5E7EB', aspectRatio: '16/9' }}>
                  <div className="w-full h-full p-8 overflow-hidden">
                    <HostView s={s} />
                  </div>
                </div>
              </div>
              {/* PARTICIPANT (phone) */}
              <div>
                <div className="text-[11px] uppercase font-black mb-2 tracking-wider" style={{ color: '#6B7280' }}>Participant — phone</div>
                <div className="rounded-[32px] overflow-hidden shadow-lg mx-auto" style={{ width: 360, height: 640, border: '10px solid #1F2937' }}>
                  <ParticipantView s={s} />
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
