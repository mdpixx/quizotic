import { describe, expect, it } from 'vitest'
import {
  resolveHostBackNavigation,
  safeHostReturnPath,
} from '../lib/host-navigation'

describe('safeHostReturnPath', () => {
  it('accepts internal host paths', () => {
    expect(safeHostReturnPath('/host/studio')).toBe('/host/studio')
    expect(safeHostReturnPath('/host/build?start=aitopic')).toBe('/host/build?start=aitopic')
  })

  it('rejects external and non-host return targets', () => {
    expect(safeHostReturnPath('https://evil.example/host/studio')).toBeNull()
    expect(safeHostReturnPath('//evil.example/host/studio')).toBeNull()
    expect(safeHostReturnPath('/join')).toBeNull()
    expect(safeHostReturnPath('/hostile')).toBeNull()
    expect(safeHostReturnPath('javascript:alert(1)')).toBeNull()
  })
})

describe('resolveHostBackNavigation', () => {
  it('prefers a safe explicit return target', () => {
    expect(resolveHostBackNavigation({
      returnTo: '/host/studio',
      referrer: 'https://quizotic.live/host',
      currentOrigin: 'https://quizotic.live',
      fallback: '/host',
    })).toEqual({ kind: 'push', href: '/host/studio' })
  })

  it('uses browser back for same-origin host referrers when no return target exists', () => {
    expect(resolveHostBackNavigation({
      returnTo: null,
      referrer: 'https://quizotic.live/host/studio',
      currentOrigin: 'https://quizotic.live',
      fallback: '/host/studio',
    })).toEqual({ kind: 'back' })
  })

  it('falls back to studio for direct new creation links', () => {
    expect(resolveHostBackNavigation({
      returnTo: null,
      referrer: '',
      currentOrigin: 'https://quizotic.live',
      fallback: '/host/studio',
    })).toEqual({ kind: 'push', href: '/host/studio' })
  })

  it('rejects unsafe return targets before considering fallback', () => {
    expect(resolveHostBackNavigation({
      returnTo: 'https://evil.example',
      referrer: 'https://evil.example/host/studio',
      currentOrigin: 'https://quizotic.live',
      fallback: '/host',
    })).toEqual({ kind: 'push', href: '/host' })
  })
})
