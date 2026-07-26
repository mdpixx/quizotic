'use client'

/**
 * What each phone sees — a true-size replica of the participant answer screen
 * (src/app/join/page.tsx, `phase === 'question'`) at the moment the question
 * opens and before this player has answered.
 *
 * The important correction over the first version of this preview: answer
 * options on a phone are a VERTICAL STACK of full-width horizontal bars — round
 * letter badge on the left, answer text filling the rest and wrapping. The 2×2
 * quadrant grid only ever appears on a ≥1024px screen (or in shared-screen
 * classroom mode), never on the phone this pane is standing in for.
 *
 * Rendered inside <ScaledDevice> at 390×844. Two consequences shape the code:
 *   • `sm:` / `lg:` variants and vw-based clamps resolve against the real
 *     browser window, not the frame, so this file avoids both and writes the
 *     value a 390px-wide phone actually gets (see the question-text sizes).
 *   • The chrome that is `lg:hidden` on the live page (the mobile top bar) is
 *     inlined here rather than imported, for the same reason.
 */

import { Avatar } from '@/components/Avatar'
import { CircularTimer } from '@/components/CircularTimer'
import { ANSWER_LETTERS, colorForIndex } from '@/lib/answer-colors'
import type { Question } from '@/lib/quiz-types'
import { getEffectiveOptions, getOptionImage, getOptionText, isLeaderboardSlide, isScoredQuestion } from '@/lib/quiz-types'

const NAVY = '#0F1B3D'
const GOLD = '#FBD13B'

/** Stand-in identity. The live server assigns one of these animal archetypes
 *  on join (src/lib/archetypes.mjs) and the avatar is seeded from the name. */
const SAMPLE_ARCHETYPE = 'Storm Tiger'

/** Types whose phone UI is a textarea + Submit, not option tiles. */
const TEXT_INPUT_TYPES: readonly Question['type'][] = ['openended', 'wordcloud', 'qa', 'fillblank']

export interface ParticipantPreviewProps {
  questions: Question[]
  index: number
}

export function ParticipantPreview({ questions, index }: ParticipantPreviewProps) {
  const question = questions[index]
  if (!question) return null

  const answerableTotal = questions.filter(q => !isLeaderboardSlide(q)).length
  const answerableNumber = questions.slice(0, index + 1).filter(q => !isLeaderboardSlide(q)).length
  const scored = isScoredQuestion(question)

  if (isLeaderboardSlide(question)) return <StandingsScreen />

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ width: '100%', height: '100%', padding: 16, paddingBottom: 96, background: '#FFFFFF' }}
    >
      {/* ── Top bar (the live page's .participant-topbar) ────────────────── */}
      <div className="participant-topbar mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar archetype={SAMPLE_ARCHETYPE} size={36} />
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="max-w-[7rem] truncate text-sm font-semibold text-gray-600">{SAMPLE_ARCHETYPE}</span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-base"
            style={{ border: '1.5px solid #E5E7EB' }}
            aria-hidden
          >
            🔊
          </span>
          <CircularTimer timeLeft={question.timerSeconds} total={question.timerSeconds} />
        </div>
      </div>

      {/* Timer progress bar — omitted entirely on no-timer questions, exactly
          as the live page does. */}
      {question.timerSeconds > 0 && (
        <div className="mb-4 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(15,27,61,0.1)' }}>
          <div className="h-full rounded-full" style={{ width: '100%', background: NAVY }} />
        </div>
      )}

      {question.type === 'case' && question.scenarioText && (
        <div className="mb-3 rounded-2xl border p-5" style={{ background: NAVY, borderColor: '#2D3A8C' }}>
          <p className="mb-2 text-base font-bold uppercase tracking-widest" style={{ color: GOLD }}>Scenario</p>
          <p className="text-lg leading-relaxed" style={{ color: '#E0E7FF' }}>{question.scenarioText}</p>
          {question.supportingDetail && (
            <p className="mt-2 text-lg font-bold" style={{ color: GOLD }}>{question.supportingDetail}</p>
          )}
        </div>
      )}

      {/* ── Question card ───────────────────────────────────────────────── */}
      <div
        className="participant-question-card font-display mb-4 rounded-2xl border border-t-4 border-gray-200 bg-white p-4 shadow-sm"
        style={{ borderTopColor: question.type === 'case' ? '#2D3A8C' : GOLD }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold tracking-wide text-gray-400">Q{answerableNumber} / {answerableTotal}</span>
          {scored ? (
            <span className="text-base font-black" style={{ color: NAVY }}>{question.points} pts</span>
          ) : question.type === 'case' ? (
            <span className="text-base font-semibold" style={{ color: '#2D3A8C' }}>Scenario</span>
          ) : (
            <span
              className="rounded-md px-2.5 py-1 text-xs font-bold"
              style={{ background: '#F3F4F6', color: '#475569', border: '1px solid #E2E8F0' }}
            >
              Participation
            </span>
          )}
        </div>
        <p
          className="break-words text-justify font-medium [hyphens:auto]"
          style={{ color: NAVY, ...questionTextSize(question.text.length) }}
        >
          {question.text || 'Untitled question'}
        </p>
        {question.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={question.imageUrl} alt="" className="mt-3 max-h-48 w-full rounded-xl bg-gray-100 object-contain" />
        )}
      </div>

      <AnswerArea question={question} />
    </div>
  )
}

