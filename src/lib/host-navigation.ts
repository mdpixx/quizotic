export type HostBackNavigation =
  | { kind: 'back' }
  | { kind: 'push'; href: string }

function isHostPath(path: string): boolean {
  return path === '/host' || path.startsWith('/host/') || path.startsWith('/host?')
}

export function safeHostReturnPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null

  try {
    const url = new URL(value, 'https://quizotic.local')
    if (url.origin !== 'https://quizotic.local') return null
    const path = `${url.pathname}${url.search}${url.hash}`
    return isHostPath(url.pathname) ? path : null
  } catch {
    return null
  }
}

function hasSameOriginHostReferrer(referrer: string | null | undefined, currentOrigin: string | null | undefined): boolean {
  if (!referrer || !currentOrigin) return false

  try {
    const url = new URL(referrer)
    return url.origin === currentOrigin && isHostPath(url.pathname)
  } catch {
    return false
  }
}

export function resolveHostBackNavigation({
  returnTo,
  referrer,
  currentOrigin,
  fallback,
}: {
  returnTo: string | null | undefined
  referrer: string | null | undefined
  currentOrigin: string | null | undefined
  fallback: string
}): HostBackNavigation {
  const safeReturnTo = safeHostReturnPath(returnTo)
  if (safeReturnTo) return { kind: 'push', href: safeReturnTo }
  if (hasSameOriginHostReferrer(referrer, currentOrigin)) return { kind: 'back' }
  return { kind: 'push', href: safeHostReturnPath(fallback) ?? '/host' }
}
