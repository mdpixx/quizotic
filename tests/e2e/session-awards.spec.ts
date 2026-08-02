// End-of-session awards — transport contract test.
//
// The allocation logic itself is unit-tested in src/__tests__/session-awards.test.ts.
// What THAT cannot cover is the wiring: whether the awards actually reach the
// two surfaces that show them. Three things can silently break without a single
// unit test failing —
//   1. `classAwards` missing from a session_ended emit site (there are three,
//      and a change that updates only one leaves the finale blank on the others),
//   2. `your_award` never emitted, so every participant's end screen is bare,
//   3. answers never reaching participant.answers[], so awards compute on empty
//      logs and the ladder silently floors everyone to "Finisher".
//
// Driven over raw Socket.IO rather than browsers for the same reasons as
// live-quiz-flow.spec.ts: this is server logic, and socket frames exercise it
// in seconds without Turbopack/CSP flake.
//
// The four players answer in deliberately DIFFERENT shapes so the allocation has
// something real to spread across — a room where everyone performs identically
// would pass a weaker version of this test while proving nothing.

import { test, expect } from '@playwright/test'
import { io as ioConnect, Socket } from 'socket.io-client'
import { hostAuthCookie } from './socket-auth'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

const AWARDS_QUIZ = {
  title: 'E2E Awards',
  questions: [0, 1, 2, 3].map(i => ({
    id: `q${i}`,
    type: 'mcq',
    text: `E2E awards Q${i + 1} — pick option B`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: '1', // index 1
    timerSeconds: 600, // long, so nothing auto-ends mid-test
    points: 1000,
  })),
}

const CORRECT = 1
const WRONG = 0

// Answer shapes per player, one entry per question. `null` = don't answer.
const PLAYERS: { name: string; answers: (number | null)[]; timeMs: number }[] = [
  // Perfect and fast — would sweep every award if allocation were threshold-based.
  { name: 'Ace', answers: [CORRECT, CORRECT, CORRECT, CORRECT], timeMs: 900 },
  // Long run then a miss — the true "On Fire" holder once Ace is taken.
  { name: 'Bea', answers: [CORRECT, CORRECT, CORRECT, WRONG], timeMs: 3_000 },
  // Accurate but slow, and answered everything.
  { name: 'Cal', answers: [CORRECT, WRONG, CORRECT, CORRECT], timeMs: 6_000 },
  // Struggled, but stayed to the end — must still get a personal badge.
  { name: 'Dev', answers: [WRONG, WRONG, WRONG, WRONG], timeMs: 9_000 },
]

function connectSocket(cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioConnect(baseURL, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
    })
    const t = setTimeout(() => { s.disconnect(); reject(new Error('socket connect timeout')) }, 10_000)
    s.on('connect', () => { clearTimeout(t); resolve(s) })
    s.on('connect_error', err => { clearTimeout(t); reject(new Error(`connect_error: ${err.message}`)) })
  })
}

function emitWithAck<T>(socket: Socket, event: string, payload: unknown, timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} ack timeout`)), timeoutMs)
    socket.emit(event, payload, (res: T) => { clearTimeout(t); resolve(res) })
  })
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event ${event} did not arrive within ${timeoutMs}ms`)), timeoutMs)
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload) })
  })
}

interface ClassAward { key: string; icon: string; label: string; winner: string; detail: string }
interface Badge { key: string; icon: string; label: string; detail: string }

