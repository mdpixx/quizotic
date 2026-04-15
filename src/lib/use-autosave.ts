import { useEffect, useRef } from 'react'

const RETRY_DELAYS = [5_000, 15_000, 60_000] // ms between retries on failure

/**
 * Debounced autosave hook with retry-on-failure.
 * Calls `onSave(value)` after `delayMs` of inactivity whenever `value` changes.
 * If `onSave` returns `false` (or a rejected Promise), retries at 5s / 15s / 60s.
 * A new change arriving during a retry window cancels all pending retries.
 * The first render is skipped (no save on mount).
 */
export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<boolean> | boolean | void,
  { delayMs = 3000 }: { delayMs?: number } = {},
): void {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const initializedRef = useRef(false)
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Cancel all pending retry timers
  function cancelRetries() {
    for (const t of retryTimersRef.current) clearTimeout(t)
    retryTimersRef.current = []
  }

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }

    // New change cancels any pending retries from the previous attempt
    cancelRetries()

    const debounceTimer = setTimeout(async () => {
      let succeeded: boolean
      try {
        const result = await onSaveRef.current(value)
        succeeded = result !== false
      } catch {
        succeeded = false
      }

      if (succeeded) return

      // Schedule retries with increasing delays
      let retryCount = 0
      function scheduleRetry() {
        if (retryCount >= RETRY_DELAYS.length) return
        const t = setTimeout(async () => {
          // Remove this timer from the list
          retryTimersRef.current = retryTimersRef.current.filter(x => x !== t)
          try {
            const result = await onSaveRef.current(value)
            if (result !== false) return // succeeded — stop retrying
          } catch { /* ignore */ }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs])
}