/**
 * `.participant-question-text` sizes itself with a vw-based clamp, which inside
 * a scaled frame would follow the browser window instead of the 390px phone
 * (a 1440px window rendered 30px text where a phone shows 20px). These are the
 * same three buckets resolved at a 390px viewport.
 */
function questionTextSize(len: number): { fontSize: number; lineHeight: number } {
  if (len > 200) return { fontSize: 15.6, lineHeight: 1.3 }
  if (len > 140) return { fontSize: 17.6, lineHeight: 1.3 }
  return { fontSize: 20, lineHeight: 1.3 }
}

// ── Answer area ──────────────────────────────────────────────────────────────

function AnswerArea({ question }: { question: Question }) {
  if (question.type === 'drawing') return <DrawingArea />
  if (TEXT_INPUT_TYPES.includes(question.type)) return <TextInputArea type={question.type} />
  if (question.type === 'rating') return <RatingArea max={question.options?.length || 5} />
  if (question.type === 'ranking') return <RankingArea question={question} />
  if (question.type === 'matching') return <MatchingArea question={question} />

  const options = getEffectiveOptions(question) ?? []
  const isMultiselect = question.type === 'multiselect'

  return (
    <>
      {isMultiselect && (
        <div className="mb-2.5 flex items-center gap-2 px-1">
          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2" style={{ borderColor: '#7C3AED', background: '#F5F3FF' }} aria-hidden />
          <span className="text-sm font-bold" style={{ color: '#7C3AED' }}>Select all that apply</span>
        </div>
      )}
      {/* THE point of this preview: one full-width bar per option, stacked. */}
      <div className="flex flex-col gap-2.5 pb-4">
        {options.map((opt, i) => {
          const optImage = getOptionImage(opt)
          return (
            <div
              key={i}
              className="flex min-h-[60px] items-center gap-3 rounded-xl px-4 py-3 text-left text-white"
              style={{ background: colorForIndex(i).hex }}
            >
              {optImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optImage} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              )}
              {isMultiselect ? (
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center"
                  style={{ borderRadius: 8, border: '3px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.12)' }}
                  aria-hidden
                />
              ) : (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/25 text-lg font-black">
                  {ANSWER_LETTERS[i] ?? String(i + 1)}
                </span>
              )}
              <span className="min-w-0 flex-1 break-words text-base font-medium leading-snug [hyphens:auto]" style={{ overflowWrap: 'anywhere' }}>
                {getOptionText(opt)}
              </span>
            </div>
          )
        })}
      </div>
      {isMultiselect && <SubmitButton label="Select answers" muted />}
    </>
  )
}

