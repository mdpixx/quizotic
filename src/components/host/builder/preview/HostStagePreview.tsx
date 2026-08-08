'use client'

/**
 * What the room sees — a true-size replica of the live host stage ("The
 * Atrium", src/app/host/session/page.tsx) at the moment a question goes live
 * and before anyone has answered.
 *
 * Structure is copied from the real stage, not approximated: the same eyebrow,
 * the same 3-column grid (left question navrail · center spotlight + answer
 * grid · right room gauge), the same `.host-*` classes, the real
 * <HostOptionTile>, the real <HostWordCloud>, and the same control dock. The
 * only differences are the ones a preview cannot have — no PIN yet, no live
 * counts, no sockets — and those render as explicit placeholders rather than
 * fake data.
 *
 * Rendered inside <ScaledDevice> at 1440×810, so every size below is written in
 * the px a real 1440×810 stage resolves to (the live stylesheet's vw/vh clamps
 * would otherwise follow the browser window, not the frame — see
 * `.qz-preview-stage` in globals.css).
 */

import { CircularTimer } from '@/components/CircularTimer'
import { HostOptionTile } from '@/components/host/HostOptionTile'
import { HostWordCloud } from '@/components/host/HostWordCloud'
import { ANSWER_COLORS, ANSWER_LETTERS, colorForIndex } from '@/lib/answer-colors'
import type { Question } from '@/lib/quiz-types'
import { getEffectiveOptions, getOptionText, isLeaderboardSlide } from '@/lib/quiz-types'
import { getHostQuestionFit } from '@/lib/host-stage'

const GOLD = '#FBD13B'

/**
 * The live stage's height-split and column decision for a long-text slide.
 * Same pure function the real stage calls, so the preview cannot drift from it
 * — which is the only reason a host can trust it before presenting.
 */
function longTextFit(question: Question) {
  return getHostQuestionFit({
    stage: 'live',
    questionText: question.text,
    optionTexts: (getEffectiveOptions(question) ?? []).map(getOptionText),
    hasExplanation: Boolean(question.explanation),
    longText: true,
  })
}

export interface HostStagePreviewProps {
  questions: Question[]
  index: number
  /** Quiz title — the real eyebrow shows `quiz.subject ?? quiz.title`. */
  title?: string
}

export function HostStagePreview({ questions, index, title }: HostStagePreviewProps) {
  const question = questions[index]
  if (!question) return null

  // Answerable numbering skips leaderboard flow slides, exactly as the live
  // stage does.
  const answerableTotal = questions.filter(q => !isLeaderboardSlide(q)).length
  const answerableNumber = questions.slice(0, index + 1).filter(q => !isLeaderboardSlide(q)).length

  return (
    <div
      className="qz-preview-stage host-question-stage flex flex-col"
      style={{
        width: '100%',
        height: '100%',
        padding: '16px 32px',
        gap: 12,
        background: 'linear-gradient(135deg, #071126 0%, #0F1B3D 55%, #102A43 100%)',
        color: '#FFFFFF',
      }}
    >
      {/* ── Eyebrow ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4" style={{ paddingRight: 32 }}>
        <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.46)' }}>
          Question{' '}
          <b style={{ color: GOLD, fontWeight: 800 }}>
            {String(answerableNumber > 0 ? answerableNumber : index + 1).padStart(2, '0')}
          </b>{' '}
          <span style={{ color: 'rgba(255,255,255,0.26)' }}>/ {answerableTotal || questions.length}</span>
        </span>
        {question.type === 'multiselect' && (
          <span
            className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
            style={{ color: GOLD, background: 'rgba(251,209,59,0.12)', border: '1px solid rgba(251,209,59,0.35)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            Multi-select
          </span>
        )}
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.26)' }}>·</span>
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.46)', maxWidth: 420 }}>
          {title?.trim() || 'Untitled quiz'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-xs font-semibold"
            style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}
            title="Your join PIN is generated when you go live"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18"/></svg>
            PIN <b style={{ letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)' }}>••••••</b>
          </span>
          <span
            className="inline-flex items-center justify-center rounded-[10px] px-2.5 py-1.5"
            style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}
            aria-hidden
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M21 21v.01M17.5 17.5v.01" />
            </svg>
          </span>
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16) 12%, rgba(255,255,255,0.16) 88%, transparent)' }} />

      {/* ── Atrium: navrail · center · room gauge ───────────────────────── */}
      <div className="host-atrium min-h-0 flex-1 grid" style={{ gridTemplateColumns: '64px minmax(0,1fr) 92px', gap: 20 }}>
        <NavRail questions={questions} index={index} />

        <div className="host-center-col flex min-h-0 min-w-0 flex-col" style={{ gap: 24 }}>
          {question.type === 'case' && question.scenarioText && (
            <div className="rounded-2xl border p-6" style={{ background: '#0F1B3D', borderColor: '#1E2A4F' }}>
              <p className="mb-2 text-base font-bold uppercase tracking-widest" style={{ color: '#6B8AFF' }}>Scenario</p>
              <p className="text-xl leading-relaxed" style={{ color: '#E0E7FF' }}>{question.scenarioText}</p>
              {question.supportingDetail && (
                <p className="mt-3 text-lg font-bold" style={{ color: '#FFD166' }}>{question.supportingDetail}</p>
              )}
            </div>
          )}

          {!isLeaderboardSlide(question) && <QuestionSpotlight question={question} />}

          <AnswerStage question={question} />

          {/* Permanently reserved tip slot — the real stage holds this space so
              revealing a tip never re-centres the column. */}
          <div className="host-tip-slot flex w-full flex-none items-center justify-center" />
        </div>

        <RoomGauge question={question} />
      </div>

      <ControlDock />
    </div>
  )
}

