// Session-store integration tests — drive the real session-store.mjs code paths
// (write-through, SCAN/MGET boot rehydration, remove, shutdown flush) against an
// in-memory fake of the ioredis surface the module uses. This covers the wiring
// the pure serialize/deserialize unit tests can't: key prefixing, SCAN cursor
// pagination, mget mapping, and the no-op behaviour when the store is disabled.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  initSessionStore,
  isSessionStoreEnabled,
  saveSession,
  removeSession,
  saveAllSessions,
  loadAllSessions,
} from '../lib/session-store.mjs'

// Minimal in-memory stand-in for the ioredis commands the store calls. SCAN
// pages one key at a time so the module's cursor loop is genuinely exercised.
function makeFakeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    async set(key: string, val: string, ...ttlArgs: unknown[]) {
      void ttlArgs // 'EX', <seconds> — accepted to match ioredis, unused here
      store.set(key, val)
      return 'OK'
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0
    },
    async scan(cursor: string, ...scanArgs: unknown[]) {
      const pattern = scanArgs[1] as string // ('MATCH', <pattern>, 'COUNT', <n>)
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
      const keys = [...store.keys()].filter((k) => regex.test(k))
      const idx = Number(cursor)
      if (idx >= keys.length) return ['0', [] as string[]]
      const next = idx + 1
      return [next >= keys.length ? '0' : String(next), [keys[idx]]]
    },
    async mget(keys: string[]) {
      return keys.map((k) => store.get(k) ?? null)
    },
  }
}

function makeSession(status = 'active') {
  const p = {
    participantId: 'pid-1',
    socketId: 'sock-1',
    name: 'Fox',
    score: 250,
    answers: [],
    joinedAt: new Date('2026-07-06T10:00:00.000Z'),
  }
  return {
    hostSocketId: 'host-sock',
    hostSocketIds: new Set(['host-sock']),
    hostResumeToken: 'tok-1',
    quizData: { id: 'q1', title: 'Bio', questions: [{ q: 'a' }] },
    currentQuestionIndex: 0,
    participants: new Map([['sock-1', p]]),
    participantsById: new Map([['pid-1', p]]),
    status,
    endTimer: setTimeout(() => {}, 60000),
  }
}

describe('session-store (fake Redis)', () => {
  beforeEach(() => initSessionStore(null))

  it('is disabled and no-ops without a client', async () => {
    expect(isSessionStoreEnabled()).toBe(false)
    await expect(saveSession('123456', makeSession())).resolves.toBeUndefined()
    await expect(loadAllSessions()).resolves.toEqual([])
  })

  it('writes with the key prefix and enabled flag', async () => {
    const redis = makeFakeRedis()
    initSessionStore(redis)
    expect(isSessionStoreEnabled()).toBe(true)
    await saveSession('123456', makeSession())
    expect(redis.store.has('quizotic:session:123456')).toBe(true)
    // Runtime handles must not have blocked JSON.stringify.
    expect(JSON.parse(redis.store.get('quizotic:session:123456')!).endTimer).toBeUndefined()
  })

  it('rehydrates saved sessions via SCAN + MGET (survives a "restart")', async () => {
    const redis = makeFakeRedis()
    initSessionStore(redis)
    await saveSession('111111', makeSession())
    await saveSession('222222', makeSession())

    // Simulate a fresh process: new store binding, same Redis backing data.
    initSessionStore(redis)
    const restored = await loadAllSessions()

    expect(restored.length).toBe(2)
    const codes = restored.map(([code]) => code).sort()
    expect(codes).toEqual(['111111', '222222'])

    const [, session] = restored.find(([code]) => code === '111111')!
    expect(session.status).toBe('active')
    expect(session.participants).toBeInstanceOf(Map)
    expect(session.participants.get('sock-1')?.score).toBe(250)
    // Offline until reconnect; host binding reset.
    expect(session.participants.get('sock-1')?.disconnectedAt).toBeTypeOf('number')
    expect(session.hostSocketId).toBeNull()
  })

  it('removeSession deletes the key', async () => {
    const redis = makeFakeRedis()
    initSessionStore(redis)
    await saveSession('333333', makeSession())
    expect(redis.store.size).toBe(1)
    await removeSession('333333')
    expect(redis.store.size).toBe(0)
    await expect(loadAllSessions()).resolves.toEqual([])
  })

  it('saveAllSessions flushes live sessions and skips ended ones', async () => {
    const redis = makeFakeRedis()
    initSessionStore(redis)
    const entries = new Map([
      ['aaaaaa', makeSession('active')],
      ['bbbbbb', makeSession('lobby')],
      ['cccccc', makeSession('ended')],
    ]).entries()

    const flushed = await saveAllSessions(entries)
    expect(flushed).toBe(2)
    expect(redis.store.has('quizotic:session:aaaaaa')).toBe(true)
    expect(redis.store.has('quizotic:session:bbbbbb')).toBe(true)
    expect(redis.store.has('quizotic:session:cccccc')).toBe(false)
  })
})
