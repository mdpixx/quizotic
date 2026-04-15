import { useEffect, useRef } from 'react'

/**
 * Debounced autosave hook.
 * Calls `onSave(value)` after `delayMs` of inactivity whenever `value` changes.
 * The first render is skipped (no save on mount).
 */
export function useAutosave<T>(
  value: T,
  onSave: (value: T) => void,
  { delayMs = 3000 }: { delayMs?: number } = {},
): void {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      onSaveRef.current(value)
    }, delayMs)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs])
}
