// Participant lifecycle tests — guards against the regression where:
//   1. The host counter does not decrement when a participant disconnects.
//   2. The host counter inflates when a participant rejoins.
//   3. A participant's answer is silently dropped when the in-flight DB
//      session row hasn't landed yet (first-participant race).
//
// Helpers are unit-tested in isolation; full socket round-trips are covered
// by the manual two-tab smoke test in the plan's verification section.

import { describe, expect, it, vi } from 'vitest'
import {
  buildSessionStateSnapshot,
  findDisconnectedEntry,
  flushPendingPersist,
  getConnectedCount,
  reconnectFromDisconnected,
} from '../lib/session-state.mjs'

type Participant = {
  participantId: string
  socketId: string
  name: string
  realName?: string
  archetype?: string
  score?: number
  team?: { index: number; name: string; color: string } | null
  disconnectedAt?: number
  disconnectedSocketId?: string
  answers?: Record<number, unknown>
}

type Session = {
  participants: Map<string, Participant>
  participantsById?: Map<string, Participant>
  disconnectedParticipants?: Map<string, { socketId: string; participant: Participant; gameCode: string }>
  _pendingPersist?: unknown[]
  currentQuestionIndex?: number
}

function makeSession(): Session {
  return {
    participants: new Map(),
    participantsById: new Map(),
    disconnectedParticipants: new Map(),
  }
}

function addParticipant(session: Session, p: Partial<Participant> & { participantId: string; socketId: string; name: string }): Participant {
  const full: Participant = { score: 0, ...p }
  session.participants.set(full.socketId, full)
  session.participantsById!.set(full.participantId, full)
  return full
}

// Mirror of the disconnect bookkeeping inside server.mjs — moves the
// participant into the disconnected map and stamps disconnectedAt so
// getConnectedCount excludes them.
function disconnectParticipant(session: Session, socketId: string, gameCode = 'TEST01') {
  const p = session.participants.get(socketId)
  if (!p) return
  p.disconnectedAt = Date.now()
  p.disconnectedSocketId = socketId
  session.disconnectedParticipants!.set(p.name.toLowerCase(), { socketId, participant: p, gameCode })
}

describe('getConnectedCount', () => {
  it('counts only currently connected participants', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice' })
    addParticipant(s, { participantId: 'p2', socketId: 's2', name: 'Bob' })
    expect(getConnectedCount(s)).toBe(2)
  })

  it('drops on disconnect (the bug-B regression case)', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice' })
    addParticipant(s, { participantId: 'p2', socketId: 's2', name: 'Bob' })
    disconnectParticipant(s, 's2')
    expect(getConnectedCount(s)).toBe(1)
  })

  it('excludes ghost players', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice' })
    s.participants.set('ghost::0', { participantId: 'g0', socketId: 'ghost::0', name: '👻 Past' })
    expect(getConnectedCount(s)).toBe(1)
  })

  it('handles empty / missing sessions gracefully', () => {
    expect(getConnectedCount(null as unknown as Session)).toBe(0)
    expect(getConnectedCount(undefined as unknown as Session)).toBe(0)
    expect(getConnectedCount({ participants: new Map() } as Session)).toBe(0)
  })
})

