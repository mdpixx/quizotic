'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import dynamic from 'next/dynamic'
import { Avatar } from '@/components/Avatar'
import { BrandWatermark } from '@/components/BrandWatermark'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { NavChevron } from '@/components/ui/NavButton'
import { CreateYourOwnCTA } from '@/components/CreateYourOwnCTA'
import { playTick, playCorrect, playWrong, playStreak, isMuted, toggleMuted } from '@/lib/sounds'
import { LeaderboardView } from '@/components/LeaderboardView'
import { ResultBeat, type PersonalResult } from '@/components/ResultBeat'
import { startClockSync, getServerNow, resyncClock } from '@/lib/clock-sync'
import { PRESENTATION_SEQUENCE } from '@/lib/sequence-theme'
import { useI18n } from '@/lib/use-i18n'
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isContentSlideType, isInteractiveSlideType } from '@/lib/presentation-types'
import { isScoredType, getEffectiveOptions } from '@/lib/quiz-types'
import type { Question as QuizQuestion, QuestionType } from '@/lib/quiz-types'
import { SlideImage } from '@/components/SlideImage'
import { ANSWER_COLORS, ANSWER_LETTERS } from '@/lib/answer-colors'
import { useConfetti } from '@/hooks/useConfetti'
import { useWakeLock } from '@/hooks/useWakeLock'
import { QuizoticLogo } from '@/components/QuizoticLogo'
import { track } from '@/lib/analytics'

function phaseForPresenterSlide(
  slideType: string | undefined,
  mirrorOn: boolean,
): 'presenter-voting' | 'presenter-content' | 'presenter-waiting' | 'presenter-lobby' {
  // Interactive slides always wake the participant phone — they have an input.
  if (isInteractiveSlideType(slideType)) return 'presenter-voting'
  // Content slides mirror ONLY when the host has explicitly turned mirror on;
  // otherwise participants sit on a passive "waiting" screen so they aren't
  // pulled into their phones during lecture content.
  if (isContentSlideType(slideType)) return mirrorOn ? 'presenter-content' : 'presenter-waiting'
  return 'presenter-lobby'
}

