import { useCallback, useEffect, useRef, useState } from 'react'

export interface HistoryControls<T> {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  reset: (baseline: T) => void
}

function serialize<T>(v: T): string {
  return JSON.stringify(v)
}

/**
 * Snapshot-based undo/redo hook with debounced capture.
 * Watches `value`, debounces capture so a typing burst becomes one step,
 * and restores snapshots through the caller's `apply` callback.
 * Mirror of use-autosave.ts style: refs for bookkeeping, version bump for re-render.
 */
export function useHistory<T>(
  value: T,
  apply: (snapshot: T) => void,
  { delayMs = 450, limit = 50 }: { delayMs?: number; limit?: number } = {},
): HistoryControls<T> {
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const presentRef = useRef<T>(value)
  // Holds serialized snapshot of a just-applied restore so the capture
  // effect can recognise and ignore its own apply call (string match,
  // not a bare boolean, to survive multiple renders before the effect fires).
  const restoringRef = useRef<string>('')
  const initializedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applyRef = useRef(apply)
  applyRef.current = apply

  const [, setVersion] = useState(0)
  const bump = useCallback(() => setVersion(v => v + 1), [])

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }

    const s = serialize(value)

    // Change came from our own apply — consume guard, don't capture
    if (s === restoringRef.current) {
      restoringRef.current = ''
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      if (s === serialize(presentRef.current)) return // no real change
      pastRef.current.push(presentRef.current)
      if (pastRef.current.length > limit) pastRef.current.shift()
      presentRef.current = value
      futureRef.current = []
      bump()
    }, delayMs)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, delayMs, limit, bump])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    const snapshot = pastRef.current.pop()!
    futureRef.current.unshift(presentRef.current)
    presentRef.current = snapshot
    restoringRef.current = serialize(snapshot)
    applyRef.current(snapshot)
    bump()
  }, [bump])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    const snapshot = futureRef.current.shift()!
    pastRef.current.push(presentRef.current)
    presentRef.current = snapshot
    restoringRef.current = serialize(snapshot)
    applyRef.current(snapshot)
    bump()
  }, [bump])

  const reset = useCallback((baseline: T) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    pastRef.current = []
    futureRef.current = []
    presentRef.current = baseline
    restoringRef.current = ''
    initializedRef.current = true // prevent baseline from being captured on next render
    bump()
  }, [bump])

  return {
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    undo,
    redo,
    reset,
  }
}
