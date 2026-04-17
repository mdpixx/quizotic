import { useEffect, useRef, useState } from 'react'

const RETRY_DELAYS = [5_000, 15_000, 60_000] // ms between retries on failure

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AutosaveState {
  status: AutosaveStatus
  lastSavedAt: number | null
}

/**
 * Debounced autosave hook with retry-on-failure.
 * Calls `onSave(value)` after `delayMs` of inactivity whenever `value` changes.
 * If `onSave` returns `false` (or a rejected Promise), retries at 5s / 15s / 60s.
 * A new change arriving during a retry window cancels all pending retries.
 * The first render is skipped (no save on mount).
 *
 * Returns a reactive status badge input: `{ status, lastSavedAt }`.
 */
export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<boolean> | boolean | void,
  { delayMs = 3000 }: { delayMs?: number } = {},
): AutosaveState {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const initializedRef = useRef(false)
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  function cancelRetries() {
    for (const t of retryTimersRef.current) clearTimeout(t)
    retryTimersRef.current = []
  }

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }

    cancelRetries()

    const debounceTimer = setTimeout(async () => {
      setStatus('saving')
      let succeeded: boolean
      try {
        const result = await onSaveRef.current(value)
        succeeded = result !== false
      } catch {
        succeeded = false
      }

      if (succeeded) {
        setStatus('saved')
        setLastSavedAt(Date.now())
        return
      }

      setStatus('error')
      let retryCount = 0
      function scheduleRetry() {
        if (retryCount >= RETRY_DELAYS.length) return
        const t = setTimeout(async () => {
          retryTimersRef.current = retryTimersRef.current.filter(x => x !== t)
          setStatus('saving')
          try {
            const result = await onSaveRef.current(value)
            if (result !== false) {
              setStatus('saved')
              setLastSavedAt(Date.now())
              return
            }
          } catch { /* ignore */ }
          setStatus('error')
          retryCount++
          scheduleRetry()
        }, RETRY_DELAYS[retryCount])
        retryTimersRef.current.push(t)
        retryCount++
      }
      scheduleRetry()
    }, delayMs)

    return () => {
      clearTimeout(debounceTimer)
      cancelRetries()
    }
  }, [value, delayMs])

  return { status, lastSavedAt }
}
