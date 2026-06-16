'use client'

/**
 * QuizListRow — a single row in the "All quizzes" library list.
 *
 * Mobile (<md): flex column layout — title wraps, badges wrap below title,
 * metadata wraps, actions collapse to Host + ⋯ (Edit lives in the ⋯ menu).
 *
 * Desktop (≥md): unchanged grid layout with separate Edit button.
 */

import Link from 'next/link'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'

// Mirrored from quizzes/page.tsx — keep in sync if schema changes
export interface QuizRecord {
  id: string
  title: string
  subject: string | null
  language: string | null
  createdAt: string
  updatedAt: string
  coverImageUrl: string | null
  questionCount: number
  asyncShareSlug: string | null
  asyncAllowRetries: boolean
  asyncOpensAt: string | null
  asyncClosesAt: string | null
  asyncPublishedAt: string | null
  asyncQuestionCount: number
  asyncResponseCount: number
  asyncNeedsRepublish: boolean
}

// ── Helpers (mirrored from page.tsx) ─────────────────────────────────────────

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #F8FAFC 0%, #E0F2FE 100%)',
  'linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%)',
  'linear-gradient(135deg, #F0FDF4 0%, #BBF7D0 100%)',
  'linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)',
  'linear-gradient(135deg, #EFF6FF 0%, #BFDBFE 100%)',
  'linear-gradient(135deg, #ECFEFF 0%, #A5F3FC 100%)',
]

function gradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length]
}

function QuizCoverMotif({ id }: { id: string }) {
  let baseSeed = 0
  for (let i = 0; i < id.length; i++) baseSeed = (baseSeed * 131 + id.charCodeAt(i)) >>> 0
  const seededUnit = (step: number) => {
    let value = (baseSeed + step * 0x9e3779b9) >>> 0
    value ^= value >>> 16
    value = Math.imul(value, 0x7feb352d)
    value ^= value >>> 15
    value = Math.imul(value, 0x846ca68b)
    value ^= value >>> 16
    return (value >>> 0) / 0xffffffff
  }
  const dots = Array.from({ length: 8 }, (_, i) => ({
    cx: 4 + seededUnit(i * 4 + 1) * 92,
    cy: 4 + seededUnit(i * 4 + 2) * 92,
    o: 0.25 + seededUnit(i * 4 + 4) * 0.6,
  }))
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      <rect x="19" y="15" width="62" height="70" rx="10" fill="#fff" opacity="0.88" />
      <rect x="28" y="27" width="44" height="7" rx="3.5" fill="#0F1B3D" opacity="0.18" />
      <rect x="28" y="43" width="38" height="6" rx="3" fill="#2563EB" opacity="0.22" />
      <rect x="28" y="57" width="32" height="6" rx="3" fill="#16A34A" opacity="0.22" />
      <circle cx="70" cy="66" r="9" fill="#F5E642" stroke="#0F1B3D" strokeOpacity="0.48" strokeWidth="2" />
      <path d="M66.4 66l2.2 2.2 5-5.2" stroke="#0F1B3D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {dots.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r="1.2" fill="#0F1B3D" opacity={s.o * 0.35} />
      ))}
    </svg>
  )
}

function modeStatus(quiz: QuizRecord): { label: string; tone: 'ready' | 'draft' | 'attention' } {
  if (!quiz.asyncShareSlug) return { label: 'Draft', tone: 'draft' }
  if (quiz.asyncNeedsRepublish) return { label: 'Republish', tone: 'attention' }
  return { label: 'Self-paced', tone: 'ready' }
}

function statusStyle(tone: 'ready' | 'draft' | 'attention') {
  if (tone === 'ready') return { background: '#ECFDF5', color: '#047857', border: '1px solid #BBF7D0' }
  if (tone === 'attention') return { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }
  return { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }
}

function readinessSignals(quiz: QuizRecord): Array<{ label: string; tone: 'ready' | 'draft' | 'attention' }> {
  const signals: Array<{ label: string; tone: 'ready' | 'draft' | 'attention' }> = []
  if (quiz.questionCount === 0) {
    signals.push({ label: 'Needs questions', tone: 'attention' })
  } else {
    signals.push({ label: 'Ready live', tone: 'ready' })
  }
  if (quiz.asyncNeedsRepublish) signals.push({ label: 'Stale link', tone: 'attention' })
  if (quiz.asyncResponseCount > 0) signals.push({ label: 'Report ready', tone: 'ready' })
  return signals
}

