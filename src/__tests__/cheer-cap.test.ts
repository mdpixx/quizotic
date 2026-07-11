// Capped cheer replay — guards the 2026-07 finale fix where the winner podium
// applause used to loop forever (playCheerLoop, el.loop=true) and droned on for
// the entire time the podium was on screen. playCheerTimes now plays the clip a
// fixed number of times via armCappedReplay, then detaches. This tests the pure
// scheduler (the vitest env is node — no real HTMLAudioElement).

import { describe, it, expect } from 'vitest'
import { armCappedReplay, type CheerAudioLike } from '../lib/sounds'

function makeFakeAudio() {
  const listeners: Array<() => void> = []
  let playCount = 0
  const el: CheerAudioLike & { fireEnded: () => void; playCount: () => number; endedListenerCount: () => number } = {
    currentTime: 0,
    play: () => { playCount++ },
    addEventListener: (_type, handler) => { listeners.push(handler) },
    removeEventListener: (_type, handler) => {
      const i = listeners.indexOf(handler)
      if (i >= 0) listeners.splice(i, 1)
    },
    fireEnded: () => listeners.slice().forEach(h => h()),
    playCount: () => playCount,
    endedListenerCount: () => listeners.length,
  }
  return el
}

describe('armCappedReplay', () => {
  it('replays until the clip has played `count` times total, then detaches', () => {
    const el = makeFakeAudio()
    // Caller triggers play #1 (not counted here). Arm for 2 total plays.
    armCappedReplay(el, 2)
    expect(el.endedListenerCount()).toBe(1)

    // First `ended` → one replay (play #2).
    el.fireEnded()
    expect(el.playCount()).toBe(1) // one replay call
    expect(el.endedListenerCount()).toBe(1) // still armed

    // Second `ended` → cap reached, no replay, listener detached.
    el.fireEnded()
    expect(el.playCount()).toBe(1) // no additional replay
    expect(el.endedListenerCount()).toBe(0) // detached — no infinite loop
  })

  it('count=1 never replays (single play, immediate detach)', () => {
    const el = makeFakeAudio()
    armCappedReplay(el, 1)
    el.fireEnded()
    expect(el.playCount()).toBe(0)
    expect(el.endedListenerCount()).toBe(0)
  })

  it('a stray extra `ended` after the cap does nothing (no runaway replays)', () => {
    const el = makeFakeAudio()
    armCappedReplay(el, 2)
    el.fireEnded() // replay to #2
    el.fireEnded() // cap → detach
    // Handler is detached, so any later ended is ignored by definition.
    expect(el.endedListenerCount()).toBe(0)
    expect(el.playCount()).toBe(1)
  })

  it('the returned handler is the one registered (detachable early by stopCheer)', () => {
    const el = makeFakeAudio()
    const handler = armCappedReplay(el, 3)
    expect(el.endedListenerCount()).toBe(1)
    el.removeEventListener('ended', handler)
    expect(el.endedListenerCount()).toBe(0)
    // After early detach, an `ended` can't rearm anything.
    el.fireEnded()
    expect(el.playCount()).toBe(0)
  })
})