describe('buildSessionStateSnapshot', () => {
  it('partitions active vs disconnected and reports connectedCount', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice', archetype: 'Fox' })
    addParticipant(s, { participantId: 'p2', socketId: 's2', name: 'Bob', archetype: 'Owl' })
    disconnectParticipant(s, 's2')
    const snap = buildSessionStateSnapshot(s)
    expect(snap.connectedCount).toBe(1)
    expect(snap.totalCount).toBe(2)
    expect(snap.active.map((p: { name: string }) => p.name)).toEqual(['Alice'])
    expect(snap.disconnected.map((p: { name: string }) => p.name)).toEqual(['Bob'])
    expect(snap.disconnected[0]).toHaveProperty('disconnectedAt')
  })

  it('returns an empty snapshot for a fresh session', () => {
    const snap = buildSessionStateSnapshot(makeSession())
    expect(snap).toEqual({ active: [], disconnected: [], connectedCount: 0, totalCount: 0, questionIndex: null })
  })

  it('flags who has answered the current question (answeredCurrent)', () => {
    const s = makeSession()
    s.currentQuestionIndex = 2
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice', answers: { 2: { answer: 'A' } } })
    addParticipant(s, { participantId: 'p2', socketId: 's2', name: 'Bob', answers: { 1: { answer: 'B' } } })
    addParticipant(s, { participantId: 'p3', socketId: 's3', name: 'Cara' })
    const snap = buildSessionStateSnapshot(s)
    const byName = Object.fromEntries(snap.active.map((p: { name: string; answeredCurrent: boolean }) => [p.name, p.answeredCurrent]))
    expect(byName).toEqual({ Alice: true, Bob: false, Cara: false })
  })

  it('answeredCurrent stays false in the lobby (no current question)', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice', answers: { 0: { answer: 'A' } } })
    const snap = buildSessionStateSnapshot(s)
    expect(snap.active[0].answeredCurrent).toBe(false)
  })
})

describe('findDisconnectedEntry — rejoin lookup robustness', () => {
  it('matches by participantId even when display name has drifted', () => {
    const s = makeSession()
    const p = addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Orange Dragon' })
    disconnectParticipant(s, 's1')
    // User reconnects under a different display name (anonymous-mode reroll
    // or localStorage tampered with) but the same participantId.
    const found = findDisconnectedEntry(s, { participantId: 'p1', displayName: 'Cyan Falcon' })
    expect(found?.entry.participant).toBe(p)
  })

  it('falls back to display-name match when participantId is absent', () => {
    const s = makeSession()
    const p = addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice' })
    disconnectParticipant(s, 's1')
    const found = findDisconnectedEntry(s, { participantId: undefined, displayName: 'Alice' })
    expect(found?.entry.participant).toBe(p)
  })

  it('returns null when neither key matches', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice' })
    disconnectParticipant(s, 's1')
    expect(findDisconnectedEntry(s, { participantId: 'nope', displayName: 'nobody' })).toBeNull()
  })
})

describe('reconnectFromDisconnected — restores identity without inflating count', () => {
  it('rebinds to a new socket without creating a duplicate participant', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice', score: 1500 })
    addParticipant(s, { participantId: 'p2', socketId: 's2', name: 'Bob' })
    disconnectParticipant(s, 's1')
    expect(getConnectedCount(s)).toBe(1) // sanity — host shows 1 player

    const found = findDisconnectedEntry(s, { participantId: 'p1', displayName: 'Alice' })
    if (!found) throw new Error('expected disconnected entry')
    const recovered = reconnectFromDisconnected(s, {
      key: found.key,
      entry: found.entry,
      newSocketId: 's1-new',
      participantId: 'p1',
    })

    // Score and identity preserved.
    expect(recovered.score).toBe(1500)
    expect(recovered.participantId).toBe('p1')
    // No double-counting: the host counter is back to 2, NOT 3.
    expect(getConnectedCount(s)).toBe(2)
    // Disconnected map drained for this participant.
    expect(s.disconnectedParticipants!.size).toBe(0)
    // participantsById still resolves the same entry.
    expect(s.participantsById!.get('p1')).toBe(recovered)
    // The old socket key is gone; the new one resolves the same record.
    expect(s.participants.get('s1')).toBeUndefined()
    expect(s.participants.get('s1-new')).toBe(recovered)
  })

  it('backfills participantId on a name-only legacy entry', () => {
    const s = makeSession()
    // Simulate a disconnected participant that was created before the
    // participantId feature shipped — name is set, but pid is empty.
    const p: Participant = { participantId: '', socketId: 's1', name: 'Alice', score: 200 }
    s.participants.set('s1', p)
    disconnectParticipant(s, 's1')

    const found = findDisconnectedEntry(s, { participantId: undefined, displayName: 'Alice' })
    if (!found) throw new Error('expected disconnected entry')
    const recovered = reconnectFromDisconnected(s, {
      key: found.key,
      entry: found.entry,
      newSocketId: 's1-new',
      participantId: 'fresh-pid',
    })
    expect(recovered.participantId).toBe('fresh-pid')
    expect(s.participantsById!.get('fresh-pid')).toBe(recovered)
  })
})

