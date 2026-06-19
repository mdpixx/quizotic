'use client'

/**
 * RowActionsMenu — a compact "⋯" overflow menu for list/card rows.
 *
 * Keeps secondary/destructive actions (Share, Duplicate, Delete, …) out of the
 * row's visible action area so the primary action (Host live) and Edit stay
 * prominent and the row reads cleanly. Used by the quizzes and presentations
 * listings.
 */

import { useState, useRef } from 'react'

export interface RowAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  danger?: boolean
  title?: string
}

export function RowActionsMenu({ actions, label = 'More actions' }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [maxHeight, setMaxHeight] = useState(320)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (actions.length === 0) return null

  function handleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      const shouldOpenUp = spaceBelow < 200 && spaceAbove > spaceBelow
      setOpenUp(shouldOpenUp)
      setMaxHeight(Math.min(320, shouldOpenUp ? spaceAbove : spaceBelow))
    }
    setOpen(o => !o)
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="btn-icon focus-visible:ring-2 focus-visible:ring-yellow-200"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute right-0 z-50 rounded-xl shadow-xl border bg-white py-1 overflow-y-auto min-w-[160px] ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
            style={{ borderColor: 'var(--color-line)', maxHeight: `${maxHeight}px` }}
          >
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                title={a.title}
                onClick={() => { a.onClick(); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-[13px] font-medium flex items-center gap-2 transition-colors hover:bg-gray-50"
                style={{ color: a.danger ? '#B91C1C' : '#374151' }}
              >
                {a.icon && <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{a.icon}</span>}
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