// ── Left rail ────────────────────────────────────────────────────────────────

function NavRail({ questions, index }: { questions: Question[]; index: number }) {
  return (
    <aside className="host-navrail flex">
      <span
        className="text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: 'rgba(255,255,255,0.26)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginBottom: 10 }}
      >
        Quiz
      </span>
      {questions.map((q, i) => (
        <span
          key={q.id ?? i}
          className={`host-navrail-dot ${i === index ? 'is-cur' : i < index ? 'is-done' : ''}`}
        >
          {isLeaderboardSlide(q) ? '★' : String(i + 1).padStart(2, '0')}
        </span>
      ))}
    </aside>
  )
}

// ── Right rail ───────────────────────────────────────────────────────────────

function RoomGauge({ question }: { question: Question }) {
  return (
    <aside className="host-gauge flex" style={{ paddingTop: 4 }}>
      <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.26)' }}>Room</span>
      {/* No live room to count. The real gauge shows "N of M in" here; faking a
          number would be the exact dishonesty this preview exists to avoid. */}
      <div
        className="host-gauge-count text-center"
        style={{ fontWeight: 800, fontSize: 30, lineHeight: 1, color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.03em' }}
        title="Fills with the answered count once participants join"
      >
        &mdash;
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.34)', letterSpacing: '0.04em', marginTop: 3 }}>
          answers in
        </span>
      </div>
      <div className="host-gauge-bar"><div style={{ height: '0%' }} /></div>
      {question.timerSeconds > 0 && (
        <div className="flex flex-col items-center gap-2" style={{ marginTop: 'auto' }}>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.26)' }}>Time</span>
          <CircularTimer timeLeft={question.timerSeconds} total={question.timerSeconds} size={60} variant="dark" />
        </div>
      )}
    </aside>
  )
}

// ── Question spotlight ───────────────────────────────────────────────────────

