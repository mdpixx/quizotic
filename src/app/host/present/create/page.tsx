'use client'

import React, { useState, useCallback, useEffect, Suspense } from 'react'
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

// ─── Slide type descriptions ──────────────────────────────────────────────────

const SLIDE_DESCRIPTIONS: Record<SlideType, string> = {
  multiple_choice: 'Participants pick from up to 4 options. Optionally reveal the correct answer after voting.',
  open_text:       'Audience types a free-text response. Answers appear as animated text on screen.',
  word_cloud:      'Each person submits 1–3 words. Frequent words grow larger in the live cloud.',
  rating_scale:    'Rate on a star or numeric scale (1–5, 1–7, 1–10). See the score distribution live.',
  ranking:         'Participants drag items into their preferred order. Live results show the consensus.',
  image_choice:    'Pick between visual options. Image cards with live vote percentages.',
  scale_100:       'Drag a dial anywhere from 0 to 100. Great for agreement or confidence checks.',
  pinpoint:        'Participants click a spot on an image or diagram. Dots cluster on the live view.',
  grid_2x2:        'Place a dot on a 2×2 quadrant (e.g. easy/hard × fun/boring). Great for retrospectives.',
  wheel:           'Spin a wheel to randomly pick a name or option from your list.',
  word_duel:       'Two sides battle for votes. Audience splits left or right — watch the bar shift.',
  live_race:       'Racing bar chart — votes animate the bars in real time. High energy!',
  emoji_pulse:     'Audience taps an emoji reaction. See the mood of the room at a glance.',
  quick_fire:      'Fast-paced vote with a countdown timer — no time to overthink!',
  title:           'Full-screen title slide for introducing a section or kicking off your session.',
  bullets:         'Display a list of key points. Presenter-led content, no audience input needed.',
  quote:           'A full-screen quote to inspire or frame a discussion moment.',
  video:           'Play a YouTube or Vimeo video inline during your presentation.',
  image:           'Display a full-screen image. Use "Import PDF" to add presentation slides as images.',
}

// ─── Slide editor fields per type ─────────────────────────────────────────────

