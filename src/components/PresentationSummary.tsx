'use client'

import type { Slide } from '@/lib/presentation-types'
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
          <div className="space-y-2">
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
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)' }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: '#F1F5F9', color: '#475569' }}>
                    {meta?.label ?? slide.type}
                  </span>
                  <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#0F1B3D' }}>
                    {slideTitle}
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: count > 0 ? '#0F1B3D' : '#94A3B8' }}>
                    {count} {count === 1 ? 'response' : 'responses'}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums w-10 text-right" style={{ color: count > 0 ? '#16A34A' : '#94A3B8' }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
