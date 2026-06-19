'use client'

// Host-only Q&A moderation queue for live `qa` questions. The projected host
// view shows only a count (privacy in shared rooms); this panel is the host
// operator's working surface to triage audience questions: spotlight one to
// read out, mark questions answered, dismiss noise, and curate order with
// upvotes. Pure presentational component — all state lives in the host page.

export type QaStatus = 'pending' | 'spotlight' | 'answered' | 'dismissed'

export interface QaEntry {
  name: string
  archetype: string
  text: string
  at: number
}

export interface QaModerationState {
  status: QaStatus
  votes: number
}

export function qaKey(e: { name: string; at: number }): string {
  return `${e.at}-${e.name}`
}

interface Props {
  entries: QaEntry[]
  moderation: Record<string, QaModerationState>
  onSetStatus: (key: string, status: QaStatus) => void
  onUpvote: (key: string) => void
  onClose: () => void
}

const STATUS_OF = (m: Record<string, QaModerationState>, key: string): QaStatus =>
  m[key]?.status ?? 'pending'
const VOTES_OF = (m: Record<string, QaModerationState>, key: string): number =>
  m[key]?.votes ?? 0

export function QaModerationPanel({ entries, moderation, onSetStatus, onUpvote, onClose }: Props) {
  const decorated = entries.map(e => {
    const key = qaKey(e)
    return { ...e, key, status: STATUS_OF(moderation, key), votes: VOTES_OF(moderation, key) }
  })

  const spotlight = decorated.find(d => d.status === 'spotlight') ?? null
  const dismissed = decorated.filter(d => d.status === 'dismissed')
  const answered = decorated.filter(d => d.status === 'answered')
  // Active queue: pending only, highest-voted first, then oldest.
  const queue = decorated
    .filter(d => d.status === 'pending')
    .sort((a, b) => (b.votes - a.votes) || (a.at - b.at))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
          <div>
            <h2 className="text-lg font-black" style={{ color: '#0F1B3D' }}>Question queue</h2>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              {queue.length} waiting · {answered.length} answered
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {spotlight && (
            <div className="rounded-2xl border-2 p-4" style={{ borderColor: '#FBD13B', background: '#FFFBEB' }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#B45309' }}>★ On stage</p>
              <p className="text-xl font-bold leading-snug" style={{ color: '#0F1B3D' }}>{spotlight.text}</p>
              <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>— {spotlight.name}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onSetStatus(spotlight.key, 'answered')} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: '#DCFCE7', color: '#15803D' }}>✓ Mark answered</button>
                <button onClick={() => onSetStatus(spotlight.key, 'pending')} className="py-2 px-3 rounded-lg text-sm font-bold" style={{ background: '#F1F5F9', color: '#475569' }}>Unpin</button>
              </div>
            </div>
          )}

          {queue.length === 0 && !spotlight && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm" style={{ color: '#94A3B8' }}>
              No questions waiting. New audience questions appear here as they arrive.
            </div>
          )}

          {queue.map(d => (
            <div key={d.key} className="rounded-xl border p-3" style={{ borderColor: '#E5E7EB' }}>
              <p className="text-base font-semibold leading-snug" style={{ color: '#0F1B3D' }}>{d.text}</p>
              <p className="mt-1 text-[11px]" style={{ color: '#94A3B8' }}>— {d.name}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={() => onUpvote(d.key)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                  ▲ {d.votes}
                </button>
                <span className="flex-1" />
                <button onClick={() => onSetStatus(d.key, 'spotlight')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#FEF3C7', color: '#B45309' }} title="Spotlight">★</button>
                <button onClick={() => onSetStatus(d.key, 'answered')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#DCFCE7', color: '#15803D' }} title="Mark answered">✓</button>
                <button onClick={() => onSetStatus(d.key, 'dismissed')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#FEE2E2', color: '#DC2626' }} title="Dismiss">✕</button>
              </div>
            </div>
          ))}

          {answered.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>Answered</p>
              <div className="space-y-1.5">
                {answered.map(d => (
                  <div key={d.key} className="flex items-center gap-2 text-sm" style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#22C55E' }}>✓</span>
                    <span className="flex-1 truncate line-through">{d.text}</span>
                    <button onClick={() => onSetStatus(d.key, 'pending')} className="text-[11px] font-bold" style={{ color: '#4F46E5' }}>undo</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dismissed.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>Dismissed ({dismissed.length})</p>
              <div className="space-y-1.5">
                {dismissed.map(d => (
                  <div key={d.key} className="flex items-center gap-2 text-sm" style={{ color: '#CBD5E1' }}>
                    <span className="flex-1 truncate line-through">{d.text}</span>
                    <button onClick={() => onSetStatus(d.key, 'pending')} className="text-[11px] font-bold" style={{ color: '#4F46E5' }}>restore</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
