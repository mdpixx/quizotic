'use client'

import type { QuestionStat, QuestionType, ResultsRenderer } from '@/lib/quiz-types'
import { RESULTS_RENDERER } from '@/lib/quiz-types'

export type ResultsMode = 'live' | 'final' | 'pdf'

interface QuestionResultsViewProps {
  questionType: QuestionType | string
  stat: Partial<QuestionStat> & { totalResponses?: number }
  mode?: ResultsMode
  className?: string
}

// Single dispatcher for all non-scored result visualizations. Used by:
//   - host live + reveal screens (mode="live" / "final")
//   - post-game presentation dashboard
//   - on-screen Session Report
// PDF export still uses inline HTML strings (see SessionReport.handlePrint),
// but is fed identical data shapes from server.mjs computeNonScoredAggregate().
export function QuestionResultsView({ questionType, stat, mode = 'final', className }: QuestionResultsViewProps) {
  const renderer: ResultsRenderer = RESULTS_RENDERER[questionType as QuestionType] || 'bars'

  if (renderer === 'bars') return <PollBars stat={stat} mode={mode} className={className} />
  if (renderer === 'cloud') return <WordCloud stat={stat} mode={mode} className={className} />
  if (renderer === 'list') return <TextResponseList stat={stat} mode={mode} className={className} />
  if (renderer === 'histogram') return <RatingHistogram stat={stat} mode={mode} className={className} />
  if (renderer === 'ordered') return <RankingResults stat={stat} mode={mode} className={className} />
  if (renderer === 'grid') return <DrawingGrid stat={stat} mode={mode} className={className} />
  if (renderer === 'answerkey') return <FillBlankResults stat={stat} mode={mode} className={className} />
  if (renderer === 'pairs') return <MatchingResults stat={stat} mode={mode} className={className} />
  // 'inner' (case) — case wraps another type; until we have inner-type
  // metadata in the stat, fall back to bars.
  return <PollBars stat={stat} mode={mode} className={className} />
}

// ─── Correct-% headline pill (scored types) ──────────────────────────────────

function CorrectPctPill({ pct, total }: { pct: number | null | undefined; total?: number }) {
  if (pct === null || pct === undefined) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-black tabular-nums" style={{ color: pct >= 50 ? '#059669' : '#DC2626' }}>{pct}%</span>
      <span className="text-xs" style={{ color: '#64748B' }}>
        answered correctly{typeof total === 'number' ? ` · ${total} ${total === 1 ? 'response' : 'responses'}` : ''}
      </span>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm ${className ?? ''}`}
      style={{ color: '#94A3B8' }}
    >
      {label}
    </div>
  )
}

// ─── Bar chart (poll, mcq, multiselect, truefalse) ───────────────────────────

interface RendererProps {
  stat: Partial<QuestionStat> & { totalResponses?: number }
  mode: ResultsMode
  className?: string
}

function PollBars({ stat, mode, className }: RendererProps) {
  const dist = stat.optionDistribution ?? []
  const options = stat.options ?? dist.map((_, i) => `Option ${i + 1}`)
  const total = dist.reduce((a, b) => a + b, 0)

  if (options.length === 0) return <EmptyState label="No options configured" className={className} />
  if (total === 0) return <EmptyState label="No responses yet" className={className} />

  const max = Math.max(...dist, 1)
  const isLive = mode === 'live'

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {options.map((opt, oi) => {
        const count = dist[oi] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const widthPct = max > 0 ? Math.round((count / max) * 100) : 0
        const isLeader = count > 0 && count === max
        return (
          <div key={oi} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-xs" style={{ color: '#475569' }}>{opt}</span>
            <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${widthPct}%`,
                  background: isLeader ? 'linear-gradient(90deg,#7C3AED,#A855F7)' : '#8B5CF6',
                  transition: isLive ? 'width 600ms cubic-bezier(0.2,0.8,0.2,1)' : 'none',
                }}
              />
            </div>
            <span className="w-16 text-right text-xs font-bold tabular-nums" style={{ color: '#0F1B3D' }}>
              {pct}% <span className="font-normal" style={{ color: '#94A3B8' }}>({count})</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Word cloud (sized text by frequency) ────────────────────────────────────

