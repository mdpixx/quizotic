/**
 * Draft storage helpers — crash-safe localStorage layer for quiz/presentation builders.
 * Sits alongside (not replacing) the saved-list keys so the two never collide.
 */

interface DraftEntry<T> {
  value: T
  savedAt: number // Date.now() timestamp
}

export function draftKey(kind: 'quiz' | 'presentation', id: string): string {
  return `quizotic_${kind}_draft_${id}`
}

export function readDraft<T>(key: string): DraftEntry<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as DraftEntry<T>
  } catch {
    return null
  }
}

export function writeDraft<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    const entry: DraftEntry<T> = { value, savedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // localStorage quota exceeded or unavailable — silently ignore
  }
}

export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Format a savedAt timestamp as a human-readable relative string */
export function formatDraftAge(savedAt: number): string {
  const diff = Math.floor((Date.now() - savedAt) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
