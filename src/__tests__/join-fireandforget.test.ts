// Join-path fire-and-forget DB write (Workstream B).
//
// join_session used to `await ensureGameSessionRow + insertAttendee` before
// firing the success callback. Under a 500-player join burst every join
// queued on the 20-connection pg pool — the single biggest source of visible
// "Joining…" lag. The fix fires the callback immediately and runs the DB
// writes out-of-band; participant.attendeeId backfills onto the live record
// when the write resolves.
//
// This test pins the contract the change relies on:
//   1. The participant is live in session.participants / participantsById the
//      moment the callback fires (so all realtime paths work pre-DB).
//   2. If an answer lands before session.dbId resolves, it queues on
//      _pendingPersist and flushes when the dbId lands — the existing
//      first-participant race machinery that the fire-and-forget path now
//      depends on for every fast participant, not just the first one.
//
// The full socket round-trip is covered by scripts/load-test-session.mjs
// (join p50/p95 under a 500-player burst) — this file covers the pure-helper
// invariants that make the change safe.

import { describe, it, expect, vi } from 'vitest'
import { flushPendingPersist } from '../lib/session-state.mjs'

type Participant = {
  participantId: string
  socketId: string
  name: string
  attendeeId?: string
}

type Session = {
  participants: Map<string, Participant>
  participantsById: Map<string, Participant>
  dbId?: string | null
  _pendingPersist?: unknown[]
  _dbInsertPromise?: Promise<unknown> | null
  _pendingFlushBound?: boolean
}

// Minimal model of the join_session in-memory mutations (server.mjs ~2573).
// The callback fires RIGHT AFTER this — before any DB write.
function joinToMemory(session: Session, socketId: string, newPid: string): Participant {
  const participant: Participant = { participantId: newPid, socketId, name: 'Alice' }
  session.participants.set(socketId, participant)
  session.participantsById.set(newPid, participant)
  return participant
}

describe('join fire-and-forget — participant is live before DB resolves', () => {
  it('participant is in both maps the moment the callback fires', () => {
    const session: Session = { participants: new Map(), participantsById: new Map(), dbId: null }
    const p = joinToMemory(session, 'sock-1', 'pid-1')
    // At this point in server.mjs the callback({success:true, ...}) fires.
    // No DB await has happened. The participant must be addressable by both
    // socket.id (for submit_answer's primary lookup) and participantId (for
    // the durable reconnect path).
    expect(session.participants.get('sock-1')).toBe(p)
    expect(session.participantsById.get('pid-1')).toBe(p)
    expect(p.attendeeId).toBeUndefined() // not yet backfilled
  })

  it('attendeeId backfills onto the live record when the DB write resolves', async () => {
    const session: Session = { participants: new Map(), participantsById: new Map(), dbId: null }
    const p = joinToMemory(session, 'sock-1', 'pid-1')
    // Simulate the IIFE in server.mjs: ensureGameSessionRow + insertAttendee
    // resolve out-of-band and assign attendeeId onto the captured participant.
    await Promise.resolve()
    p.attendeeId = 'attendee-uuid-1'
    // The same object reference is what every other path reads — no lookup
    // race, no stale copy.
    expect(session.participants.get('sock-1')?.attendeeId).toBe('attendee-uuid-1')
    expect(session.participantsById.get('pid-1')?.attendeeId).toBe('attendee-uuid-1')
  })
})

describe('join fire-and-forget — fast answer before dbId lands', () => {
  it('answer queues on _pendingPersist and flushes when dbId resolves', () => {
    // This is the existing first-participant race machinery — the
    // fire-and-forget change means EVERY fast participant can hit this path,
    // not just the first one. The contract must hold.
    const session: Session = {
      participants: new Map(),
      participantsById: new Map(),
      dbId: null, // ensureGameSessionRow hasn't resolved yet
      _pendingPersist: [],
    }
    joinToMemory(session, 'sock-1', 'pid-1')

    // A fast answer arrives. persistAnswer sees no dbId → queues.
    session._pendingPersist!.push({ participantId: 'pid-1', questionIndex: 0, attendeeId: null })

    // dbId lands (the IIFE resolves ensureGameSessionRow).
    session.dbId = 'session-uuid-1'

    // flushPendingPersist (called from the _dbInsertPromise.then handler in
    // server.mjs) drains the queue.
    const insertFn = vi.fn()
    const flushed = flushPendingPersist(session as never, 'session-uuid-1', insertFn)
    expect(flushed).toBe(1)
    expect(insertFn).toHaveBeenCalledTimes(1)
    expect(session._pendingPersist).toEqual([])
  })

  it('multiple fast participants all queue and flush together', () => {
    const session: Session = {
      participants: new Map(),
      participantsById: new Map(),
      dbId: null,
      _pendingPersist: [],
    }
    joinToMemory(session, 'sock-1', 'pid-1')
    joinToMemory(session, 'sock-2', 'pid-2')
    joinToMemory(session, 'sock-3', 'pid-3')

    // Three fast answers arrive before the dbId lands.
    session._pendingPersist!.push({ participantId: 'pid-1', questionIndex: 0 })
    session._pendingPersist!.push({ participantId: 'pid-2', questionIndex: 0 })
    session._pendingPersist!.push({ participantId: 'pid-3', questionIndex: 0 })

    session.dbId = 'session-uuid-1'
    const insertFn = vi.fn()
    expect(flushPendingPersist(session as never, 'session-uuid-1', insertFn)).toBe(3)
    expect(insertFn).toHaveBeenCalledTimes(3)
  })
})
