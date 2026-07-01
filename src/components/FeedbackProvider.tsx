'use client'

// FeedbackProvider — mounts a single FeedbackModal app-wide and exposes
// openFeedback(source?) so any surface can trigger it. Replaces the old
// always-on floating bubble: the modal never shows uninvited, only when a
// deliberate entry point (account menu, footer link, post-session prompt)
// calls openFeedback().

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { FeedbackModal } from '@/components/FeedbackModal'

interface FeedbackContextValue {
  openFeedback: (source?: string) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<string | undefined>(undefined)

  const openFeedback = useCallback((src?: string) => {
    setSource(src)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const value = useMemo<FeedbackContextValue>(() => ({ openFeedback }), [openFeedback])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackModal open={open} onClose={close} source={source} />
    </FeedbackContext.Provider>
  )
}

// Returns openFeedback. Safe to call outside the provider (no-op) so surfaces
// that may render in isolation (tests, storybook) don't crash.
export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  return ctx ?? { openFeedback: () => {} }
}
