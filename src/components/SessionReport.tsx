import type { QuestionStat, BloomsLevel, QuestionType } from '@/lib/quiz-types'
import { QuizoticLogo } from './QuizoticLogo'
import { QuestionResultsView } from './results/QuestionResultsView'

const BLOOMS_COLORS: Record<BloomsLevel, string> = {
  remember: 'bg-blue-400',
  understand: 'bg-green-400',
  apply: 'bg-yellow-400',
  analyse: 'bg-orange-400',
  evaluate: 'bg-red-400',
  create: 'bg-purple-400',
}

const BLOOMS_LABELS: Record<BloomsLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyse: 'Analyse',
  evaluate: 'Evaluate',
  create: 'Create',
}

function BloomsDistribution({ stats }: { stats: QuestionStat[] }) {
  const tagged = stats.filter(s => s.bloomsLevel)
  if (tagged.length === 0) return null

  const counts = tagged.reduce((acc, s) => {
    if (s.bloomsLevel) acc[s.bloomsLevel] = (acc[s.bloomsLevel] ?? 0) + 1
    return acc
  }, {} as Partial<Record<BloomsLevel, number>>)

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Bloom&apos;s Distribution</p>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(counts) as [BloomsLevel, number][]).map(([level, count]) => (
          <span key={level} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700">
            <span className={`w-2 h-2 rounded-full ${BLOOMS_COLORS[level]}`} />
            {BLOOMS_LABELS[level]} ({count})
          </span>
        ))}
      </div>
    </div>
  )
}

