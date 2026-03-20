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

export function SessionReport({ questionStats }: { questionStats: QuestionStat[] }) {
  if (!questionStats || questionStats.length === 0) return null

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <p className="text-xl font-black text-gray-900 mb-4">Session Report</p>

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