test.describe('End-of-session awards', () => {
  test('class awards reach the host and every player gets a personal badge', async () => {
    const host = await connectSocket(await hostAuthCookie())
    const sockets: Socket[] = []

    try {
      const created = await emitWithAck<{ success: boolean; gameCode?: string }>(
        host, 'create_session', { quizData: AWARDS_QUIZ },
      )
      expect(created.success).toBe(true)
      const gameCode = created.gameCode!

      // ── Join all four ──
      const ids: string[] = []
      for (const player of PLAYERS) {
        const s = await connectSocket()
        sockets.push(s)
        const joined = await emitWithAck<{ success: boolean; participantId?: string }>(
          s, 'join_session', { gameCode, displayName: player.name },
        )
        expect(joined.success).toBe(true)
        ids.push(joined.participantId!)
      }

      // Both events fire once, at end_session. Buffer them from now rather than
      // awaiting a promise with a deadline: the question loop below takes ~20s,
      // so a timeout armed here would expire before the quiz even finished and
      // report a missing event that was never sent yet.
      const badges: Badge[] = []
      sockets.forEach(s => s.on('your_award', (b: Badge) => badges.push(b)))
      let endedPayload: { classAwards?: ClassAward[] } | null = null
      host.on('session_ended', (p: { classAwards?: ClassAward[] }) => { endedPayload = p })

      // ── Play every question ──
      for (let q = 0; q < AWARDS_QUIZ.questions.length; q++) {
        const shown = waitForEvent<{ index: number }>(sockets[0], 'question_show', 10_000)
        if (q === 0) host.emit('start_quiz', { gameCode })
        else host.emit('next_question', { gameCode })
        await shown
        // Server holds a ~3.5s "get ready" countdown before accepting answers.
        await new Promise(r => setTimeout(r, 4_000))

        for (let i = 0; i < PLAYERS.length; i++) {
          const choice = PLAYERS[i].answers[q]
          if (choice === null) continue
          await emitWithAck<{ accepted: boolean }>(sockets[i], 'submit_answer', {
            gameCode,
            participantId: ids[i],
            answer: choice,
            timeMs: PLAYERS[i].timeMs,
            confidence: 'sure',
            serverSubmittedAt: Date.now(),
          }, 6_000)
        }
        host.emit('end_question', { gameCode })
        await new Promise(r => setTimeout(r, 700))
      }

      host.emit('end_session', { gameCode })

      // Now the deadline is meaningful — everything below is emitted in
      // response to end_session, which has just been sent.
      const deadline = Date.now() + 12_000
      while (Date.now() < deadline && (!endedPayload || badges.length < PLAYERS.length)) {
        await new Promise(r => setTimeout(r, 200))
      }

      // ── 1. Class awards reached the host ──
      expect(endedPayload, 'host never received session_ended').toBeTruthy()
      const awards = (endedPayload as { classAwards?: ClassAward[] } | null)?.classAwards ?? []
      expect(awards.length, 'session_ended carried no classAwards').toBeGreaterThan(0)

      for (const a of awards) {
        expect(a.key).toBeTruthy()
        expect(a.label).toBeTruthy()
        expect(a.winner).toBeTruthy()
        expect(a.detail).toBeTruthy()
      }

      // ── 2. The allocation spread across distinct people ──
      // This is the whole point of the feature: Ace answered everything
      // correctly and fastest, so threshold-based scoring would hand him
      // Flawless + On Fire + Quickest and name two fewer people.
      const winners = awards.map(a => a.winner)
      expect(new Set(winners).size, `awards repeated a winner: ${winners.join(', ')}`).toBe(winners.length)
      expect(winners).toContain('Ace')
      expect(awards.filter(a => a.winner === 'Ace')).toHaveLength(1)

      // ── 3. Everyone got a personal badge, including the player who got
      //       every question wrong. The ladder's floor is the reason the
      //       screen replaced a bare rank in the first place.
      expect(badges, `only ${badges.length} of ${PLAYERS.length} players got a badge`).toHaveLength(PLAYERS.length)
      for (const b of badges) {
        expect(b.label, 'a participant received an empty badge').toBeTruthy()
        expect(b.detail).toBeTruthy()
        expect(b.icon).toBeTruthy()
      }

      // Someone won the room, so exactly one champion tier was handed out —
      // which also proves answers actually landed in participant.answers[]
      // rather than everyone silently flooring to "Finisher" on an empty log.
      expect(badges.filter(b => b.key === 'champion')).toHaveLength(1)
    } finally {
      host.disconnect()
      for (const s of sockets) s.disconnect()
    }
  })
})