function scheduledLabel(quiz: QuizRecord): string | null {
  if (!quiz.asyncOpensAt) return null
  const opens = new Date(quiz.asyncOpensAt)
  if (opens.getTime() <= Date.now()) return null
  return `Scheduled · ${opens.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SCHEDULED_CHIP_STYLE = { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }

// ── Component ─────────────────────────────────────────────────────────────────

interface QuizListRowProps {
  quiz: QuizRecord
  isLastRow: boolean
  startingId: string | null
  onStart: (id: string) => void
  onAssign: (id: string, title: string) => void
  onViewResults: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export function QuizListRow({
  quiz,
  isLastRow,
  startingId,
  onStart,
  onAssign,
  onViewResults,
  onDuplicate,
  onDelete,
}: QuizListRowProps) {
  const status = modeStatus(quiz)
  const attention = readinessSignals(quiz).find(s => s.tone === 'attention')
  const sLabel = scheduledLabel(quiz)

  // Edit link always points to the new builder
  const editHref = `/host/build?edit=${quiz.id}`

  const overflowActions = [
    // Edit is the first action in ⋯ on mobile; hidden behind a standalone btn on desktop
    {
      label: 'Edit',
      onClick: () => { window.location.href = editHref },
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: 'Assign',
      title: 'Share now or schedule for a date',
      onClick: () => onAssign(quiz.id, quiz.title),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    ...(quiz.asyncShareSlug ? [{
      label: 'View results',
      onClick: () => onViewResults(quiz.id),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path d="M3 3v18h18M9 17V9M14 17V5M19 17v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    }] : []),
    {
      label: 'Duplicate',
      onClick: () => onDuplicate(quiz.id),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
    },
    {
      label: 'Delete',
      onClick: () => onDelete(quiz.id),
      danger: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className={`transition-colors hover:bg-[var(--color-paper)] ${!isLastRow ? 'border-b' : ''}`}
      style={{ borderColor: 'var(--color-line)' }}
    >
      {/* ── Mobile (<md): stacked flex card ───────────────────────────────── */}
      <div className="flex md:hidden items-start gap-3 px-3.5 py-3">
        {/* Thumbnail */}
        <div className="w-11 h-11 rounded-[10px] overflow-hidden relative flex-shrink-0 mt-0.5" style={{ background: gradientFor(quiz.id) }}>
          {quiz.coverImageUrl
            ? <img src={quiz.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <QuizCoverMotif id={`thumb-${quiz.id}`} />}
        </div>

        {/* Content + actions */}
        <div className="flex-1 min-w-0">
          {/* Title — wraps to 2 lines on small screens */}
          <p
            className="text-[14px] font-bold leading-snug"
            style={{
              color: '#0F1B3D',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {quiz.title || 'Untitled quiz'}
          </p>

          {/* Badges — wrap naturally */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="chip" style={statusStyle(status.tone)}>{status.label}</span>
            {sLabel && <span className="chip" style={SCHEDULED_CHIP_STYLE}>{sLabel}</span>}
            {attention && <span className="chip" style={statusStyle('attention')}>{attention.label}</span>}
          </div>

          {/* Metadata + actions row */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-[11px] flex-wrap" style={{ color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
              {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'}
              {' · '}Updated {timeAgo(quiz.updatedAt)}
            </p>

            {/* Actions: Host ▶ + ⋯ only on mobile */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onStart(quiz.id)}
                disabled={startingId === quiz.id}
                className="btn-golive"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                aria-label="Host live"
              >
                {startingId === quiz.id ? (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span className="play-dot" style={{ width: '14px', height: '14px' }}>
                    <svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2 h-2"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                )}
              </button>
              <RowActionsMenu
                label={`Actions for ${quiz.title || 'quiz'}`}
                actions={overflowActions}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop (≥md): original grid row ──────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-[44px_1fr_110px_auto] gap-4 items-center px-3.5 py-3">
        {/* Thumbnail */}
        <div className="w-11 h-11 rounded-[10px] overflow-hidden relative" style={{ background: gradientFor(quiz.id) }}>
          {quiz.coverImageUrl
            ? <img src={quiz.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <QuizCoverMotif id={`thumb-${quiz.id}`} />}
        </div>

        {/* Title + badges + metadata */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-bold truncate" style={{ color: '#0F1B3D' }}>{quiz.title || 'Untitled quiz'}</span>
            <span className="chip flex-shrink-0" style={statusStyle(status.tone)}>{status.label}</span>
            {sLabel && <span className="chip flex-shrink-0" style={SCHEDULED_CHIP_STYLE}>{sLabel}</span>}
            {attention && <span className="chip flex-shrink-0" style={statusStyle('attention')}>{attention.label}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {quiz.subject && <><span className="truncate max-w-[120px]">{quiz.subject}</span><span aria-hidden>·</span></>}
            <span>{quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'}</span>
            <span aria-hidden>·</span>
            <span>Updated {timeAgo(quiz.updatedAt)}</span>
            {quiz.asyncShareSlug && quiz.asyncResponseCount > 0 && (
              <><span aria-hidden>·</span><span>{quiz.asyncResponseCount} self-paced responses</span></>
            )}
          </div>
        </div>

        {/* Created date */}
        <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {new Date(quiz.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        {/* Actions: Host + Edit + ⋯ */}
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onStart(quiz.id)}
            disabled={startingId === quiz.id}
            className="btn-golive"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {startingId === quiz.id ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <>
                <span className="play-dot" style={{ width: '14px', height: '14px' }}>
                  <svg viewBox="0 0 24 24" fill="#0F1B3D" className="w-2 h-2"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span>Host live</span>
              </>
            )}
          </button>
          {/* Edit button — desktop only (mobile uses ⋯ menu) */}
          <Link
            href={editHref}
            className="btn-secondary"
            style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '12px' }}
          >
            Edit
          </Link>
          <RowActionsMenu
            label={`Actions for ${quiz.title || 'quiz'}`}
            actions={overflowActions.slice(1)} /* skip Edit — it has its own button on desktop */
          />
        </div>
      </div>
    </div>
  )
}