function QuestionSpotlight({ question }: { question: Question }) {
  const withImage = !!question.imageUrl && question.type !== 'wordcloud'
  // Standard slides keep the hardcoded `fit-large` guess they have always used
  // — HostOptionTile and the question fit both re-measure at runtime anyway.
  // Long-text slides additionally need the stage class, because the height
  // split is the whole reason the preview would otherwise lie about clipping.
  const stageClass = question.longText ? longTextFit(question).stageClass : 'host-stage-standard'
  return (
    <div
      className={`host-question-card w-full host-question-fit-large ${stageClass} flex rounded-[26px] border ${withImage ? 'flex-row items-center' : 'flex-col'} ${question.type === 'case' ? 'border-blue-300' : 'border-white/20'}`}
      style={{
        background: 'rgba(255,255,255,0.97)',
        boxShadow: '0 30px 90px -20px rgba(0,0,0,0.5)',
        // clamp(22px, 4.2vh, 50px) clamp(34px, 5vw, 72px) at 1440×810.
        padding: '34px 72px',
        gap: withImage ? 43 : undefined,
      }}
    >
      {withImage ? (
        <>
          {/* height 178 = clamp(120px, 22vh, 220px) resolved at the 810px frame.
              maxHeight mirrors the live stage, where the panel is bound to the
              card's own content box because the clamp is viewport-relative
              while the card cap is a percentage of the stage — without it a
              projector clipped the panel out of the card. It does not bind at
              810px, so this changes nothing today; it exists so the two cannot
              drift, which is the whole point of this component. */}
          <div
            className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl"
            style={{ width: 'clamp(150px, 30%, 340px)', height: 178, maxHeight: '100%', background: '#F5F6F8', boxShadow: 'inset 0 0 0 1px rgba(15,27,61,0.06)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={question.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <p className="font-display min-w-0 flex-1 break-words font-medium leading-snug" style={{ color: '#0F1B3D', lineHeight: 1.15 }}>
            {question.text || 'Untitled question'}
          </p>
        </>
      ) : (
        <p className="font-display shrink-0 break-words font-medium leading-snug" style={{ color: '#0F1B3D', lineHeight: 1.15 }}>
          {question.text || 'Untitled question'}
        </p>
      )}
    </div>
  )
}

// ── Answer stage (one branch per question type, mirroring the live stage) ────

function AnswerStage({ question }: { question: Question }) {
  if (isLeaderboardSlide(question)) return <StandingsSlide topN={question.topN ?? 5} />
  if (question.type === 'wordcloud') return <HostWordCloud words={[]} />
  if (question.type === 'rating') return <RatingStage max={question.options?.length || 5} />
  if (question.type === 'qa' || question.type === 'openended') return <CollectedStage isQa={question.type === 'qa'} />
  if (question.type === 'matching') return <MatchingStage question={question} />
  if (question.type === 'fillblank') return <FillBlankStage />
  if (question.type === 'ranking') return <RankingStage question={question} />
  if (question.type === 'drawing') return <DrawingStage />

  const options = getEffectiveOptions(question) ?? []
  if (options.length === 0) return <CollectedStage isQa={false} />

  const longText = question.longText === true
  const singleCol = longText && longTextFit(question).optionColumns === 1

  return (
    <div className={`host-answer-stage host-options-stage host-option-fit-large ${longText ? 'host-options-long' : ''} ${singleCol ? 'host-options-single-col' : ''}`}>
      {options.map((opt, i) => (
        <HostOptionTile
          key={i}
          index={i}
          letter={ANSWER_LETTERS[i] ?? String(i + 1)}
          colorClass={colorForIndex(i).tw}
          text={getOptionText(opt) || 'Empty option'}
          votes={0}
          votePct={0}
          showVotes={false}
          highlightCorrect={false}
          longText={longText}
        />
      ))}
    </div>
  )
}

/** Shared white "answers land here" card the live stage uses for text types. */
function WhiteStage({ children, className = '', maxWidth = 'max-w-3xl' }: { children: React.ReactNode; className?: string; maxWidth?: string }) {
  return (
    <div className={`host-answer-stage ${maxWidth} mx-auto min-h-0 w-full flex-1 rounded-2xl border border-gray-200 bg-white p-8 ${className}`}>
      {children}
    </div>
  )
}

function CollectedStage({ isQa }: { isQa: boolean }) {
  return (
    <WhiteStage className="flex flex-col items-center justify-center text-center">
      <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-gray-400">Answers Collected</p>
      <div className="text-[8rem] font-black leading-none tabular-nums" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>0</div>
      <p className="mt-3 text-lg font-semibold text-gray-500">Waiting for responses…</p>
      <p className="mt-5 max-w-md text-xs font-medium text-gray-400">
        {isQa
          ? 'Questions are moderated from a side panel — the wall only shows the count.'
          : 'Individual responses stay private here — review them in the post-session report.'}
      </p>
    </WhiteStage>
  )
}

function RatingStage({ max }: { max: number }) {
  return (
    <WhiteStage maxWidth="max-w-7xl" className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => (
          <svg key={i} viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1.5" strokeLinejoin="round"
            />
          </svg>
        ))}
      </div>
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-7xl font-black tabular-nums" style={{ color: '#F59E0B', fontFamily: 'var(--font-heading)' }}>&mdash;</span>
        <span className="text-2xl font-bold text-gray-400">/ {max}</span>
      </div>
      <p className="text-sm font-bold text-gray-500">Waiting for ratings…</p>
    </WhiteStage>
  )
}

