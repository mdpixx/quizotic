// answer_received coalescing (Workstream C).
//
// server.mjs collapses a burst of N submit_answer calls into ~1 host emit
// per ANSWER_RECEIVED_COALESCE_MS window via scheduleAnswerReceivedEmit. The
// host UI converges to the same final state either way — it just gets there
// with one re-render per window instead of N per answer.
//
// This file tests the coalescing CONTRACT in isolation by replicating the
// tiny state machine (pending payload + timer) the server uses. The real
// helper in server.mjs is exercised end-to-end by scripts/load-test-session.mjs
// (which measures answer-ack p95 under a 500-player burst).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mirror of the server.mjs coalesce state machine, pared to its essence.
// The mock io.to(room).emit(event, payload) is what the simulation drives.
const COALESCE_MS = 150

type Payload = { count: number; questionIndex: number }
type Pending = { gameCode: string; payload: Payload } | null
type EmitFn = (event: string, payload: Payload) => void

function makeCoalescer(emitFn: EmitFn) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: Pending = null
  const io = {
    to: (_room: string) => ({ emit: emitFn }), // eslint-disable-line @typescript-eslint/no-unused-vars
  }

  function schedule(gameCode: string, payload: Payload) {
    if (!pending) pending = { gameCode, payload }
    else pending.payload = payload
    if (timer) return
    timer = setTimeout(() => {
      const p = pending
      pending = null
      timer = null
      if (!p) return
      io.to(`host:${p.gameCode}`).emit('answer_received', p.payload)
    }, COALESCE_MS)
  }

  function flushNow() {
    if (!timer) return
    clearTimeout(timer)
    timer = null
    const p = pending
    pending = null
    if (!p) return
    io.to(`host:${p.gameCode}`).emit('answer_received', p.payload)
  }

  return { schedule, flushNow }
}

describe('answer_received coalescing', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('collapses a synchronous burst of N answers into ONE emit', () => {
    const emit = vi.fn()
    const c = makeCoalescer(emit)

    // 100 answers arrive in the same tick (a 100-player classroom answering).
    for (let i = 0; i < 100; i++) {
      c.schedule('GAME01', { count: i + 1, questionIndex: 0 })
    }
    expect(emit).not.toHaveBeenCalled() // still inside the window

    vi.advanceTimersByTime(COALESCE_MS)
    expect(emit).toHaveBeenCalledTimes(1)
    // Final payload reflects the LAST count, not the first — host converges.
    expect(emit).toHaveBeenCalledWith('answer_received', { count: 100, questionIndex: 0 })
  })

  it('emits the latest payload (host converges to final state)', () => {
    const emit = vi.fn()
    const c = makeCoalescer(emit)

    c.schedule('GAME01', { count: 1, questionIndex: 0 })
    c.schedule('GAME01', { count: 2, questionIndex: 0 })
    c.schedule('GAME01', { count: 5, questionIndex: 0 })
    c.schedule('GAME01', { count: 42, questionIndex: 0 })

    vi.advanceTimersByTime(COALESCE_MS)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('answer_received', { count: 42, questionIndex: 0 })
  })

  it('opens a fresh window after the previous one flushes', () => {
    const emit = vi.fn()
    const c = makeCoalescer(emit)

    // First burst
    c.schedule('GAME01', { count: 1, questionIndex: 0 })
    c.schedule('GAME01', { count: 2, questionIndex: 0 })
    vi.advanceTimersByTime(COALESCE_MS)
    expect(emit).toHaveBeenCalledTimes(1)

    // Second burst arrives after the window closes — a new window opens.
    c.schedule('GAME01', { count: 3, questionIndex: 0 })
    c.schedule('GAME01', { count: 4, questionIndex: 0 })
    vi.advanceTimersByTime(COALESCE_MS)
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenLastCalledWith('answer_received', { count: 4, questionIndex: 0 })
  })

  it('flushNow emits immediately on question advance/reveal (no 150ms wait)', () => {
    const emit = vi.fn()
    const c = makeCoalescer(emit)

    c.schedule('GAME01', { count: 7, questionIndex: 0 })
    expect(emit).not.toHaveBeenCalled()
    // Question ends → reveal must see the true final tally immediately.
    c.flushNow()
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('answer_received', { count: 7, questionIndex: 0 })

    // A second flushNow with nothing pending is a no-op.
    c.flushNow()
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('flushNow clears the pending timer so no late duplicate emit fires', () => {
    const emit = vi.fn()
    const c = makeCoalescer(emit)

    c.schedule('GAME01', { count: 3, questionIndex: 0 })
    c.flushNow()
    expect(emit).toHaveBeenCalledTimes(1)

    // Advancing past the original window must NOT fire a second emit.
    vi.advanceTimersByTime(COALESCE_MS + 50)
    expect(emit).toHaveBeenCalledTimes(1)
  })
})