function ConfidenceGridDisplay({ grid }: { grid: NonNullable<QuestionStat['confidenceGrid']> }) {
  const { sureCorrect, sureWrong, unsureCorrect, unsureWrong } = grid
  return (
    <table className="text-xs border-collapse mt-2 w-full max-w-[220px]">
      <thead>
        <tr>
          <th className="text-gray-400 font-normal pb-1 text-left" />
          <th className="text-gray-500 font-semibold pb-1 text-center">Correct</th>
          <th className="text-gray-500 font-semibold pb-1 text-center">Wrong</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="text-gray-500 pr-3 py-1">Sure</td>
          <td className="bg-green-50 border border-gray-100 text-center rounded-sm py-1 px-2 text-gray-700">{sureCorrect}</td>
          <td className="bg-amber-50 border border-gray-100 text-center rounded-sm py-1 px-2 text-amber-800 font-semibold">{sureWrong}</td>
        </tr>
        <tr>
          <td className="text-gray-500 pr-3 py-1">Not Sure</td>
          <td className="bg-green-50 border border-gray-100 text-center rounded-sm py-1 px-2 text-gray-700">{unsureCorrect}</td>
          <td className="border border-gray-100 text-center rounded-sm py-1 px-2 text-gray-700">{unsureWrong}</td>
        </tr>
      </tbody>
    </table>
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// PDF-safe inline-style renderer for non-scored question results. Mirrors
// QuestionResultsView dispatch but emits a self-contained HTML string so the
// print window doesn't need any CSS classes or React mount.
function renderResultsHtml(stat: QuestionStat): string {
  const wrap = (inner: string) => `<div style="margin-top:10px">${inner}</div>`
  const empty = (label: string) =>
    wrap(`<p style="font-size:12px;color:#94a3b8;font-style:italic;margin:0">${escapeHtml(label)}</p>`)

  const type = stat.type
  // Bars (poll, mcq, multiselect, truefalse) ────────────────────────────────
  if (!type || type === 'poll' || type === 'mcq' || type === 'multiselect' || type === 'truefalse') {
    const dist = stat.optionDistribution ?? []
    const options = stat.options ?? []
    const total = dist.reduce((a, b) => a + b, 0)
    if (options.length === 0) return empty('No options configured')
    if (total === 0) return empty('No responses recorded')
    return wrap(options.map((opt, oi) => {
      const count = dist[oi] ?? 0
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;">
        <span style="color:#6b7280;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(opt)}</span>
        <div style="flex:1;height:14px;background:#f3f4f6;border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#8B5CF6;border-radius:99px"></div></div>
        <span style="color:#374151;font-weight:600;width:60px;text-align:right">${pct}% (${count})</span>
      </div>`
    }).join(''))
  }

  // Word cloud ────────────────────────────────────────────────────────────
  if (type === 'wordcloud') {
    const freq = stat.wordFrequencies ?? {}
    const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60)
    if (entries.length === 0) return empty('No words submitted')
    const max = Math.max(...entries.map(([, n]) => n), 1)
    // Same light palette used in the live presentation and results views.
    const palette = ['#7C82FF', '#FF8A8A', '#5DB6E5', '#F4A582', '#B19CD9', '#FFB088', '#94B3D1', '#F2A9C0']
    const words = entries.map(([w, n], i) => {
      const fontSize = Math.round(12 + (n / max) * 32)
      return `<span style="font-size:${fontSize}px;color:${palette[i % palette.length]};font-weight:700;margin:0 6px">${escapeHtml(w)}</span>`
    }).join('')
    return wrap(`<div style="background:#fafafa;border:1px solid #f1f5f9;border-radius:10px;padding:12px;text-align:center;line-height:1.4">${words}</div>`)
  }

  // Text response list ─────────────────────────────────────────────────────
  if (type === 'openended' || type === 'qa') {
    const responses = stat.textResponses ?? []
    if (responses.length === 0) return empty('No responses submitted')
    const items = responses.slice(0, 30).map(r => `
      <div style="border:1px solid #f1f5f9;border-radius:8px;padding:8px 10px;margin-bottom:6px;background:#ffffff;font-size:12px;color:#0F1B3D;">
        <p style="margin:0;line-height:1.4">${escapeHtml(r.answer)}</p>
        ${r.name ? `<p style="margin:4px 0 0;font-size:10px;color:#94a3b8">— ${escapeHtml(r.name)}</p>` : ''}
      </div>`).join('')
    const more = responses.length > 30
      ? `<p style="font-size:11px;color:#94a3b8;margin:6px 0 0">…and ${responses.length - 30} more</p>` : ''
    return wrap(`<div>${items}${more}</div>`)
  }

  // Rating histogram ──────────────────────────────────────────────────────
  if (type === 'rating') {
    const histogram = stat.ratingHistogram ?? []
    const ratingMax = stat.ratingMax ?? histogram.length ?? 5
    const total = histogram.reduce((a, b) => a + b, 0)
    if (total === 0) return empty('No ratings yet')
    const max = Math.max(...histogram, 1)
    const avg = stat.ratingAverage ?? null
    const bars = Array.from({ length: ratingMax }).map((_, idx) => {
      const count = histogram[idx] ?? 0
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      const widthPct = max > 0 ? Math.round((count / max) * 100) : 0
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;">
        <span style="color:#475569;font-weight:700;width:30px;text-align:center">${idx + 1}</span>
        <div style="flex:1;height:12px;background:#f3f4f6;border-radius:99px;overflow:hidden"><div style="height:100%;width:${widthPct}%;background:linear-gradient(90deg,#A855F7,#7C3AED);border-radius:99px"></div></div>
        <span style="color:#374151;font-weight:600;width:60px;text-align:right">${pct}% (${count})</span>
      </div>`
    }).join('')
    const avgLabel = avg !== null
      ? `<p style="margin:0 0 8px;font-size:13px;color:#0F1B3D"><strong>Average:</strong> ${avg.toFixed(2)} / ${ratingMax} · ${total} ratings</p>`
      : ''
    return wrap(`<div>${avgLabel}${bars}</div>`)
  }

  // Ranking results ───────────────────────────────────────────────────────
  if (type === 'ranking') {
    const items = stat.rankingItems ?? stat.options ?? []
    const averages = stat.rankingAverages ?? []
    const firsts = stat.rankingFirstPlaceCounts ?? []
    if (items.length === 0) return empty('No rankings submitted yet')
    const ranked = items
      .map((label, i) => ({ label, avg: averages[i], firsts: firsts[i] ?? 0 }))
      .filter(r => r.avg !== null && r.avg !== undefined)
      .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))
    if (ranked.length === 0) return empty('No rankings submitted yet')
    const rows = ranked.map((r, i) => `
      <div style="display:flex;align-items:center;gap:8px;border:1px solid #f1f5f9;border-radius:8px;padding:6px 10px;margin-bottom:4px;background:#fff;font-size:12px;">
        <span style="display:inline-block;width:22px;height:22px;border-radius:99px;background:${i === 0 ? '#F5E642' : '#F1F5F9'};color:${i === 0 ? '#0F1B3D' : '#475569'};text-align:center;font-weight:900;line-height:22px">${i + 1}</span>
        <span style="flex:1;color:#0F1B3D;font-weight:600">${escapeHtml(r.label)}</span>
        <span style="color:#64748b">avg ${(r.avg ?? 0).toFixed(2)}</span>
        ${r.firsts > 0 ? `<span style="background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:6px;font-weight:700">${r.firsts} × #1</span>` : ''}
      </div>`).join('')
    return wrap(`<div>${rows}</div>`)
  }

  // Drawing grid (PDF includes thumbnails inline as data URLs) ────────────
  if (type === 'drawing') {
    const thumbs = stat.drawingThumbnails ?? []
    if (thumbs.length === 0) return empty('No drawings submitted yet')
    const cells = thumbs.slice(0, 12).map(t => `
      <div style="border:1px solid #f1f5f9;border-radius:8px;overflow:hidden;background:#fff">
        <img src="${t.dataUrl}" alt="" style="display:block;width:100%;aspect-ratio:1/1;object-fit:cover" />
        ${t.name ? `<p style="margin:0;padding:4px 6px;font-size:10px;color:#64748b">${escapeHtml(t.name)}</p>` : ''}
      </div>`).join('')
    const more = thumbs.length > 12
      ? `<p style="font-size:11px;color:#94a3b8;margin:6px 0 0">…and ${thumbs.length - 12} more</p>` : ''
    return wrap(`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${cells}</div>${more}`)
  }

  return ''
}

interface AttendeeSummary {
  joinedAt: string | Date
  leftAt?: string | Date | null
  durationSec?: number | null
}

interface SessionReportProps {
  questionStats: QuestionStat[]
  quizTitle?: string
  participantCount?: number
  sessionDate?: string
  plan?: 'free' | 'pro'
  sessionId?: string
  attendees?: AttendeeSummary[]
}

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m} min ${r} sec`
}

function formatTime(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function AttendanceSummary({ attendees }: { attendees: AttendeeSummary[] }) {
  if (!attendees || attendees.length === 0) return null

  const durations = attendees.map(a => a.durationSec).filter((v): v is number => typeof v === 'number')
  const avgSec = durations.length > 0 ? durations.reduce((s, v) => s + v, 0) / durations.length : 0

  const joinTimes = attendees.map(a => new Date(a.joinedAt).getTime()).filter(n => !Number.isNaN(n))
  const earliestJoin = joinTimes.length > 0 ? new Date(Math.min(...joinTimes)) : null

  const leftTimes = attendees.map(a => a.leftAt ? new Date(a.leftAt).getTime() : NaN).filter(n => !Number.isNaN(n))
  const anyStillIn = attendees.some(a => !a.leftAt)
  const latestLeave = !anyStillIn && leftTimes.length > 0 ? new Date(Math.max(...leftTimes)) : null

  return (
    <div className="mt-4 mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Attendance</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Attendees</p>
          <p className="text-2xl font-black text-gray-900">{attendees.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Duration</p>
          <p className="text-2xl font-black text-gray-900">{durations.length > 0 ? formatDuration(avgSec) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Earliest Join</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{earliestJoin ? formatTime(earliestJoin) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Latest Leave</p>
          <p className="text-sm font-bold text-gray-900 mt-1">{latestLeave ? formatTime(latestLeave) : 'in progress'}</p>
        </div>
      </div>
    </div>
  )
}

export function SessionReport({ questionStats, quizTitle, participantCount, sessionDate, plan = 'free', sessionId, attendees }: SessionReportProps) {
  if (!questionStats || questionStats.length === 0) return null

  const scoredStats = questionStats.filter(q => !q.isNonScored && q.correctPct != null)
  const avgAccuracy = scoredStats.length > 0
    ? Math.round(scoredStats.reduce((s, q) => s + (q.correctPct ?? 0), 0) / scoredStats.length)
    : 0

  const weakQuestions = scoredStats.filter(q => (q.correctPct ?? 0) < 50)
  const strongQuestions = scoredStats.filter(q => (q.correctPct ?? 0) >= 80)

  function handlePrint() {
    const scored = questionStats.filter(s => !s.isNonScored && s.correctPct != null)
    const needsReview = scored.filter(s => (s.correctPct ?? 0) < 50)
    const mastered = scored.filter(s => (s.correctPct ?? 0) >= 80)
    const misconceptions = scored.filter(s => s.confidenceGrid && s.confidenceGrid.sureWrong > 0)
    const date = sessionDate || new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })

    // Insight summary sentence
    const insights: string[] = []
    if (mastered.length > 0) insights.push(`${mastered.length} question${mastered.length > 1 ? 's' : ''} mastered (≥80%)`)
    if (needsReview.length > 0) insights.push(`${needsReview.length} need${needsReview.length === 1 ? 's' : ''} re-teaching`)
    if (misconceptions.length > 0) insights.push(`${misconceptions.length} misconception${misconceptions.length > 1 ? 's' : ''} detected (confident but wrong)`)

    const needsReviewBox = needsReview.length > 0 ? `
      <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.06em">⚠ Needs Re-teaching</p>
        <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.5">${needsReview.map(s => `Q${s.index + 1}: ${escapeHtml(s.text.length > 60 ? s.text.slice(0, 60) + '…' : s.text)}`).join('<br>')}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#c2410c">Revisit these topics in the next session before moving forward.</p>
      </div>` : ''

    const misconceptionBox = misconceptions.length > 0 ? `
      <div style="background:#fdf4ff;border:1.5px solid #e9d5ff;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#7e22ce;text-transform:uppercase;letter-spacing:0.06em">🎯 Misconceptions Detected</p>
        <p style="margin:0;font-size:13px;color:#6b21a8;line-height:1.5">${misconceptions.map(s => `Q${s.index + 1}: ${s.confidenceGrid!.sureWrong} student${s.confidenceGrid!.sureWrong > 1 ? 's were' : ' was'} confident but answered incorrectly`).join('<br>')}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#7e22ce">These students may hold incorrect prior knowledge — targeted correction needed.</p>
      </div>` : ''

    const rows = questionStats.map((stat, i) => {
      const isNonScored = stat.isNonScored || stat.correctPct == null
      const isWeak = !isNonScored && (stat.correctPct ?? 0) < 50
      const isStrong = !isNonScored && (stat.correctPct ?? 0) >= 80
      const pctColor = isNonScored ? '#7c3aed' : isWeak ? '#dc2626' : isStrong ? '#16a34a' : '#374151'
      const cardBorder = isNonScored ? '#ddd6fe' : isWeak ? '#fca5a5' : isStrong ? '#86efac' : '#e5e7eb'
      const cardBg = isNonScored ? '#faf5ff' : isWeak ? '#fff5f5' : isStrong ? '#f0fdf4' : '#ffffff'
      const badgeHtml = isNonScored
        ? `<span style="background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:8px">${stat.type === 'poll' ? 'Poll' : stat.type === 'wordcloud' ? 'Word Cloud' : 'Unscored'}</span>`
        : isWeak
        ? `<span style="background:#fee2e2;color:#dc2626;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:8px">Needs Review</span>`
        : isStrong
        ? `<span style="background:#dcfce7;color:#16a34a;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:8px">Mastered</span>`
        : ''

      // Type-aware results section for the PDF — mirrors QuestionResultsView
      // dispatch on the client. Each branch is plain inline-style HTML so it
      // survives the print-window rasterization without needing CSS classes.
      let distributionHtml = ''
      if (isNonScored) {
        distributionHtml = renderResultsHtml(stat)
      }

      const rightSide = isNonScored
        ? ''
        : `<span style="font-size:26px;font-weight:900;color:${pctColor};white-space:nowrap">${stat.correctPct}%</span>`

      const grid = stat.confidenceGrid
      const gridHtml = grid ? `
        <table style="border-collapse:collapse;margin-top:10px;font-size:12px;">
          <tr>
            <th style="width:80px"></th>
            <th style="padding:2px 14px;color:#6b7280;font-weight:600;text-align:center">Correct</th>
            <th style="padding:2px 14px;color:#6b7280;font-weight:600;text-align:center">Wrong</th>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:4px 8px 4px 0;font-size:12px">Sure</td>
            <td style="background:#f0fdf4;border:1px solid #d1fae5;padding:4px 14px;text-align:center;border-radius:4px">${grid.sureCorrect}</td>
            <td style="background:${grid.sureWrong > 0 ? '#fef3c7' : '#f9fafb'};border:1px solid ${grid.sureWrong > 0 ? '#fcd34d' : '#e5e7eb'};padding:4px 14px;text-align:center;border-radius:4px;font-weight:${grid.sureWrong > 0 ? '700' : '400'};color:${grid.sureWrong > 0 ? '#92400e' : '#374151'}">${grid.sureWrong}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:4px 8px 4px 0;font-size:12px">Not Sure</td>
            <td style="background:#f0fdf4;border:1px solid #d1fae5;padding:4px 14px;text-align:center;border-radius:4px">${grid.unsureCorrect}</td>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;padding:4px 14px;text-align:center;border-radius:4px">${grid.unsureWrong}</td>
          </tr>
        </table>` : ''
      const misconceptionNote = grid && grid.sureWrong > 0
        ? `<p style="margin:10px 0 0;font-size:12px;color:#7e22ce;background:#fdf4ff;border-radius:6px;padding:7px 10px">⚠ ${grid.sureWrong} student${grid.sureWrong > 1 ? 's were' : ' was'} confident but wrong — possible misconception</p>` : ''
      return `
        <div style="border:1.5px solid ${cardBorder};border-radius:10px;padding:16px;margin-bottom:12px;background:${cardBg};page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <p style="font-size:13px;color:#1f2937;font-weight:600;margin:0;line-height:1.5;flex:1">Q${i + 1}. ${escapeHtml(stat.text)}${badgeHtml}</p>
            ${rightSide}
          </div>
          ${distributionHtml}
          ${!isNonScored && grid ? gridHtml : ''}
          ${!isNonScored ? misconceptionNote : ''}
          ${stat.explanation ? `<p style="margin-top:10px;font-size:12px;color:#0F1B3D;background:#F8F9FA;border-radius:6px;padding:8px 10px">💡 ${escapeHtml(stat.explanation)}</p>` : ''}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${escapeHtml(quizTitle || 'Session Report')} — Quizotic</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #111; background: #fff; }
        @media print { @page { margin: 16mm; } }
      </style>
    </head><body>

      <!-- Brand header -->
      <div style="background:#0F1B3D;padding:28px 32px;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.75">Session Report</p>
            <h1 style="margin:4px 0 0;font-size:26px;font-weight:900;letter-spacing:-0.02em">${escapeHtml(quizTitle || 'Quiz Session')}</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:0.8">${date}</p>
          </div>
          <div style="text-align:right">
            <p style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.03em">Quizotic</p>
            <p style="margin:4px 0 0;font-size:11px;opacity:0.7">quizotic.live</p>
          </div>
        </div>

        <!-- Stats row -->
        <div style="display:flex;gap:0;margin-top:20px;background:rgba(255,255,255,0.15);border-radius:10px;overflow:hidden;">
          ${participantCount !== undefined ? `
          <div style="flex:1;padding:12px 18px;border-right:1px solid rgba(255,255,255,0.2);">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75">Participants</p>
            <p style="margin:4px 0 0;font-size:26px;font-weight:900">${participantCount}</p>
          </div>` : ''}
          <div style="flex:1;padding:12px 18px;border-right:1px solid rgba(255,255,255,0.2);">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75">Avg Accuracy</p>
            <p style="margin:4px 0 0;font-size:26px;font-weight:900">${avgAccuracy}%</p>
          </div>
          <div style="flex:1;padding:12px 18px;border-right:1px solid rgba(255,255,255,0.2);">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75">Questions</p>
            <p style="margin:4px 0 0;font-size:26px;font-weight:900">${questionStats.length}</p>
          </div>
          <div style="flex:1;padding:12px 18px;border-right:1px solid rgba(255,255,255,0.2);">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75">Mastered</p>
            <p style="margin:4px 0 0;font-size:26px;font-weight:900">${mastered.length}</p>
          </div>
          <div style="flex:1;padding:12px 18px;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75">Needs Review</p>
            <p style="margin:4px 0 0;font-size:26px;font-weight:900;color:${needsReview.length > 0 ? '#fbbf24' : '#fff'}">${needsReview.length}</p>
          </div>
        </div>

        <!-- Insight line -->
        ${insights.length > 0 ? `<p style="margin:14px 0 0;font-size:13px;opacity:0.9;background:rgba(0,0,0,0.15);border-radius:6px;padding:8px 12px">📊 ${insights.join(' · ')}</p>` : ''}
      </div>

      <!-- Body -->
      <div style="padding:24px 32px;">
        ${needsReviewBox}
        ${misconceptionBox}
        <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Question-by-Question Breakdown</p>
        ${rows}
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #e5e7eb;padding:14px 32px;display:flex;justify-content:space-between;align-items:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af">Generated by <strong style="color:#0F1B3D">Quizotic</strong> · quizotic.live</p>
        <p style="margin:0;font-size:11px;color:#9ca3af">${date}</p>
      </div>

    </body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 300)
  }

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 print:rounded-none print:shadow-none print:border-0 print:p-0" id="session-report">

      {/* Print-only header */}
      <div className="hidden print:block mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-black text-gray-900">{quizTitle || 'Session Report'}</p>
            <p className="text-sm text-gray-500 mt-1">{sessionDate || new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Powered by</p>
            <QuizoticLogo variant="onLight" className="text-lg" />
          </div>
        </div>
        {/* Summary row */}
        <div className="flex gap-6 mt-4">
          {participantCount !== undefined && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Participants</p>
              <p className="text-2xl font-black text-gray-900">{participantCount}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Accuracy</p>
            <p className="text-2xl font-black text-gray-900">{avgAccuracy}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Questions</p>
            <p className="text-2xl font-black text-gray-900">{questionStats.length}</p>
          </div>
          {weakQuestions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Needs Review</p>
              <p className="text-2xl font-black text-red-500">{weakQuestions.length}</p>
            </div>
          )}
          {strongQuestions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Strong</p>
              <p className="text-2xl font-black text-green-600">{strongQuestions.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Screen header */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <p className="text-xl font-black text-gray-900">Session Report</p>
        <div className="flex items-center gap-2">
          {sessionId && (
            plan === 'pro' ? (
              <a
                href={`/api/sessions/${sessionId}/csv`}
                download
                className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border-2 transition-all hover:border-green-400 hover:text-green-600 hover:bg-green-50"
                style={{ borderColor: '#D1FAE5', color: '#16a34a' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
                </svg>
                Export CSV
              </a>
            ) : (
              <span className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-400 cursor-not-allowed" title="CSV export — email info@quizotic.live if you need it">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
                </svg>
                CSV
              </span>
            )
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border-2 transition-all hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50"
            style={{ borderColor: 'rgba(15,27,61,0.15)', color: '#0F1B3D' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Download Report
          </button>
        </div>
      </div>

      {attendees && attendees.length > 0 && <AttendanceSummary attendees={attendees} />}

      <BloomsDistribution stats={questionStats} />

      <div className="space-y-4">
        {questionStats.map((stat) => {
          const isNonScored = stat.isNonScored || stat.correctPct == null
          const isWeak = !isNonScored && (stat.correctPct ?? 0) < 50
          const isStrong = !isNonScored && (stat.correctPct ?? 0) >= 80
          return (
            <div key={stat.index} className="border border-gray-100 rounded-xl p-4">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-gray-700 font-medium leading-snug">
                  Q{stat.index + 1}. {stat.text.length > 80 ? stat.text.slice(0, 80) + '…' : stat.text}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {isNonScored ? (
                    <span className="bg-violet-100 text-violet-600 rounded-full px-2.5 py-0.5 text-xs font-bold">
                      {stat.type === 'poll' ? 'Poll' : stat.type === 'wordcloud' ? 'Word Cloud' : stat.type === 'open' ? 'Open' : stat.type === 'qna' ? 'Q&A' : 'Unscored'}
                    </span>
                  ) : (
                    <>
                      <span className={`text-2xl font-black ${isWeak ? 'text-red-500' : isStrong ? 'text-green-600' : 'text-gray-700'}`}>
                        {stat.correctPct}%
                      </span>
                      {isWeak && (
                        <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                          ⚠ Weak
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Type-aware results view (poll bars, word cloud, text list,
                  rating histogram, ranking, drawing grid) */}
              {isNonScored && (
                <div className="mt-2">
                  <QuestionResultsView
                    questionType={(stat.type ?? 'poll') as QuestionType}
                    stat={stat}
                    mode="final"
                  />
                </div>
              )}

              {/* Bloom's tag */}
              {stat.bloomsLevel && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${BLOOMS_COLORS[stat.bloomsLevel]}`} />
                  <span className="text-xs text-gray-500">{BLOOMS_LABELS[stat.bloomsLevel]}</span>
                </div>
              )}

              {/* Confidence grid */}
              {stat.confidenceGrid && <ConfidenceGridDisplay grid={stat.confidenceGrid} />}

              {/* Explanation */}
              {stat.explanation && (
                <p className="mt-2 text-xs rounded-lg p-2" style={{ color: '#0F1B3D', background: '#F8F9FA' }}>{stat.explanation}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