function WordCloud({ stat, mode, className }: RendererProps) {
  const freq = stat.wordFrequencies ?? {}
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60)

  if (entries.length === 0) return <EmptyState label="No words submitted yet" className={className} />

  const max = Math.max(...entries.map(([, n]) => n), 1)
  // Light, Mentimeter-style palette — same set used by the live presentation cloud.
  const palette = ['#7C82FF', '#FF8A8A', '#5DB6E5', '#F4A582', '#B19CD9', '#FFB088', '#94B3D1', '#F2A9C0']
  const isLive = mode === 'live'

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl px-4 py-5 ${className ?? ''}`}
      style={{ background: '#FAFAFA', border: '1px solid #F1F5F9', minHeight: 120 }}
    >
      {entries.map(([word, n], i) => {
        const weight = n / max
        const fontSize = Math.round(13 + weight * 47) // 13px → 60px for stronger size hierarchy
        const color = palette[i % palette.length]
        return (
          <span
            key={word}
            style={{
              fontSize,
              color,
              fontWeight: weight > 0.5 ? 800 : 700,
              lineHeight: 1.1,
              transition: isLive ? 'font-size 400ms ease' : 'none',
            }}
            title={`${n} mention${n === 1 ? '' : 's'}`}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

// ─── Text response list (openended, qa) ──────────────────────────────────────

function TextResponseList({ stat, className }: RendererProps) {
  const responses = stat.textResponses ?? []
  if (responses.length === 0) return <EmptyState label="No responses submitted yet" className={className} />

  return (
    <div className={`space-y-2 max-h-80 overflow-y-auto pr-1 ${className ?? ''}`}>
      {responses.map((r, i) => (
        <div
          key={`${i}-${r.submittedAt}`}
          className="rounded-lg border border-gray-100 bg-white p-3 text-sm"
          style={{ color: '#0F1B3D' }}
        >
          <p className="leading-snug whitespace-pre-wrap">{r.answer}</p>
          {r.name && (
            <p className="mt-1 text-[11px]" style={{ color: '#94A3B8' }}>
              — {r.name}{r.archetype ? ` · ${r.archetype}` : ''}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Rating histogram (1..N + average) ───────────────────────────────────────

function RatingHistogram({ stat, mode, className }: RendererProps) {
  const histogram = stat.ratingHistogram ?? []
  const ratingMax = stat.ratingMax ?? histogram.length ?? 5
  // Half-star support: when ratingStep === 0.5 the histogram has ratingMax*2
  // buckets (1.0, 1.5, … 5.0). Older records without ratingStep used integer
  // buckets — fall back to 1 in that case.
  const ratingStep = stat.ratingStep ?? (histogram.length > ratingMax ? 0.5 : 1)
  const total = histogram.reduce((a, b) => a + b, 0)
  if (total === 0) return <EmptyState label="No ratings yet" className={className} />

  const avg = stat.ratingAverage ?? null
  const max = Math.max(...histogram, 1)
  const isLive = mode === 'live'

  return (
    <div className={`flex items-end gap-4 ${className ?? ''}`}>
      <div className="flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Average</p>
        <p className="text-4xl font-black tabular-nums" style={{ color: '#0F1B3D' }}>
          {avg !== null ? avg.toFixed(2) : '—'}
        </p>
        <p className="text-xs" style={{ color: '#64748B' }}>
          out of {ratingMax} · {total} {total === 1 ? 'rating' : 'ratings'}
        </p>
      </div>
      <div className="flex-1 flex items-end justify-around gap-1.5 h-32">
        {histogram.map((count, idx) => {
          const heightPct = max > 0 ? Math.round((count / max) * 100) : 0
          const value = 1 + idx * ratingStep
          const label = ratingStep === 0.5 ? value.toFixed(1) : String(value)
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${heightPct}%`,
                    minHeight: count > 0 ? 4 : 0,
                    background: `linear-gradient(180deg,#A855F7,#7C3AED)`,
                    transition: isLive ? 'height 500ms cubic-bezier(0.2,0.8,0.2,1)' : 'none',
                  }}
                />
              </div>
              <p className="text-[11px] font-bold tabular-nums" style={{ color: '#0F1B3D' }}>{label}</p>
              <p className="text-[10px] tabular-nums" style={{ color: '#94A3B8' }}>{count}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Ranking results (sorted by avg position) ────────────────────────────────