function TextInputArea({ type }: { type: Question['type'] }) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div
        className="min-h-[140px] w-full rounded-2xl border-2 border-gray-200 bg-white p-4 text-lg text-gray-400"
        aria-hidden
      >
        {type === 'qa' ? 'Type your question…' : 'Type your answer…'}
      </div>
      <SubmitButton label="Submit →" />
    </div>
  )
}

function RatingArea({ max }: { max: number }) {
  const starSize = max <= 5 ? 56 : max <= 7 ? 48 : 40
  const fontSize = max <= 5 ? 36 : max <= 7 ? 30 : 24
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
      <p className="text-sm font-semibold text-gray-500">Tap to rate</p>
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="flex items-center justify-center rounded-2xl border-2 border-gray-200 bg-white"
            style={{ width: starSize, height: starSize, fontSize, lineHeight: 1, color: '#D1D5DB' }}
            aria-hidden
          >
            ★
          </span>
        ))}
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: '#D1D5DB' }}>&mdash; / {max}</p>
      <div className="w-full max-w-xs"><SubmitButton label="Tap to rate" muted /></div>
    </div>
  )
}

function RankingArea({ question }: { question: Question }) {
  const options = question.options ?? []
  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-center text-sm font-semibold text-gray-500">Drag to rank your order, then submit</p>
      {options.map((opt, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white"
          style={{ background: colorForIndex(i).hex }}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/25 text-sm font-black">{i + 1}</span>
          <span className="min-w-0 flex-1 break-words text-base font-medium">{getOptionText(opt)}</span>
          <span className="flex-shrink-0 text-lg opacity-70" aria-hidden>⠿</span>
        </div>
      ))}
      <SubmitButton label="Submit order →" />
    </div>
  )
}

function MatchingArea({ question }: { question: Question }) {
  const pairs = question.matchPairs ?? []
  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-center text-sm font-semibold text-gray-500">Match each item, then submit</p>
      {pairs.map((p, i) => (
        <div key={i} className="rounded-2xl border-2 border-gray-200 bg-white p-3">
          <p className="mb-2 text-base font-bold" style={{ color: NAVY }}>{p.left}</p>
          <div className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-3 text-base font-semibold" style={{ color: '#831843' }} aria-hidden>
            Choose a match…
          </div>
        </div>
      ))}
      <SubmitButton label="Submit matches →" muted />
    </div>
  )
}

function DrawingArea() {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50" style={{ minHeight: 220 }}>
        <p className="text-sm font-semibold text-gray-400">Draw your answer here</p>
      </div>
      <SubmitButton label="Submit drawing →" />
    </div>
  )
}

function SubmitButton({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div
      className="w-full rounded-2xl py-4 text-center text-xl font-black"
      style={muted
        ? { background: '#e5e7eb', color: '#0D0D0D' }
        : { background: GOLD, color: '#0D0D0D', border: '2px solid #0D0D0D' }}
      aria-hidden
    >
      {label}
    </div>
  )
}

function StandingsScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center" style={{ width: '100%', height: '100%', padding: 24, background: '#FFFFFF' }}>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-400">Standings</p>
      <p className="text-2xl font-black" style={{ color: NAVY }}>Your rank appears here</p>
      <p className="text-sm font-medium text-gray-400">
        Nothing to answer on this slide — phones show the live leaderboard.
      </p>
      <div className="mt-2 w-full space-y-1.5">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2 rounded-lg px-2 py-2" style={{ background: n === 2 ? '#FFF8DB' : '#F8FAFC', border: `1px solid ${n === 2 ? GOLD : '#EEF2F7'}` }}>
            <span className="w-5 text-center text-xs font-black tabular-nums" style={{ color: n === 2 ? NAVY : '#9CA3AF' }}>{n}</span>
            <span className="h-3 flex-1 rounded" style={{ background: 'rgba(15,27,61,0.08)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
