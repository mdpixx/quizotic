'use client'

// SessionFeedbackPrompt — the one-tap 1–5 smiley shown at the end of a session,
// to both hosts and participants. Frictionless by design: a single tap on a
// face is a complete submission; the reason chips + text box only appear after
// the tap, so most people never type.
//
// PRIVACY: participant submissions are anonymous — this component never sends a
// name or id, only role + rating (+ optional chips/comment) + the room code for
// roll-up. Keeps under-18 participant data clean under India's DPDP Act.
//
// Lightweight on purpose (inline SVG faces, no deps beyond the analytics
// facade) and lazy-loaded on the participant page so it stays outside the
// sub-100KB /join initial bundle.

import { useMemo, useState, useSyncExternalStore } from 'react'
import { captureRaw } from '@/lib/analytics'

// No-op subscribe: localStorage doesn't change under us within a session, so we
// only need a stable server/client snapshot (SSR-safe, no hydration mismatch).
const noopSubscribe = () => () => {}

type Role = 'host' | 'participant'

interface Props {
  role: Role
  /** Room code (preferred) so the API can roll sentiment up to the session. */
  sessionCode?: string | null
  sessionId?: string | null
  /** Called once the prompt is submitted or dismissed (parent may reveal next step). */
  onResolved?: () => void
  className?: string
}

interface Face {
  v: number
  label: string
  color: string
  /** mouth path in a 0..24 viewBox */
  mouth: string
}

const FACES: Face[] = [
  { v: 1, label: 'Bad', color: '#DC2626', mouth: 'M8 17c1.5-2 6.5-2 8 0' },
  { v: 2, label: 'Meh', color: '#F97316', mouth: 'M8 16.5c1.3-1.2 6.7-1.2 8 0' },
  { v: 3, label: 'Okay', color: '#CA8A04', mouth: 'M8.5 16h7' },
  { v: 4, label: 'Good', color: '#65A30D', mouth: 'M8 15c1.5 2 6.5 2 8 0' },
  { v: 5, label: 'Loved it', color: '#16A34A', mouth: 'M7.5 14.5c1.7 2.6 7.3 2.6 9 0' },
]

const LOW_CHIPS = ['Too fast', 'Confusing', 'Tech / lag', 'Boring', 'Other']
const HIGH_CHIPS = ['Fun', 'Learned a lot', 'Great questions', 'Good pace']
const MID_CHIPS = ['Pace', 'Difficulty', 'Question quality', 'Other']

function storageKey(role: Role, ref: string) {
  return `qz_sfb_${role}_${ref}`
}

