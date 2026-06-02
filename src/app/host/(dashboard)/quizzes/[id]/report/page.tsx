'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RESULTS_RENDERER, type QuestionStat } from '@/lib/quiz-types'

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

function BarChart({ dist, labels, total, correctIdx }: { dist: number[]; labels: string[]; total: number; correctIdx?: number }) {
  const max = Math.max(...dist, 1)
  return (
    <div className="space-y-1.5">
      {labels.map((label, i) => {
        const pct = total > 0 ? Math.round((dist[i] ?? 0) / total * 100) : 0
        const isCorrect = i === correctIdx
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-6 shrink-0 text-center font-bold text-slate-500">{String.fromCharCode(65 + i)}</span>
            <div className="flex-1 bg-slate-100 rounded-sm overflow-hidden h-6">
              <div
                className={`h-full transition-all duration-500 ${isCorrect ? 'bg-emerald-500' : 'bg-sky-500'}`}
                style={{ width: `${(dist[i] ?? 0) / max * 100}%` }}
              />
            </div>
            <span className="w-12 text-right text-slate-600">{pct}%</span>
            <span className="w-28 truncate text-slate-500 hidden sm:block">{label}</span>
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
              <div className="w-full bg-amber-500 rounded-t" style={{ height: `${pct}%` }} />
              <span className="text-xs text-slate-500">{i + 1}</span>
            </div>
          )
        })}
      </div>
      {average !== null && (
        <p className="mt-2 text-sm text-slate-500">Average: <span className="text-amber-600 font-semibold">{average.toFixed(1)} / {ratingMax}</span> · {total} response{total !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

function TextList({ responses }: { responses: { answer: string }[] }) {
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {responses.length === 0 && <p className="text-slate-500 text-sm">No responses yet.</p>}
      {responses.map((r, i) => (
        <div key={i} className="text-sm bg-slate-50 px-3 py-1.5 rounded text-slate-700 border border-slate-100">{r.answer}</div>
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
          <span key={word} className="text-sky-700 font-medium" style={{ fontSize: `${size}rem` }}>{word}</span>
        )
      })}
    </div>
  )
}

function QuestionStatCard({ stat }: { stat: QuestionStat }) {
  const renderer = RESULTS_RENDERER[stat.type as keyof typeof RESULTS_RENDERER] ?? 'bars'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider">{stat.type}</span>
          <p className="text-slate-900 text-sm font-medium mt-0.5">{stat.text}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">{stat.totalResponses ?? 0} resp.</p>
          {stat.correctPct !== null && (
            <p className="text-sm font-semibold text-emerald-700">{stat.correctPct}% correct</p>
          )}
        </div>
      </div>
      {renderer === 'bars' && stat.optionDistribution && stat.options && (
        <BarChart
          dist={stat.optionDistribution}
          labels={stat.options}
          total={stat.totalResponses ?? 0}
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
              <span className="w-6 shrink-0 text-center text-slate-500">#{i + 1}</span>
              <span className="flex-1 text-slate-700">{item}</span>
              <span className="text-slate-500">avg {stat.rankingAverages?.[i]?.toFixed(1) ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      {renderer === 'grid' && stat.drawingThumbnails && (
        <div className="flex flex-wrap gap-2">
          {stat.drawingThumbnails.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.dataUrl} alt={d.name ?? `Drawing ${i + 1}`} className="w-20 h-16 object-contain bg-slate-50 rounded border border-slate-100" />
              {d.name && <span className="text-xs text-slate-500">{d.name}</span>}
            </div>
          ))}
        </div>
      )}
      {stat.explanation && (
        <p className="text-xs text-slate-500 border-t border-slate-200 pt-2">{stat.explanation}</p>
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 3).map(item => (
            <li key={`${title}-${item.index}`} className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Q{item.index + 1}</span>
              <span className="text-slate-500"> · {render(item)}</span>
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
          <h2 className="text-lg font-semibold text-slate-950">Teaching insights</h2>
          <p className="text-sm text-slate-500">What to revise, extend, or follow up next.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          Completion: <span className="font-semibold text-slate-950">{insights.completion.completionRate ?? '—'}%</span>
          {insights.completion.dropOffCount > 0 && (
            <span className="text-slate-500"> · {insights.completion.dropOffCount} incomplete</span>
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

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <span className="font-semibold">Suggested next step:</span> {insights.suggestedNextStep}
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
  const [csvLoading, setCsvLoading] = useState(false)

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">{error}</div>
  )
  if (!data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">Loading report…</div>
  )

  const { summary, leaderboard, questionStats, title, subject } = data

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-slate-800 mb-2 flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          {subject && <p className="text-slate-500 text-sm mt-0.5">{subject}</p>}
        </div>
        {isPro ? (
          <button
            onClick={downloadCsv}
            disabled={csvLoading}
            className="shrink-0 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {csvLoading ? 'Exporting…' : 'Download CSV'}
          </button>
        ) : (
          <div className="shrink-0 text-xs text-slate-500 text-right">
            <span className="text-sky-700 font-medium">Pro</span> feature: CSV export
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Responses', value: summary.totalResponses },
          { label: 'Finished', value: summary.finishedCount },
          { label: 'Avg Score', value: summary.avgScore !== null ? summary.avgScore : '—' },
          { label: 'Avg Accuracy', value: summary.avgAccuracy !== null ? `${summary.avgAccuracy}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-950">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <InsightsPanel insights={data.insights} />

      {/* Leaderboard */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-950">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-slate-500 text-sm">No participants yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium text-right">Score</th>
                  <th className="py-2 pr-4 font-medium text-right hidden sm:table-cell">Correct</th>
                  <th className="py-2 pr-4 font-medium text-right hidden sm:table-cell">Accuracy</th>
                  <th className="py-2 pr-4 font-medium text-right hidden md:table-cell">Time</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((entry, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 pl-3 pr-4 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium text-slate-900">{entry.name}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-sky-700">{entry.score}</td>
                    <td className="py-2 pr-4 text-right text-slate-500 hidden sm:table-cell">{entry.correctCount}/{entry.answeredCount}</td>
                    <td className="py-2 pr-4 text-right text-slate-500 hidden sm:table-cell">{entry.accuracy !== null ? `${entry.accuracy}%` : '—'}</td>
                    <td className="py-2 pr-4 text-right text-slate-500 hidden md:table-cell">{fmt(entry.timeSec)}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.status === 'finished' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
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
          <h2 className="text-lg font-semibold mb-3 text-slate-950">Per-question results</h2>
          <div className="space-y-4">
            {questionStats.map((stat, i) => (
              <QuestionStatCard key={i} stat={stat} />
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  )
}
