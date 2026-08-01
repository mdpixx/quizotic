import { buildMisconceptionSummary, type MisconceptionQuestion, type SessionMatrixData } from '@/lib/session-matrix'

function QuestionEvidence({ question }: { question: MisconceptionQuestion }) {
  return (
    <li className="rounded-[12px] p-3.5 md:p-4" style={{ border: '1px solid var(--color-line)', background: '#fff' }}>
      <div className="flex items-start gap-3">
        <span
          className="inline-flex flex-shrink-0 items-center justify-center rounded-[8px] px-2 py-1 font-mono text-[11px] font-black"
          style={{ background: '#FEF2F2', color: '#B91C1C' }}
        >
          Q{question.index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h3 className="font-display text-[14px] font-black leading-snug" style={{ color: 'var(--color-ink)' }}>{question.label}</h3>
            <span className="flex-shrink-0 text-[12px] font-bold" style={{ color: '#B91C1C' }}>
              {question.answerCount} confident {question.answerCount === 1 ? 'mistake' : 'mistakes'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-text-muted)' }}>Participants</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {question.participants.map(participant => (
              <span
                key={participant.id}
                className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{ background: '#F4F7FB', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }}
              >
                {participant.name}
              </span>
            ))}
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
  const visibleQuestions = summary?.questions.slice(0, 6) ?? []
  const extraQuestions = summary?.questions.slice(6) ?? []

  return (
    <section id="misconceptions" tabIndex={-1} className="dash-card mb-6 scroll-mt-24 p-4 md:p-5" aria-labelledby="misconceptions-title">
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px] text-[17px] font-black"
          style={{ background: '#FEF2F2', color: '#B91C1C' }}
          aria-hidden="true"
        >
          !
        </span>
        <div>
          <h2 id="misconceptions-title" className="font-display text-[18px] font-black" style={{ color: 'var(--color-ink)' }}>Confidently wrong</h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            The exact questions and participants behind sure-but-incorrect answers. Use this evidence to check the misconception directly.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-[12px] px-4 py-5 text-[13px]" style={{ background: 'var(--color-paper-2)', color: 'var(--color-text-muted)' }} role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-line)', borderTopColor: '#B91C1C' }} />
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
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Confidently wrong summary">
            {[
              { value: summary.learnerCount, label: summary.learnerCount === 1 ? 'learner' : 'learners' },
              { value: summary.answerCount, label: 'answers' },
              { value: summary.questionCount, label: summary.questionCount === 1 ? 'question' : 'questions' },
            ].map(item => (
              <div key={item.label} className="rounded-[11px] px-3.5 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <strong className="font-display text-[22px] font-black" style={{ color: '#B91C1C' }}>{item.value}</strong>
                <span className="ml-1.5 text-[12px] font-semibold" style={{ color: '#7F1D1D' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <ol className="mt-3 space-y-2">
            {visibleQuestions.map(question => <QuestionEvidence key={question.index} question={question} />)}
          </ol>
          {extraQuestions.length > 0 && (
            <details className="mt-2 rounded-[12px]" style={{ border: '1px solid var(--color-line)', background: 'var(--color-paper-2)' }}>
              <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold" style={{ color: 'var(--color-ink)' }}>
                Show {extraQuestions.length} more {extraQuestions.length === 1 ? 'question' : 'questions'}
              </summary>
              <ol className="space-y-2 px-2 pb-2">
                {extraQuestions.map(question => <QuestionEvidence key={question.index} question={question} />)}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  )
}