describe('flushPendingPersist — first-participant DB race', () => {
  it('flushes buffered answer payloads when the dbId finally lands', () => {
    const session = { _pendingPersist: [
      { participantId: 'p1', questionIndex: 0, answer: 'a', isCorrect: true, basePoints: 1000, streakBonus: 0, points: 1000, timeMs: 1234, confidence: 'sure', attendeeId: null },
      { participantId: 'p1', questionIndex: 1, answer: 'b', isCorrect: false, basePoints: 0, streakBonus: 0, points: 0, timeMs: 4321, confidence: 'unsure', attendeeId: null },
    ] } as unknown as Parameters<typeof flushPendingPersist>[0]
    const insertFn = vi.fn()
    const flushed = flushPendingPersist(session, 'session-uuid-1', insertFn)
    expect(flushed).toBe(2)
    expect(insertFn).toHaveBeenCalledTimes(2)
    expect(insertFn).toHaveBeenNthCalledWith(1, 'session-uuid-1', expect.objectContaining({ questionIndex: 0 }))
    expect(insertFn).toHaveBeenNthCalledWith(2, 'session-uuid-1', expect.objectContaining({ questionIndex: 1 }))
    // After flush the queue is drained — a second call is a no-op.
    expect(flushPendingPersist(session, 'session-uuid-1', insertFn)).toBe(0)
  })

  it('is a no-op when no pending writes', () => {
    const session = {} as unknown as Parameters<typeof flushPendingPersist>[0]
    expect(flushPendingPersist(session, 'x', vi.fn())).toBe(0)
  })

  it('is a no-op when sessionDbId is still missing', () => {
    const session = { _pendingPersist: [{ participantId: 'p1', questionIndex: 0 }] } as unknown as Parameters<typeof flushPendingPersist>[0]
    const insertFn = vi.fn()
    expect(flushPendingPersist(session, '', insertFn)).toBe(0)
    expect(insertFn).not.toHaveBeenCalled()
  })
})

describe('end-to-end sequence: disconnect → rejoin (no inflation)', () => {
  it('models the regression scenario: 2 join, 1 drops, 1 rejoins → still 2', () => {
    const s = makeSession()
    addParticipant(s, { participantId: 'p1', socketId: 's1', name: 'Alice', score: 800 })
    addParticipant(s, { participantId: 'p2', socketId: 's2', name: 'Bob', score: 600 })
    expect(getConnectedCount(s)).toBe(2)

    // Alice's mobile screen locks — socket drops.
    disconnectParticipant(s, 's1')
    expect(getConnectedCount(s)).toBe(1)
    const snapDuringDisconnect = buildSessionStateSnapshot(s)
    expect(snapDuringDisconnect.connectedCount).toBe(1)
    expect(snapDuringDisconnect.totalCount).toBe(2)

    // Alice unlocks; reconnect handshake brings localStorage participantId.
    const found = findDisconnectedEntry(s, { participantId: 'p1', displayName: 'Alice' })
    if (!found) throw new Error('expected disconnected entry')
    reconnectFromDisconnected(s, { key: found.key, entry: found.entry, newSocketId: 's1-new', participantId: 'p1' })
    expect(getConnectedCount(s)).toBe(2)
    // Participants map size reflects truth — no phantom third entry.
    expect(s.participants.size).toBe(2)
    // Score preserved across the reconnect.
    expect(s.participantsById!.get('p1')!.score).toBe(800)
  })
})
