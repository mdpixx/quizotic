// Session persistence tests — guard the serialize ⇆ deserialize round-trip that
// lets a restarted server rehydrate live sessions from Redis instead of dropping
// every in-flight game ("Game not found"). The store I/O is thin; the risk is in
// the pure transform handling Maps/Sets, dropping runtime handles, and marking
// participants offline until they reconnect.

import { describe, expect, it } from 'vitest'
import {
  serializeSession,
  deserializeSession,
  serializeParticipant,
} from '../lib/session-state.mjs'

type AnySession = Record<string, unknown>

function makeLiveSession(): AnySession {
  const p1 = {
    participantId: 'pid-1',
    socketId: 'sock-1',
    name: 'Fox',
    realName: 'Asha',
    archetype: 'fox',
    score: 300,
    answers: [{ index: 0, correct: true }],
    team: { index: 0, name: 'Red', color: '#EF4444' },
    joinedAt: new Date('2026-07-06T10:00:00.000Z'),
    attendeeId: 'att-1',
  }
  const p2 = {
    participantId: 'pid-2',
    socketId: 'sock-2',
    name: 'Owl',
    realName: 'Ravi',
    archetype: 'owl',
    score: 150,
    answers: [],
    team: null,
    joinedAt: new Date('2026-07-06T10:01:00.000Z'),
  }
  return {
    hostSocketId: 'host-sock',
    hostSocketIds: new Set(['host-sock']),
    hostResumeToken: 'tok-abc',
    quizData: { id: 'quiz-1', title: 'Physics', questions: [{ q: 'a' }, { q: 'b' }] },
    currentQuestionIndex: 1,
    participants: new Map([
      ['sock-1', p1],
      ['sock-2', p2],
    ]),
    participantsById: new Map([
      ['pid-1', p1],
      ['pid-2', p2],
    ]),
    status: 'active',
    sessionMode: 'competitive',
    scoringFormula: 'classic',
    teamMode: true,
    teamCount: 2,
    teamNames: ['Red', 'Blue'],
    teamJoinCounter: 2,
    blockedParticipantIds: new Set(['pid-kicked']),
    previousRanks: new Map([['pid-1', 1]]),
    playedQuestionIndexes: new Set([0, 1]),
    userId: 'user-1',
    startedAt: 1751795000000,
    // Runtime handles that must never be persisted:
    endTimer: setTimeout(() => {}, 60000),
    _stateBroadcastTimer: setInterval(() => {}, 5000),
    _dbInsertPromise: Promise.resolve('db-1'),
  }
}

describe('serializeSession / deserializeSession', () => {
  it('produces a JSON-safe object (no throw, no runtime handles)', () => {
    const s = makeLiveSession()
    const serialized = serializeSession(s)
    // Must survive JSON.stringify — that is what the store writes to Redis.
    expect(() => JSON.stringify(serialized)).not.toThrow()
    const json = JSON.parse(JSON.stringify(serialized))
    expect(json.endTimer).toBeUndefined()
    expect(json._stateBroadcastTimer).toBeUndefined()
    expect(json._dbInsertPromise).toBeUndefined()
    expect(json.hostSocketId).toBeUndefined()
    expect(json.hostSocketIds).toBeUndefined()
  })

  it('round-trips core game state losslessly', () => {
    const s = makeLiveSession()
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession

    expect(restored.status).toBe('active')
    expect(restored.currentQuestionIndex).toBe(1)
    expect(restored.hostResumeToken).toBe('tok-abc')
    expect(restored.teamMode).toBe(true)
    expect(restored.teamJoinCounter).toBe(2)
    expect((restored.quizData as { title: string }).title).toBe('Physics')
  })

  it('rebuilds Maps and Sets', () => {
    const s = makeLiveSession()
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession

    expect(restored.participants).toBeInstanceOf(Map)
    expect(restored.participantsById).toBeInstanceOf(Map)
    expect(restored.blockedParticipantIds).toBeInstanceOf(Set)
    expect(restored.previousRanks).toBeInstanceOf(Map)
    expect(restored.playedQuestionIndexes).toBeInstanceOf(Set)

    expect((restored.blockedParticipantIds as Set<string>).has('pid-kicked')).toBe(true)
    expect((restored.playedQuestionIndexes as Set<number>).has(1)).toBe(true)
    expect((restored.previousRanks as Map<string, number>).get('pid-1')).toBe(1)
  })

  it('preserves participants and their scores/answers, keyed by old socket id', () => {
    const s = makeLiveSession()
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession
    const participants = restored.participants as Map<string, { score: number; answers: unknown[] }>
    const byId = restored.participantsById as Map<string, { score: number }>

    expect(participants.size).toBe(2)
    // Keyed by the old socket id so the reconnect path (which evicts by
    // existing.socketId) rebinds cleanly on the new socket.
    expect(participants.get('sock-1')?.score).toBe(300)
    expect(participants.get('sock-1')?.answers.length).toBe(1)
    expect(byId.get('pid-2')?.score).toBe(150)
  })

  it('shares the same object between participants and participantsById', () => {
    const s = makeLiveSession()
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession
    const bySocket = (restored.participants as Map<string, object>).get('sock-1')
    const byId = (restored.participantsById as Map<string, object>).get('pid-1')
    // Reconnect logic mutates one and expects the other to see it.
    expect(bySocket).toBe(byId)
  })

  it('marks real participants offline until they reconnect', () => {
    const s = makeLiveSession()
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession
    const participants = restored.participants as Map<string, { disconnectedAt?: number }>
    // Old sockets died with the previous process — everyone is offline until a
    // participantId reconnect clears the flag (getConnectedCount honours this).
    expect(participants.get('sock-1')?.disconnectedAt).toBeTypeOf('number')
    expect(participants.get('sock-2')?.disconnectedAt).toBeTypeOf('number')
  })

  it('resets ephemeral host bindings and timers', () => {
    const s = makeLiveSession()
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession
    expect(restored.hostSocketId).toBeNull()
    expect(restored.hostSocketIds).toBeInstanceOf(Set)
    expect((restored.hostSocketIds as Set<string>).size).toBe(0)
    expect(restored.endTimer).toBeNull()
    expect(restored._stateBroadcastTimer).toBeNull()
    expect(restored.disconnectedParticipants).toBeInstanceOf(Map)
  })

  it('does not flag ghost players as disconnected', () => {
    const ghost = { name: '👻 Ghost', archetype: 'ghost', score: 0 }
    const s: AnySession = {
      status: 'active',
      quizData: { id: 'q', title: 't', questions: [] },
      participants: new Map<string, object>([['ghost::0', ghost]]),
    }
    const restored = deserializeSession(JSON.parse(JSON.stringify(serializeSession(s)))) as AnySession
    const participants = restored.participants as Map<string, { disconnectedAt?: number }>
    expect(participants.has('ghost::0')).toBe(true)
    expect(participants.get('ghost::0')?.disconnectedAt).toBeUndefined()
  })

  it('serializeParticipant converts joinedAt Date to ISO string', () => {
    const out = serializeParticipant({ participantId: 'p', joinedAt: new Date('2026-07-06T10:00:00.000Z') })
    expect(out.joinedAt).toBe('2026-07-06T10:00:00.000Z')
  })

  it('handles null/empty inputs safely', () => {
    expect(serializeSession(null)).toBeNull()
    expect(deserializeSession(null)).toBeNull()
    const empty = deserializeSession(serializeSession({ status: 'lobby', participants: new Map() })) as AnySession
    expect((empty.participants as Map<string, unknown>).size).toBe(0)
  })
})