export function SessionFeedbackPrompt({ role, sessionCode, sessionId, onResolved, className = 'mt-4' }: Props) {
  const ref = (sessionCode || sessionId || 'anon').toString()
  const key = storageKey(role, ref)

  // Once-per-session per device. useSyncExternalStore reads localStorage
  // SSR-safely: server snapshot is always false (prompt hidden in SSR HTML),
  // client snapshot reflects a prior submit/dismiss — no hydration mismatch,
  // no setState-in-effect.
  const alreadyDone = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return !!window.localStorage.getItem(key)
      } catch {
        return false
      }
    },
    () => false,
  )

  const [rating, setRating] = useState(0)
  const [reasons, setReasons] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'follow' | 'done'>('idle')

  const chips = useMemo(() => {
    if (rating === 0) return []
    if (rating <= 2) return LOW_CHIPS
    if (rating >= 4) return HIGH_CHIPS
    return MID_CHIPS
  }, [rating])

  const remember = (value: 'submitted' | 'dismissed') => {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // ignore — non-persistent is fine
    }
  }

  const pick = (v: number) => {
    setRating(v)
    setState('follow')
    captureRaw('session_feedback_rated', { role, rating: v })
  }

  const toggleReason = (c: string) => {
    setReasons(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))
  }

  const resolve = () => {
    setState('done')
    onResolved?.()
  }

  const submit = () => {
    remember('submitted')
    captureRaw('session_feedback_submitted', {
      role,
      rating,
      hasComment: comment.trim().length > 0,
      reasonCount: reasons.length,
    })
    // Fire-and-forget — the UI resolves immediately, network is best-effort.
    try {
      fetch('/api/session-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          role,
          reasons,
          comment: comment.trim() || null,
          sessionCode: sessionCode || null,
          sessionId: sessionId || null,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }
    resolve()
  }

  const skip = () => {
    remember('dismissed')
    captureRaw('session_feedback_dismissed', { role, rating: rating || null })
    resolve()
  }

  // Hide if this device already submitted/dismissed for this session — unless
  // we're mid-flow showing our own "Thanks" confirmation.
  if (alreadyDone && state !== 'done') return null

  const title = state === 'done'
    ? null
    : role === 'host'
      ? 'How did that session go?'
      : 'How was it?'
  const sub = role === 'host' ? 'Helps us improve the tool — bugs and ideas welcome' : 'One tap — that’s it'

  const thanks = rating >= 4 ? 'Thanks! 🙌' : rating === 3 ? 'Thanks — anything we could improve?' : 'Sorry it missed! What went wrong?'

  return (
    <div
      className={`rounded-2xl p-5 w-full ${className}`}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(15,27,61,0.04)' }}
      role="group"
      aria-label="Session feedback"
    >
      {state === 'done' ? (
        <p className="text-center font-black text-sm" style={{ color: '#16A34A', fontFamily: 'var(--font-heading)' }}>
          Thanks for the feedback 💛
        </p>
      ) : (
        <>
          <p className="text-center font-black text-base" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
            {title}
          </p>
          <p className="text-center text-xs mt-0.5 mb-3" style={{ color: '#6B7280' }}>
            {sub}
          </p>

          <div className="flex justify-between gap-1.5">
            {FACES.map(f => {
              const selected = rating === f.v
              const dim = rating !== 0 && !selected
              return (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => pick(f.v)}
                  aria-label={f.label}
                  aria-pressed={selected}
                  className="flex-1 flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition-transform"
                  style={{ opacity: dim ? 0.4 : 1, transform: selected ? 'scale(1.12)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden style={{ filter: selected ? 'none' : 'grayscale(0.3)' }}>
                    <circle cx="12" cy="12" r="10.5" fill={f.color} opacity="0.16" />
                    <circle cx="12" cy="12" r="10.5" stroke={f.color} strokeWidth="1.6" />
                    <circle cx="8.6" cy="9.6" r="1.25" fill={f.color} />
                    <circle cx="15.4" cy="9.6" r="1.25" fill={f.color} />
                    <path d={f.mouth} stroke={f.color} strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  <span className="text-[10px] font-bold" style={{ color: selected ? '#0F1B3D' : '#9CA3AF' }}>
                    {f.label}
                  </span>
                </button>
              )
            })}
          </div>

          {state === 'follow' && (
            <div className="mt-4">
              <p className="text-center text-[13px] font-bold mb-2" style={{ color: rating >= 4 ? '#16A34A' : rating === 3 ? '#CA8A04' : '#DC2626' }}>
                {thanks}
              </p>
              {chips.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {chips.map(c => {
                    const on = reasons.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleReason(c)}
                        className="text-xs font-bold rounded-full px-3 py-1.5 transition-colors"
                        style={{
                          border: `1.5px solid ${on ? '#0F1B3D' : '#E5E7EB'}`,
                          background: on ? '#0F1B3D' : '#FFFFFF',
                          color: on ? '#FFFFFF' : '#0F1B3D',
                          cursor: 'pointer',
                        }}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              )}
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Anything else? (optional)"
                className="w-full resize-none rounded-xl p-3 text-sm mb-2"
                style={{ border: '1px solid #E5E7EB' }}
              />
              <button
                type="button"
                onClick={submit}
                className="w-full rounded-full py-3 font-black text-sm transition-transform hover:scale-[1.01]"
                style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
              >
                Send
              </button>
              <button
                type="button"
                onClick={skip}
                className="w-full mt-2 text-xs font-semibold"
                style={{ color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Skip
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
