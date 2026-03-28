import type { QuestionStat, BloomsLevel } from '@/lib/quiz-types'

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
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Bloom's Distribution</p>
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

interface SessionReportProps {
  questionStats: QuestionStat[]
  quizTitle?: string
  participantCount?: number
  sessionDate?: string
}

export function SessionReport({ questionStats, quizTitle, participantCount, sessionDate }: SessionReportProps) {
  if (!questionStats || questionStats.length === 0) return null

  const avgAccuracy = questionStats.length > 0
    ? Math.round(questionStats.reduce((s, q) => s + q.correctPct, 0) / questionStats.length)
    : 0

  const weakQuestions = questionStats.filter(q => q.correctPct < 50)
  const strongQuestions = questionStats.filter(q => q.correctPct >= 80)

  function handlePrint() {
    window.print()
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
            <p className="text-lg font-black text-gray-900">Quizotic</p>
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
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border-2 transition-all hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50"
          style={{ borderColor: '#E9E2FF', color: '#7C3AED' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Download Report
        </button>
      </div>

      <BloomsDistribution stats={questionStats} />

      <div className="space-y-4">
        {questionStats.map((stat) => {
          const isWeak = stat.correctPct < 50
          const isStrong = stat.correctPct >= 80
          return (
            <div key={stat.index} className="border border-gray-100 rounded-xl p-4">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-gray-700 font-medium leading-snug">
                  Q{stat.index + 1}. {stat.text.length > 80 ? stat.text.slice(0, 80) + '…' : stat.text}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-2xl font-black ${isWeak ? 'text-red-500' : isStrong ? 'text-green-600' : 'text-gray-700'}`}>
                    {stat.correctPct}%
                  </span>
                  {isWeak && (
                    <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                      ⚠ Weak
                    </span>
                  )}
                </div>
              </div>

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
                <p className="mt-2 text-xs text-indigo-700 bg-indigo-50 rounded-lg p-2">{stat.explanation}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
