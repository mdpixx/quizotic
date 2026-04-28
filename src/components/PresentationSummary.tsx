'use client'

import type { Slide, SlideType } from '@/lib/presentation-types'
import { SLIDE_TYPE_META } from '@/lib/presentation-types'

interface AggregateData {
  total: number
  counts?: number[]
  words?: Record<string, number>
  scores?: number[]
  emojis?: Record<string, number>
  pins?: { x: number; y: number }[]
}

interface SummaryRecord {
  presentationTitle: string
  participantCount: number
  duration: number
  totalSlides: number
  interactiveSlides: number
  slidesWithResponses: number
  totalResponses: number
  engagementRate: number
  avgResponsesPerSlide: number
}

interface PresentationSummaryProps {
  record: SummaryRecord
  slides: Slide[]
  aggregates: Record<number, AggregateData>
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(15,27,61,0.08)',
        boxShadow: '0 4px 12px rgba(15,27,61,0.06)',
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</p>
      <p className="text-2xl md:text-3xl font-black mt-1 tabular-nums" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>{value}</p>
      {hint && <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>{hint}</p>}
    </div>
  )
}

export function PresentationSummary({ record, slides, aggregates }: PresentationSummaryProps) {
  const interactiveSlides = slides
    .map((slide, index) => ({ slide, index, meta: SLIDE_TYPE_META[slide.type] }))
    .filter(s => s.meta?.hasAudienceInput)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl md:text-4xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
          Session Complete
        </h1>
        <p className="text-sm md:text-base mt-1" style={{ color: '#6B7280' }}>
          {record.presentationTitle}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Participants" value={record.participantCount} />
        <StatCard label="Duration" value={formatDuration(record.duration)} />
        <StatCard label="Total Responses" value={record.totalResponses} hint={`across ${record.interactiveSlides} interactive slide${record.interactiveSlides === 1 ? '' : 's'}`} />
        <StatCard label="Engagement Rate" value={`${record.engagementRate}%`} hint="slides that got at least one response" />
      </div>

      {interactiveSlides.length > 0 && (
        <div
          className="rounded-3xl p-4 md:p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.7))',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(15,27,61,0.08)',
            boxShadow: '0 8px 32px rgba(15,27,61,0.08)',
          }}
        >
          <h2 className="text-lg font-black mb-3" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
            Per-Slide Responses
          </h2>
          <div className="space-y-3">
            {interactiveSlides.map(({ slide, index, meta }) => {
              const agg = aggregates[index]
              const count = agg?.total ?? 0
              const pct = record.participantCount > 0 ? Math.round((count / record.participantCount) * 100) : 0
              const slideTitle = ('question' in slide && typeof slide.question === 'string' && slide.question)
                ? slide.question
                : `Slide ${index + 1}`
              return (
                <div
                  key={index}
                  className="rounded-xl p-3 md:p-4"
                  style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.75)' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}>
                      {meta?.label ?? slide.type}
                    </span>
                    <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#0F1B3D' }}>
                      Q{index + 1}. {slideTitle}
                    </span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: count > 0 ? '#0F1B3D' : '#94A3B8' }}>
                      {count} {count === 1 ? 'response' : 'responses'}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums w-10 text-right" style={{ color: count > 0 ? '#16A34A' : '#94A3B8' }}>
                      {pct}%
                    </span>
                  </div>
                  {count > 0 && <SlideResults slide={slide} aggregate={agg} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Per-slide visual breakdown (bars / cloud / histogram / etc.) ────────────

function SlideResults({ slide, aggregate }: { slide: Slide; aggregate?: AggregateData }) {
  if (!aggregate || aggregate.total === 0) return null
  const t = slide.type as SlideType

  // Bars from `counts` against `slide.options` ─────────────────────────────
  if (t === 'multiple_choice' || t === 'quick_fire' || t === 'live_race' || t === 'image_choice') {
    const options = (slide as { options: string[] }).options
    return <Bars labels={options} counts={aggregate.counts ?? []} />
  }
  if (t === 'word_duel') {
    const s = slide as { optionA: string; optionB: string }
    return <Bars labels={[s.optionA, s.optionB]} counts={aggregate.counts ?? []} />
  }

  // Word cloud from `words` ───────────────────────────────────────────────
  if (t === 'word_cloud' || t === 'open_text') {
    return <CloudFromFreq freq={aggregate.words ?? {}} />
  }

  // Rating scale: counts indexed by rating-1 ──────────────────────────────
  if (t === 'rating_scale') {
    const ratingMax = (slide as { maxRating: 5 | 7 | 10 }).maxRating
    const histogram = aggregate.counts ?? []
    return <Histogram histogram={histogram} ratingMax={ratingMax} scores={aggregate.scores} />
  }

  // 100-point scale: bucket scores into 10 buckets of 10 ──────────────────
  if (t === 'scale_100') {
    const scores = aggregate.scores ?? []
    if (scores.length === 0) return null
    const buckets = new Array(10).fill(0) as number[]
    for (const s of scores) {
      const idx = Math.min(9, Math.max(0, Math.floor(s / 10)))
      buckets[idx]++
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return (
      <div className="space-y-2">
        <p className="text-xs" style={{ color: '#475569' }}>
          <strong style={{ color: '#0F1B3D' }}>Avg:</strong> {avg.toFixed(1)} / 100 · {scores.length} responses
        </p>
        <Bars labels={buckets.map((_, i) => `${i * 10}–${i * 10 + 9}`)} counts={buckets} />
      </div>
    )
  }

  // Emoji pulse: bars per emoji ───────────────────────────────────────────
  if (t === 'emoji_pulse') {
    const emojis = (slide as { emojis: string[] }).emojis
    const counts = emojis.map(em => aggregate.emojis?.[em] ?? 0)
    return <Bars labels={emojis} counts={counts} />
  }

  // Ranking: AggregateData doesn't carry per-position data, so skip ───────
  if (t === 'ranking') {
    return <p className="text-xs italic" style={{ color: '#94A3B8' }}>Ranking results captured · download report for breakdown</p>
  }

  // Pinpoint / grid_2x2: spatial — count only ─────────────────────────────
  if (t === 'pinpoint' || t === 'grid_2x2') {
    return <p className="text-xs italic" style={{ color: '#94A3B8' }}>{aggregate.pins?.length ?? aggregate.total} pin{(aggregate.pins?.length ?? aggregate.total) === 1 ? '' : 's'} placed</p>
  }
  return null
}

function Bars({ labels, counts }: { labels: string[]; counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const max = Math.max(...counts, 1)
  return (
    <div className="space-y-1.5">
      {labels.map((label, i) => {
        const count = counts[i] ?? 0
        const pct = Math.round((count / total) * 100)
        const widthPct = Math.round((count / max) * 100)
        const isLeader = count > 0 && count === max
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate" style={{ color: '#475569' }}>{label || `Option ${i + 1}`}</span>
            <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${widthPct}%`,
                  background: isLeader ? 'linear-gradient(90deg,#7C3AED,#A855F7)' : '#8B5CF6',
                }}
              />
            </div>
            <span className="w-14 text-right tabular-nums font-semibold" style={{ color: '#0F1B3D' }}>
              {pct}% <span className="font-normal" style={{ color: '#94A3B8' }}>({count})</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CloudFromFreq({ freq }: { freq: Record<string, number> }) {
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50)
  if (entries.length === 0) return null
  const max = Math.max(...entries.map(([, n]) => n), 1)
  const palette = ['#7C3AED', '#0F1B3D', '#FF8A47', '#16A34A', '#2D3A8C', '#DC2626']
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg px-3 py-3"
      style={{ background: '#FAFAFA', border: '1px solid #F1F5F9' }}>
      {entries.map(([word, n], i) => {
        const fontSize = Math.round(12 + (n / max) * 24)
        return (
          <span key={word} style={{ fontSize, color: palette[i % palette.length], fontWeight: n / max > 0.5 ? 800 : 600 }}>
            {word}
          </span>
        )
      })}
    </div>
  )
}

function Histogram({ histogram, ratingMax, scores }: { histogram: number[]; ratingMax: number; scores?: number[] }) {
  const total = histogram.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const max = Math.max(...histogram, 1)
  const avg = scores && scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null
  return (
    <div className="flex items-end gap-3">
      {avg !== null && (
        <div className="flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Avg</p>
          <p className="text-2xl font-black tabular-nums" style={{ color: '#0F1B3D' }}>{avg.toFixed(1)}</p>
        </div>
      )}
      <div className="flex-1 flex items-end justify-around gap-1 h-20">
        {Array.from({ length: ratingMax }).map((_, idx) => {
          const count = histogram[idx] ?? 0
          const heightPct = Math.round((count / max) * 100)
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{ height: `${heightPct}%`, minHeight: count > 0 ? 3 : 0, background: 'linear-gradient(180deg,#A855F7,#7C3AED)' }}
                />
              </div>
              <p className="text-[10px] font-bold tabular-nums" style={{ color: '#0F1B3D' }}>{idx + 1}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
