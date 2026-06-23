'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RESULTS_RENDERER, type QuestionStat } from '@/lib/quiz-types'
import { AssignQuizModal } from '@/components/host/AssignQuizModal'

type LeaderboardEntry = {
  name: string
  score: number
  correctCount: number
  answeredCount: number
  accuracy: number | null
  status: 'finished' | 'in_progress'
  timeSec: number | null
}

type Summary = {
  totalResponses: number
  finishedCount: number
  avgScore: number | null
  avgAccuracy: number | null
}

type TeacherInsights = {
  weakestQuestions: Array<{ index: number; text: string; correctPct: number }>
  masteredQuestions: Array<{ index: number; text: string; correctPct: number }>
  misconceptions: Array<{ index: number; text: string; sureWrong: number }>
  completion: {
    totalParticipants: number
    finishedCount: number
    completionRate: number | null
    dropOffCount: number
  }
  suggestedNextStep: string
}

type ReportData = {
  title: string
  subject: string | null
  shareSlug: string | null
  status: string
  closesAt: string | null
  summary: Summary
  leaderboard: LeaderboardEntry[]
  questionStats: QuestionStat[]
  insights?: TeacherInsights
}

function fmt(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Build a plain-text answer key that pastes cleanly into WhatsApp / email / Sheets.
function buildAnswerKeyText(title: string, stats: QuestionStat[]): string {
  const lines: string[] = [`${title} — Answer Key`, '']
  stats.forEach(s => {
    lines.push(`${s.index + 1}. ${s.text}`)
    lines.push(`   ✓ ${s.correctAnswerText ?? '—'}`)
    if (s.explanation) lines.push(`   ${s.explanation}`)
    lines.push('')
  })
  return lines.join('\n').trim()
}

function BarChart({ dist, labels, total, correctIdx }: { dist: number[]; labels: string[]; total: number; correctIdx?: number }) {
  const max = Math.max(...dist, 1)
  return (
    <div className="space-y-1.5">
      {labels.map((label, i) => {
        const pct = total > 0 ? Math.round((dist[i] ?? 0) / total * 100) : 0
        const isCorrect = i === correctIdx
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-6 shrink-0 text-center font-bold font-display" style={{ color: 'var(--color-text-muted)' }}>{String.fromCharCode(65 + i)}</span>
            <div className="flex-1 rounded-md overflow-hidden h-6" style={{ background: 'var(--color-paper-2)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${(dist[i] ?? 0) / max * 100}%`, background: isCorrect ? 'var(--color-accent-green)' : 'var(--color-accent-blue)' }}
              />
            </div>
            <span className="w-12 text-right font-display" style={{ color: 'var(--color-text-secondary)' }}>{pct}%</span>
            <span className="w-28 truncate hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function RatingBar({ histogram, average, ratingMax }: { histogram: number[]; average: number | null; ratingMax: number }) {
  const max = Math.max(...histogram, 1)
  const total = histogram.reduce((s, c) => s + c, 0)
  return (
    <div>
      <div className="flex items-end gap-1 h-20">
        {histogram.map((count, i) => {
          const pct = count / max * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t" style={{ height: `${pct}%`, background: 'var(--color-secondary)' }} />
              <span className="text-xs font-display" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
            </div>
          )
        })}
      </div>
      {average !== null && (
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Average: <span className="font-semibold font-display" style={{ color: 'var(--color-secondary-dark)' }}>{average.toFixed(1)} / {ratingMax}</span> · {total} response{total !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

function TextList({ responses }: { responses: { answer: string }[] }) {
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {responses.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No responses yet.</p>}
      {responses.map((r, i) => (
        <div key={i} className="text-sm px-3 py-1.5 rounded-md" style={{ background: 'var(--color-paper)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-line)' }}>{r.answer}</div>
      ))}
    </div>
  )
}

function WordCloudDisplay({ frequencies }: { frequencies: Record<string, number> }) {
  const words = Object.entries(frequencies).sort((a, b) => b[1] - a[1]).slice(0, 40)
  const max = words[0]?.[1] ?? 1
  return (
    <div className="flex flex-wrap gap-2">
      {words.map(([word, count]) => {
        const size = 0.75 + (count / max) * 1.25
        return (
          <span key={word} className="font-display font-medium" style={{ fontSize: `${size}rem`, color: 'var(--color-info)' }}>{word}</span>
        )
      })}
    </div>
  )
}

function QuestionStatCard({ stat }: { stat: QuestionStat }) {
  const renderer = RESULTS_RENDERER[stat.type as keyof typeof RESULTS_RENDERER] ?? 'bars'
  return (
    <div className="rounded-[16px] p-4 space-y-3 border bg-white" style={{ borderColor: 'var(--color-line)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider font-display" style={{ color: 'var(--color-info)' }}>{stat.type}</span>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-ink)' }}>{stat.text}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-display" style={{ color: 'var(--color-text-muted)' }}>{stat.totalResponses ?? 0} resp.</p>
          {stat.correctPct !== null && (
            <p className="text-sm font-bold font-display" style={{ color: 'var(--color-accent-green)' }}>{stat.correctPct}% correct</p>
          )}
        </div>
      </div>
      {renderer === 'bars' && stat.optionDistribution && stat.options && (
        <BarChart
          dist={stat.optionDistribution}
          labels={stat.options}
          total={stat.totalResponses ?? 0}
          correctIdx={stat.correctIndex ?? undefined}
        />
      )}
      {renderer === 'cloud' && stat.wordFrequencies && (
        <WordCloudDisplay frequencies={stat.wordFrequencies} />
      )}
      {renderer === 'list' && stat.textResponses && (
        <TextList responses={stat.textResponses} />
      )}
      {renderer === 'histogram' && stat.ratingHistogram && (
        <RatingBar histogram={stat.ratingHistogram} average={stat.ratingAverage ?? null} ratingMax={stat.ratingMax ?? 5} />
      )}
      {renderer === 'ordered' && stat.rankingItems && stat.rankingAverages && (
        <div className="space-y-1">
          {stat.rankingItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-6 shrink-0 text-center font-display" style={{ color: 'var(--color-text-muted)' }}>#{i + 1}</span>
              <span className="flex-1" style={{ color: 'var(--color-text-secondary)' }}>{item}</span>
              <span className="font-display" style={{ color: 'var(--color-text-muted)' }}>avg {stat.rankingAverages?.[i]?.toFixed(1) ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      {renderer === 'grid' && stat.drawingThumbnails && (
        <div className="flex flex-wrap gap-2">
          {stat.drawingThumbnails.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.dataUrl} alt={d.name ?? `Drawing ${i + 1}`} className="w-20 h-16 object-contain rounded-md" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-line)' }} />
              {d.name && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.name}</span>}
            </div>
          ))}
        </div>
      )}
      {stat.explanation && (
        <p className="text-xs pt-2" style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-line)' }}>{stat.explanation}</p>
      )}
    </div>
  )
}

function InsightList({ title, items, empty, render }: {
  title: string
  items: Array<{ index: number; text: string; correctPct?: number; sureWrong?: number }>
  empty: string
  render: (item: { index: number; text: string; correctPct?: number; sureWrong?: number }) => string
}) {
  return (
    <div className="rounded-[16px] p-4 border bg-white" style={{ borderColor: 'var(--color-line)' }}>
      <h3 className="text-sm font-bold font-display" style={{ color: 'var(--color-ink)' }}>{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 3).map(item => (
            <li key={`${title}-${item.index}`} className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-bold font-display" style={{ color: 'var(--color-ink)' }}>Q{item.index + 1}</span>
              <span style={{ color: 'var(--color-text-muted)' }}> · {render(item)}</span>
              <p className="mt-0.5 line-clamp-2">{item.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InsightsPanel({ insights }: { insights?: TeacherInsights }) {
  if (!insights) return null

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black font-display" style={{ color: 'var(--color-ink)' }}>Teaching insights</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>What to revise, extend, or follow up next.</p>
        </div>
        <div className="rounded-[12px] px-3 py-2 text-sm border bg-white" style={{ borderColor: 'var(--color-line)', color: 'var(--color-text-secondary)' }}>
          Completion: <span className="font-bold font-display" style={{ color: 'var(--color-ink)' }}>{insights.completion.completionRate ?? '—'}%</span>
          {insights.completion.dropOffCount > 0 && (
            <span style={{ color: 'var(--color-text-muted)' }}> · {insights.completion.dropOffCount} incomplete</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <InsightList
          title="Weakest questions"
          items={insights.weakestQuestions}
          empty="No scored question is below the review threshold."
          render={item => `${item.correctPct}% correct`}
        />
        <InsightList
          title="Mastered questions"
          items={insights.masteredQuestions}
          empty="No clear mastery signal yet."
          render={item => `${item.correctPct}% correct`}
        />
        <InsightList
          title="Confident misses"
          items={insights.misconceptions}
          empty="No confident-but-wrong pattern detected."
          render={item => `${item.sureWrong} sure wrong`}
        />
      </div>

      <div className="rounded-[12px] px-4 py-3 text-sm border" style={{ background: 'var(--color-paper)', borderColor: 'var(--color-line)', color: 'var(--color-ink)' }}>
        <span className="font-bold">Suggested next step:</span> {insights.suggestedNextStep}
      </div>
    </section>
  )
}

export default function AsyncReportPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/quizzes/${id}/report`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) { setError(json.error ?? 'Failed to load report'); return }
        setData(json.data)
      })
      .catch(() => setError('Failed to load report'))

    fetch('/api/billing/status').then(r => r.json()).then(json => {
      if (json?.plan && json.plan !== 'free') setIsPro(true)
    }).catch(() => {})
  }, [id])

  async function downloadCsv() {
    setCsvLoading(true)
    const res = await fetch(`/api/quizzes/${id}/report?format=csv`)
    if (!res.ok) { setCsvLoading(false); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `quiz-report-${id}.csv`; a.click()
    URL.revokeObjectURL(url)
    setCsvLoading(false)
  }

  if (error) return (
    <div className="paper-grain min-h-screen flex items-center justify-center" style={{ background: 'var(--color-paper)', color: 'var(--color-text-muted)' }}>{error}</div>
  )
  if (!data) return (
    <div className="paper-grain min-h-screen flex items-center justify-center" style={{ background: 'var(--color-paper)', color: 'var(--color-text-muted)' }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-ink)', borderTopColor: 'transparent' }} />
    </div>
  )

  const { summary, leaderboard, questionStats, title, subject } = data
  const scoredStats = questionStats.filter(s => s.correctAnswerText != null)

  return (
    <div className="paper-grain min-h-screen px-4 py-6 md:py-8" style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}>
      <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-xs mb-2 flex items-center gap-1 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
            ← Back
          </button>
          <h1 className="text-[26px] font-black font-display leading-tight" style={{ color: 'var(--color-ink)' }}>{title}</h1>
          {subject && <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{subject}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAssignOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold border transition-colors hover:bg-gray-50"
            style={{ color: 'var(--color-ink)', borderColor: 'var(--color-line)' }}
            title="Schedule this quiz again for a new cohort"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
            Schedule again
          </button>
          {isPro ? (
            <button
              onClick={downloadCsv}
              disabled={csvLoading}
              className="btn-golive"
              style={{ fontSize: '13px', padding: '8px 14px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {csvLoading ? 'Exporting…' : 'Download CSV'}
            </button>
          ) : (
            <div className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--color-info)' }}>Pro</span> feature: CSV export
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Responses', value: summary.totalResponses },
          { label: 'Finished', value: summary.finishedCount },
          { label: 'Avg Score', value: summary.avgScore !== null ? summary.avgScore : '—' },
          { label: 'Avg Accuracy', value: summary.avgAccuracy !== null ? `${summary.avgAccuracy}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-[16px] p-4 text-center border" style={{ background: '#fff', borderColor: 'var(--color-line)' }}>
            <p className="text-2xl font-black font-display" style={{ color: 'var(--color-ink)' }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      <InsightsPanel insights={data.insights} />

      {/* Leaderboard */}
      <section>
        <h2 className="text-[18px] font-black font-display mb-3" style={{ color: 'var(--color-ink)' }}>Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No participants yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-[16px] border bg-white" style={{ borderColor: 'var(--color-line)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ color: 'var(--color-text-subtle)', borderColor: 'var(--color-line)', background: 'var(--color-paper)' }}>
                  <th className="py-2.5 pr-4 pl-3 font-semibold font-display">#</th>
                  <th className="py-2.5 pr-4 font-semibold font-display">Name</th>
                  <th className="py-2.5 pr-4 font-semibold text-right font-display">Score</th>
                  <th className="py-2.5 pr-4 font-semibold text-right hidden sm:table-cell font-display">Correct</th>
                  <th className="py-2.5 pr-4 font-semibold text-right hidden sm:table-cell font-display">Accuracy</th>
                  <th className="py-2.5 pr-4 font-semibold text-right hidden md:table-cell font-display">Time</th>
                  <th className="py-2.5 pr-3 font-semibold font-display">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={i} className="border-t transition-colors" style={{ borderColor: 'var(--color-line)' }}>
                    <td className="py-2.5 pl-3 pr-4 font-display" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                    <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--color-ink)' }}>{entry.name}</td>
                    <td className="py-2.5 pr-4 text-right font-bold font-display" style={{ color: 'var(--color-info)' }}>{entry.score}</td>
                    <td className="py-2.5 pr-4 text-right hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>{entry.correctCount}/{entry.answeredCount}</td>
                    <td className="py-2.5 pr-4 text-right hidden sm:table-cell font-display" style={{ color: 'var(--color-text-muted)' }}>{entry.accuracy !== null ? `${entry.accuracy}%` : '—'}</td>
                    <td className="py-2.5 pr-4 text-right hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>{fmt(entry.timeSec)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="chip" style={{ background: entry.status === 'finished' ? '#F0FDF4' : '#FEF3C7', color: entry.status === 'finished' ? '#16A34A' : '#D97706', padding: '4px 9px' }}>
                        {entry.status === 'finished' ? 'Done' : 'In progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-question stats */}
      {questionStats.length > 0 && (
        <section>
          <h2 className="text-[18px] font-black font-display mb-3" style={{ color: 'var(--color-ink)' }}>Per-question results</h2>
          <div className="space-y-4">
            {questionStats.map((stat, i) => (
              <QuestionStatCard key={i} stat={stat} />
            ))}
          </div>
        </section>
      )}

      {/* Answer Key */}
      {scoredStats.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[18px] font-black font-display" style={{ color: 'var(--color-ink)' }}>Answer Key</h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(buildAnswerKeyText(title, scoredStats))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="btn-secondary"
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="rounded-[16px] border bg-white overflow-hidden" style={{ borderColor: 'var(--color-line)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left font-display" style={{ background: 'var(--color-paper)', color: 'var(--color-text-subtle)', borderColor: 'var(--color-line)' }}>
                  <th className="py-2.5 px-3 font-semibold w-10">#</th>
                  <th className="py-2.5 px-3 font-semibold">Question</th>
                  <th className="py-2.5 px-3 font-semibold" style={{ color: 'var(--color-accent-green)' }}>Correct Answer</th>
                </tr>
              </thead>
              <tbody>
                {scoredStats.map((s, i) => (
                  <tr key={s.index} className="border-t" style={{ borderColor: 'var(--color-line)', background: i % 2 === 0 ? '#fff' : 'var(--color-paper)' }}>
                    <td className="py-3 px-3 font-display font-semibold align-top" style={{ color: 'var(--color-text-muted)' }}>{s.index + 1}</td>
                    <td className="py-3 px-3 align-top">
                      <p style={{ color: 'var(--color-ink)' }}>{s.text}</p>
                      {s.explanation && (
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{s.explanation}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold align-top" style={{ color: 'var(--color-accent-green)' }}>{s.correctAnswerText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Schedule again — reuse this quiz for a new cohort via the assign modal. */}
      {assignOpen && (
        <AssignQuizModal
          quizId={id}
          quizTitle={title}
          hasExistingShare={false}
          onClose={() => setAssignOpen(false)}
          onChanged={() => { /* report is read-only; modal self-manages the new session */ }}
        />
      )}
      </div>
    </div>
  )
}