const CircularTimer = dynamic(() => import('@/components/CircularTimer').then(m => m.CircularTimer), { ssr: false })
const DrawingCanvas = dynamic(() => import('@/components/DrawingCanvas').then(m => m.DrawingCanvas), { ssr: false })
const Podium = dynamic(() => import('@/components/Podium').then(m => m.Podium), { ssr: false })
const ReflectionMoment = dynamic(() => import('@/components/ReflectionMoment').then(m => m.ReflectionMoment), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'form' | 'connecting' | 'lobby' | 'question' | 'answered' | 'standings' | 'ended' | 'selfpaced' | 'selfpaced-done'
  | 'presenter-lobby' | 'presenter-content' | 'presenter-voting' | 'presenter-voted' | 'presenter-results'
  | 'presenter-waiting'

interface PresenterAggregateData {
  total: number
  counts?: number[]
  words?: Record<string, number>
  responses?: string[]              // open_text — full strings
  scores?: number[]
  emojis?: Record<string, number>
  pins?: { x: number; y: number }[]
  rankings?: number[][]             // ranking — full orderings
  ideas?: { id: string; text: string; votes: number }[]  // brainstorm — upvotable cards
}

type QuestionOption = string | { text: string; imageUrl?: string }

function getOptText(opt: QuestionOption): string {
  return typeof opt === 'string' ? opt : opt.text
}

function getOptImage(opt: QuestionOption): string | undefined {
  return typeof opt === 'string' ? undefined : opt.imageUrl
}

interface Question {
  id: string
  type: string
  text: string
  imageUrl?: string       // question context image (CDN URL)
  options?: QuestionOption[]
  timerSeconds: number
  points: number
  isScored?: boolean
  index: number
  total: number
  scenarioText?: string
  supportingDetail?: string
  correctAnswer?: string  // available in self-paced (follow-up) mode
  explanation?: string    // available in self-paced (follow-up) mode
  matchLefts?: string[]   // matching — left prompts (ordered)
  matchRights?: string[]  // matching — right options (shuffled)
}

interface LeaderboardEntry {
  name: string
  archetype: string
  score: number
  // Movement data from the server's leaderboard snapshot — drives the
  // ▲/▼ and "+points" badges in LeaderboardView.
  previousRank?: number | null
  rankDelta?: number
  scoreDelta?: number
}

// Kahoot-style vibrant answer colors — source: src/lib/answer-colors.ts.
// Shadow Tailwind classes kept local because they need arbitrary-value
// rgba() tuples and are read by class name at runtime.
const OPTION_GRADIENTS = [
  'shadow-[0_4px_14px_rgba(226,27,60,0.35)]',
  'shadow-[0_4px_14px_rgba(19,104,206,0.35)]',
  'shadow-[0_4px_14px_rgba(216,158,0,0.35)]',
  'shadow-[0_4px_14px_rgba(38,137,12,0.35)]',
  'shadow-[0_4px_14px_rgba(124,58,237,0.35)]',
]
const OPTION_COLORS = ANSWER_COLORS.map(c => c.hex)
const OPTION_LABELS = ANSWER_LETTERS
const TEXT_INPUT_TYPES = ['openended', 'wordcloud', 'qa', 'fillblank']

// ─── Countdown Number (for get-ready overlay) ────────────────────────────────
// Wall-clock-anchored countdown shared with the host. Formula:
//   Math.max(0, Math.min(3, Math.ceil((targetTime - now) / 1000)))
// The min(3, ...) cap stops a stray "4" appearing briefly when the server's
// startAt is +3.5s away. Polling at 100ms keeps the flip aligned with the
// host's identical loop down to a render frame.
function CountdownNumber({ targetTime }: { targetTime: number }) {
  const compute = () => Math.max(0, Math.min(3, Math.ceil((targetTime - Date.now()) / 1000)))
  const [val, setVal] = useState(compute)
  const prevVal = useRef(val)
  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = compute()
      setVal(remaining)
      if (remaining <= 0) clearInterval(tick)
    }, 100)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTime])
  const changed = val !== prevVal.current
  // Play a clock tick each time the number drops (3 → 2 → 1). The targetTime
  // is derived from the server's startAt, so this fires in sync with the
  // host's intro countdown ticks.
  useEffect(() => {
    if (changed && val > 0) playTick()
  }, [changed, val])
  prevVal.current = val
  return (
    <div className="relative">
      <div
        key={changed ? val : undefined}
        className="font-display"
        style={{
          fontSize: 120,
          lineHeight: 1,
          color: '#FBD13B',
          fontWeight: 900,
          animation: changed ? 'countdownPop 0.9s ease-out forwards' : undefined,
        }}
      >
        {val > 0 ? val : ''}
      </div>
      <style>{`
        @keyframes countdownPop {
          0%   { transform: scale(1.4); opacity: 0.6; }
          30%  { transform: scale(1.0); opacity: 1; }
          80%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(0.7); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── Star Rating Component ───────────────────────────────────────────────────
function StarRating({ max, minLabel, maxLabel, textLight, onSubmit, disabled, onDisabledClick }: {
  max: number; minLabel?: string; maxLabel?: string; textLight: string
  onSubmit: (value: number) => void
  disabled?: boolean
  onDisabledClick?: () => void
}) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  return (
    <div className={`space-y-6 ${disabled ? 'opacity-50' : ''}`} style={disabled ? { filter: 'grayscale(1)' } : undefined}>
      <div className="flex items-center justify-between text-sm opacity-50" style={{ color: textLight }}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <div className="flex justify-center" style={{ gap: max <= 5 ? 12 : max <= 7 ? 8 : 4 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => {
          const active = n <= (hovered || selected)
          const size = max <= 5 ? 'w-12 h-12' : max <= 7 ? 'w-10 h-10' : 'w-8 h-8'
          return (
            <button key={n}
              onPointerEnter={() => { if (!disabled) setHovered(n) }}
              onPointerLeave={() => setHovered(0)}
              onClick={() => { if (disabled) { onDisabledClick?.(); return } setSelected(n) }}
              className={`transition-all duration-150 active:scale-90 ${size}`}
              style={{ transform: active ? 'scale(1.15)' : 'scale(1)' }}>
              <svg viewBox="0 0 24 24" className="w-full h-full" style={{ filter: active ? 'drop-shadow(0 0 6px rgba(250,204,21,0.5))' : 'none' }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={active ? '#FACC15' : 'rgba(255,255,255,0.1)'}
                  stroke={active ? '#EAB308' : 'rgba(255,255,255,0.25)'}
                  strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          )
        })}
      </div>
      <div className="text-center">
        <span className="text-3xl font-black" style={{ color: selected > 0 ? PRESENTATION_SEQUENCE.accentOnDark : 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-heading)' }}>
          {selected > 0 ? `${selected} / ${max}` : 'Tap a star'}
        </span>
      </div>
      <button onClick={() => { if (disabled) { onDisabledClick?.(); return } if (selected > 0) onSubmit(selected) }}
        disabled={selected === 0 || disabled}
        className="w-full py-5 rounded-2xl text-xl font-black transition-all disabled:opacity-30"
        style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: '2px solid rgba(255,255,255,0.25)' }}>
        Submit
      </button>
    </div>
  )
}

// ─── Pinpoint Component ──────────────────────────────────────────────────────
function PinpointInput({ imageUrl, onSubmit }: {
  imageUrl?: string; onSubmit: (value: { x: number; y: number }) => void
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleTap(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setPin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl"
        style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.35)' }}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>
          <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
          <circle cx="12" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
        <p className="text-sm font-bold" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>
          {pin ? 'Tap again to move your pin' : 'Tap the image to drop your pin'}
        </p>
      </div>
      <div ref={containerRef} onPointerDown={imageUrl ? handleTap : undefined}
        className="relative rounded-2xl overflow-hidden border"
        style={{
          aspectRatio: '4/3', cursor: imageUrl ? 'crosshair' : 'not-allowed',
          background: imageUrl ? '#000' : 'rgba(255,255,255,0.05)',
          borderColor: 'rgba(255,255,255,0.15)',
        }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-contain pointer-events-none" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-30" style={{ color: 'white' }}>
              <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
            </svg>
            <p className="text-xs opacity-50" style={{ color: 'white' }}>Waiting for image...</p>
          </div>
        )}
        {pin && (
          <div className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white pointer-events-none"
            style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: '#EF4444', boxShadow: '0 0 12px rgba(239,68,68,0.7)' }} />
        )}
      </div>
      <button onClick={() => { if (pin) onSubmit(pin) }}
        disabled={!pin}
        className="w-full py-5 rounded-2xl text-xl font-black transition-all disabled:opacity-30"
        style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: '2px solid rgba(255,255,255,0.25)' }}>
        {pin ? 'Submit Pin' : 'Tap the image first'}
      </button>
    </div>
  )
}

// ─── Grid 2x2 Component ─────────────────────────────────────────────────────
function Grid2x2Input({ xMin, xMax, yMin, yMax, onSubmit }: {
  xMin?: string; xMax?: string; yMin?: string; yMax?: string
  onSubmit: (value: { x: number; y: number }) => void
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleTap(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setPin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center opacity-50" style={{ color: 'white' }}>Tap to place yourself on the grid</p>
      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-1 top-0 bottom-0 flex flex-col justify-between items-center py-1 z-10" style={{ width: 20 }}>
          <span className="text-[10px] font-bold" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>{yMax || 'High'}</span>
          <span className="text-[10px] font-bold" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>{yMin || 'Low'}</span>
        </div>
        <div className="ml-6">
          {/* Grid area */}
          <div ref={containerRef} onPointerDown={handleTap}
            className="relative rounded-xl overflow-hidden"
            style={{
              aspectRatio: '1', cursor: 'crosshair',
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}>
            {/* Grid lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            {/* Pin */}
            {pin && (
              <div className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: '#8B5CF6', boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
            )}
          </div>
          {/* X-axis labels */}
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-bold" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>{xMin || 'Low'}</span>
            <span className="text-[10px] font-bold" style={{ color: PRESENTATION_SEQUENCE.accentOnDark }}>{xMax || 'High'}</span>
          </div>
        </div>
      </div>
      <button onClick={() => { if (pin) onSubmit(pin) }}
        disabled={!pin}
        className="w-full py-5 rounded-2xl text-xl font-black transition-all disabled:opacity-30"
        style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: '2px solid rgba(255,255,255,0.25)' }}>
        {pin ? 'Submit' : 'Tap the grid first'}
      </button>
    </div>
  )
}

// ─── Sortable Ranking Item ───────────────────────────────────────────────────
// Whole-bar drag: listeners are on the bar div so the participant can grab
// anywhere. TouchSensor delay:200ms lets quick swipes still scroll the page
// (fixes the earlier sideways-slide regression on touch devices).
function SortableRankingItem({ id, index, label, color }: { id: string; index: number; label: string; color: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const base = CSS.Transform.toString(transform)
  const style: React.CSSProperties = {
    transform: isDragging && base ? `${base} scale(1.03)` : base,
    transition,
    background: color,
    opacity: isDragging ? 0.95 : 1,
    touchAction: 'manipulation',
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.35)' : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="w-full py-4 rounded-2xl text-left px-5 text-base font-bold text-white flex items-center gap-3 select-none">
      <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm font-black"
        style={{ background: 'rgba(255,255,255,0.2)' }}>{index + 1}</span>
      <span className="flex-1">{label}</span>
      <span
        aria-hidden="true"
        className="opacity-80 text-xl leading-none px-2 py-1 -mr-2 rounded-md"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >⋮⋮</span>
    </div>
  )
}

// ─── Inner Component (uses useSearchParams — requires Suspense) ───────────────
// Outbox payload — buffered answer submissions that retry on reconnect.
// `confidence` may be a number (multi-question level) on the wire; the server
// validates via SubmitAnswerSchema.
type SubmitAnswerPayload = {
  gameCode: string
  participantId?: string
  answer: string | number | (string | number)[]
  timeMs: number
  confidence: 'sure' | 'unsure' | null
  serverSubmittedAt?: number
}
type OutboxItem = {
  id: string
  questionIndex: number
  payload: SubmitAnswerPayload
  ts: number
}

// Durable per-game participant identity. localStorage survives socket drops,
// tab close, and browser restarts — server matches this UUID against
// session.participantsById, so a participant can disconnect for hours and
// still come back as themselves with their score intact. 6h TTL prevents
// cross-quiz collisions if someone reuses a code.
function getOrCreateParticipantId(gameCode: string): string {
  if (typeof window === 'undefined' || !gameCode) return ''
  const key = `quizotic_pid_${gameCode}`
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id: string; ts: number }
        if (parsed?.id && Date.now() - parsed.ts < 6 * 60 * 60 * 1000) return parsed.id
      } catch { /* fall through to regen */ }
    }
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(key, JSON.stringify({ id, ts: Date.now() }))
    return id
  } catch {
    return ''
  }
}

function setParticipantId(gameCode: string, id: string): void {
  if (typeof window === 'undefined' || !gameCode || !id) return
  try {
    window.localStorage.setItem(`quizotic_pid_${gameCode}`, JSON.stringify({ id, ts: Date.now() }))
  } catch { /* noop */ }
}

function clearParticipantId(gameCode: string): void {
  if (typeof window === 'undefined' || !gameCode) return
  try {
    window.localStorage.removeItem(`quizotic_pid_${gameCode}`)
  } catch { /* noop */ }
}

// Persistent top status banner: shows live socket health and any one-shot
// answer error (e.g. "Question already closed"). Mounts in every in-game
// phase return so the user is never silently disconnected.
function StatusBanner({ connectionState, answerToast }: { connectionState: 'connected' | 'reconnecting'; answerToast: string }) {
  const reconnecting = connectionState === 'reconnecting'
  if (!reconnecting && !answerToast) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[70] flex flex-col items-stretch pointer-events-none">
      {reconnecting && (
        <div className="bg-red-500/95 text-white px-4 py-2 text-sm font-bold text-center shadow-md">
          Connection lost — reconnecting…
        </div>
      )}
      {answerToast && (
        <div className="bg-yellow-400/95 text-black px-4 py-2 text-sm font-bold text-center shadow-md">
          {answerToast}
        </div>
      )}
    </div>
  )
}

function JoinPageInner() {
  // Participant flow is English-only — pin the locale and drop the language toggle.
  const { t } = useI18n('en')
  const searchParams = useSearchParams()
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answerTimeRef = useRef<number>(0)
  // Outbox of unconfirmed answer submissions. Cleared on answer_confirmed,
  // re-flushed on socket reconnect or after a forced re-join. This is the
  // single safety net against the silent-drop class of bugs.
  const outboxRef = useRef<Map<string, OutboxItem>>(new Map())
  // Indirection so initSocket's stable closure can call the latest flush impl.
  const flushAnswerOutboxRef = useRef<() => void>(() => {})
  // Durable participant identity (Layer 2). Set when the user joins or when
  // the server echoes back a participantId in the join callback.
  const participantIdRef = useRef<string>('')
  // Outbox flush gate. Stays false from socket-disconnect until the next
  // successful join_session callback. This prevents the classic race where a
  // buffered answer is flushed on the new socket BEFORE the rejoin handshake
  // completes — the server wouldn't recognise the new socket.id and reject
  // the answer as `unknown_participant`.
  const joinAckedRef = useRef<boolean>(false)

  const followupParam = searchParams.get('followup')
  const modeParam = searchParams.get('mode') // 'presenter' for presenter sessions
  const codeFromLink = searchParams.get('code') ?? ''
  // True when the participant arrived via a deep link with a valid 6-digit
  // code. We hide the code input in that case — the host already shared the
  // exact session, so showing an editable field invites typo bugs.
  const hasPrefilledCode = /^\d{6}$/.test(codeFromLink)
  const [phase, setPhase] = useState<Phase>(followupParam ? 'connecting' : 'form')
  const phaseRef = useRef<Phase>(followupParam ? 'connecting' : 'form')

  // Keep the participant phone screen awake while they're in a session.
  // Active for every phase except the pre-join name form and the post-quiz
  // "ended" / "selfpaced-done" terminal screens.
  useWakeLock(phase !== 'form' && phase !== 'ended' && phase !== 'selfpaced-done')

  const [code, setCode] = useState(codeFromLink)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // When the participant lands with a valid ?code in the URL, pre-fetch the
  // session title from the lookup endpoint so the form can render
  // "Joining {title}" before the user submits — and so we can show an
  // immediate error if the code is dead instead of waiting for the socket
  // round-trip. Skipped for follow-up sessions (their title is fetched via
  // the dedicated follow-up endpoint further down).
  useEffect(() => {
    if (!hasPrefilledCode || followupParam) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/session/lookup?code=' + encodeURIComponent(codeFromLink))
        if (!r.ok) return
        const data = await r.json().catch(() => null) as { ok?: boolean; exists?: boolean; title?: string } | null
        if (cancelled) return
        if (data?.exists && typeof data.title === 'string' && data.title) {
          setQuizTitle(data.title)
        }
      } catch {
        // Lookup failures are non-fatal — the user can still submit.
      }
    })()
    return () => { cancelled = true }
  }, [hasPrefilledCode, codeFromLink, followupParam])

  // With the code already filled, drop focus straight on the name field so a
  // direct-link visitor goes from arrival to typing their name in one step.
  useEffect(() => {
    if (!hasPrefilledCode) return
    nameInputRef.current?.focus()
  }, [hasPrefilledCode])

  // Presenter mode state
  const [presenterTitle, setPresenterTitle] = useState('')
  const [presenterSlideIndex, setPresenterSlideIndex] = useState(0)
  const [presenterTotalSlides, setPresenterTotalSlides] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [presenterCurrentSlide, setPresenterCurrentSlide] = useState<any>(null)
  const presenterVotedRef = useRef(false)
  const [presenterResponseMode, setPresenterResponseMode] = useState<'instant' | 'on_click' | 'private'>('instant')
  const presenterResponseModeRef = useRef<'instant' | 'on_click' | 'private'>('instant')
  // When the host has "Mirror to participants" OFF (default), content slides
  // render a passive waiting screen on the participant device instead of
  // mirroring the slide content. Interactive slides are unaffected.
  const mirrorToParticipantsRef = useRef(false)
  const [quickFireLeft, setQuickFireLeft] = useState<number | null>(null)
  const quickFireTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [presenterAggregate, setPresenterAggregate] = useState<PresenterAggregateData>({ total: 0 })
  // Brainstorm: ids of ideas this participant has upvoted (disables the button).
  const [upvotedIdeas, setUpvotedIdeas] = useState<Set<string>>(new Set())
  const [rankingOrder, setRankingOrder] = useState<number[]>([])
  // Matching: participant's chosen right-column value per left item (by index).
  const [matchChoices, setMatchChoices] = useState<string[]>([])
  const rankingSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [error, setError] = useState('')
  const [quizTitle, setQuizTitle] = useState('')
  // Live socket health — drives the in-game "Reconnecting…" banner so the
  // user is never silently disconnected while the question screen is open.
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting'>('connected')
  // One-shot toast for answer-related issues that aren't already surfaced
  // via the dedicated phase UI (e.g. unknown_participant after long idle).
  const [answerToast, setAnswerToast] = useState<string>('')
  useEffect(() => {
    if (!answerToast) return
    const t = setTimeout(() => setAnswerToast(''), 4000)
    return () => clearTimeout(t)
  }, [answerToast])

  // Avatar
  const [archetype, setArchetype] = useState<string | null>(null)
  const [avatarRevealed, setAvatarRevealed] = useState(false)
  // 'accuracy' is treated as a sub-mode of competitive on the participant
  // side — it still shows leaderboard/standings UI, only the scoring formula
  // differs (server enforces flat 100 per correct).
  const [sessionMode, setSessionMode] = useState<'competitive' | 'reflection' | 'accuracy'>('competitive')
  const sessionModeRef = useRef<'competitive' | 'reflection' | 'accuracy'>('competitive')
  useEffect(() => { sessionModeRef.current = sessionMode }, [sessionMode])
  const [anonymousMode, setAnonymousMode] = useState(false)
  const [team, setTeam] = useState<{ index: number; name: string; color: string } | null>(null)
  const [teamLeaderboard, setTeamLeaderboard] = useState<{ name: string; color: string; score: number; members: number }[] | null>(null)

  // Question
  const [question, setQuestion] = useState<Question | null>(null)
  // Answerable-question progress (excludes leaderboard flow slides) for "X of N".
  const [answerableNumber, setAnswerableNumber] = useState(0)
  const [answerableTotal, setAnswerableTotal] = useState(0)
  const questionRef = useRef<Question | null>(null)
  useEffect(() => { questionRef.current = question }, [question])
  const [paused, setPaused] = useState(false)
  const [personalResult, setPersonalResult] = useState<PersonalResult | null>(null)
  const [topMovers, setTopMovers] = useState<{ name: string; archetype?: string; fromRank: number; toRank: number; delta: number }[]>([])
  const [displayMode, setDisplayMode] = useState<'full-device' | 'shared-screen'>('full-device')
  const [timeLeft, setTimeLeft] = useState(0)
  const [getReadyVisible, setGetReadyVisible] = useState(false)
  const timeLeftRef = useRef(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  // Text answer (for open-ended, word cloud, Q&A)
  const [textAnswer, setTextAnswer] = useState('')

  // Confidence tap
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<'sure' | 'unsure' | null>(null)

  // Answered
  const [isCorrect, setIsCorrect] = useState(false)
  const [answeredIsScored, setAnsweredIsScored] = useState(false)
  // For scored questions, correctness/points are hidden ("locked in") until the
  // question ends for everyone (personal_result) so neighbours can't copy.
  const [revealed, setRevealed] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  // Mirrors the persisted global mute in lib/sounds — initialised in an
  // effect because localStorage isn't readable during SSR render.
  const [soundMuted, setSoundMuted] = useState(false)
  useEffect(() => { setSoundMuted(isMuted()) }, [])
  const [explanation, setExplanation] = useState<string | null>(null)
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<string | null>(null)

  // Streak + reactions
  const [streak, setStreak] = useState(0)
  const [showRedFlash, setShowRedFlash] = useState(false)
  const fireConfetti = useConfetti()

  // Ended
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Intermediate leaderboard (between questions)
  const [intermediateLeaderboard, setIntermediateLeaderboard] = useState<LeaderboardEntry[]>([])
  const [intermediateRank, setIntermediateRank] = useState<number | null>(null)

  // Multiselect
  const [multiselectChosen, setMultiselectChosen] = useState<Set<number>>(new Set())

  // Self-paced follow-up state
  const [spQuestions, setSpQuestions] = useState<Question[]>([])
  const [spIndex, setSpIndex] = useState(0)
  const [spScore, setSpScore] = useState(0)
  const [spLabel, setSpLabel] = useState('')
  const [spSelected, setSpSelected] = useState<string | null>(null)
  const [spCorrect, setSpCorrect] = useState<boolean | null>(null)
  const [spShowAnswer, setSpShowAnswer] = useState(false)
  const followupCodeRef = useRef('')

  const gameCodeRef = useRef('')
  const displayNameRef = useRef('')
  // Fire the participant funnel events at most once per live session so the
  // PostHog funnel (joined → answered → finished) counts people, not retries.
  const answeredTrackedRef = useRef(false)
  const shownQuestionsRef = useRef<{ index: number; text: string }[]>([])

  const [reflectionVisible, setReflectionVisible] = useState(false)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

  // Mobile lifecycle (Layer 2.7): when the tab regains visibility (user
  // unlocks phone, switches back from another app), force a liveness check
  // on the socket. iOS Safari often kills idle WebSockets in the background
  // without notifying the JS layer, so this also triggers a manual reconnect
  // if needed. Without this, a returning participant's first answer can hit
  // the silent-drop path before Socket.IO's own keepalive notices the gap.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const s = socketRef.current
      if (!s) return
      if (!s.connected) {
        try { s.connect() } catch { /* noop */ }
      } else {
        try { s.emit('ping_time', { clientTime: Date.now() }, () => {}) } catch { /* noop */ }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [])

  // Application-level heartbeat (Layer 3.2): defeats NAT/router idle timeouts
  // and surfaces dead sockets faster than Socket.IO's pingInterval alone.
  // Runs every 30s while a session is in flight (lobby or question phase),
  // tiny payload, negligible bandwidth. Critical for long presentations
  // where participants might sit idle on a slide for many minutes.
  useEffect(() => {
    if (phase !== 'lobby' && phase !== 'question' && phase !== 'answered' && phase !== 'connecting') return
    const id = window.setInterval(() => {
      const s = socketRef.current
      if (!s || !s.connected) return
      try { s.emit('ping_time', { clientTime: Date.now() }, () => {}) } catch { /* noop */ }
    }, 30000)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'ended') {
      const t = setTimeout(() => setReflectionVisible(true), 2500)
      return () => clearTimeout(t)
    } else {
      setReflectionVisible(false)
    }
  }, [phase])

  // ─── Answer outbox helpers ─────────────────────────────────────────────────
  // Buffered submissions retried on reconnect / after forced re-join. Refs only,
  // so closures stay stable and useCallback deps stay empty.
  //
  // Strict ack semantics: an answer is only removed from the outbox when the
  // server's ack callback fires positively. If the socket drops mid-send, the
  // entry stays in the outbox and gets re-flushed once the new join handshake
  // completes (joinAckedRef === true). This guarantees no silent drops.
  const trySendAnswer = useCallback((item: OutboxItem) => {
    const s = socketRef.current
    if (!s || !s.connected) return
    if (!joinAckedRef.current) return  // wait for re-join handshake
    s.emit('submit_answer', item.payload, (res?: { accepted: boolean; reason?: string }) => {
      if (res?.accepted) {
        outboxRef.current.delete(item.id)
      }
      // On non-accept the existing answer_rejected listener handles UX —
      // and entries like 'duplicate' / 'late' / 'not_active' are explicitly
      // dropped there. unknown_participant triggers a forced re-join then
      // re-flushes the outbox.
    })
  }, [])

  const enqueueAnswer = useCallback((payload: SubmitAnswerPayload, questionIndex: number) => {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    // Stamp the NTP-corrected client tap time so the server can score against
    // its own clock without the receivedAt - rtt/2 hack.
    const enriched: SubmitAnswerPayload = {
      ...payload,
      // Floor to integer ms — the server clock-sync offset is a fractional
      // average and getServerNow() returns Date.now() + offsetMs which is
      // a float. Sending the float used to slip past dev but get silently
      // rejected by the (now relaxed) server schema in production.
      serverSubmittedAt: Math.floor(getServerNow()),
      ...(participantIdRef.current ? { participantId: participantIdRef.current } : {}),
    }
    const item: OutboxItem = { id, questionIndex, payload: enriched, ts: Date.now() }
    outboxRef.current.set(id, item)
    trySendAnswer(item)
  }, [trySendAnswer])

  const flushAnswerOutbox = useCallback(() => {
    for (const item of outboxRef.current.values()) {
      trySendAnswer(item)
    }
  }, [trySendAnswer])

  useEffect(() => {
    flushAnswerOutboxRef.current = flushAnswerOutbox
  }, [flushAnswerOutbox])

  // Tab background/foreground recovery: iOS Safari throttles or suspends
  // intervals in background tabs, and the clock offset can be stale by the
  // time the tab wakes. Resync immediately on foreground — the running
  // question interval picks the corrected offset up on its next 100ms tick.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncClock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // ─── Deferred Socket.io — connect only when user joins ─────────────────────
  const initSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current
    // Dynamic import to keep socket.io-client out of the initial form bundle.
    // ESLint complains about require() in TS but a dynamic require IS what we
    // want here — `await import()` would force the surrounding fn to be async
    // and rewriting initSocket's call sites to handle Promise<Socket> is more
    // churn than this single line warrants.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { io: ioConnect } = require('socket.io-client') as typeof import('socket.io-client')
    const socket: Socket = ioConnect({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    // Bound to the socket lifecycle: start/stop the NTP-style clock-sync
    // burst+steady cadence in lib/clock-sync.ts. Best-of-N keeps offset stable
    // even when a single ping spikes due to mobile network jitter.
    let stopClockSync: (() => void) | null = null

    socket.on('connect', () => {
      if (stopClockSync) stopClockSync()
      stopClockSync = startClockSync(socket)
      // Hold the outbox flush until the rejoin handshake confirms identity.
      joinAckedRef.current = false
      setConnectionState('connected')
      if (gameCodeRef.current && displayNameRef.current) {
        const pid = participantIdRef.current || getOrCreateParticipantId(gameCodeRef.current)
        if (pid) participantIdRef.current = pid
        socket.emit('join_session', {
          gameCode: gameCodeRef.current,
          displayName: displayNameRef.current,
          participantId: pid || undefined,
        }, (res?: { success?: boolean; participantId?: string }) => {
          if (res?.participantId) {
            participantIdRef.current = res.participantId
            setParticipantId(gameCodeRef.current, res.participantId)
          }
          if (res?.success) {
            joinAckedRef.current = true
          }
          // Re-flush any unconfirmed answers after a successful (re)join.
          flushAnswerOutboxRef.current()
        })
      } else {
        // No active game yet — outbox stays disabled until the user actually
        // submits the join form.
        flushAnswerOutboxRef.current()
      }
    })

    socket.on('disconnect', () => {
      joinAckedRef.current = false
      setConnectionState('reconnecting')
      setError('Connection lost. Reconnecting...')
      if (stopClockSync) { stopClockSync(); stopClockSync = null }
    })

    socket.on('connect_error', () => {
      joinAckedRef.current = false
      setConnectionState('reconnecting')
      setError('Connection lost. Reconnecting...')
    })

    // Server-side rejection of an answer. The most important case is
    // `unknown_participant` — it means our socket.id is no longer in the
    // server's participant Map (typical after a long lobby idle on mobile).
    // We force a clean re-join, then re-flush the outbox so the answer lands.
    socket.on('answer_rejected', ({ reason, gameCode: rcvGameCode }: { reason: string; gameCode?: string }) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[answer_rejected]', reason, rcvGameCode)
      }
      if (reason === 'duplicate') {
        // Server already has this answer; drop the matching outbox entry.
        // Conservative: clear the entry for the most-recent question.
        if (question?.index !== undefined) {
          for (const [id, item] of outboxRef.current.entries()) {
            if (item.questionIndex === question.index) outboxRef.current.delete(id)
          }
        }
        return
      }
      if (reason === 'unknown_participant' || reason === 'no_session') {
        joinAckedRef.current = false
        if (gameCodeRef.current && displayNameRef.current) {
          const pid = participantIdRef.current || getOrCreateParticipantId(gameCodeRef.current)
          if (pid) participantIdRef.current = pid
          socket.emit('join_session', {
            gameCode: gameCodeRef.current,
            displayName: displayNameRef.current,
            participantId: pid || undefined,
          }, (res?: { success?: boolean; participantId?: string }) => {
            if (res?.participantId) {
              participantIdRef.current = res.participantId
              setParticipantId(gameCodeRef.current, res.participantId)
            }
            if (res?.success) {
              joinAckedRef.current = true
            }
            flushAnswerOutboxRef.current()
          })
        }
        return
      }
      if (reason === 'not_active' || reason === 'no_question') {
        // Question moved on. Don't keep retrying a stale answer.
        if (question?.index !== undefined) {
          for (const [id, item] of outboxRef.current.entries()) {
            if (item.questionIndex === question.index) outboxRef.current.delete(id)
          }
        }
        setError('Question already closed.')
        setAnswerToast('Question already closed — your answer was not counted.')
        return
      }
      // Fallback: surface a retry hint without trapping the user.
      setError('Submit failed — tap an option to retry.')
      setAnswerToast('Submit failed — tap to retry.')
      setSelectedAnswer(null)
      setPendingAnswer(null)
    })

    socket.on('invalid_payload', ({ event, error: pErr }: { event: string; error: string }) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[invalid_payload]', event, pErr)
      }
      // Make schema-validation failures visible to the participant. Without this
      // toast, a rejected submit_answer (e.g. timeMs out of bounds) is invisible
      // — the host counter doesn't move and the player has no idea their tap
      // was lost. Clearing selectedAnswer/pendingAnswer re-enables the option
      // buttons so they can tap again.
      if (event === 'submit_answer') {
        setAnswerToast('Submit failed — tap an option to retry.')
        setSelectedAnswer(null)
        setPendingAnswer(null)
      }
    })

    socket.on('question_show', ({ question, index, total, startAt, answerableNumber: aNum, answerableTotal: aTot }: { question: Omit<Question, 'index' | 'total'>; index: number; total: number; startAt?: number; answerableNumber?: number; answerableTotal?: number }) => {
      shownQuestionsRef.current.push({ index, text: question.text })
      setAnswerableNumber(typeof aNum === 'number' ? aNum : index + 1)
      setAnswerableTotal(typeof aTot === 'number' ? aTot : total)
      // M3: reset prior-question state before showing the new one
      setExplanation(null)
      setCorrectAnswerIndex(null)
      setSelectedAnswer(null)
      setIsCorrect(false)
      setAnsweredIsScored(false)
      setRevealed(false)
      setError('')
      setQuestion({ ...question, index, total })
      setPendingAnswer(null)
      setConfidence(null)
      setTextAnswer('')
      setShowRedFlash(false)
      setMultiselectChosen(new Set())
      setIntermediateRank(null)
      setPersonalResult(null)
      setMatchChoices(question.type === 'matching' ? (question.matchLefts ?? []).map(() => '') : [])
      // For ranking questions, initialize rankingOrder from the received options (which may be shuffled for sequence ranking)
      if (question.type === 'ranking') {
        const opts = question.options || []
        setRankingOrder(opts.map((_, i) => i))
      } else {
        setRankingOrder([])
      }
      setPhase('question')

      // Clamp incoming timer to [5,120] as a client-side belt-and-suspenders
      // alongside the server clamp in sanitizeQuestion.
      const safeTimerSeconds = Math.max(5, Math.min(120, Number(question.timerSeconds) || 20))
      const effectiveStartAt = typeof startAt === 'number' ? startAt : getServerNow()
      const endAt = effectiveStartAt + safeTimerSeconds * 1000
      // Compare against SERVER time (getServerNow), not raw client clock. Mixing
      // a server timestamp with a drifted client clock was the root cause of
      // the "starts at 2s" red-zone bug.
      const initialLeft = Math.max(0, Math.ceil((endAt - getServerNow()) / 1000))
      setTimeLeft(initialLeft)
      setGetReadyVisible(getServerNow() < effectiveStartAt)
      answerTimeRef.current = effectiveStartAt

      // One interval drives both the get-ready window and the live countdown,
      // re-reading getServerNow() every tick. That way clock-offset corrections
      // (resync burst landing, tab foregrounding) shift the displayed time and
      // the start moment automatically — no setTimeout pinned to a stale offset.
      // 100ms cadence matches the host timer so both screens flip digits within
      // one tick of each other.
      if (timerRef.current) clearInterval(timerRef.current)
      let started = getServerNow() >= effectiveStartAt
      timerRef.current = setInterval(() => {
        const now = getServerNow()
        if (now < effectiveStartAt) return
        if (!started) {
          started = true
          setGetReadyVisible(false)
          answerTimeRef.current = Date.now()
        }
        const left = Math.max(0, Math.ceil((endAt - now) / 1000))
        setTimeLeft(prev => {
          if (left <= 0) { if (timerRef.current) clearInterval(timerRef.current); return 0 }
          if (left <= 6 && left > 0 && left < prev) playTick()
          return left
        })
      }, 100)

      // Tighten the clock offset now that the timer is running. Without this,
      // a participant device whose local clock has drifted (15-20s is common
      // over a 10-minute session) renders the timer in the red zone from
      // frame 1. Once the burst settles, snap the displayed values so a
      // mid-question reconnect doesn't flash a wrong number for a tick.
      resyncClock(() => {
        setGetReadyVisible(getServerNow() < effectiveStartAt)
        setTimeLeft(Math.max(0, Math.ceil((endAt - getServerNow()) / 1000)))
      })
    })

    socket.on('answer_confirmed', ({ late, isNonScored }: { received?: boolean; late?: boolean; isNonScored?: boolean }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      // Participant funnel: count this player as "engaged" on their first
      // accepted answer (once per session, not per question).
      if (!answeredTrackedRef.current) {
        answeredTrackedRef.current = true
        track('participant_answered', { gameCode: gameCodeRef.current })
      }
      // Server has accepted at least one answer — drop outbox entries for the
      // current question so we don't double-submit on later reconnects.
      if (question?.index !== undefined) {
        for (const [id, item] of outboxRef.current.entries()) {
          if (item.questionIndex === question.index) outboxRef.current.delete(id)
        }
      }
      setPhase('answered')
      if (late) {
        setAnswerToast('Submitted just past the buzzer — recorded but no points.')
      }

      // The server now reports isNonScored authoritatively (it already accounts
      // for sequence-ranking being scored). Scored questions stay NEUTRAL here —
      // correctness/points/score + sounds are revealed later via personal_result
      // when the question ends for everyone, so an early submitter can't tip off
      // a neighbour. Non-scored questions have nothing to leak, so celebrate now.
      const scored = isNonScored === false
      setAnsweredIsScored(scored)
      if (!scored) {
        setStreak(0)
        setRevealed(true)
        playCorrect()
      }
    })

    socket.on('question_ended', ({ explanation: exp, correctAnswer: ca }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
      if (ca !== undefined && ca !== null) setCorrectAnswerIndex(ca)
      // Don't auto-transition. Participants stay on the answered/question
      // screen showing personal feedback until the host explicitly broadcasts
      // 'show_standings' (then phase = 'standings') or 'question_show'
      // (then phase = 'question').
    })

    // Host clicked the Next button on the question screen and chose to show
    // the standings screen — broadcast tells every participant to switch.
    socket.on('show_standings', () => {
      if (sessionModeRef.current !== 'competitive' && sessionModeRef.current !== 'accuracy') return
      if (phaseRef.current !== 'standings') setPhase('standings')
    })

    socket.on('leaderboard_update', ({ top, teamLeaderboard: tlb, topMovers: tm }: {
      top: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      topMovers?: { name: string; archetype?: string; fromRank: number; toRank: number; delta: number }[];
    }) => {
      setIntermediateLeaderboard(top)
      if (tlb) setTeamLeaderboard(tlb)
      setTopMovers(tm ?? [])
    })

    // Host-placed leaderboard slide reached — show standings, no answer UI.
    socket.on('leaderboard_slide_show', ({ top, teamLeaderboard: tlb }: {
      index: number;
      total?: number;
      title?: string | null;
      top: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      totalPlayers?: number;
    }) => {
      setIntermediateLeaderboard(top ?? [])
      if (tlb) setTeamLeaderboard(tlb)
      setTopMovers([])
      setPhase('standings')
    })

    socket.on('personal_result', (data: PersonalResult) => {
      setPersonalResult(data)
      if (typeof data.rank === 'number') setIntermediateRank(data.rank)
      // REVEAL trigger. The question has ended for everyone, so it's now safe to
      // show this player's correctness/points/score + play feedback. Non-scored
      // questions report isCorrect === null and were already acknowledged on
      // submit, so they're skipped here.
      if (data.isCorrect === true || data.isCorrect === false) {
        const correct = data.isCorrect === true
        setIsCorrect(correct)
        setPointsEarned(data.pointsEarned ?? 0)
        setTotalScore(data.totalScore ?? 0)
        setRevealed(true)
        if (correct) {
          const newStreak = data.streakCount ?? 1
          setStreak(newStreak)
          if (newStreak >= 3) playStreak()
          else playCorrect()
          fireConfetti('mini')
        } else {
          setStreak(0)
          playWrong()
          setShowRedFlash(true)
          setTimeout(() => setShowRedFlash(false), 600)
        }
      }
    })

    socket.on('my_rank_update', ({ rank }: { rank: number }) => {
      setIntermediateRank(rank)
    })

    socket.on('session_ended', ({ leaderboard, teamLeaderboard: tlb, sessionMode: sm }: {
      leaderboard: LeaderboardEntry[];
      teamLeaderboard?: { name: string; color: string; score: number; members: number }[] | null;
      sessionMode: 'competitive' | 'reflection' | 'accuracy';
    }) => {
      setLeaderboard(leaderboard)
      setTeamLeaderboard(tlb ?? null)
      if (sm) setSessionMode(sm)
      const rank = leaderboard.findIndex(e => e.name === displayNameRef.current) + 1
      setPhase('ended')
      // Participant funnel: player stayed to the end of the live session.
      track('participant_finished', {
        gameCode: gameCodeRef.current,
        rank,
        players: leaderboard.length,
      })
      // Podium now owns the full reveal sequence: staggered 3rd→2nd→1st, drumroll,
      // layered cheer + fanfare + bass boom, and a full-screen canvas-confetti burst.
      // Clear durable identity for this game code so a fresh re-join starts clean.
      if (gameCodeRef.current) clearParticipantId(gameCodeRef.current)
      participantIdRef.current = ''
      outboxRef.current.clear()
    })

    socket.on('quiz_paused', () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPaused(true)
    })

    socket.on('quiz_resumed', ({ remainingMs }: { remainingMs?: number }) => {
      setPaused(false)
      if (phaseRef.current !== 'question') return
      // Wall-clock anchored, same as question_show. The old decrement-per-
      // second interval drifted from the host (and the server auto-end) by
      // up to a second after every pause/resume cycle.
      const remMs = remainingMs !== undefined ? remainingMs : timeLeftRef.current * 1000
      const endAt = getServerNow() + remMs
      const secs = Math.max(0, Math.ceil(remMs / 1000))
      setTimeLeft(secs)
      timeLeftRef.current = secs
      if (timerRef.current) clearInterval(timerRef.current)
      if (remMs > 0) {
        timerRef.current = setInterval(() => {
          const left = Math.max(0, Math.ceil((endAt - getServerNow()) / 1000))
          setTimeLeft(prev => {
            if (left <= 0) { if (timerRef.current) clearInterval(timerRef.current); return 0 }
            if (left <= 6 && left > 0 && left < prev) playTick()
            return left
          })
        }, 100)
      }
    })

    socket.on('host_disconnected', () => {
      setError('The host has left. Session ended.')
      setPhase('form')
    })

    socket.on('presenter_slide_changed', ({ slideIndex, total, slide, responseMode, mirrorToParticipants: mirror }: { slideIndex: number; total: number; slide?: unknown; responseMode?: string; mirrorToParticipants?: boolean }) => {
      setPresenterSlideIndex(slideIndex)
      setPresenterTotalSlides(total)
      if (slide !== undefined) setPresenterCurrentSlide(slide)
      presenterVotedRef.current = false
      setPresenterAggregate({ total: 0 })
      setUpvotedIdeas(new Set())
      // Reset ranking order based on new slide's options
      {
        const slideRec = slide as Record<string, unknown> | undefined
        const opts = (slideRec?.options as unknown[] | undefined) || (slideRec?.items as unknown[] | undefined) || []
        setRankingOrder(opts.map((_, i) => i))
      }
      const mode = (responseMode as 'instant' | 'on_click' | 'private') || 'instant'
      setPresenterResponseMode(mode)
      presenterResponseModeRef.current = mode
      const mirrorFlag = !!mirror
      mirrorToParticipantsRef.current = mirrorFlag
      // Clear any previous quickfire timer
      if (quickFireTimerRef.current) { clearInterval(quickFireTimerRef.current); quickFireTimerRef.current = null }
      setQuickFireLeft(null)
      const sType = (slide as Record<string, unknown>)?.type as string | undefined
      setPhase(phaseForPresenterSlide(sType, mirrorFlag))
      // Start quickfire countdown if applicable
      if (sType === 'quick_fire') {
        const dur = ((slide as Record<string, unknown>)?.durationSeconds as number) || 5
        setQuickFireLeft(dur)
        quickFireTimerRef.current = setInterval(() => {
          setQuickFireLeft(prev => {
            if (prev === null || prev <= 1) { clearInterval(quickFireTimerRef.current!); quickFireTimerRef.current = null; return 0 }
            return prev - 1
          })
        }, 1000)
      }
    })

    socket.on('presenter_response_confirmed', () => {
      presenterVotedRef.current = true
      if (presenterResponseModeRef.current === 'instant') {
        setPhase('presenter-results')
      } else {
        setPhase('presenter-voted')
      }
    })

    // Receive live aggregate updates (instant mode broadcasts to everyone)
    socket.on('presenter_aggregate_updated', (data: PresenterAggregateData) => {
      setPresenterAggregate(data)
      // If already voted and in instant mode, ensure results screen is shown
      if (presenterVotedRef.current && presenterResponseModeRef.current === 'instant') {
        setPhase('presenter-results')
      }
    })

    // Host revealed results (on_click mode)
    socket.on('presenter_results_revealed', (data: PresenterAggregateData) => {
      setPresenterAggregate(data)
      setPhase('presenter-results')
    })

    socket.on('presenter_ended', () => {
      setPhase('form')
    })

    // Host toggled "Mirror to participants" mid-slide. If we're currently on a
    // content slide, flip between mirror and waiting; on interactive slides we
    // ignore the signal because the input UI is unchanged.
    socket.on('mirror_mode_changed', ({ mirrorToParticipants: mirror }: { mirrorToParticipants: boolean }) => {
      const flag = !!mirror
      mirrorToParticipantsRef.current = flag
      const sType = (presenterCurrentSlide as Record<string, unknown> | null)?.type as string | undefined
      if (isContentSlideType(sType)) {
        setPhase(flag ? 'presenter-content' : 'presenter-waiting')
      }
    })

    return socket
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-join follow-up session if ?followup= param is present
  useEffect(() => {
    if (followupParam) {
      const socket = initSocket()
      followupCodeRef.current = followupParam
      socket.emit('join_followup', { code: followupParam }, (res: {
        success: boolean; error?: string;
        questions?: Question[]; quizTitle?: string; label?: string;
      }) => {
        if (!res.success) {
          setError(res.error ?? 'Follow-up not found.')
          setPhase('form')
          return
        }
        setQuizTitle(res.quizTitle ?? 'Follow-up Quiz')
        setSpLabel(res.label ?? '')
        setSpQuestions(res.questions ?? [])
        setSpIndex(0)
        setSpScore(0)
        setSpSelected(null)
        setSpCorrect(null)
        setSpShowAnswer(false)
        setPhase('selfpaced')
      })
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [followupParam, initSocket])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    if (!trimmedName && !trimmedCode) {
      setError('Enter your name and session code')
      return
    }
    if (!trimmedName) {
      setError('Enter your name')
      return
    }
    if (!trimmedCode) {
      setError('Enter a session code')
      return
    }
    if (trimmedName.length > 30) {
      setError('Name must be 30 characters or less')
      return
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError('Session code must be a 6-digit number')
      return
    }
    setError('')
    setPhase('connecting')

    gameCodeRef.current = trimmedCode
    displayNameRef.current = trimmedName
    // Bootstrap durable identity for this game code (Layer 2). Server will
    // either honor this UUID (reconnect) or echo back its own (first join).
    participantIdRef.current = getOrCreateParticipantId(trimmedCode)

    // Connect socket on first join (deferred from page load)
    const socket = initSocket()

    // Route to presenter join if mode=presenter
    if (modeParam === 'presenter') {
      socket.emit('join_presenter_session', {
        gameCode: trimmedCode,
        displayName: trimmedName,
        email: email.trim() || undefined,
      }, (res: {
        success: boolean; error?: string;
        presentationTitle?: string;
        currentSlideIndex?: number;
        totalSlides?: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentSlide?: any;
        responseMode?: string;
      }) => {
        if (!res.success) {
          setError(res.error ?? 'Session not found. Check your 6-digit code and try again.')
          setPhase('form')
          return
        }
        setPresenterTitle(res.presentationTitle ?? '')
        setPresenterSlideIndex(res.currentSlideIndex ?? 0)
        setPresenterTotalSlides(res.totalSlides ?? 0)
        setPresenterCurrentSlide(res.currentSlide ?? null)
        presenterVotedRef.current = false
        setPresenterAggregate({ total: 0 })
        setPresenterResponseMode((res.responseMode as 'instant' | 'on_click' | 'private') || 'instant')
        const slideType = res.currentSlide?.type
        setPhase(phaseForPresenterSlide(slideType, mirrorToParticipantsRef.current))
      })
      return
    }

    // Determine join event via session lookup (quiz vs presenter)
    let joinEvent = 'join_session'
    try {
      const r = await fetch('/api/session/lookup?code=' + encodeURIComponent(trimmedCode))
      if (r.ok) {
        const data = await r.json().catch(() => null)
        if (data && data.type === 'presenter') joinEvent = 'join_presenter_session'
      }
    } catch {
      // Ignore lookup failures and fall back to join_session
    }

    let settled = false
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setError("Couldn't join. Check your code or try again.")
      setPhase('form')
      track('participant_join_failed', { reason: 'timeout', gameCode: trimmedCode })
    }, 8000)

    socket.emit(joinEvent, {
      gameCode: trimmedCode,
      displayName: trimmedName,
      email: email.trim() || undefined,
      participantId: participantIdRef.current || undefined,
    }, (res: { success: boolean; error?: string; status?: string; quizTitle?: string; archetype?: string; sessionMode?: 'competitive' | 'reflection' | 'accuracy'; anonymousMode?: boolean; team?: { index: number; name: string; color: string } | null; presentationTitle?: string; currentSlideIndex?: number; totalSlides?: number; currentSlide?: unknown; responseMode?: string; participantId?: string; displayMode?: 'full-device' | 'shared-screen' }) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      if (!res.success) {
        setError(res.error ?? 'Session not found. Check your 6-digit code and try again.')
        setPhase('form')
        track('participant_join_failed', { reason: res.error ?? 'rejected', gameCode: trimmedCode })
        return
      }

      // Server may echo back an authoritative participantId — persist it so
      // future reconnects (and answer submissions) carry the same identity.
      if (res.participantId) {
        participantIdRef.current = res.participantId
        setParticipantId(trimmedCode, res.participantId)
      }
      // The server has accepted us — the outbox is now safe to flush.
      joinAckedRef.current = true
      // Participant funnel: a real, server-confirmed join. Re-arm the per-session
      // answered guard so the next event fires once for this fresh session.
      answeredTrackedRef.current = false
      track('participant_joined', {
        gameCode: trimmedCode,
        mode: joinEvent === 'join_presenter_session' ? 'presenter' : 'live',
      })

      if (joinEvent === 'join_presenter_session') {
        setPresenterTitle(res.presentationTitle ?? '')
        setPresenterSlideIndex(res.currentSlideIndex ?? 0)
        setPresenterTotalSlides(res.totalSlides ?? 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPresenterCurrentSlide((res.currentSlide as any) ?? null)
        presenterVotedRef.current = false
        setPresenterAggregate({ total: 0 })
        setPresenterResponseMode((res.responseMode as 'instant' | 'on_click' | 'private') || 'instant')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slideType = (res.currentSlide as any)?.type
        setPhase(phaseForPresenterSlide(slideType, mirrorToParticipantsRef.current))
        return
      }

      setQuizTitle(res.quizTitle ?? '')
      setArchetype(res.archetype ?? null)
      if (res.sessionMode) setSessionMode(res.sessionMode)
      if (res.anonymousMode) setAnonymousMode(true)
      if (res.team) setTeam(res.team)
      // Anonymous mode replaces the player's typed name with their archetype
      // on the leaderboard. Mirror that here so the end-of-session rank
      // lookup (`leaderboard.findIndex(e => e.name === displayNameRef.current)`)
      // matches the displayed entry instead of returning -1 / rank 0.
      if (res.anonymousMode && res.archetype) {
        displayNameRef.current = res.archetype
      }
      if (res.displayMode) setDisplayMode(res.displayMode)

      if (res.status === 'active') {
        setPhase('question')
      } else {
        setPhase('lobby')
        setTimeout(() => setAvatarRevealed(true), 100)
      }
    })
  }

  function handleAnswerTap(idx: number) {
    if (paused) return
    if (question?.type === 'multiselect') {
      if (selectedAnswer !== null || timeLeft <= 0) return
      setMultiselectChosen(prev => {
        const next = new Set(prev)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        return next
      })
      return
    }
    if (selectedAnswer !== null || pendingAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer(String(idx))
    setPendingAnswer(idx)
  }

  function submitMultiselect() {
    if (multiselectChosen.size === 0 || selectedAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer('multi')
    const timeMs = Math.max(0, Date.now() - answerTimeRef.current)
    enqueueAnswer({
      gameCode: gameCodeRef.current,
      answer: Array.from(multiselectChosen).map(String),
      timeMs,
      confidence: null,
    }, question?.index ?? -1)
  }

  // Lets the participant go back and re-pick before the answer is submitted.
  // Safe because nothing has been sent to the server yet at this point.
  function clearPendingAnswer() {
    setSelectedAnswer(null)
    setPendingAnswer(null)
  }

  function submitWithConfidence(level: 'sure' | 'unsure') {
    if (pendingAnswer === null) return
    setConfidence(level)
    const timeMs = Math.max(0, Date.now() - answerTimeRef.current)
    enqueueAnswer({
      gameCode: gameCodeRef.current,
      answer: pendingAnswer,
      timeMs,
      confidence: level,
    }, question?.index ?? -1)
  }

  function submitTextAnswer() {
    if (!textAnswer.trim() || selectedAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer('text')
    const timeMs = Math.max(0, Date.now() - answerTimeRef.current)
    enqueueAnswer({
      gameCode: gameCodeRef.current,
      answer: textAnswer.trim(),
      timeMs,
      confidence: null,
    }, question?.index ?? -1)
  }

  // Direct submission for participation-only types (rating, ranking) that
  // skip the confidence overlay — those flows are non-scored so "sure/unsure"
  // adds friction without value.
  function submitAnswerRaw(answer: unknown, selectedMarker?: string) {
    if (selectedAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer(selectedMarker ?? (typeof answer === 'number' ? String(answer) : 'submitted'))
    setPendingAnswer(null)
    const timeMs = Math.max(0, Date.now() - answerTimeRef.current)
    enqueueAnswer({
      gameCode: gameCodeRef.current,
      answer: answer as string | number | number[] | string[],
      timeMs,
      confidence: null,
    }, question?.index ?? -1)
  }

  function submitDrawing(dataUrl: string) {
    if (selectedAnswer !== null || timeLeft <= 0) return
    setSelectedAnswer('drawing')
    socketRef.current?.emit('submit_drawing', {
      gameCode: gameCodeRef.current,
      dataUrl,
    })
  }

  function handleSpAnswer(idx: number) {
    if (spSelected !== null) return
    const q = spQuestions[spIndex]
    const correct = q.type === 'mcq' || q.type === 'truefalse'
      ? String(idx) === String(q.correctAnswer)
      : false // polls/case — no score
    setSpSelected(String(idx))
    setSpCorrect(correct)
    if (correct) setSpScore(s => s + q.points)
    setSpShowAnswer(true)
  }

  function handleSpNext() {
    const nextIdx = spIndex + 1
    if (nextIdx >= spQuestions.length) {
      setPhase('selfpaced-done')
    } else {
      setSpIndex(nextIdx)
      setSpSelected(null)
      setSpCorrect(null)
      setSpShowAnswer(false)
    }
  }

  function handlePlayAgain() {
    setPhase('form')
    setCode('')
    setName('')
    setError('')
    setArchetype(null)
    setAvatarRevealed(false)
    setSessionMode('competitive')
    setAnonymousMode(false)
    setQuestion(null)
    setSelectedAnswer(null)
    setPendingAnswer(null)
    setConfidence(null)
    setExplanation(null)
    setCorrectAnswerIndex(null)
    setIsCorrect(false)
    setPointsEarned(0)
    setTotalScore(0)
    setLeaderboard([])
  }

  // ─── Form Phase ────────────────────────────────────────────────────────────
  if (phase === 'form' || phase === 'connecting') {
    const STARS = [
      { top: '8%',  left: '12%', s: 2.5, o: 0.7,  amber: true  },
      { top: '14%', left: '78%', s: 3,   o: 0.5,  amber: false },
      { top: '28%', left: '6%',  s: 2,   o: 0.4,  amber: false },
      { top: '38%', left: '88%', s: 2,   o: 0.6,  amber: true  },
      { top: '52%', left: '92%', s: 1.5, o: 0.35, amber: false },
      { top: '65%', left: '8%',  s: 3,   o: 0.45, amber: false },
      { top: '72%', left: '68%', s: 2,   o: 0.5,  amber: true  },
      { top: '82%', left: '35%', s: 1.5, o: 0.3,  amber: false },
      { top: '90%', left: '82%', s: 2.5, o: 0.4,  amber: false },
      { top: '20%', left: '48%', s: 1.5, o: 0.25, amber: true  },
      { top: '48%', left: '22%', s: 2,   o: 0.35, amber: false },
      { top: '60%', left: '55%', s: 1.5, o: 0.3,  amber: false },
    ]
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: '#0F1B3D' }}>

        {/* Background glow + stars */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{
            position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(251,209,59,0.08) 0%, transparent 68%)',
          }} />
          {STARS.map((star, i) => (
            <div key={i} style={{
              position: 'absolute', top: star.top, left: star.left,
              width: star.s, height: star.s, borderRadius: '50%',
              background: star.amber ? '#FBD13B' : 'rgba(255,255,255,0.6)',
              opacity: star.o,
            }} />
          ))}
        </div>

        <div className="w-full max-w-md relative" style={{ zIndex: 10 }}>
          {/* Logo */}
          <div className="text-center mb-8">
            <QuizoticLogo
              variant="onDark"
              className="text-5xl justify-center"
              markSize={56}
            />
            <p className="text-lg mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t('join.title')}
            </p>
            {/* Direct-link arrival: show what they're joining the moment the
                lookup resolves, instead of the generic "Join a live quiz" CTA. */}
            {hasPrefilledCode && quizTitle ? (
              <p className="text-base font-bold mt-3 font-display" style={{ color: '#FBD13B' }}>
                Joining {quizTitle}
              </p>
            ) : (
              <p className="text-xs font-bold uppercase tracking-[0.14em] mt-2 font-display" style={{ color: '#FBD13B' }}>
                Join a live quiz with code
              </p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {hasPrefilledCode ? (
              // Direct-link summary chip. Showing an editable field here invites
              // typos on a code the host already shared, and the visitor can
              // always change it via the "Use a different code" affordance below.
              <div
                className="flex items-center justify-between rounded-xl px-5 py-3"
                style={{
                  background: 'rgba(34,197,94,0.10)',
                  border: '1.5px solid rgba(34,197,94,0.45)',
                }}
              >
                <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Session code
                </span>
                <span className="text-xl font-black tracking-[0.3em] text-white font-display">
                  {code}
                </span>
              </div>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                placeholder={t('join.codePlaceholder')}
                aria-label={t('join.codePlaceholder')}
                autoComplete="one-time-code"
                value={code}
                onChange={e => {
                  // Strip non-digits, cap at 6. When the 6th digit lands, jump
                  // focus to the name field so the user flows straight into it.
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(digits)
                  if (digits.length === 6 && code.length < 6) {
                    nameInputRef.current?.focus()
                  }
                }}
                disabled={phase === 'connecting'}
                className="w-full rounded-xl px-5 py-4 text-2xl font-bold tracking-[0.3em] text-center outline-none transition-all placeholder:text-white/30 focus:ring-2 font-display"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: code.length === 6
                    ? '1.5px solid rgba(34,197,94,0.9)' // valid → green border
                    : '1.5px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  '--tw-ring-color': 'rgba(251,209,59,0.4)',
                } as React.CSSProperties}
                maxLength={6}
              />
            )}
            <input
              ref={nameInputRef}
              type="text"
              placeholder={t('join.namePlaceholder')}
              aria-label={t('join.namePlaceholder')}
              autoComplete="nickname"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full rounded-xl px-5 py-4 text-xl outline-none transition-all placeholder:text-white/30 focus:ring-2"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: 'white',
                '--tw-ring-color': 'rgba(251,209,59,0.4)',
              } as React.CSSProperties}
              maxLength={24}
            />
            {!showEmailInput ? (
              <button
                type="button"
                onClick={() => setShowEmailInput(true)}
                className="text-sm underline"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {t('join.addEmail')}
              </button>
            ) : (
              <input
                type="email"
                placeholder={t('join.emailPlaceholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={phase === 'connecting'}
                className="w-full rounded-xl px-5 py-3 text-base outline-none transition-all placeholder:text-white/30 focus:ring-2"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  '--tw-ring-color': 'rgba(251,209,59,0.4)',
                } as React.CSSProperties}
                maxLength={120}
              />
            )}
            {error && <p className="text-red-400 text-lg text-center">{error}</p>}
            <button
              type="submit"
              disabled={phase === 'connecting'}
              className="w-full font-black rounded-full py-5 text-xl transition-all disabled:opacity-50 hover:opacity-90 font-display"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '3px solid #0D0D0D', boxShadow: '4px 4px 0 #0D0D0D' }}
            >
              {phase === 'connecting' ? t('join.joining') : t('join.submitBtn')}
            </button>
          </form>

          <p className="text-center text-base mt-5" style={{ color: 'rgba(255,255,255,0.28)' }}>
            You&apos;ll get a unique character when you join
          </p>
        </div>
      </div>
    )
  }

  // ─── Lobby Phase ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className={`transition-all duration-500 mb-4 ${avatarRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
            {archetype && (
              <div className="flex justify-center mb-3">
                <div className="ring-4 rounded-full" style={{ '--tw-ring-color': 'rgba(251,209,59,0.3)' } as React.CSSProperties}>
                  <Avatar archetype={archetype} size={120} />
                </div>
              </div>
            )}
          </div>
          {archetype && (
            <>
              <p className="font-display font-black text-2xl" style={{ color: '#0F1B3D' }}>You are the {archetype}</p>
              <p className="text-gray-500 text-lg mt-1">{name}</p>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {sessionMode === 'reflection' && (
              <span className="text-base rounded-full px-4 py-1.5 font-semibold border" style={{ background: '#FFFDE6', color: '#0F1B3D', borderColor: 'rgba(251,209,59,0.4)' }}>
                Reflection Mode — results at end
              </span>
            )}
            {anonymousMode && (
              <span className="text-base rounded-full px-4 py-1.5 font-semibold border" style={{ background: '#F8F9FA', color: '#0F1B3D', borderColor: '#E2E8F0' }}>
                Anonymous — your name is hidden
              </span>
            )}
            {team && (
              <span className="text-white text-base rounded-full px-4 py-1.5 font-bold" style={{ background: team.color }}>
                Team {team.name}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-lg mt-6 mb-3">Waiting for host to start</p>
          <div className="flex justify-center gap-2">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-3 h-3 rounded-full animate-bounce" style={{ background: '#FBD13B', animationDelay: `${delay}ms` }} />
            ))}
          </div>
          <p className="text-gray-400 text-lg mt-4 font-medium">{quizTitle}</p>
        </div>
      </div>
    )
  }

  // ─── Question Phase ────────────────────────────────────────────────────────
  if (phase === 'question' && question) {
    // Shared-screen classroom mode hides question text + option text on the
    // phone for MCQ-like types so the host display carries the content. We
    // intentionally exclude open_text / qa / wordcloud / drawing types where
    // the participant must read the prompt to respond.
    const sharedScreenEligible = ['mcq', 'multiselect', 'truefalse', 'image_choice', 'poll'].includes(question.type)
    const sharedScreenSimple = displayMode === 'shared-screen' && sharedScreenEligible
    return (
      <div className="min-h-svh p-4 flex flex-col max-w-xl mx-auto overflow-x-hidden" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))', paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 0px))' }}>
        <StatusBanner connectionState={connectionState} answerToast={answerToast} />
        {getReadyVisible && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(15,27,61,0.92)' }}>
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-[0.25em] mb-3" style={{ color: '#FBD13B' }}>
                Question {answerableNumber} of {answerableTotal}
              </p>
              <CountdownNumber targetTime={answerTimeRef.current} />
              <p className="text-xl font-bold mt-4" style={{ color: 'rgba(255,255,255,0.7)' }}>Get ready!</p>
            </div>
          </div>
        )}
        {/* Top bar — slim identity + score + streak + sound, timer prominent on the right */}
        <div className="participant-topbar flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {archetype && <Avatar archetype={archetype} size={36} />}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-gray-600 text-sm font-semibold truncate max-w-[7rem]">{archetype}</span>
              {team && (
                <span className="text-white text-[11px] rounded-full px-2 py-0.5 font-bold flex-shrink-0" style={{ background: team.color }}>{team.name}</span>
              )}
              {/* Score chip — only meaningful once the player has points */}
              {totalScore > 0 && (
                <span className="font-display inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black flex-shrink-0"
                  style={{ background: '#0F1B3D', color: '#FBD13B' }}>
                  {totalScore.toLocaleString()}
                </span>
              )}
              {/* Streak chip — slim, does not push layout when absent */}
              {streak >= 2 && (
                <span className="font-display inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black flex-shrink-0"
                  style={{
                    background: streak >= 5 ? 'linear-gradient(135deg,#FBD13B,#FF8A47)' : 'rgba(251,209,59,0.14)',
                    color: streak >= 5 ? '#0D0D0D' : '#B45309',
                  }}>
                  🔥{streak}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSoundMuted(toggleMuted())}
              aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
              aria-pressed={soundMuted}
              title={soundMuted ? 'Sounds are muted' : 'Mute sounds'}
              className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#FBD13B]"
              style={{ border: '1.5px solid #E5E7EB' }}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
            <CircularTimer timeLeft={timeLeft} total={question.timerSeconds} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(15,27,61,0.1)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${(timeLeft / question.timerSeconds) * 100}%`, background: timeLeft <= 5 ? '#DC2626' : '#0F1B3D' }}
          />
        </div>

        {/* Scenario card — shown for 'case' type questions */}
        {question.type === 'case' && question.scenarioText && (
          <div className="rounded-2xl p-5 mb-3 border" style={{ background: '#0F1B3D', borderColor: '#2D3A8C' }}>
            <p className="text-base font-bold uppercase tracking-widest mb-2" style={{ color: '#FBD13B' }}>Scenario</p>
            <p className="text-lg leading-relaxed" style={{ color: '#E0E7FF' }}>{question.scenarioText}</p>
            {question.supportingDetail && (
              <p className="mt-2 font-bold text-lg" style={{ color: '#FBD13B' }}>{question.supportingDetail}</p>
            )}
          </div>
        )}

        {/* Question card. In shared-screen mode for MCQ-like types we replace
            the full question card with a compact "look up" prompt. */}
        {sharedScreenSimple ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#9CA3AF' }}>
              Q{answerableNumber} / {answerableTotal}
            </p>
            <p className="text-base font-bold mt-1" style={{ color: '#0F1B3D' }}>👀 Look at the host screen</p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Tap the colour matching your answer</p>
          </div>
        ) : (
        <div className={`participant-question-card font-display bg-white rounded-2xl shadow-sm border p-4 sm:p-6 mb-4 ${question.type === 'case' ? 'border-t-4' : 'border-gray-200 border-t-4'}`} style={{ borderTopColor: question.type === 'case' ? '#2D3A8C' : '#FBD13B' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400 font-bold tracking-wide">Q{answerableNumber} / {answerableTotal}</span>
            {(question.isScored || isScoredType(question.type as QuestionType)) && (
              <span className="text-base font-black" style={{ color: '#0F1B3D' }}>{question.points} pts</span>
            )}
            {!(question.isScored || isScoredType(question.type as QuestionType)) && question.type !== 'case' && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-md"
                style={{ background: '#F3F4F6', color: '#475569', border: '1px solid #E2E8F0' }}
                title="Your response is collected but does not earn points."
              >
                Participation
              </span>
            )}
            {question.type === 'case' && (
              <span className="text-base font-semibold" style={{ color: '#2D3A8C' }}>Scenario</span>
            )}
          </div>
          <p
            className="font-bold leading-snug break-words"
            style={{
              color: '#0F1B3D',
              fontSize: (() => {
                const len = question.text.length
                if (len > 200) return '0.95rem'
                if (len > 140) return '1.1rem'
                if (len > 80) return '1.25rem'
                return '1.5rem'
              })(),
              lineHeight: 1.3,
            }}
          >
            {question.text}
          </p>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" className="mt-3 rounded-xl max-h-48 w-full object-contain bg-gray-100" loading="lazy" />
          )}
        </div>
        )}

        {/* Answer options / text input / drawing */}
        {question.type === 'drawing' ? (
          <div className="flex flex-col gap-3 flex-1">
            {selectedAnswer !== null ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">✓</div>
                <p className="font-black text-2xl text-green-600">Drawing submitted!</p>
              </div>
            ) : (
              <DrawingCanvas onSubmit={submitDrawing} disabled={selectedAnswer !== null || timeLeft <= 0} />
            )}
          </div>
        ) : TEXT_INPUT_TYPES.includes(question.type) ? (
          <div className="flex flex-col gap-3 flex-1">
            <textarea
              className={`w-full rounded-2xl border-2 p-4 text-lg resize-none focus:outline-none transition-colors min-h-[140px] ${
                selectedAnswer !== null ? 'opacity-60 pointer-events-none border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
              }`}
              placeholder={question.type === 'qa' ? 'Type your question…' : 'Type your answer…'}
              value={textAnswer}
              onChange={e => setTextAnswer(e.target.value)}
              disabled={selectedAnswer !== null}
            />
            <button
              onClick={submitTextAnswer}
              disabled={selectedAnswer !== null || !textAnswer.trim()}
              className="w-full py-4 rounded-2xl font-black text-xl transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#0F1B3D] focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
              style={{ background: selectedAnswer !== null ? '#9ca3af' : '#FBD13B', color: selectedAnswer !== null ? '#fff' : '#0D0D0D', border: selectedAnswer !== null ? 'none' : '2px solid #0D0D0D' }}
            >
              {selectedAnswer !== null ? 'Submitted ✓' : 'Submit →'}
            </button>
          </div>
        ) : question.type === 'rating' ? (
          <div className="flex flex-col gap-4 flex-1 items-center justify-center py-4">
            <p className="text-sm text-gray-500 font-semibold">Tap a star to rate</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => {
                const idx = n - 1
                const isSelected = selectedAnswer === String(idx)
                const isActive = selectedAnswer !== null && Number(selectedAnswer) + 1 >= n
                const isDisabled = selectedAnswer !== null || timeLeft <= 0
                return (
                  <button
                    key={n}
                    onClick={() => submitAnswerRaw(String(idx), String(idx))}
                    disabled={isDisabled}
                    aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
                    aria-pressed={isSelected}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-4xl transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 ${
                      isActive ? 'bg-amber-100 scale-105' : 'bg-white border-2 border-gray-200 hover:border-amber-300 active:scale-95'
                    } ${isDisabled && !isActive ? 'opacity-50' : ''}`}
                  >
                    <span style={{ color: isActive ? '#F59E0B' : '#D1D5DB', lineHeight: 1 }}>★</span>
                  </button>
                )
              })}
            </div>
            {selectedAnswer !== null && (
              <p className="font-black text-2xl" style={{ color: '#F59E0B' }}>
                {Number(selectedAnswer) + 1} / 5 submitted ✓
              </p>
            )}
          </div>
        ) : question.type === 'ranking' ? (
          (() => {
            const rankOpts = (question.options ?? []) as QuizQuestion['options']
            const rankOptCount = rankOpts?.length ?? 0
            const order = rankingOrder.length === rankOptCount && rankOptCount > 0
              ? rankingOrder
              : Array.from({ length: rankOptCount }, (_, i) => i)
            const ids = order.map(i => `quiz-rank-${i}`)
            const isSubmitted = selectedAnswer !== null
            return (
              <div className="flex flex-col gap-3 flex-1">
                <p className="text-sm text-center font-semibold text-gray-500">Drag to rank your order, then submit</p>
                <DndContext sensors={rankingSensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => {
                  if (isSubmitted) return
                  const { active, over } = e
                  if (!over || active.id === over.id) return
                  const oldIndex = ids.indexOf(String(active.id))
                  const newIndex = ids.indexOf(String(over.id))
                  if (oldIndex < 0 || newIndex < 0) return
                  setRankingOrder(arrayMove(order, oldIndex, newIndex))
                }}>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {order.map((origIdx, pos) => {
                        const label = getOptText(rankOpts?.[origIdx] ?? '') || `Option ${origIdx + 1}`
                        return (
                          <SortableRankingItem
                            key={`quiz-rank-${origIdx}`}
                            id={`quiz-rank-${origIdx}`}
                            index={pos}
                            label={label}
                            color={OPTION_COLORS[origIdx % OPTION_COLORS.length]}
                          />
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                <button
                  onClick={() => submitAnswerRaw(order, 'ranked')}
                  disabled={isSubmitted || timeLeft <= 0}
                  className="w-full py-4 rounded-2xl font-black text-xl transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#0F1B3D] focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
                  style={{ background: isSubmitted ? '#9ca3af' : '#FBD13B', color: isSubmitted ? '#fff' : '#0D0D0D', border: isSubmitted ? 'none' : '2px solid #0D0D0D' }}
                >
                  {isSubmitted ? 'Submitted ✓' : 'Submit order →'}
                </button>
              </div>
            )
          })()
        ) : question.type === 'matching' ? (
          (() => {
            const lefts = question.matchLefts ?? []
            const rights = question.matchRights ?? []
            const choices = lefts.map((_, i) => matchChoices[i] ?? '')
            const allChosen = lefts.length > 0 && choices.every(c => c !== '')
            const isSubmitted = selectedAnswer !== null
            return (
              <div className="flex flex-col gap-3 flex-1">
                <p className="text-sm text-center font-semibold text-gray-500">Match each item, then submit</p>
                {lefts.map((leftText, i) => (
                  <div key={i} className="rounded-2xl border-2 border-gray-200 bg-white p-3">
                    <p className="font-bold text-base mb-2" style={{ color: '#0F1B3D' }}>{leftText}</p>
                    <select
                      value={choices[i]}
                      disabled={isSubmitted || timeLeft <= 0}
                      onChange={e => setMatchChoices(prev => {
                        const next = lefts.map((_, j) => prev[j] ?? '')
                        next[i] = e.target.value
                        return next
                      })}
                      className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-3 text-base font-semibold outline-none focus:border-pink-400 disabled:opacity-60"
                      style={{ color: '#831843' }}
                    >
                      <option value="">Choose a match…</option>
                      {rights.map((r, ri) => (
                        <option key={ri} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  onClick={() => submitAnswerRaw(choices, 'matched')}
                  disabled={isSubmitted || !allChosen || timeLeft <= 0}
                  className="w-full py-4 rounded-2xl font-black text-xl transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#0F1B3D] focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
                  style={{ background: isSubmitted ? '#9ca3af' : '#FBD13B', color: isSubmitted ? '#fff' : '#0D0D0D', border: isSubmitted ? 'none' : '2px solid #0D0D0D' }}
                >
                  {isSubmitted ? 'Submitted ✓' : 'Submit matches →'}
                </button>
              </div>
            )
          })()
        ) : (() => {
          const effectiveOpts = getEffectiveOptions(question as unknown as QuizQuestion)
          return (
          <div className={`gap-2.5 pb-4 ${
            question.type === 'rating' && effectiveOpts?.length === 5
              ? 'grid grid-cols-5'
              : effectiveOpts?.length === 2
              ? 'grid grid-cols-1'
              : 'grid grid-cols-2'
          }`}>
            {effectiveOpts?.map((opt, idx) => {
              const isSelected = question.type === 'multiselect'
                ? multiselectChosen.has(idx)
                : selectedAnswer === String(idx)
              const isDisabled = (question.type === 'multiselect' ? selectedAnswer !== null : (selectedAnswer !== null || pendingAnswer !== null)) || timeLeft <= 0
              const optText = getOptText(opt)
              const optImage = getOptImage(opt)
              const isTwoOption = (question.options?.length ?? 0) === 2
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerTap(idx)}
                  disabled={isDisabled}
                  aria-label={`Option ${OPTION_LABELS[idx]}: ${optText}`}
                  aria-pressed={isSelected}
                  className={`${OPTION_GRADIENTS[idx]} rounded-xl p-3.5 text-white text-left transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-white
                    ${isTwoOption ? 'flex items-center gap-4 py-4' : 'min-h-[116px] h-auto flex flex-col items-center justify-center'}
                    ${isSelected ? 'ring-4 ring-white scale-[0.97]' : 'motion-safe:hover:scale-[1.02] motion-safe:hover:brightness-110 motion-safe:active:scale-95'}
                    ${isDisabled && !isSelected ? 'opacity-50 pointer-events-none' : ''}
                  `}
                  style={{ background: OPTION_COLORS[idx] ?? '#0F1B3D' }}
                >
                  {/* Hide images + option text in shared-screen mode for
                      MCQ-like types. The host's display carries the content;
                      the phone is just a coloured tap zone. */}
                  {optImage && !sharedScreenSimple && (
                    <img src={optImage} alt="" className="w-full h-20 object-cover rounded-xl mb-2" loading="lazy" />
                  )}
                  <span className={`rounded-full bg-white/25 flex items-center justify-center font-black flex-shrink-0
                    ${sharedScreenSimple ? 'w-16 h-16 text-3xl mx-auto' : isTwoOption ? 'w-10 h-10 text-lg' : 'w-10 h-10 mb-2 mx-auto text-lg'}`}
                  >
                    {question.type === 'rating' ? optText : OPTION_LABELS[idx]}
                  </span>
                  {question.type !== 'rating' && !sharedScreenSimple && (
                    <span className="min-w-0 break-words text-base sm:text-lg font-semibold leading-snug" style={{ overflowWrap: 'anywhere' }}>{optText}</span>
                  )}
                </button>
              )
            })}
          </div>
          )
        })()}

        {/* Multiselect submit button */}
        {question.type === 'multiselect' && selectedAnswer === null && (
          <button
            onClick={submitMultiselect}
            disabled={multiselectChosen.size === 0 || timeLeft <= 0}
            className="w-full py-4 mt-1 rounded-2xl font-black text-xl transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#0F1B3D] focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
            style={{ background: multiselectChosen.size > 0 ? '#FBD13B' : '#e5e7eb', color: '#0D0D0D', border: multiselectChosen.size > 0 ? '2px solid #0D0D0D' : 'none' }}
          >
            {multiselectChosen.size > 0 ? t('join.submit', { n: multiselectChosen.size }) : t('join.selectAll')}
          </button>
        )}

        {/* Confidence overlay */}
        {pendingAnswer !== null && confidence === null && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" style={{ padding: '1.5rem', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
              <p className="font-black text-2xl mb-1" style={{ color: '#0F1B3D' }}>{t('join.confident')}</p>
              {/* Show the chosen option letter so the participant can confirm at a glance */}
              {question?.options?.[pendingAnswer] !== undefined && (
                <p className="text-sm font-bold mb-1" style={{ color: '#6B7280' }}>
                  Option {OPTION_LABELS[pendingAnswer]}: <span style={{ color: '#0F1B3D' }}>{String(getEffectiveOptions(question as unknown as QuizQuestion)?.[pendingAnswer] ? getOptText(getEffectiveOptions(question as unknown as QuizQuestion)![pendingAnswer]) : '')}</span>
                </p>
              )}
              <p className="text-gray-500 text-base mb-6">{t('join.confidenceSubtitle')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => submitWithConfidence('sure')}
                  className="flex-1 text-white font-black rounded-xl py-5 text-xl hover:opacity-90 transition-colors"
                  style={{ background: '#0F1B3D' }}
                >
                  {t('join.sure')}
                </button>
                <button
                  onClick={() => submitWithConfidence('unsure')}
                  className="flex-1 border-2 border-gray-300 text-gray-700 font-black rounded-xl py-5 text-xl hover:border-gray-400 transition-colors"
                >
                  {t('join.notSure')}
                </button>
              </div>
              {/* Change answer — only available while timer is still running */}
              {timeLeft > 0 && (
                <button
                  onClick={clearPendingAnswer}
                  className="mt-4 w-full py-3 text-base font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {t('join.changeAnswer')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Answered Phase ────────────────────────────────────────────────────────
  if (phase === 'answered') {
    const isNonScored = !answeredIsScored
    const correctOptionIndex = correctAnswerIndex !== null ? Number(correctAnswerIndex) : null
    const correctOption = correctOptionIndex !== null && Number.isFinite(correctOptionIndex)
      ? question?.options?.[correctOptionIndex]
      : undefined
    const correctOptionLetter = correctOptionIndex !== null && Number.isFinite(correctOptionIndex)
      ? (ANSWER_LETTERS[correctOptionIndex] ?? String(correctOptionIndex + 1))
      : null
    return (
      <div
        className="min-h-svh w-full max-w-md mx-auto flex flex-col items-center justify-center px-4 py-5 text-center gap-5 relative overflow-x-hidden overflow-y-auto"
        style={{
          paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <StatusBanner connectionState={connectionState} answerToast={answerToast} />
        {/* Screen-reader live announcement for result */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {isNonScored ? 'Response recorded.' : !revealed ? 'Answer locked in. Waiting for results.' : isCorrect ? `Correct! You earned ${pointsEarned} points. Total score: ${totalScore}.` : `Incorrect. Total score: ${totalScore}.`}
        </div>
        {/* Red flash overlay on wrong answer */}
        {showRedFlash && (
          <div className="fixed inset-0 pointer-events-none z-50" style={{
            background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0) 70%)',
            animation: 'redFlash 0.6s ease-out forwards',
          }} />
        )}

        {/* Confetti burst on correct answer is fired via useConfetti('mini')
            — see fireConfetti() call in the answer_confirmed handler. */}

        {isNonScored ? (
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-5xl bg-blue-50 border-2 border-blue-200">
            ✓
          </div>
        ) : !revealed ? (
          // Neutral "locked in" — correctness is hidden until the question ends
          // for everyone, so a neighbour can't read it off this screen.
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl bg-blue-50 border-2 border-blue-200" style={{ animation: 'correctPop 0.4s ease-out' }}>
            🔒
          </div>
        ) : (
          <div className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl
            ${isCorrect ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}
            style={isCorrect ? { animation: 'correctPop 0.4s ease-out' } : { animation: 'wrongShake 0.4s ease-out' }}
          >
            {isCorrect ? '✓' : '✗'}
          </div>
        )}
        {isNonScored ? (
          <p className="font-display font-black text-4xl" style={{ color: '#0F1B3D' }}>{t('join.recorded')}</p>
        ) : !revealed ? (
          <div className="flex flex-col items-center gap-1">
            <p className="font-display font-black text-3xl" style={{ color: '#0F1B3D' }}>Answer locked in!</p>
            <p className="text-base font-medium" style={{ color: '#64748B' }}>Hang tight — results when everyone&rsquo;s in.</p>
          </div>
        ) : (
          <p className={`font-display font-black text-4xl ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
            {isCorrect ? t('join.correct') : t('join.wrong')}
          </p>
        )}

        {/* Streak badge */}
        {isCorrect && streak >= 2 && (
          <div className="font-display flex items-center gap-2 px-4 py-2 rounded-full" style={{
            background: streak >= 5 ? 'linear-gradient(135deg, #FBD13B, #FF8A47)' : '#0F1B3D',
            animation: 'correctPop 0.4s ease-out',
          }}>
            <span className="font-black text-xl" style={{ color: streak >= 5 ? '#0D0D0D' : '#FBD13B' }}>{t('join.streak', { n: streak })}</span>
          </div>
        )}

        {isCorrect && (sessionMode === 'competitive' || sessionMode === 'accuracy') && !isNonScored && (
          <p className="font-display font-bold text-2xl animate-pulse" style={{ color: '#0F1B3D' }}>{t('join.pts', { n: pointsEarned })}</p>
        )}
        {(sessionMode === 'competitive' || sessionMode === 'accuracy') && !isNonScored && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full relative">
            <p className="text-gray-500 text-lg">{t('join.yourScore')}</p>
            <p className="font-display text-6xl font-black tabular-nums" style={{ color: '#0F1B3D' }}>{totalScore.toLocaleString()}</p>
            {isCorrect && pointsEarned > 0 && (
              <span
                aria-hidden
                className="font-display absolute left-1/2 -translate-x-1/2 -top-2 font-black text-3xl pointer-events-none score-fly-up"
                style={{ color: '#16A34A' }}
              >
                +{pointsEarned}
              </span>
            )}
          </div>
        )}
        {/* Correct answer reveal — shown after host ends the question */}
        {correctOption !== undefined && (
          <div className={`w-full max-w-full rounded-2xl p-4 flex items-start gap-3 text-left ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-green-50 border-2 border-green-300'}`}>
            <span className="font-display w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-black text-base flex-shrink-0" aria-label={correctOptionLetter ? `Correct option ${correctOptionLetter}` : 'Correct option'}>
              {correctOptionLetter ?? '✓'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-green-600 mb-1">Correct answer</p>
              <p className="participant-correct-answer-text font-black text-green-800">
                {getOptText(correctOption)}
              </p>
            </div>
          </div>
        )}

        {/* Result Beat — kinetic personal feedback strip (points, rank delta,
            streak, fastest, top-5 flip). Replaces the old static "Waiting for
            next question…" line. Driven by the server's personal_result event;
            falls back to the waiting line until the question ends. */}
        <ResultBeat
          result={personalResult}
          competitive={sessionMode === 'competitive'}
          fallback={<p className="text-gray-400 text-base">Waiting for next question…</p>}
        />
        {personalResult && (
          <p className="text-gray-400 text-xs">Host is moving on…</p>
        )}

        <style>{`
          @keyframes confettiBurst {
            0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
            100% { transform: translateY(-200px) translateX(${Math.random() > 0.5 ? '' : '-'}${40 + Math.random() * 60}px) rotate(720deg) scale(0); opacity: 0; }
          }
          @keyframes redFlash {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes correctPop {
            0% { transform: scale(0.5); }
            60% { transform: scale(1.15); }
            100% { transform: scale(1); }
          }
          @keyframes wrongShake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(5px); }
          }
          @keyframes scoreFlyUp {
            0% { transform: translate(-50%, 0); opacity: 0; }
            15% { opacity: 1; }
            100% { transform: translate(-50%, -56px); opacity: 0; }
          }
          .score-fly-up { animation: scoreFlyUp 1.4s ease-out 0.2s forwards; opacity: 0; }
          @media (prefers-reduced-motion: reduce) {
            .score-fly-up { animation: none; opacity: 1; position: static; transform: none; display: block; }
          }
        `}</style>
      </div>
    )
  }

  // ─── Standings Phase (between questions, competitive only) ─────────────────
  if (phase === 'standings') {
    return (
      <div className="min-h-screen px-2 py-4 sm:px-4 sm:py-6 max-w-xl mx-auto flex flex-col gap-4 overflow-x-hidden">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#9CA3AF' }}>Standings</p>
          <h2 className="font-display text-2xl font-black mt-0.5" style={{ color: '#0F1B3D' }}>
            How you&apos;re doing
          </h2>
        </div>

        {intermediateRank !== null && (
          <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F1B3D 0%, #1B2A5E 100%)', color: '#fff' }}>
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold">Your rank</p>
              <div className="flex items-baseline gap-2">
                {/* Keyed on rank so a change re-mounts and pops — the player
                    literally sees their number move. */}
                <p
                  key={intermediateRank}
                  className="font-display text-4xl font-black tabular-nums"
                  style={{ color: '#FBD13B', animation: 'correctPop 0.5s ease-out' }}
                >
                  #{intermediateRank}
                </p>
                {typeof personalResult?.delta === 'number' && personalResult.delta !== 0 && (
                  <span
                    className="font-display text-sm font-black px-2 py-0.5 rounded-full"
                    style={{
                      color: personalResult.delta > 0 ? '#14532D' : '#7F1D1D',
                      background: personalResult.delta > 0 ? '#BBF7D0' : '#FECACA',
                    }}
                  >
                    {personalResult.delta > 0 ? `▲${personalResult.delta}` : `▼${Math.abs(personalResult.delta)}`}
                  </span>
                )}
              </div>
              {typeof personalResult?.prevRank === 'number' && personalResult.prevRank !== intermediateRank && (
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  was #{personalResult.prevRank}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold">Your score</p>
              <p className="font-display text-2xl font-black tabular-nums">{totalScore.toLocaleString()}</p>
            </div>
          </div>
        )}
        <style>{`
          @keyframes correctPop {
            0% { transform: scale(0.6); }
            60% { transform: scale(1.12); }
            100% { transform: scale(1); }
          }
        `}</style>

        {intermediateLeaderboard.length > 0 && (
          <LeaderboardView
            variant="compact"
            heading="Leaderboard"
            highlightId={name}
            rows={intermediateLeaderboard.slice(0, 10).map(entry => ({
              id: entry.name,
              name: entry.name,
              score: entry.score,
              archetype: entry.archetype,
              previousRank: entry.previousRank,
              rankDelta: entry.rankDelta,
              scoreDelta: entry.scoreDelta,
            }))}
          />
        )}

        {/* Top Movers — surfaces the bottom 80% of the room when somebody
            jumps several places, even if they're still mid-pack. */}
        {topMovers.length > 0 && (
          <div className="rounded-2xl p-3 sm:p-4" style={{ background: '#FAFAF7', border: '1px solid #E5E7EB' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#6B7280' }}>
              Top Movers
            </p>
            <div className="space-y-1.5">
              {topMovers.map(m => (
                <div key={m.name} className="flex items-center gap-2 rounded-xl p-2" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                  <span className="font-display inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-black flex-shrink-0" style={{ background: '#DCFCE7', color: '#15803D' }}>
                    ↑{m.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: '#0F1B3D' }}>{m.name}</p>
                    <p className="text-[11px]" style={{ color: '#6B7280' }}>#{m.fromRank} → #{m.toRank}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {team && teamLeaderboard && teamLeaderboard.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-bold mb-3 uppercase tracking-widest text-gray-400">Team Standings</p>
            {teamLeaderboard.map((t, i) => {
              const isMyTeam = t.name === team.name
              return (
                <div key={t.name} className={`flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 ${isMyTeam ? 'bg-yellow-50 -mx-4 px-4' : ''}`}>
                  <span className="w-6 text-center font-black text-sm" style={{ color: '#0F1B3D' }}>{i + 1}</span>
                  <span className="text-white text-xs rounded-full px-2 py-0.5 font-bold" style={{ background: t.color }}>{t.name}</span>
                  {isMyTeam && <span className="text-xs text-gray-400 font-semibold">You</span>}
                  <span className="flex-1" />
                  <span className="font-black text-sm" style={{ color: '#0F1B3D' }}>{t.score}</span>
                </div>
              )
            })}
          </div>
        )}

        {explanation && (
          <div className={`rounded-xl p-4 text-sm ${question?.type === 'case' ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'bg-blue-50 border border-blue-100 text-blue-800'}`}>
            <p className="font-bold mb-1 text-[11px] uppercase tracking-wide text-blue-600">
              {question?.type === 'case' ? 'Expert View' : 'Why?'}
            </p>
            <p>{explanation}</p>
          </div>
        )}

        <p className="text-gray-400 text-center text-sm mt-auto">Waiting for host to continue…</p>
      </div>
    )
  }

  // ─── Ended Phase ───────────────────────────────────────────────────────────
  if (phase === 'ended') {
    return (
      <div className="min-h-screen px-3 sm:px-4 pt-8 sm:pt-6 pb-4 max-w-md mx-auto relative overflow-x-hidden" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 0px))' }}>
        <h2 className="font-display text-3xl sm:text-4xl font-black mb-5 text-center" style={{ color: '#0F1B3D' }}>Quiz Over!</h2>

        {/* Team leaderboard */}
        {teamLeaderboard && teamLeaderboard.length > 0 && (
          <div className="space-y-2 mb-6">
            <h3 className="text-lg font-black text-center" style={{ color: '#0F1B3D' }}>Team Standings</h3>
            {teamLeaderboard.map((t, i) => {
              const isMyTeam = team && t.name === team.name
              return (
                <div key={t.name} className={`flex items-center gap-3 rounded-xl p-3 ${isMyTeam ? 'ring-2' : ''}`}
                  style={{ background: '#fff', border: '1px solid #E5E7EB', ...(isMyTeam ? { '--tw-ring-color': '#FBD13B' } as React.CSSProperties : {}) }}>
                  <span className="text-lg font-black w-6 text-center" style={{ color: t.color }}>
                    {i === 0 ? '🏆' : i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: t.color }}>
                    {t.name[0]}
                  </div>
                  <span className="flex-1 font-bold text-sm" style={{ color: '#1E1B4B' }}>Team {t.name}</span>
                  {(sessionMode === 'competitive' || sessionMode === 'accuracy') && (
                    <span className="text-sm font-black tabular-nums" style={{ color: t.color }}>{t.score.toLocaleString()}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Podium leaderboard={leaderboard} sessionMode={sessionMode} highlightName={displayNameRef.current} />

        {reflectionVisible && shownQuestionsRef.current.length > 0 && (
          <ReflectionMoment
            gameCode={gameCodeRef.current}
            participantName={displayNameRef.current}
            questions={shownQuestionsRef.current}
          />
        )}

        <CreateYourOwnCTA context="quiz-ended" />

        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-4 text-lg hover:border-gray-400 transition-colors font-semibold mt-3"
        >
          Attempt Again
        </button>

        <div className="text-center mt-4">
          <ShareQuizotic context="participant-ended" />
        </div>
      </div>
    )
  }

  // ─── Self-paced Follow-up Phase ────────────────────────────────────────────
  if (phase === 'selfpaced' && spQuestions.length > 0) {
    const q = spQuestions[spIndex]
    return (
      <div className="min-h-screen p-4 flex flex-col max-w-lg mx-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-base font-bold uppercase tracking-widest" style={{ color: '#0F1B3D' }}>{spLabel}</p>
            <p className="text-lg text-gray-500">{quizTitle}</p>
          </div>
          <span className="text-base text-gray-400">{spIndex + 1} / {spQuestions.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((spIndex + 1) / spQuestions.length) * 100}%`, background: '#0F1B3D' }} />
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4 border-t-4" style={{ borderTopColor: '#0F1B3D' }}>
          <p className="font-bold text-2xl leading-snug" style={{ color: '#0F1B3D' }}>{q.text}</p>
          {q.imageUrl && (
            <img src={q.imageUrl} alt="" className="mt-3 rounded-xl max-h-48 w-full object-contain" loading="lazy" />
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {q.options?.map((opt, idx) => {
            const isSelected = spSelected === String(idx)
            const isCorrectOpt = spShowAnswer && String(idx) === String(q.correctAnswer)
            const isWrongOpt = spShowAnswer && isSelected && !isCorrectOpt
            const optText = getOptText(opt)
            const optImage = getOptImage(opt)
            let bg = OPTION_GRADIENTS[idx]
            if (spShowAnswer) {
              if (isCorrectOpt) bg = 'bg-gradient-to-br from-green-600 to-green-500'
              else if (isWrongOpt) bg = 'bg-gradient-to-br from-red-600 to-red-500'
              else bg = 'bg-gray-200 shadow-none'
            }
            return (
              <button
                key={idx}
                onClick={() => handleSpAnswer(idx)}
                disabled={spSelected !== null}
                className={`${bg} rounded-2xl p-5 text-white text-left transition-all
                  ${isSelected ? 'ring-4 ring-white scale-[0.97]' : ''}
                  ${spSelected !== null && !isSelected && !isCorrectOpt ? 'opacity-50' : ''}
                `}
                style={spShowAnswer && !isCorrectOpt && !isWrongOpt ? { color: '#6B7280' } : {}}
              >
                {optImage && (
                  <img src={optImage} alt="" className="w-full h-16 object-cover rounded-xl mb-2" loading="lazy" />
                )}
                <span className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-black text-lg mb-2 flex-shrink-0">
                  {OPTION_LABELS[idx]}
                </span>
                <span className="break-words text-lg font-semibold leading-snug">{optText}</span>
              </button>
            )
          })}
        </div>

        {/* Result feedback + next button */}
        {spShowAnswer && (
          <div className="space-y-3">
            {spCorrect !== null && (
              <div className={`rounded-xl p-4 text-lg font-semibold text-center ${spCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {spCorrect ? `Correct! +${q.points} pts` : 'Not quite — see the correct answer above.'}
              </div>
            )}
            {q.explanation && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-lg text-blue-800">
                <span className="font-bold text-blue-600 text-base uppercase tracking-wide">Why? </span>{q.explanation}
              </div>
            )}
            <button
              onClick={handleSpNext}
              className="w-full py-4 rounded-full font-bold text-lg transition-all hover:opacity-90 inline-flex items-center justify-center gap-2"
              style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
            >
              {spIndex + 1 >= spQuestions.length ? 'See Results' : 'Next'}
              <NavChevron direction="forward" className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── Self-paced Done Phase ──────────────────────────────────────────────────
  if (phase === 'selfpaced-done') {
    const maxPossible = spQuestions
      .filter(q => q.type === 'mcq' || q.type === 'truefalse')
      .reduce((s, q) => s + q.points, 0)
    const pct = maxPossible > 0 ? Math.round((spScore / maxPossible) * 100) : 0
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto text-center gap-5">
        <div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{ background: '#0F1B3D' }}>
          <span style={{ color: '#fff' }}>{pct >= 80 ? '★' : pct >= 50 ? '✓' : '→'}</span>
        </div>
        <p className="font-black text-4xl" style={{ color: '#0F1B3D' }}>{spScore} pts</p>
        <p className="text-gray-500 text-lg">{spLabel} complete · {pct}% accuracy</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 w-full text-left">
          <p className="text-base font-bold uppercase tracking-widest mb-1" style={{ color: '#0F1B3D' }}>Quiz</p>
          <p className="font-bold text-xl" style={{ color: '#0F1B3D' }}>{quizTitle}</p>
          <p className="text-base text-gray-500 mt-1">{spQuestions.length} questions · spaced retrieval practice</p>
        </div>
        <CreateYourOwnCTA context="selfpaced-done" className="" />
        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-4 text-lg hover:border-gray-400 transition-colors font-semibold"
        >
          Back to Home
        </button>
      </div>
    )
  }

  // ─── Presenter Waiting (content slide, mirror OFF) ─────────────────────────
  // Shown between interactive slides while the host is lecturing. Deliberately
  // boring so participants don't stay glued to their phones.
  if (phase === 'presenter-waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8"
        style={{ background: '#0F1B3D' }}>
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-2"
            style={{ background: 'rgba(251,209,59,0.1)', border: '1.5px solid rgba(251,209,59,0.3)' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10"><circle cx="12" cy="12" r="9" stroke="#FBD13B" strokeWidth="1.5"/><path d="M12 7v5l3 2" stroke="#FBD13B" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <h1 className="font-display text-2xl font-black" style={{ color: '#fff' }}>
            Look up at the screen
          </h1>
          <p className="text-base" style={{ color: '#94A3B8' }}>
            The next question will appear on your phone automatically.
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: '#64748B' }}>You&rsquo;re in</span>
          <span className="text-sm font-semibold" style={{ color: '#FBD13B' }}>{presenterTitle || 'Session'}</span>
        </div>
      </div>
    )
  }

  // ─── Presenter Lobby ───────────────────────────────────────────────────────
  if (phase === 'presenter-lobby') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
        style={{ background: '#0F1B3D' }}>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: '#FBD13B', border: '2px solid #0D0D0D' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><rect x="3" y="3" width="18" height="14" rx="2" stroke="#0F1B3D" strokeWidth="2"/><path d="M8 21h8M12 17v4" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <h1 className="font-display text-3xl font-black" style={{ color: '#fff' }}>{presenterTitle}</h1>
          <p className="text-lg" style={{ color: '#94A3B8' }}>
            Waiting for the presenter to start...
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#16A34A' }} />
          <span className="text-lg font-semibold" style={{ color: '#16A34A' }}>Connected</span>
        </div>
      </div>
    )
  }

  // ─── Presenter Content (imported/text slides — follow along) ───────────────
  if (phase === 'presenter-content' && presenterCurrentSlide) {
    const slide = presenterCurrentSlide as Record<string, unknown>
    const sType = slide.type as string | undefined
    const imageUrl = typeof slide.imageUrl === 'string' ? slide.imageUrl : ''
    const heading = typeof slide.heading === 'string' ? slide.heading : ''
    const subheading = typeof slide.subheading === 'string' ? slide.subheading : ''
    const bullets = Array.isArray(slide.bullets) ? (slide.bullets as unknown[]).filter((b): b is string => typeof b === 'string') : []
    const quote = typeof slide.quote === 'string' ? slide.quote : ''
    const attribution = typeof slide.attribution === 'string' ? slide.attribution : ''
    const videoUrl = typeof slide.url === 'string' ? slide.url : ''

    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0F1B3D' }}>
        <div className="px-4 pt-4 pb-2 flex items-center justify-between text-xs" style={{ color: '#94A3B8' }}>
          <span className="font-semibold truncate">{presenterTitle}</span>
          <span>{presenterSlideIndex + 1} / {presenterTotalSlides}</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          {sType === 'image' && imageUrl && (
            <SlideImage
              src={imageUrl}
              alt=""
              className="max-h-full max-w-full object-contain rounded-xl"
              fallbackText="Slide image couldn't load on your device. Follow along on the host screen."
              tone="dark"
            />
          )}
          {sType === 'title' && (
            <div className="text-center space-y-3">
              {heading && <h1 className="font-display text-2xl font-black" style={{ color: '#fff' }}>{heading}</h1>}
              {subheading && <p className="text-base" style={{ color: '#CBD5E1' }}>{subheading}</p>}
            </div>
          )}
          {sType === 'bullets' && (
            <div className="w-full max-w-md space-y-3">
              {heading && <h2 className="text-xl font-bold" style={{ color: '#fff' }}>{heading}</h2>}
              <ul className="space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="text-base flex gap-2" style={{ color: '#E2E8F0' }}>
                    <span style={{ color: '#FBD13B' }}>•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sType === 'quote' && (
            <div className="text-center max-w-md space-y-3 px-2">
              {quote && <p className="text-xl italic leading-relaxed" style={{ color: '#fff' }}>&ldquo;{quote}&rdquo;</p>}
              {attribution && <p className="text-sm" style={{ color: '#94A3B8' }}>— {attribution}</p>}
            </div>
          )}
          {sType === 'video' && videoUrl && (
            <p className="text-sm text-center" style={{ color: '#94A3B8' }}>Video playing on the host screen.</p>
          )}
        </div>
        <div className="px-4 py-2 flex items-center justify-center gap-2" style={{ color: '#94A3B8' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16A34A' }} />
          <span className="text-xs">Live</span>
        </div>
      </div>
    )
  }

  // ─── Presenter Voting ──────────────────────────────────────────────────────
  if (phase === 'presenter-voting' && presenterCurrentSlide) {
    const slide = presenterCurrentSlide
    const bgDark = '#0F1B3D'
    const textLight = 'white'

    function submitVote(response: string | number | number[] | { x: number; y: number }) {
      socketRef.current?.emit('submit_presenter_response', {
        gameCode: gameCodeRef.current,
        slideIndex: presenterSlideIndex,
        response,
      })
    }

    const OPTION_COLORS_P = ['#2D3A8C','#FF8A47','#5BC0EB','#E07A5F','#0F1B3D']

    return (
      <div className="min-h-screen flex flex-col p-4 gap-4" style={{ background: bgDark }}>
        {/* Header — compact slide counter only; deck title omitted to save mobile space */}
        <div className="text-[11px] font-semibold opacity-50 tracking-[0.15em] uppercase" style={{ color: textLight }}>
          Slide {presenterSlideIndex + 1} / {presenterTotalSlides}
        </div>

        {/* Question */}
        <h2 className="font-display text-2xl md:text-3xl font-black leading-snug" style={{ color: textLight }}>
          {slide.question || slide.heading || slide.title || ''}
        </h2>

        {/* Vote area by type */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          {slide.type === 'image_choice' && (
            <div className="grid grid-cols-2 gap-3">
              {(slide.options as string[]).map((opt: string, i: number) => {
                const imgUrl = (slide.imageUrls as string[])?.[i]
                return (
                  <button key={i} onClick={() => submitVote(i)}
                    className="rounded-2xl overflow-hidden transition-all active:scale-[0.97] border-2 border-transparent"
                    style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length] }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={opt} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 flex items-center justify-center opacity-30 text-white text-3xl">🖼</div>
                    )}
                    <div className="px-3 py-2 text-white font-bold text-sm text-center">{opt || `Option ${i+1}`}</div>
                  </button>
                )
              })}
            </div>
          )}

          {(slide.type === 'multiple_choice' || slide.type === 'quick_fire') && (
            <>
              {slide.type === 'quick_fire' && quickFireLeft !== null && (
                <div className="w-full text-center mb-2">
                  <p className="font-display text-4xl font-black" style={{ color: quickFireLeft <= 2 ? '#EF4444' : '#FBD13B' }}>
                    {quickFireLeft}
                  </p>
                  <div className="h-2 rounded-full w-full mt-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${(quickFireLeft / (((presenterCurrentSlide as Record<string, unknown>)?.durationSeconds as number) || 5)) * 100}%`,
                      background: quickFireLeft <= 2 ? '#EF4444' : '#FBD13B',
                    }} />
                  </div>
                </div>
              )}
              {(slide.options as string[]).map((opt: string, i: number) => (
                <button key={i} onClick={() => submitVote(i)}
                  disabled={slide.type === 'quick_fire' && quickFireLeft === 0}
                  className="w-full py-5 rounded-2xl text-left px-6 text-xl font-bold transition-all active:scale-[0.98]"
                  style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length], color: '#fff', opacity: slide.type === 'quick_fire' && quickFireLeft === 0 ? 0.5 : 1 }}>
                  <span className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-lg mr-3 font-black"
                    style={{ background: 'rgba(255,255,255,0.2)' }}>
                    {['A','B','C','D','E'][i]}
                  </span>
                  {opt || `Option ${i+1}`}
                </button>
              ))}
            </>
          )}

          {slide.type === 'word_duel' && (
            <div className="grid grid-cols-2 gap-3">
              {[slide.optionA, slide.optionB].map((opt: string, i: number) => (
                <button key={i} onClick={() => submitVote(i)}
                  className="py-8 rounded-2xl text-center text-2xl font-black transition-all active:scale-[0.97]"
                  style={{ background: i === 0 ? '#2563EB' : '#DC2626', color: '#fff' }}>
                  {opt || (i === 0 ? 'Side A' : 'Side B')}
                </button>
              ))}
            </div>
          )}

          {slide.type === 'live_race' && (
            <div className="space-y-3">
              {(slide.options || slide.items || []).map((opt: string, i: number) => (
                <button key={i} onClick={() => submitVote(i)}
                  className="w-full py-4 rounded-2xl text-left px-5 text-base font-bold transition-all active:scale-[0.98]"
                  style={{ background: OPTION_COLORS_P[i % OPTION_COLORS_P.length], color: '#fff' }}>
                  {opt || `Option ${i+1}`}
                </button>
              ))}
            </div>
          )}

          {slide.type === 'ranking' && (() => {
            const rankOpts = ((slide.options || slide.items || []) as string[])
            const order = rankingOrder.length === rankOpts.length && rankingOrder.length > 0
              ? rankingOrder
              : rankOpts.map((_, i) => i)
            const ids = order.map(i => `rank-${i}`)
            return (
              <div className="space-y-3 overflow-x-hidden">
                <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>Drag to rank your order</p>
                <DndContext sensors={rankingSensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => {
                  const { active, over } = e
                  if (!over || active.id === over.id) return
                  const oldIndex = ids.indexOf(String(active.id))
                  const newIndex = ids.indexOf(String(over.id))
                  if (oldIndex < 0 || newIndex < 0) return
                  setRankingOrder(arrayMove(order, oldIndex, newIndex))
                }}>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {order.map((origIdx, pos) => (
                        <SortableRankingItem
                          key={`rank-${origIdx}`}
                          id={`rank-${origIdx}`}
                          index={pos}
                          label={rankOpts[origIdx] || `Option ${origIdx + 1}`}
                          color={OPTION_COLORS_P[origIdx % OPTION_COLORS_P.length]}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <button
                  onClick={() => submitVote(order)}
                  className="w-full py-5 rounded-2xl text-xl font-black"
                  style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: '2px solid rgba(255,255,255,0.25)' }}>
                  Submit order
                </button>
              </div>
            )
          })()}

          {(slide.type === 'word_cloud' || slide.type === 'open_text' || slide.type === 'brainstorm') && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder={slide.type === 'word_cloud' ? `Type ${(slide.maxWords || 1) === 1 ? 'a word' : `up to ${slide.maxWords} words`}...` : slide.type === 'brainstorm' ? 'Share an idea...' : 'Type your response...'}
                id="presenter-text-input"
                maxLength={slide.type === 'word_cloud' ? 50 : slide.type === 'brainstorm' ? (slide.maxChars || 120) : 300}
                className="w-full rounded-xl px-5 py-4 text-xl outline-none focus:ring-2 focus:ring-blue-400"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
              {slide.type === 'word_cloud' && (slide.maxWords === 1 || !slide.maxWords) && (
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>One word only</p>
              )}
              <button
                onClick={() => {
                  const input = document.getElementById('presenter-text-input') as HTMLInputElement
                  const raw = input?.value.trim()
                  if (!raw) return
                  if (slide.type === 'word_cloud') {
                    const words = raw.split(/\s+/)
                    const maxW = (slide.maxWords as number) || 1
                    const toSubmit = words.slice(0, maxW).join(' ')
                    submitVote(toSubmit)
                  } else {
                    submitVote(raw)
                  }
                }}
                className="w-full py-5 rounded-2xl text-xl font-black"
                style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: '2px solid rgba(255,255,255,0.25)' }}>
                Submit
              </button>
            </div>
          )}

          {slide.type === 'rating_scale' && (
            <StarRating max={slide.maxRating || 5} minLabel={slide.minLabel} maxLabel={slide.maxLabel}
              textLight={textLight} onSubmit={submitVote}
              disabled={false}
              onDisabledClick={() => setError("Time's up for this question")} />
          )}

          {slide.type === 'scale_100' && (
            <div className="space-y-4">
              <input type="range" min={0} max={100} defaultValue={50}
                id="scale-100-input"
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-base opacity-50" style={{ color: textLight }}>
                <span>0 · {slide.minLabel}</span>
                <span>{slide.maxLabel} · 100</span>
              </div>
              <button
                onClick={() => {
                  const input = document.getElementById('scale-100-input') as HTMLInputElement
                  submitVote(Number(input?.value ?? 50))
                }}
                className="w-full py-5 rounded-2xl text-xl font-black"
                style={{ background: PRESENTATION_SEQUENCE.accent, color: PRESENTATION_SEQUENCE.accentText, border: '2px solid rgba(255,255,255,0.25)' }}>
                Submit
              </button>
            </div>
          )}

          {slide.type === 'emoji_pulse' && (
            <div className="grid grid-cols-2 gap-3">
              {(slide.emojis as string[]).map((em: string) => (
                <button key={em} onClick={() => submitVote(em)}
                  className="py-8 rounded-2xl text-5xl transition-all active:scale-[0.95]"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                  {em}
                </button>
              ))}
            </div>
          )}

          {slide.type === 'pinpoint' && (
            <PinpointInput imageUrl={slide.imageUrl} onSubmit={submitVote} />
          )}

          {slide.type === 'grid_2x2' && (
            <Grid2x2Input xMin={slide.xMin} xMax={slide.xMax} yMin={slide.yMin} yMax={slide.yMax} onSubmit={submitVote} />
          )}
        </div>
      </div>
    )
  }

  // ─── Presenter Voted (waiting for next slide or results) ────────────────────
  if (phase === 'presenter-voted') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
        style={{ background: '#0F1B3D' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: '#FBD13B', border: '2px solid #0D0D0D' }}>
          <span className="text-3xl" style={{ color: '#0D0D0D' }}>✓</span>
        </div>
        <div className="text-center space-y-2">
          <p className="font-display text-3xl font-black" style={{ color: 'white' }}>Vote counted!</p>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {presenterResponseMode === 'on_click'
              ? 'Waiting for the presenter to reveal results...'
              : presenterResponseMode === 'private'
              ? 'Your response has been recorded.'
              : 'Waiting for the presenter to move to the next slide...'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FBD13B' }} />
          <span className="text-xs font-semibold opacity-60 tracking-wider uppercase" style={{ color: 'white' }}>Slide {presenterSlideIndex + 1} / {presenterTotalSlides}</span>
        </div>
      </div>
    )
  }

  // ─── Presenter Results (live or revealed) ─────────────────────────────────
  if (phase === 'presenter-results' && presenterCurrentSlide) {
    const slide = presenterCurrentSlide
    const agg = presenterAggregate
    const bgDark = '#0F1B3D'
    const textLight = 'white'
    const BAR_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F', '#0F1B3D', '#16A34A']

    function renderParticipantResults() {
      const slideType = slide.type as string

      // Image choice: show thumbnails with bars
      if (slideType === 'image_choice') {
        const options: string[] = slide.options || []
        const imgUrls: string[] = (slide.imageUrls as string[]) || []
        const counts = agg.counts ?? new Array(options.length).fill(0)
        const maxCount = Math.max(1, ...counts)
        return (
          <div className="grid grid-cols-2 gap-3 w-full">
            {options.map((opt: string, i: number) => {
              const count = counts[i] ?? 0
              const pct = (count / maxCount) * 100
              return (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  {imgUrls[i] && <img src={imgUrls[i]} alt={opt} className="w-full h-20 object-cover" />}
                  <div className="p-2">
                    <div className="text-xs font-bold text-white truncate">{opt || `Option ${i+1}`}</div>
                    <div className="h-2 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                    </div>
                    <div className="text-xs opacity-50 mt-0.5" style={{ color: textLight }}>{count}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      // Bar chart types
      if (['multiple_choice', 'quick_fire', 'live_race'].includes(slideType)) {
        const options: string[] = slide.options || []
        const counts = agg.counts ?? new Array(options.length).fill(0)
        const maxCount = Math.max(1, ...counts)
        return (
          <div className="space-y-3 w-full">
            {options.map((opt: string, i: number) => {
              const count = counts[i] ?? 0
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-semibold" style={{ color: textLight }}>
                    <span className="truncate mr-2">{opt || `Option ${i + 1}`}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{count}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length], minWidth: count > 0 ? 8 : 0 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      if (slideType === 'word_duel') {
        const options = [slide.optionA, slide.optionB]
        const counts = agg.counts ?? [0, 0]
        const colors = ['#2563EB', '#DC2626']
        const total = Math.max(1, (counts[0] ?? 0) + (counts[1] ?? 0))
        return (
          <div className="space-y-4 w-full">
            {options.map((opt: string, i: number) => {
              const count = counts[i] ?? 0
              const pct = Math.round((count / total) * 100)
              return (
                <div key={i} className="rounded-2xl p-4" style={{ background: colors[i], opacity: 0.9 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black" style={{ color: '#fff' }}>{opt || (i === 0 ? 'Side A' : 'Side B')}</span>
                    <span className="text-2xl font-black" style={{ color: '#fff' }}>{pct}%</span>
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{count} vote{count !== 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>
        )
      }

      if (slideType === 'ranking') {
        const items: string[] = slide.items || []
        // Borda count from the rankings array. Each ordering [a,b,c,d]
        // gives a=N, b=N-1, c=N-2, d=1. Falls back to the legacy `counts`
        // field if rankings isn't populated yet (mid-deploy aggregates).
        const rankings: number[][] = Array.isArray(agg.rankings) ? agg.rankings : []
        const numItems = items.length || (agg.counts?.length ?? 0)
        const scoreByItem = new Array(numItems).fill(0) as number[]
        if (rankings.length > 0) {
          for (const ordering of rankings) {
            ordering.forEach((optionIdx: number, position: number) => {
              if (optionIdx >= 0 && optionIdx < numItems) {
                scoreByItem[optionIdx] += (numItems - position)
              }
            })
          }
        } else if (Array.isArray(agg.counts)) {
          // Legacy aggregate from before the fix — display whatever's there.
          agg.counts.forEach((c: number, i: number) => { scoreByItem[i] = c })
        }
        const ranked = items
          .map((label: string, i: number) => ({ label: label || `Item ${i + 1}`, score: scoreByItem[i] ?? 0, originalIndex: i }))
          .sort((a, b) => b.score - a.score)
        const maxScore = Math.max(1, ...scoreByItem)
        return (
          <div className="space-y-3 w-full">
            {ranked.map((item, displayPos) => {
              const pct = maxScore > 0 ? (item.score / maxScore) * 100 : 0
              return (
                <div key={item.originalIndex} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-semibold" style={{ color: textLight }}>
                    <span className="truncate mr-2">#{displayPos + 1} · {item.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{item.score}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: '#4F46E5', minWidth: item.score > 0 ? 8 : 0 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      // Open text — responses array as a wall of text bubbles.
      if (slideType === 'open_text') {
        const responses: string[] = Array.isArray(agg.responses) ? agg.responses : []
        if (responses.length === 0) {
          return <p className="text-lg text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Waiting for responses...</p>
        }
        const palette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
        const visible = responses.slice(-30)
        return (
          <div className="flex flex-wrap gap-2 justify-center max-h-full overflow-auto">
            {visible.map((text, i) => {
              const color = palette[i % palette.length]
              return (
                <div
                  key={`${i}-${text.slice(0, 16)}`}
                  className="rounded-xl px-3 py-2 text-xs font-medium max-w-[45%] break-words"
                  style={{ background: `${color}24`, color, border: `1px solid ${color}55` }}
                >
                  {text}
                </div>
              )
            })}
          </div>
        )
      }

      // Brainstorm — upvotable idea cards (tap ▲ to boost). Sorted by votes.
      if (slideType === 'brainstorm') {
        const ideas = [...(agg.ideas ?? [])].sort((a, b) => b.votes - a.votes)
        if (ideas.length === 0) {
          return <p className="text-lg text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Waiting for ideas...</p>
        }
        function upvote(ideaId: string) {
          if (upvotedIdeas.has(ideaId)) return
          setUpvotedIdeas(prev => new Set(prev).add(ideaId))
          socketRef.current?.emit('upvote_brainstorm', {
            gameCode: gameCodeRef.current,
            slideIndex: presenterSlideIndex,
            ideaId,
          })
        }
        return (
          <div className="flex flex-col gap-2 w-full max-h-full overflow-auto">
            {ideas.map(idea => {
              const voted = upvotedIdeas.has(idea.id)
              return (
                <div key={idea.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <button
                    onClick={() => upvote(idea.id)}
                    disabled={voted}
                    aria-label={`Upvote: ${idea.text}`}
                    className="flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 font-black tabular-nums transition-all active:scale-90 disabled:opacity-60"
                    style={{ background: voted ? '#4F46E5' : 'rgba(255,255,255,0.12)', color: '#fff', minWidth: 44 }}
                  >
                    <span className="text-xs leading-none">▲</span>
                    <span className="text-sm leading-tight">{idea.votes}</span>
                  </button>
                  <span className="flex-1 text-sm font-medium break-words" style={{ color: 'white' }}>{idea.text}</span>
                </div>
              )
            })}
          </div>
        )
      }

      // Word cloud (frequency-bucketed words)
      if (slideType === 'word_cloud') {
        const words = agg.words ?? {}
        const entries = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 20)
        const maxFreq = entries.length > 0 ? entries[0][1] : 1
        if (entries.length === 0) {
          return <p className="text-lg text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Waiting for responses...</p>
        }
        return (
          <div className="flex flex-wrap gap-2 justify-center w-full">
            {entries.map(([word, freq]) => {
              const scale = 0.75 + (freq / maxFreq) * 0.75
              return (
                <span key={word} className="px-3 py-1.5 rounded-full font-bold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#FBD13B',
                    fontSize: `${scale}rem`,
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}>
                  {word} <span style={{ color: 'rgba(255,255,255,0.4)' }}>{freq}</span>
                </span>
              )
            })}
          </div>
        )
      }

      // Rating scale / scale_100
      if (slideType === 'rating_scale' || slideType === 'scale_100') {
        const scores = agg.scores ?? []
        if (scores.length === 0) {
          return <p className="text-lg text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Waiting for responses...</p>
        }
        const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        const display = slideType === 'scale_100' ? Math.round(avg) : avg.toFixed(1)
        return (
          <div className="text-center w-full space-y-2">
            <p className="text-6xl font-black" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>{display}</p>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
              average {slideType === 'rating_scale' ? 'rating' : 'score'} from {agg.total} response{agg.total !== 1 ? 's' : ''}
            </p>
          </div>
        )
      }

      // Emoji pulse
      if (slideType === 'emoji_pulse') {
        const emojis: string[] = slide.emojis || []
        const emojiCounts = agg.emojis ?? {}
        return (
          <div className="flex flex-wrap gap-6 justify-center w-full">
            {emojis.map((em: string) => (
              <div key={em} className="flex flex-col items-center gap-1">
                <span className="text-4xl">{em}</span>
                <span className="text-xl font-black" style={{ color: '#FBD13B' }}>{emojiCounts[em] ?? 0}</span>
              </div>
            ))}
          </div>
        )
      }

      // Pinpoint / grid_2x2 — just show count on mobile
      if (slideType === 'pinpoint' || slideType === 'grid_2x2') {
        const pinCount = agg.pins?.length ?? 0
        return (
          <div className="text-center w-full space-y-2">
            <p className="text-5xl font-black" style={{ color: '#FBD13B', fontFamily: 'var(--font-heading)' }}>{pinCount}</p>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
              response{pinCount !== 1 ? 's' : ''} placed
            </p>
          </div>
        )
      }

      return <p className="text-lg text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{agg.total} response{agg.total !== 1 ? 's' : ''}</p>
    }

    return (
      <div className="min-h-screen flex flex-col p-4 gap-4" style={{ background: bgDark }}>
        {/* Header — compact slide counter only; deck title omitted to save mobile space */}
        <div className="text-[11px] font-semibold opacity-50 tracking-[0.15em] uppercase" style={{ color: textLight }}>
          Slide {presenterSlideIndex + 1} / {presenterTotalSlides}
        </div>

        {/* Question */}
        <h2 className="text-xl md:text-2xl font-black leading-snug" style={{ color: textLight }}>
          {slide.question || slide.heading || slide.title || ''}
        </h2>

        {/* Results */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-2">
          {/* Vote confirmed badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(251,209,59,0.15)' }}>
            <span className="text-sm font-bold" style={{ color: '#FBD13B' }}>Your vote is in</span>
            <span style={{ color: '#FBD13B' }}>✓</span>
          </div>

          {/* Total responses */}
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {agg.total} response{agg.total !== 1 ? 's' : ''}
          </p>

          {renderParticipantResults()}
        </div>
      </div>
    )
  }

  return null
}

// ─── Outer Wrapper (Suspense required for useSearchParams in Next.js 16) ──────
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0F1B3D' }} />}>
      <JoinPageInner />
      <BrandWatermark placement="participant" />
    </Suspense>
  )
}
