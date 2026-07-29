'use client'

// FeedbackProvider — mounts a single FeedbackModal app-wide and exposes
// openFeedback(source?, type?) so any surface can trigger it. Replaces the old
// always-on floating bubble: the modal never shows uninvited, only when a
// deliberate entry point (account menu, footer link, post-session prompt,
// dashboard "Request a feature" button) calls openFeedback().

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { FeedbackModal, type FeedbackType } from '@/components/FeedbackModal'

interface FeedbackContextValue {
  // `type` selects the modal's copy and is persisted on the Feedback row so
  // feature requests can be triaged apart from bugs in the admin Voice tab.
  // Omitted = 'general', keeping every existing call site unchanged.
  openFeedback: (source?: string, type?: FeedbackType) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<string | undefined>(undefined)
  const [type, setType] = useState<FeedbackType>('general')

  const openFeedback = useCallback((src?: string, kind: FeedbackType = 'general') => {
    setSource(src)
    setType(kind)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const value = useMemo<FeedbackContextValue>(() => ({ openFeedback }), [openFeedback])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackModal open={open} onClose={close} source={source} type={type} />
    </FeedbackContext.Provider>
  )
}

// Returns openFeedback. Safe to call outside the provider (no-op) so surfaces
// that may render in isolation (tests, storybook) don't crash.
export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  return ctx ?? { openFeedback: () => {} }
}
