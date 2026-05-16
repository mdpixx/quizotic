'use client'

import { useEffect, useRef } from 'react'

interface EndQuizConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  questionsRemaining?: number
}

// Confirmation modal for the host's "End Quiz" action. Modeled on
// QuizVsSlidesModal — same backdrop/blur/escape behavior. Destructive CTA
// is red and is NOT the default focus so an accidental Enter press cancels
// rather than ends the quiz.
export function EndQuizConfirmModal({
  open,
  onClose,
  onConfirm,
  questionsRemaining,
}: EndQuizConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Focus the safe (Cancel) button so Enter doesn't end the quiz.
    const t = setTimeout(() => cancelRef.current?.focus(), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="End quiz confirmation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,27,61,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid var(--color-line)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-2">
          <h2
            className="text-[20px] font-black"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
          >
            End the quiz now?
          </h2>
        </div>

        <div className="px-6 pb-4 space-y-3">
          <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
            {typeof questionsRemaining === 'number' && questionsRemaining > 0
              ? `${questionsRemaining} question${questionsRemaining === 1 ? '' : 's'} will be skipped. `
              : ''}
            Participants will see the final podium and scores. This cannot be undone.
          </p>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ background: 'var(--color-paper)', borderTop: '1px solid var(--color-line)' }}
        >
          <button
            ref={cancelRef}
            onClick={onClose}
            className="btn-secondary"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="px-4 py-2 rounded-lg font-bold text-white"
            style={{ background: '#DC2626', border: '1px solid #B91C1C' }}
            type="button"
          >
            End Quiz
          </button>
        </div>
      </div>
    </div>
  )
}
