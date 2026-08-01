import { buildMisconceptionSummary, type MisconceptionQuestion, type SessionMatrixData } from '@/lib/session-matrix'

function QuestionEvidence({ question }: { question: MisconceptionQuestion }) {
  const responseLabel = `${question.answerCount} of ${question.respondentCount} respondents`

  return (
    <li className="rounded-[12px] px-3.5 py-3 md:px-4" style={{ border: '1px solid var(--color-line)', background: '#fff' }}>
      <div className="flex items-start gap-3">
        <span
          className="inline-flex flex-shrink-0 items-center justify-center rounded-[7px] px-2 py-1 font-mono text-[11px] font-black"
          style={{ background: '#FFF4F2', color: '#B63D38' }}
        >
          Q{question.index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <h3 className="line-clamp-2 font-display text-[14px] font-black leading-snug" style={{ color: 'var(--color-ink)' }} title={question.label}>
              {question.label}
            </h3>
            <div className="flex flex-shrink-0 items-baseline gap-2 sm:justify-end">
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{responseLabel}</span>
              <strong className="font-display text-[15px] font-black tabular-nums" style={{ color: '#B63D38' }}>{question.affectedPct}%</strong>
            </div>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full"
            style={{ background: '#EEF2F7' }}
            role="progressbar"
            aria-label={`Q${question.index + 1}: ${responseLabel} were confidently wrong`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={question.affectedPct}
          >
            <div className="h-full rounded-full" style={{ width: `${question.affectedPct}%`, background: '#B63D38' }} />
          </div>
        </div>
      </div>
    </li>
  )
}

export function ConfidentlyWrongPanel({
  data,
  loading,
  error,
}: {
  data: SessionMatrixData | null
  loading: boolean
  error: string | null
}) {
  const summary = data ? buildMisconceptionSummary(data) : null
  const visibleQuestions = summary?.questions.slice(0, 5) ?? []

  return (
    <section id="misconceptions" tabIndex={-1} className="dash-card mb-6 scroll-mt-24 p-4 md:p-5" aria-labelledby="misconceptions-title">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-10 w-1 flex-shrink-0 rounded-full" style={{ background: '#EA6B66' }} aria-hidden="true" />
        <div>
          <h2 id="misconceptions-title" className="font-display text-[18px] font-black" style={{ color: 'var(--color-ink)' }}>Misconception overview</h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Where certainty and incorrect answers overlap. The highest-impact questions are shown first.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-[12px] px-4 py-5 text-[13px]" style={{ background: 'var(--color-paper-2)', color: 'var(--color-text-muted)' }} role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-line)', borderTopColor: '#EA6B66' }} />
          Matching confidence to participant answers…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-[12px] px-4 py-4 text-[13px]" style={{ background: '#F9FAFB', border: '1px solid var(--color-line)', color: 'var(--color-text-muted)' }}>
          Confidence detail is unavailable right now. The rest of this report is still complete.
        </div>
      ) : !data || !summary?.hasConfidenceData ? (
        <div className="mt-4 rounded-[12px] px-4 py-4 text-[13px]" style={{ background: '#F9FAFB', border: '1px solid var(--color-line)', color: 'var(--color-text-muted)' }}>
          <strong className="block text-[14px]" style={{ color: 'var(--color-ink)' }}>Confidence wasn’t captured for this session</strong>
          Older or imported sessions can still show correctness, but Quizotic cannot infer how sure a participant felt.
        </div>
      ) : summary.answerCount === 0 ? (
        <div className="mt-4 rounded-[12px] px-4 py-4 text-[13px]" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
          <strong className="block text-[14px]">No confidently-wrong answers in this session</strong>
          Learners who marked themselves sure did not pair that confidence with an incorrect scored answer.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[11px] px-3.5 py-3" style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-line)' }} aria-label="Misconception summary">
            {[
              { value: summary.learnerCount, label: summary.learnerCount === 1 ? 'learner' : 'learners' },
              { value: summary.answerCount, label: 'answers' },
              { value: summary.questionCount, label: summary.questionCount === 1 ? 'question' : 'questions' },
            ].map(item => (
              <div key={item.label} className="flex items-baseline gap-1.5">
                <strong className="font-display text-[20px] font-black" style={{ color: 'var(--color-ink)' }}>{item.value}</strong><span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <ol className="mt-3 space-y-2">
            {visibleQuestions.map(question => <QuestionEvidence key={question.index} question={question} />)}
          </ol>
          {summary.questionCount > visibleQuestions.length && (
            <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              Showing {visibleQuestions.length} of {summary.questionCount} affected questions
            </p>
          )}
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Participant names are included in Download Report for focused follow-up.
          </p>
        </>
      )}
    </section>
  )
}