function RankingResults({ stat, className }: RendererProps) {
  const items = stat.rankingItems ?? stat.options ?? []
  const averages = stat.rankingAverages ?? []
  const firsts = stat.rankingFirstPlaceCounts ?? []
  const correctOrder = stat.correctOrder
  const fullCorrectCount = stat.fullCorrectCount ?? 0
  const optionIdAt = (index: number) => {
    const option = stat.options?.[index] as unknown
    if (!option) return undefined
    if (typeof option === 'string') return option
    const maybeWithId = option as unknown as Record<string, unknown>
    return typeof maybeWithId.id === 'string' ? maybeWithId.id : typeof maybeWithId.text === 'string' ? maybeWithId.text : undefined
  }

  if (items.length === 0 || averages.every(a => a === null || a === undefined)) {
    return <EmptyState label="No rankings submitted yet" className={className} />
  }

  const ranked = items
    .map((label, i) => ({ label, avg: averages[i], firsts: firsts[i] ?? 0 }))
    .filter(r => r.avg !== null && r.avg !== undefined)
    .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {correctOrder && correctOrder.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#059669' }}>
            Correct Order
          </p>
          <ol className="space-y-1.5">
            {correctOrder.map((optId, idx) => {
              const optIdxNum = typeof optId === 'number' ? optId : Number.parseInt(String(optId), 10)
              const opt = Number.isInteger(optIdxNum) && optIdxNum >= 0 && optIdxNum < items.length
                ? items[optIdxNum]
                : items.find((_, i) => optionIdAt(i) === String(optId))
              const optLabel = typeof opt === 'string' ? opt : opt || `Option ${idx + 1}`
              return (
                <li key={`${optId}-${idx}`} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: '#10b981', color: 'white' }}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate" style={{ color: '#0F1B3D' }}>
                    {optLabel}
                  </span>
                </li>
              )
            })}
          </ol>
          {fullCorrectCount > 0 && (
            <p className="text-xs mt-2 pt-2 border-t border-green-200" style={{ color: '#047857' }}>
              <span className="font-bold">{fullCorrectCount}</span> {fullCorrectCount === 1 ? 'participant' : 'participants'} got it perfect
            </p>
          )}
        </div>
      )}
      <ol className="space-y-2">
        {ranked.map((r, i) => (
          <li
            key={r.label + i}
            className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black tabular-nums"
              style={{
                background: i === 0 ? '#FBD13B' : '#F1F5F9',
                color: i === 0 ? '#0F1B3D' : '#475569',
              }}
            >
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#0F1B3D' }}>{r.label}</span>
            <span className="text-[11px] tabular-nums" style={{ color: '#64748B' }}>
              avg {(r.avg ?? 0).toFixed(2)}
            </span>
            {r.firsts > 0 && (
              <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-md font-bold"
                style={{ background: '#FEF3C7', color: '#92400E' }}>
                {r.firsts} × #1
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Fill-in-the-blank (typed answers + accepted-answer key) ─────────────────

function FillBlankResults({ stat, className }: RendererProps) {
  const responses = (stat.textResponses ?? []) as Array<{ answer: string; name?: string; archetype?: string; isCorrect?: boolean }>
  const acceptedKey = stat.correctAnswerText

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <CorrectPctPill pct={stat.correctPct} total={stat.totalResponses} />
      {acceptedKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#059669' }}>Accepted answers</p>
          <p className="text-sm font-semibold" style={{ color: '#047857' }}>{acceptedKey}</p>
        </div>
      )}
      {responses.length === 0 ? (
        <EmptyState label="No responses yet" />
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {responses.map((r, i) => (
            <div
              key={`${i}-${r.name ?? ''}`}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: r.isCorrect ? '#A7F3D0' : '#FECACA',
                background: r.isCorrect ? '#F0FDF4' : '#FEF2F2',
              }}
            >
              <span className="flex-shrink-0" style={{ color: r.isCorrect ? '#059669' : '#DC2626' }}>{r.isCorrect ? '✓' : '✗'}</span>
              <span className="flex-1 truncate" style={{ color: '#0F1B3D' }}>{r.answer}</span>
              {r.name && <span className="text-[11px] flex-shrink-0" style={{ color: '#94A3B8' }}>{r.name}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Matching (left↔right answer key + correct %) ────────────────────────────

function MatchingResults({ stat, className }: RendererProps) {
  const pairs = stat.matchPairs ?? []
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <CorrectPctPill pct={stat.correctPct} total={stat.totalResponses} />
      {pairs.length === 0 ? (
        <EmptyState label="No pairs configured" />
      ) : (
        <ol className="space-y-2">
          {pairs.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate rounded-lg px-3 py-2 font-semibold" style={{ background: '#FDF2F8', color: '#831843' }}>{p.left}</span>
              <span className="flex-shrink-0 text-gray-300 font-bold">↔</span>
              <span className="flex-1 truncate rounded-lg px-3 py-2 font-semibold" style={{ background: '#F0FDFA', color: '#134E4A' }}>{p.right}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ─── Drawing thumbnail grid ──────────────────────────────────────────────────

function DrawingGrid({ stat, className }: RendererProps) {
  const thumbs = stat.drawingThumbnails ?? []
  if (thumbs.length === 0) return <EmptyState label="No drawings submitted yet" className={className} />

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${className ?? ''}`}>
      {thumbs.map((t, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.dataUrl}
            alt={t.name ? `Drawing by ${t.name}` : `Drawing ${i + 1}`}
            className="w-full aspect-square object-cover bg-white"
          />
          {t.name && (
            <p className="px-2 py-1 text-[11px] truncate" style={{ color: '#64748B' }}>
              {t.name}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
