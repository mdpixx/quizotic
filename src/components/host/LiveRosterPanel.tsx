'use client'

// Roster of live participant status for the host's question screen — ✓ submitted,
// animated dots while attempting, greyed when offline.
//
// Two variants share one body:
//   - variant="drawer" (default, mobile): the original fixed right-edge
//     drawer collapsed behind a slim edge tab, so the projected question stays
//     full-bleed on narrow screens.
//   - variant="rail" (desktop lg+): an inline, always-visible panel rendered
//     as the right rail of the 3-column host stage. No edge tab, no drawer
//     animation — the roster is always at hand, matching the Wayground layout.

import { useMemo, useState } from 'react'
import { Avatar } from '@/components/Avatar'

export interface RosterEntry {
  name: string
  archetype: string
  team?: { index: number; name: string; color: string } | null
  connected: boolean
}

interface LiveRosterPanelProps {
  participants: Map<string, RosterEntry>
  answeredKeys: Set<string>
  answered: number
  connectedCount: number
  onKick?: (key: string, name: string) => void
  anonymous?: boolean
  onToggleAnonymous?: () => void
  /** "drawer" = fixed edge-tab drawer (mobile); "rail" = inline always-on panel (desktop). */
  variant?: 'drawer' | 'rail'
}

type Filter = 'all' | 'submitted' | 'attempting'

function StatusIcon({ submitted, connected }: { submitted: boolean; connected: boolean }) {
  if (submitted) {
    return (
      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.25)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-label="Submitted"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    )
  }
  if (!connected) {
    return (
      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Offline">
        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" className="w-3 h-3"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></svg>
      </span>
    )
  }
  return (
    <span className="w-5 h-5 rounded-full flex items-center justify-center gap-[2px] flex-shrink-0" style={{ background: 'rgba(251,209,59,0.18)' }} aria-label="Attempting">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full animate-bounce" style={{ background: '#FBD13B', animationDelay: `${i * 150}ms`, animationDuration: '900ms' }} />
      ))}
    </span>
  )
}

export function LiveRosterPanel({ participants, answeredKeys, answered, connectedCount, onKick, anonymous, onToggleAnonymous, variant = 'drawer' }: LiveRosterPanelProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [kickArmedKey, setKickArmedKey] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = Array.from(participants.entries()).map(([key, p]) => ({
      key,
      ...p,
      submitted: answeredKeys.has(key),
    }))
    // Submitted first, then attempting, offline last; stable by name inside groups.
    list.sort((a, b) => {
      const rank = (r: typeof a) => (r.submitted ? 0 : r.connected ? 1 : 2)
      return rank(a) - rank(b) || a.name.localeCompare(b.name)
    })
    if (filter === 'submitted') return list.filter(r => r.submitted)
    if (filter === 'attempting') return list.filter(r => !r.submitted && r.connected)
    return list
  }, [participants, answeredKeys, filter])

  const attemptingCount = Math.max(0, connectedCount - answered)

  const header = (
    <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Answered <span style={{ color: '#FBD13B' }}>{answered}/{connectedCount}</span>
        </p>
        {onToggleAnonymous && (
          <button
            onClick={onToggleAnonymous}
            className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors"
            style={{
              background: anonymous ? 'rgba(255,255,255,0.12)' : 'rgba(34,197,94,0.2)',
              color: anonymous ? 'rgba(255,255,255,0.7)' : '#4ADE80',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
            title={anonymous ? 'Names are hidden (archetypes shown) — click to show real names' : 'Real names visible — click to hide behind archetypes'}
            aria-pressed={!anonymous}
          >
            {anonymous ? 'Names hidden' : 'Names shown'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5">
        {([
          { id: 'all', label: `All` },
          { id: 'submitted', label: `✓ ${answered}` },
          { id: 'attempting', label: `⋯ ${attemptingCount}` },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors"
            style={{
              background: filter === f.id ? '#FBD13B' : 'rgba(255,255,255,0.1)',
              color: filter === f.id ? '#0F1B3D' : 'rgba(255,255,255,0.75)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )

  const list = (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {rows.length === 0 ? (
        <p className="text-[12px] text-center py-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {filter === 'submitted' ? 'No answers yet.' : filter === 'attempting' ? 'Everyone has answered.' : 'No participants.'}
        </p>
      ) : (
        rows.map(row => (
          <div
            key={row.key}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group"
            style={{ opacity: row.connected || row.submitted ? 1 : 0.45, filter: row.connected ? undefined : 'grayscale(0.8)' }}
          >
            <Avatar archetype={row.archetype || row.name} size={28} />
            <span
              className="flex-1 text-[13px] font-semibold truncate"
              style={{ color: '#fff', textShadow: row.team ? undefined : 'none', borderLeft: row.team ? `3px solid ${row.team.color}` : undefined, paddingLeft: row.team ? 6 : 0 }}
              title={row.name}
            >
              {row.name}
            </span>
            {onKick && row.key.startsWith('pid:') && (
              kickArmedKey === row.key ? (
                <button
                  onClick={() => { onKick(row.key, row.name); setKickArmedKey(null) }}
                  onBlur={() => setKickArmedKey(null)}
                  className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: '#DC2626', color: '#fff' }}
                >
                  Remove?
                </button>
              ) : (
                <button
                  onClick={() => setKickArmedKey(row.key)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[13px] leading-none px-1.5 py-0.5 rounded"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  title={`Remove ${row.name} from the game`}
                  aria-label={`Remove ${row.name}`}
                >
                  ×
                </button>
              )
            )}
            <StatusIcon submitted={row.submitted} connected={row.connected} />
          </div>
        ))
      )}
    </div>
  )

  // ── Rail variant: inline, always-visible right rail (desktop lg+) ──────────
  if (variant === 'rail') {
    return (
      <aside
        className="host-rail host-roster-rail flex flex-col rounded-2xl overflow-hidden h-full"
        style={{
          background: 'rgba(15,27,61,0.92)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5)',
        }}
        aria-live="off"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: '#fff' }}>
            Participants
          </h3>
          <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded-full" style={{ color: '#0F1B3D', background: '#FBD13B' }}>
            {connectedCount}
          </span>
        </div>
        {header}
        {list}
      </aside>
    )
  }

  // ── Drawer variant: fixed right-edge drawer (mobile <lg) ───────────────────
  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center" aria-live="off">
      {/* Edge tab — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-l-xl px-2 py-3 flex flex-col items-center gap-1 transition-colors"
        style={{ background: 'rgba(15,27,61,0.92)', border: '1px solid rgba(255,255,255,0.18)', borderRight: 'none', color: '#fff' }}
        title={open ? 'Hide participant status' : 'Show who has answered'}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M15 18l-6-6 6-6" /></svg>
        <span className="text-[11px] font-black tabular-nums" style={{ color: '#FBD13B' }}>✓{answered}/{connectedCount}</span>
      </button>

      {/* Drawer */}
      <div
        className="overflow-hidden transition-all duration-300 rounded-l-2xl"
        style={{
          width: open ? 300 : 0,
          maxHeight: '80vh',
          background: 'rgba(15,27,61,0.95)',
          border: open ? '1px solid rgba(255,255,255,0.18)' : 'none',
          boxShadow: open ? '0 12px 40px -12px rgba(0,0,0,0.6)' : 'none',
        }}
      >
        <div className="w-[300px] max-h-[80vh] flex flex-col">
          {header}
          {list}
        </div>
      </div>
    </div>
  )
}