function SlideEditor({ slide, onChange }: { slide: Slide; onChange: (s: Slide) => void }) {
  const update = (patch: Partial<Slide>) => onChange({ ...slide, ...patch } as Slide)

  const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-colors"
  const inputStyle = { borderColor: '#E9E2FF', color: '#1A0A2E', background: '#fff' }
  const labelClass = "block text-xs font-semibold mb-1.5"
  const labelStyle = { color: '#6B4FA0' }

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
                style={{ background: ['#3B82F6','#4361EE','#FF6B6B','#16A34A'][i] }}>
                {['A','B','C','D'][i]}
              </span>
              <input className={inputClass} style={inputStyle} value={opt}
                onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
                placeholder={`Option ${['A','B','C','D'][i]}`} />
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
            {[1,2,3].map(n => <option key={n} value={n}>{n} word{n > 1 ? 's' : ''}</option>)}
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
            onChange={e => update({ maxRating: Number(e.target.value) as 5|7|10 })}>
            <option value={5}>1–5 stars</option>
            <option value={7}>1–7 scale</option>
            <option value={10}>1–10 scale</option>
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
                style={{ background: '#F0F4FF', color: 'var(--color-primary)' }}>{i+1}</span>
              <input className={inputClass} style={inputStyle} value={item}
                onChange={e => { const items = [...slide.items]; items[i] = e.target.value; update({ items }) }}
                placeholder={`Item ${i+1}`} />
              {slide.items.length > 2 && (
                <button type="button" onClick={() => update({ items: slide.items.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
              )}
            </div>
          ))}
          {slide.items.length < 6 && (
            <button type="button"
              onClick={() => update({ items: [...slide.items, ''] })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-primary)', background: '#F0F4FF' }}>
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
            onChange={e => update({ question: e.target.value })} placeholder="On a scale of 0–100..." />
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
                style={{ background: ['#3B82F6','#4361EE','#FF6B6B','#16A34A','#F59E0B'][i % 5] }} />
              <input className={inputClass} style={inputStyle} value={opt}
                onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
                placeholder={`Option ${i+1}`} />
              {slide.options.length > 2 && (
                <button type="button" onClick={() => update({ options: slide.options.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
              )}
            </div>
          ))}
          {slide.options.length < 5 && (
            <button type="button" onClick={() => update({ options: [...slide.options, ''] })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--color-primary)', background: '#F0F4FF' }}>
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
              <input key={i} className="text-center text-2xl border rounded-xl w-14 h-14 focus:outline-none focus:ring-2 focus:ring-violet-300"
                style={{ borderColor: '#E9E2FF' }}
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
            onChange={e => update({ question: e.target.value })} placeholder="Quick — vote fast!" />
        </div>
        <div className="space-y-2">
          <label className={labelClass} style={labelStyle}>Options</label>
          {slide.options.map((opt, i) => (
            <input key={i} className={inputClass} style={inputStyle} value={opt}
              onChange={e => { const opts = [...slide.options]; opts[i] = e.target.value; update({ options: opts }) }}
              placeholder={`Option ${i+1}`} />
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
                placeholder={`Name ${i+1}`} />
              {slide.names.length > 2 && (
                <button type="button" onClick={() => update({ names: slide.names.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => update({ names: [...slide.names, ''] })}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--color-primary)', background: '#F0F4FF' }}>
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
              className="w-10 h-10 rounded-lg border cursor-pointer" style={{ borderColor: '#E9E2FF' }} />
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
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
              <input className={inputClass} style={inputStyle} value={b}
                onChange={e => { const bullets = [...slide.bullets]; bullets[i] = e.target.value; update({ bullets }) }}
                placeholder={`Point ${i+1}`} />
              {slide.bullets.length > 1 && (
                <button type="button" onClick={() => update({ bullets: slide.bullets.filter((_, j) => j !== i) })}
                  className="text-xs text-red-400 hover:text-red-600">✕</button>
              )}
            </div>
          ))}
          {slide.bullets.length < 8 && (
            <button type="button" onClick={() => update({ bullets: [...slide.bullets, ''] })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--color-primary)', background: '#F0F4FF' }}>
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
            onChange={e => update({ quote: e.target.value })} placeholder="&ldquo;Type the quote here...&rdquo;" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Attribution</label>
          <input className={inputClass} style={inputStyle} value={slide.attribution}
            onChange={e => update({ attribution: e.target.value })} placeholder="— Author name" />
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
              style={{ background: '#F0F4FF', color: '#4361EE', border: '1.5px solid #DBEAFE' }}>
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
                ✕
              </button>
            )}
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#9CA3AF' }}>
            Paste a URL or upload an image (max 2 MB). Leave blank for a plain canvas.
          </p>
        </div>
        {slide.imageUrl && (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E9E2FF' }}>
            <img src={slide.imageUrl} alt="Pinpoint background" className="w-full object-contain max-h-40" />
          </div>
        )}
        <div className="rounded-xl p-3 text-xs" style={{ background: '#FAF5FF', border: '1px solid #E9D5FF', color: '#7C3AED' }}>
          During the session, participant pins appear as coloured dots on the shared screen in real time.
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
          {/* Mini quadrant preview */}
          <div className="rounded-xl p-3 flex flex-col items-center gap-1" style={{ background: '#F0FDFA', border: '1px solid #99F6E4' }}>
            <span className="text-xs font-bold" style={{ color: '#0D9488' }}>{slide.yMax || 'Y Max'}</span>
            <div className="flex items-center gap-1 w-full">
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#0D9488' }}>{slide.xMin || 'X Min'}</span>
              <div className="grid grid-cols-2 gap-0.5 flex-1">
                {['#CCFBF1','#99F6E4','#99F6E4','#CCFBF1'].map((bg, i) => (
                  <div key={i} className="rounded-md" style={{ background: bg, aspectRatio: '1' }} />
                ))}
              </div>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#0D9488' }}>{slide.xMax || 'X Max'}</span>
            </div>
            <span className="text-xs font-bold" style={{ color: '#0D9488' }}>{slide.yMin || 'Y Min'}</span>
          </div>
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
          <img src={slide.imageUrl} alt="" className="w-full rounded-xl border max-h-64 object-contain" style={{ borderColor: '#E9E2FF' }} />
        )}
        <div>
          <label className={labelClass} style={labelStyle}>Caption (optional)</label>
          <input className={inputClass} style={inputStyle} value={slide.caption}
            onChange={e => update({ caption: e.target.value })} placeholder="Slide title or context..." />
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

// ─── Slide thumbnail ──────────────────────────────────────────────────────────

function SlideThumbnail({ slide, index, active, onClick }: {
  slide: Slide; index: number; active: boolean; onClick: () => void
}) {
  const meta = SLIDE_TYPE_META[slide.type]
  const icon = SLIDE_ICONS[slide.type]

  const getLabel = () => {
    switch (slide.type) {
      case 'title': return (slide as { heading: string }).heading || 'Title Slide'
      case 'bullets': return (slide as { heading: string }).heading || 'Bullet Points'
      case 'quote': return (slide as { quote: string }).quote || 'Quote'
      case 'video': return 'Video'
      case 'image': return (slide as { caption?: string }).caption || 'Image'
      default: return (slide as { question?: string }).question || meta.label
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 transition-all group flex items-start gap-3"
      style={{
        border: active ? `2px solid ${meta.color}` : '2px solid transparent',
        background: active ? meta.bg : '#F8F7FF',
      }}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: active ? meta.color : '#E9E2FF', color: active ? '#fff' : meta.color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: meta.color }}>{index + 1} · {meta.label}</p>
        <p className="text-sm font-medium truncate" style={{ color: active ? '#1A0A2E' : '#6B7280' }}>{getLabel()}</p>
      </div>
    </button>
  )
}

// ─── Slide type picker ────────────────────────────────────────────────────────

function SlideTypePicker({ onPick, onHover }: {
  onPick: (type: SlideType) => void
  onHover: (type: SlideType | null) => void
}) {
  const [hovered, setHovered] = useState<SlideType | null>(null)

  const allByCategory = SLIDE_CATEGORIES.map(cat => ({
    ...cat,
    types: (Object.keys(SLIDE_TYPE_META) as SlideType[]).filter(t => SLIDE_TYPE_META[t].category === cat.id),
  }))

  function handleHover(type: SlideType | null) {
    setHovered(type)
    onHover(type)
  }

  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: '#DBEAFE', background: '#FDFBFF' }}>
      <p className="text-sm font-bold uppercase tracking-widest px-1 pb-2" style={{ color: '#4361EE' }}>Add Slide</p>
      {allByCategory.map((cat, ci) => (
        <div key={cat.id}>
          {ci > 0 && <div className="h-px my-2" style={{ background: '#EEF2FF' }} />}
          <p className="text-[11px] font-black uppercase tracking-widest px-2 py-1" style={{ color: cat.color }}>
            {cat.label}
          </p>
          {cat.types.map(type => {
            const meta = SLIDE_TYPE_META[type]
            const isHov = hovered === type
            return (
              <button key={type} onClick={() => onPick(type)}
                onMouseEnter={() => handleHover(type)}
                onMouseLeave={() => handleHover(null)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-all"
                style={{
                  background: isHov ? meta.bg : 'transparent',
                  border: isHov ? `1px solid ${meta.color}25` : '1px solid transparent',
                }}>
                <span style={{ color: meta.color }}>{SLIDE_ICONS[type]}</span>
                <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</span>
              </button>
            )
          })}
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
  const [hoveredType, setHoveredType] = useState<SlideType | null>(null)
  const [pdfImporting, setPdfImporting] = useState(false)
  const [pdfProgress, setPdfProgress] = useState('')

  // Load existing presentation when editing
  useEffect(() => {
    const editId = searchParams.get('id')
    if (editId) {
      // Load from localStorage by ID
      try {
        const all = JSON.parse(localStorage.getItem('quizotic_presentations') ?? '[]')
        const found = all.find((p: Presentation) => p.id === editId)
        if (found) { setPresentation(found); setActiveIndex(0); return }
      } catch { /* ignore */ }
    }
    // Also try loading from active presentation (coming from session page "Edit slides")
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

  function addSlide(type: SlideType) {
    const newSlide = makeSlide(type)
    setPresentation(prev => {
      const slides = [...prev.slides, newSlide]
      return { ...prev, slides, updatedAt: new Date().toISOString() }
    })
    setActiveIndex(presentation.slides.length)
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
      // Also save to localStorage as fallback
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
    router.push('/host/present/session')
  }

  async function importPdf(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert('PDF must be under 10 MB')
      return
    }
    setPdfImporting(true)
    setPdfProgress('Loading PDF...')

    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const pageCount = pdf.numPages

      if (pageCount > 50) {
        alert('PDF must have 50 pages or fewer')
        setPdfImporting(false)
        return
      }

      const newSlides: Slide[] = []

      for (let i = 1; i <= pageCount; i++) {
        setPdfProgress(`Rendering page ${i} / ${pageCount}...`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2 })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvas, canvasContext: ctx, viewport }).promise

        // Convert to blob for upload
        const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85))

        setPdfProgress(`Uploading page ${i} / ${pageCount}...`)
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

      // Append imported slides after current slides
      setPresentation(prev => ({
        ...prev,
        slides: [...prev.slides, ...newSlides],
        updatedAt: new Date().toISOString(),
      }))
      setActiveIndex(presentation.slides.length) // focus first imported slide
      setPdfProgress('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF import failed')
    } finally {
      setPdfImporting(false)
      setPdfProgress('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FDFBFF', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b" style={{ background: 'rgba(253,251,255,0.96)', backdropFilter: 'blur(8px)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 px-5 h-14">
          <button onClick={() => router.push('/host')}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-violet-50"
            style={{ color: 'var(--color-text-secondary)' }}>
            <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div className="h-5 w-px" style={{ background: 'var(--color-border)' }} />

          {/* Editable title */}
          <input
            value={presentation.title}
            onChange={e => setPresentation(prev => ({ ...prev, title: e.target.value }))}
            className="flex-1 text-sm font-bold bg-transparent focus:outline-none min-w-0"
            style={{ color: 'var(--color-text-primary)' }}
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={savePresentation} disabled={saving}
              className="text-sm font-bold px-5 py-2 rounded-xl border-2 transition-all"
              style={{ borderColor: saved ? '#16A34A' : 'var(--color-border)', color: saved ? '#16A34A' : 'var(--color-primary)', background: saved ? '#F0FDF4' : 'var(--color-surface)' }}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </button>
            <button onClick={() => { savePresentation(); startPresentation() }}
              className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: 'var(--brand-gradient)', color: '#fff', fontFamily: 'var(--font-heading)' }}>
              Save & Present →
            </button>
          </div>
        </div>
      </header>

      {/* Body — 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: slide list + type picker */}
        <div className="w-72 flex-shrink-0 border-r overflow-y-auto p-3 space-y-3" style={{ borderColor: '#DBEAFE', background: '#F8F7FF' }}>
          <div className="space-y-1.5">
            {presentation.slides.map((slide, i) => (
              <div key={slide.id} className="relative group">
                <SlideThumbnail
                  slide={slide}
                  index={i}
                  active={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                />
                {/* Slide actions */}
                {presentation.slides.length > 1 && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    {i > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 'up') }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-white/90 text-sm shadow-sm bg-white/70 transition-colors">
                        ↑
                      </button>
                    )}
                    {i < presentation.slides.length - 1 && (
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 'down') }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-white/90 text-sm shadow-sm bg-white/70 transition-colors">
                        ↓
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteSlide(i) }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white/90 text-sm shadow-sm bg-white/70 transition-colors">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* PDF Import */}
          <div className="rounded-2xl border p-3" style={{ borderColor: '#E9D5FF', background: 'linear-gradient(135deg, #F5F3FF 0%, #FEF3C7 100%)' }}>
            <label className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-all ${pdfImporting ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.02] cursor-pointer'}`}
              style={{ background: 'var(--brand-gradient)', color: '#fff' }}>
              <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                <path d="M10 3v10m0 0l-3-3m3 3l3-3M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {pdfImporting ? pdfProgress || 'Importing...' : 'Import PDF'}
              <input type="file" accept=".pdf" className="hidden"
                disabled={pdfImporting}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) importPdf(file)
                  e.target.value = ''
                }} />
            </label>
            <p className="text-[11px] text-center mt-1.5" style={{ color: '#6B4FA0' }}>
              Each page becomes an image slide
            </p>
          </div>

          <SlideTypePicker onPick={addSlide} onHover={setHoveredType} />
        </div>

        {/* CENTER: slide editor */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {activeSlide ? (
            <div className="max-w-2xl w-full mx-auto px-8 py-8 flex-1">
              {/* Slide type badge */}
              <div className="flex items-center gap-2 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ background: SLIDE_TYPE_META[activeSlide.type].bg, color: SLIDE_TYPE_META[activeSlide.type].color }}>
                  {SLIDE_ICONS[activeSlide.type]}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: SLIDE_TYPE_META[activeSlide.type].color }}>
                    {SLIDE_TYPE_META[activeSlide.type].label}
                  </p>
                  <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                    Slide {activeIndex + 1} of {presentation.slides.length}
                    {SLIDE_TYPE_META[activeSlide.type].hasAudienceInput ? ' · Audience votes' : ' · Display only'}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px mb-5" style={{ background: '#E9E2FF' }} />

              {/* Editor form */}
              <SlideEditor slide={activeSlide} onChange={updateSlide} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Select a slide to edit</p>
            </div>
          )}
        </div>

        {/* RIGHT: type info panel */}
        <div className="w-56 flex-shrink-0 border-l p-4 space-y-4 overflow-y-auto" style={{ borderColor: '#DBEAFE', background: '#FDFBFF' }}>
          {hoveredType ? (
            /* Show hovered slide type info */
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4361EE' }}>Slide Preview</p>
              <div className="rounded-xl p-4 space-y-2" style={{
                background: SLIDE_TYPE_META[hoveredType].bg,
                border: `1.5px solid ${SLIDE_TYPE_META[hoveredType].color}30`,
              }}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{ background: SLIDE_TYPE_META[hoveredType].color, color: '#fff' }}>
                    {SLIDE_ICONS[hoveredType]}
                  </span>
                  <p className="text-sm font-bold" style={{ color: SLIDE_TYPE_META[hoveredType].color }}>
                    {SLIDE_TYPE_META[hoveredType].label}
                  </p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#4B5563' }}>
                  {SLIDE_DESCRIPTIONS[hoveredType]}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: SLIDE_TYPE_META[hoveredType].hasAudienceInput ? '#16A34A' : '#9CA3AF' }} />
                  <span className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>
                    {SLIDE_TYPE_META[hoveredType].hasAudienceInput ? 'Audience votes' : 'Display only'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>Click to add this slide</p>
            </div>
          ) : activeSlide ? (
            /* Show current slide info */
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4361EE' }}>Current Slide</p>
              <div className="rounded-xl p-3" style={{
                background: SLIDE_TYPE_META[activeSlide.type].bg,
                border: `1px solid ${SLIDE_TYPE_META[activeSlide.type].color}20`,
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md"
                    style={{ background: SLIDE_TYPE_META[activeSlide.type].color, color: '#fff' }}>
                    {SLIDE_ICONS[activeSlide.type]}
                  </span>
                  <p className="text-xs font-bold" style={{ color: SLIDE_TYPE_META[activeSlide.type].color }}>
                    {SLIDE_TYPE_META[activeSlide.type].label}
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: '#6B7280' }}>
                  {SLIDE_DESCRIPTIONS[activeSlide.type]}
                </p>
              </div>
              <div className="space-y-2 text-[11px]" style={{ color: '#9CA3AF' }}>
                <p>Slide {activeIndex + 1} of {presentation.slides.length}</p>
                <p>{presentation.slides.filter(s => SLIDE_TYPE_META[s.type].hasAudienceInput).length} interactive slide{presentation.slides.filter(s => SLIDE_TYPE_META[s.type].hasAudienceInput).length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4361EE' }}>Slide Info</p>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Hover a slide type on the left to see what it does.</p>
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