// ── Podium must survive the awards trigger ─────────────────────────────────
// REGRESSION: the Class Awards button was first placed inside the finale hero,
// which is lg:h-[calc(100dvh-56px)] with the podium card claiming the remainder
// as flex-1. The button's ~70px of flow shortened the card past its 29px of
// slack at 1440x800 and clipped the bottom off the podium bars — reported from
// a screenshot, not caught by any test. The trigger now lives in
// PostSessionHeader, outside that height calculation.
//
// No questions are played: podium bar heights are fixed constants (210/150/100
// in PODIUM_CONFIG), not derived from scores, so an unplayed session exercises
// the identical layout in a fraction of the time. Asserted on geometry rather
// than on where the button sits, so ANY future finale element that eats the
// podium's height fails here too.
test.describe('Finale layout', () => {
  test.setTimeout(90_000)

  test('podium bars rank tallest-to-shortest and are not clipped by the card', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 800 } })
    const cookie = await hostAuthCookie()
    const eq = cookie.indexOf('=')
    await ctx.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: baseURL }])
    const page = await ctx.newPage()
    await page.addInitScript(q => localStorage.setItem('quizotic_active_session', JSON.stringify(q)), {
      ...AWARDS_QUIZ, id: `pod-${Date.now()}`, subject: 'e2e', language: 'en',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    await page.goto('/host/session?preview=host-stage')
    await page.getByRole('button', { name: 'Start lobby' }).click()
    await expect(page.getByRole('button', { name: /Start Quiz/ })).toBeVisible({ timeout: 20_000 })
    const pin = (await page.locator('p.select-all').first().innerText()).trim()

    // Three players so the podium has all three tiers to render.
    const socks: Socket[] = []
    for (const p of PLAYERS.slice(0, 3)) {
      const s = await connectSocket()
      socks.push(s)
      await emitWithAck(s, 'join_session', { gameCode: pin, displayName: p.name })
    }

    try {
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /Start Quiz/ }).click()
      await expect(page.locator('.host-question-card')).toBeVisible({ timeout: 15_000 })

      // Straight to the finale — the bars do not care what anyone scored.
      const hostSock = await connectSocket(await hostAuthCookie())
      socks.push(hostSock)
      await page.waitForTimeout(1500)
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /More options/.test(b.getAttribute('aria-label') || ''))
        btn?.click()
      })
      await page.getByRole('menuitem', { name: 'End Quiz' }).click().catch(() => {})
      const confirmEnd = page.getByRole('button', { name: /End (quiz|session|now)/i }).last()
      if (await confirmEnd.isVisible({ timeout: 2_000 }).catch(() => false)) await confirmEnd.click().catch(() => {})

      // .first() — the header subtitle also reads "Session complete".
      await expect(page.getByRole('heading', { name: 'Session Complete' }).first()).toBeVisible({ timeout: 20_000 })

      // The winner's bar only starts rising at 7.8s and takes 2.8s. Measuring
      // before that reads the GOLD bar as the shortest — exactly what an early
      // screenshot showed, and why this waits the reveal out.
      await page.waitForTimeout(13_000)

      const geo = await page.evaluate(() => {
        const bars: Record<string, DOMRect> = {}
        for (const el of Array.from(document.querySelectorAll('div'))) {
          const t = el.querySelector(':scope > span')?.textContent?.trim() ?? ''
          if (['1st', '2nd', '3rd'].includes(t) && !bars[t]) bars[t] = el.getBoundingClientRect()
        }
        const card = document.querySelector('.font-display.w-full.max-w-5xl')?.getBoundingClientRect()
        return {
          first: bars['1st']?.height ?? 0,
          second: bars['2nd']?.height ?? 0,
          third: bars['3rd']?.height ?? 0,
          barBottom: bars['1st']?.bottom ?? 0,
          cardBottom: card?.bottom ?? 0,
        }
      })

      expect(geo.third, 'no podium bars rendered').toBeGreaterThan(0)
      expect(geo.first, '1st place bar must be the tallest').toBeGreaterThan(geo.second)
      expect(geo.second, '2nd place bar must be taller than 3rd').toBeGreaterThan(geo.third)
      // The card is overflow-hidden, so a bar extending past it is silently cut.
      expect(geo.barBottom, 'podium bars are clipped by the card').toBeLessThanOrEqual(geo.cardBottom + 1)
    } finally {
      for (const s of socks) s.disconnect()
      await ctx.close()
    }
  })
})