function FillBlankStage() {
  return (
    <WhiteStage className="flex flex-col items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-gray-400">Type your answer</p>
        <div className="rounded-2xl px-5 py-4 text-lg text-gray-400" style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
          Waiting for responses…
        </div>
      </div>
    </WhiteStage>
  )
}

function DrawingStage() {
  return (
    <WhiteStage maxWidth="max-w-7xl" className="p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Drawings received (0)</p>
      <p className="text-sm text-gray-400">Waiting for participants to draw…</p>
    </WhiteStage>
  )
}

function MatchingStage({ question }: { question: Question }) {
  const pairs = question.matchPairs ?? []
  // The live stage never shows the aligned pairs — the right column is the
  // shuffled pool, so the wall shows the task and not the answer key.
  const pool = pairs.map(p => p.right)
  return (
    <WhiteStage maxWidth="max-w-5xl" className="overflow-hidden p-5">
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Match these</p>
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold" style={{ background: '#EEF2FF', color: '#4F46E5' }}>{i + 1}</span>
              <span className="min-w-0 flex-1 break-words font-medium text-gray-900">{p.left}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">With one of these</p>
          {pool.map((right, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: '#FDF2F8', border: '1px solid #FBCFE8' }}>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold" style={{ background: '#FCE7F3', color: '#DB2777' }}>{String.fromCharCode(65 + i)}</span>
              <span className="min-w-0 flex-1 break-words font-medium text-gray-900">{right}</span>
            </div>
          ))}
        </div>
      </div>
    </WhiteStage>
  )
}

function RankingStage({ question }: { question: Question }) {
  const options = question.options ?? []
  return (
    <WhiteStage maxWidth="max-w-7xl" className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Class consensus</p>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">0 submissions</span>
      </div>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-black text-gray-600">{i + 1}</span>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: colorForIndex(i).hex }}>
              {ANSWER_COLORS[i % ANSWER_COLORS.length]!.letter}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{getOptionText(opt)}</span>
            <span className="text-xs font-bold tabular-nums text-gray-600">&mdash;</span>
          </div>
        ))}
      </div>
    </WhiteStage>
  )
}

function StandingsSlide({ topN }: { topN: number }) {
  return (
    <WhiteStage maxWidth="max-w-3xl" className="flex flex-col items-center justify-center gap-3 text-center">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-400">Standings slide</p>
      <p className="text-2xl font-black" style={{ color: '#0F1B3D' }}>Top {topN} appear here</p>
      <p className="max-w-md text-sm font-medium text-gray-400">
        This slide is not answerable — it pauses the quiz on the live leaderboard.
      </p>
    </WhiteStage>
  )
}

// ── Control dock ─────────────────────────────────────────────────────────────

/** The live stage's glass control bar. Non-interactive here — it is part of
 *  what the room sees, so leaving it out made the stage look emptier than it
 *  is. */
function ControlDock() {
  const iconBox: React.CSSProperties = {
    height: 38, width: 38, borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(255,255,255,0.14)',
  }
  return (
    <div className="mt-auto flex w-full justify-center pt-2" aria-hidden>
      <div
        className="items-center"
        style={{
          width: 680,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(15,27,61,0.74)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 18px 50px -16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '8px 12px',
        }}
      >
        <div className="flex min-w-0 items-center justify-start" style={{ gap: 7 }}>
          <span className="flex items-center justify-center" style={iconBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
          </span>
          <span className="flex items-center justify-center" style={{ ...iconBox, background: 'rgba(251,209,59,0.22)', color: GOLD, border: '1px solid rgba(251,209,59,0.5)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
          </span>
          <span className="flex items-center justify-center" style={iconBox}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[17px] w-[17px]"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          </span>
          <span className="flex items-center justify-center px-2.5 text-[13px] font-black" style={{ ...iconBox, width: 'auto' }}>+15s</span>
          <span className="flex items-center justify-center" style={iconBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /></svg>
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <span
            className="inline-flex items-center justify-center gap-2 px-5"
            style={{
              height: 46, borderRadius: 14,
              border: '2px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
            }}
          >
            End Now
          </span>
        </div>

        <div className="flex items-center justify-end" style={{ gap: 7 }}>
          <span className="flex items-center justify-center" style={iconBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>
          </span>
          <span className="flex items-center justify-center" style={iconBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
          </span>
          <span className="flex items-center justify-center" style={iconBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]"><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 0 0 0-6M21 20a6 6 0 0 0-4-5.6" /></svg>
          </span>
        </div>
      </div>
    </div>
  )
}
