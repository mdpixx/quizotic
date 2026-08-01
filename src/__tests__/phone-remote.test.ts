// The phone-remote affordance on the host projector.
//
// There is no DOM test environment in this project (vitest runs in 'node' and
// jsdom is not a dependency), so this asserts on the source rather than a
// render — same trade-off, and same reasoning, as lifecycle-nudge-card.test.ts.
//
// What it covers is the part a screenshot can't: the deep link baked into the
// QR, the positioning property whose absence made the panel invisible, and the
// lobby-only confinement. All three are load-bearing — the feature is worthless
// if a host can't see the QR, near-worthless if scanning it lands them on a
// session picker, and actively confusing if it appears on a projector mid-quiz.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const MODAL = read('src/components/host/PhoneRemoteModal.tsx')
const PANEL = read('src/components/host/PhoneRemotePanel.tsx')
const SESSION = read('src/app/host/session/page.tsx')

describe('phone remote QR', () => {
  it('deep-links the game code so one scan takes control of this session', () => {
    // /host/remote reads ?code= on mount and calls takeControl directly,
    // skipping the "which of your live sessions?" picker. Drop the param and
    // every host has to pick their session by hand after scanning.
    expect(MODAL).toContain('${REMOTE_PATH}?code=${gameCode}')
  })

  it('points at the host remote, not the participant join page', () => {
    expect(MODAL).toContain("const REMOTE_PATH = '/host/remote'")
    expect(MODAL).not.toContain('/join?code=')
  })

  it('renders the QR from the live origin, with a canonical SSR fallback', () => {
    // useSyncExternalStore keeps the server and client snapshots distinct
    // without a hydration mismatch — a plain `typeof window` check here would
    // bake the fallback domain into the markup on first paint.
    expect(MODAL).toContain('useSyncExternalStore')
    expect(MODAL).toContain("'https://quizotic.live'")
  })
})

describe('phone remote panel placement', () => {
  it('anchors to the viewport so no ancestor overflow can clip it', () => {
    // REGRESSION: this used to be an absolutely-positioned popover under a
    // button at the bottom of the lobby PIN card. That card sits in a
    // `lg:overflow-y-auto` column on an `h-svh overflow-hidden` page, so the
    // panel opened below the fold and the button looked dead. `fixed` is the
    // fix — not a tuned offset, which the next layout change would break again.
    expect(MODAL).toContain('className="fixed inset-0 z-50')
    expect(PANEL).not.toContain('QRCode')
  })

  it('traps escape and click-away like the sibling join modal', () => {
    expect(MODAL).toContain("e.key === 'Escape'")
    expect(MODAL).toContain('aria-modal="true"')
  })

  it('sits in the left column, under a divider, so the card fills its row', () => {
    // The PIN card used to be shorter than the players panel beside it,
    // leaving dead white space. The panel fills it; `lg:flex-1` stretches the
    // card so both columns end level.
    expect(PANEL).toContain('borderTop')
    expect(SESSION).toContain('<PhoneRemotePanel')
    expect(SESSION).toContain('lg:flex-1 overflow-hidden')
  })

  it('keeps its own height so the card always fits its grid row', () => {
    // Adding this section to a card that was already at capacity on a 720p
    // screen pushed the button off the bottom — the very bug being fixed. The
    // room came out of the card's chrome, not the QR: see the QR-size test.
    expect(SESSION).toContain('aspect-square')
    expect(SESSION).toContain("style={{ width: '100%', height: '100%' }}")
    // The redundant "enter code 123456" line is gone — it repeated the PIN
    // rendered at 60px immediately above it.
    expect(SESSION).not.toContain('enter code <span')
  })
})

describe('phone remote is host-only and lobby-only', () => {
  it('says so on the trigger and again on the QR', () => {
    // Account pairing already blocks participants server-side, but a QR on a
    // projector is read by the whole room — it has to say who it is for.
    expect(PANEL).toContain('Host only')
    expect(MODAL).toContain('Host only — not for participants')
  })

  it('tells participants what to use instead', () => {
    // The panel is one row tall so the participant QR keeps its size, so this
    // lives in the trigger's tooltip; the modal carries the full explanation.
    expect(PANEL).toContain('Participants join with the game PIN.')
    expect(MODAL).toContain('Participants join with the game PIN instead')
  })

  it('never costs the participant QR any height', () => {
    // The QR is what a person reads from the back of a room. It holds its
    // original 160px on any screen ~700px+ tall and grows to 300px on a big
    // host display; only the chrome around it flexes.
    expect(SESSION).toContain('min-h-[min(160px,23vh)]')
    expect(SESSION).toContain('max-h-[300px]')
    expect(PANEL).toContain('shrink-0 mt-3')
  })

  it('never renders once the quiz has started', () => {
    // The `phase` guard is the real enforcement — it also neuters the 'R'
    // shortcut, which fires from a window-level listener with no phase in
    // scope. Without it, a host could put a host-only QR on the projector
    // mid-quiz and have a room full of people scan it.
    expect(SESSION).toContain("open={showPhoneRemote && phase === 'lobby'}")
  })

  it('has no entry point in the mid-quiz overflow menu', () => {
    const joinQrAt = SESSION.indexOf('Show join QR')
    const menu = SESSION.slice(Math.max(0, joinQrAt - 2000), joinQrAt)
    expect(menu).not.toContain('<PhoneRemote')
  })
})
