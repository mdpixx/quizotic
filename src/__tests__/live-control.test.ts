import { afterEach, describe, expect, it } from 'vitest'
import {
  createLiveSession,
  controlLiveSession,
  snapshotLiveSession,
  publicSnapshotLiveSession,
  sessionOwnerMatches,
  hasLiveSession,
  isLiveControlAvailable,
  type CreateLiveSessionInput,
} from '../lib/live-control'

// The typed client talks to server.mjs via a globalThis bridge. In the test
// process the custom server never boots, so the bridge is absent — every
// call must degrade to a safe no-op (the contract routes rely on). We then
// register a mock bridge to verify the delegation wiring.

afterEach(() => {
  // Strip any mock bridge between tests so each starts from the absent state.
  const g = globalThis as unknown as { __quizoticLiveControl?: unknown }
  delete g.__quizoticLiveControl
})

describe('live-control client — bridge absent (test/no-custom-server)', () => {
  it('reports the bridge as unavailable', () => {
    expect(isLiveControlAvailable()).toBe(false)
  })

  it('createLiveSession returns a 503-style error', async () => {
    const result = await createLiveSession(makeCreateInput())
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/unavailable/i)
  })

  it('controlLiveSession returns an unavailable error', async () => {
    const result = await controlLiveSession({ action: 'start', gameCode: '123456', actor: 'test' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/unavailable/i)
  })

  it('snapshotLiveSession returns null (no throw)', () => {
    expect(snapshotLiveSession('123456')).toBeNull()
  })

  it('publicSnapshotLiveSession returns null (no throw)', () => {
    expect(publicSnapshotLiveSession('123456')).toBeNull()
  })

  it('sessionOwnerMatches returns false for unknown session', () => {
    expect(sessionOwnerMatches('123456', 'user_1')).toBe(false)
  })

  it('hasLiveSession returns false', () => {
    expect(hasLiveSession('123456')).toBe(false)
  })
})

describe('live-control client — bridge present (delegation wiring)', () => {
  function registerMockBridge(overrides: Partial<{
    createLiveSession: (i: CreateLiveSessionInput) => Promise<{ ok: boolean; gameCode?: string; hostResumeToken?: string; error?: string }>
    controlLiveSession: (i: { action: string; gameCode: string; actor: string }) => Promise<{ ok: boolean; status?: string; error?: string }>
    snapshotLiveSession: (code: string) => unknown
    publicSnapshotLiveSession: (code: string) => unknown
    getSessionOwner: (code: string) => string | null
    hasLiveSession: (code: string) => boolean
  }> = {}) {
    const calls = {
      createInput: null as CreateLiveSessionInput | null,
      controlInput: null as { action: string; gameCode: string; actor: string } | null,
      snapshotCode: null as string | null,
      publicSnapshotCode: null as string | null,
      ownerCode: null as string | null,
      hasCode: null as string | null,
    }
    const bridge = {
      createLiveSession: overrides.createLiveSession ?? (async (input: CreateLiveSessionInput) => {
        calls.createInput = input
        return { ok: true, gameCode: '654321', hostResumeToken: 'resume-token-abc' }
      }),
      controlLiveSession: overrides.controlLiveSession ?? (async (input: { action: string; gameCode: string; actor: string }) => {
        calls.controlInput = input
        return { ok: true, status: 'active' }
      }),
      snapshotLiveSession: overrides.snapshotLiveSession ?? ((code: string) => {
        calls.snapshotCode = code
        return { gameCode: code, phase: 'lobby' }
      }),
      publicSnapshotLiveSession: overrides.publicSnapshotLiveSession ?? ((code: string) => {
        calls.publicSnapshotCode = code
        return { gameCode: code, phase: 'lobby', connectedCount: 0 }
      }),
      getSessionOwner: overrides.getSessionOwner ?? ((code: string) => {
        calls.ownerCode = code
        return code === '654321' ? 'user_1' : null
      }),
      hasLiveSession: overrides.hasLiveSession ?? ((code: string) => {
        calls.hasCode = code
        return code === '654321'
      }),
    }
    ;(globalThis as unknown as { __quizoticLiveControl: typeof bridge }).__quizoticLiveControl = bridge
    return { calls }
  }

  it('reports the bridge as available', () => {
    registerMockBridge()
    expect(isLiveControlAvailable()).toBe(true)
  })

  it('createLiveSession forwards the input and returns the bridge result', async () => {
    const { calls } = registerMockBridge()
    const input = makeCreateInput()
    const result = await createLiveSession(input)
    expect(result.ok).toBe(true)
    expect(result.gameCode).toBe('654321')
    expect(result.hostResumeToken).toBe('resume-token-abc')
    expect(calls.createInput).toEqual(input)
  })

  it('createLiveSession surfaces bridge errors verbatim', async () => {
    registerMockBridge({
      createLiveSession: async () => ({ ok: false, error: 'Server capacity reached.' }),
    })
    const result = await createLiveSession(makeCreateInput())
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Server capacity reached.')
  })

  it('controlLiveSession forwards action, gameCode, actor', async () => {
    const { calls } = registerMockBridge()
    const result = await controlLiveSession({ action: 'next', gameCode: '654321', actor: 'http:test' })
    expect(result.ok).toBe(true)
    expect(calls.controlInput).toEqual({ action: 'next', gameCode: '654321', actor: 'http:test' })
  })

  it('snapshotLiveSession forwards the code', () => {
    const { calls } = registerMockBridge()
    const snap = snapshotLiveSession('654321')
    expect(snap).not.toBeNull()
    expect(calls.snapshotCode).toBe('654321')
  })

  it('publicSnapshotLiveSession forwards the code', () => {
    const { calls } = registerMockBridge()
    const snap = publicSnapshotLiveSession('654321')
    expect(snap).not.toBeNull()
    expect(calls.publicSnapshotCode).toBe('654321')
  })

  it('sessionOwnerMatches returns true only when owner equals the userId', () => {
    registerMockBridge() // owner of '654321' is 'user_1'
    expect(sessionOwnerMatches('654321', 'user_1')).toBe(true)
    expect(sessionOwnerMatches('654321', 'user_2')).toBe(false) // foreign
    expect(sessionOwnerMatches('000000', 'user_1')).toBe(false) // unknown
  })

  it('hasLiveSession forwards to the bridge', () => {
    registerMockBridge()
    expect(hasLiveSession('654321')).toBe(true)
    expect(hasLiveSession('000000')).toBe(false)
  })
})

// ─── helpers ────────────────────────────────────────────────────────────
function makeCreateInput(): CreateLiveSessionInput {
  return {
    userId: 'user_1',
    quizData: { id: 'quiz_1', title: 'Test quiz', questions: [{ type: 'mcq', text: 'Q1' }] },
    primaryHostSocketId: null,
  }
}
