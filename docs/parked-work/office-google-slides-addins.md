# Parked: PowerPoint + Google Slides add-ins — completion checklist

**Status:** 🟡 Phase 1 (foundation) shipped & merged to `main` (PR #100, commit `8d47d9e7`, 2026-07-21). Phases 2 & 3 are **half-built and not user-usable**. Work paused at owner's request.

**Parked:** 2026-07-21 — "park the pending works in memory, maybe later."
**Owner:** Mahesh

This note exists so any future session (human or agent) can pick up exactly where this left off without re-deriving the gaps. Read this top-to-bottom before resuming.

---

## TL;DR — why it's parked

The backend HTTP control surface works and is tested, but **end users cannot use either add-in today** because of three blockers (two code, one operational). The merged code is inert from a user's perspective — it doesn't affect normal Quizotic operation (see "Performance / safety" below).

## What's DONE and merged (don't redo this)

All in `main` as of commit `8d47d9e7`:

- **CSP carve-out** — `next.config.ts` adds a `/embed/:path*` header rule that loosens `frame-ancestors` for `officeapps.live.com` + `docs.google.com` + `usercontent.google.com` only. Global policy unchanged.
- **server.mjs control surface** — `createLiveSessionInternal`, `controlLiveSessionInternal`, `snapshotLiveSessionInternal`, `publicSnapshotLiveSessionInternal` extracted as the single source of truth; socket `create_session` now delegates to the shared function. Exposed via `globalThis.__quizoticLiveControl`.
- **Bearer socket auth** — `getSocketUserId` accepts a Bearer API key as a second identity path (for cross-origin taskpanes).
- **HTTP routes** — `POST /api/v1/sessions/create`, `GET /api/v1/sessions/:id/snapshot`, `POST /api/v1/sessions/:id/control`, public `GET /api/embed/snapshot`.
- **Typed client** — `src/lib/live-control.ts` with safe no-op degradation.
- **Embed view** — `/embed/session/[code]` + `EmbedLiveView.tsx` renders a live lobby/question/standings/ended view by polling the public snapshot. **Fully functional standalone.**
- **Office taskpane shell** — `/embed/taskpane` + `TaskpaneApp.tsx` — connect/pick/start/drive flow works via HTTP control API.
- **Office manifest** — `public/manifest.xml` (correct, not yet submitted).
- **Google Apps Script files** — `addons/google-slides/` (`appsscript.json`, `Code.gs`, `Sidebar.html`, `README.md`). Never `clasp push`-ed.
- **Tests** — 31 Vitest + 2 Playwright E2E, all passing. CI green.
- **Docs** — `docs/addin-architecture.md`, `docs/addin-office-deploy.md`, `docs/addin-google-deploy.md`.

## What's PENDING — the three blockers

### ⛔ Blocker 1 (CODE): no host-facing API key UI
Both add-ins tell the user "paste your API key from `quizotic.live/host/settings`" — **that page does not exist**. The API key route works (`POST /api/user/api-key` returns a `qz_…` key) but nothing in the dashboard calls it.

**To finish:**
- Add an "API key" section to the host dashboard (likely under `src/app/host/(dashboard)/` — there's no settings page yet, may need to create one).
- Call the existing `GET /api/user/api-key` (masked preview), `POST` (generate, returns full key once), `DELETE` (revoke) routes.
- Show the masked key + a "Generate / Regenerate" button + a "Copy" affordance on first reveal + a "Revoke" button.
- Match the visual style of the existing dashboard pages.

**Effort:** ~1–2 hours.
**Unblocks:** both add-ins (they need a key to authenticate).

### ⛔ Blocker 2 (CODE): Office taskpane doesn't insert onto the slide
The taskpane can start + drive a session, but **does not write anything to the PowerPoint slide surface**. `Office.context.document.settings.set('quizotic_game_code', …)` is called, but there's no Office.js code that:
1. Inserts a QR + game-code placeholder image onto the current slide, OR
2. Listens for `Office.EventType.ActiveViewChanged` to swap the placeholder for a live `<iframe src="/embed/session/<code>">` when the host enters slideshow mode.

So in PowerPoint today: taskpane works, slide is blank, audience sees nothing projected.

**To finish (in `src/components/embed/TaskpaneApp.tsx`):**
- After `startSession()` succeeds, call `Office.context.document.setSelectedDataAsync(...)` or insert a content control with the QR image + game code text. Use the existing `react-qr-code` or generate a QR server-side.
- Register an `ActiveViewChanged` handler (`Office.context.document.addHandlerAsync(Office.EventType.ActiveViewChanged, handler)`). On slideshow entry, read the stored `quizotic_game_code` setting and swap the placeholder shape for an iframe pointing at the embed URL. On slideshow exit, swap back.
- Handle the known sizing issue (Mentimeter users report iframe cutoff) — budget a fit-to-slide pass.
- The `EmbedLiveView` component is already built and renders correctly; this is purely the Office.js glue.

**Effort:** ~1 day (Office.js is finicky; needs real PowerPoint testing).
**Unblocks:** Office add-in's core value prop (on-slide live view).

### ⛔ Blocker 3 (OPS): neither add-in is listed/sideloadable
Even with the code complete, end users can't install either add-in:

**Office — AppSource submission:**
- Validate manifest: `npx office-addin-lint public/manifest.xml`
- Register at partner.microsoft.com, create an Office add-in offer.
- Upload `public/manifest.xml` + screenshots + privacy policy URL (`/privacy`).
- Wait ~1–2 weeks for Microsoft review. Common rejections: version not bumped, taskpane fails to load (CORS/CSP — verify `/embed/*` rule is live in prod), missing `SupportUrl`/`AppDomains`.
- Details in `docs/addin-office-deploy.md`.

**Google — Apps Script deploy + Marketplace:**
- `npm install -g @google/clasp` → `clasp login` → `clasp create --type slides --root addons/google-slides` → `clasp push`.
- Enable Google Workspace Marketplace SDK in the tied Cloud project.
- Configure listing, submit OAuth consent screen for verification (~few days), enable installability.
- **UX limitation to disclose honestly in marketing:** Google Slides has no "slideshow active" lifecycle hook, so the add-on runs from a manually-advanced polling sidebar — NOT a seamless on-slide live iframe like Office. Documented in `docs/addin-google-deploy.md`.
- Details there.

**Effort:** ~1 day ops + ~1–2 weeks waiting (mostly review queues).
**Unblocks:** actual end-user installation.

## Suggested resume order

1. **Blocker 1 (API key UI)** — smallest, unblocks both add-ins, useful even without the rest (powers the REST API v1 / MCP server UX too).
2. **Blocker 2 (Office.js slide insertion)** — the real product value for the Office add-in.
3. **Internal dogfood sideload** — sideload the Office manifest against production, test end-to-end with a real deck. Catches iframe-sizing issues.
4. **AppSource submission** (Office) — parallel-safe with #5.
5. **Google Apps Script deploy + Marketplace** — parallel-safe with #4.

Items 1 and 2 are pure code and can be done from this repo. Items 3–5 need Mahesh's Partner Center / Google Cloud access.

## Performance / safety of the merged code (reassurance)

The merged code is **inert under normal Quizotic load** and does not regress existing flows:

- **`getSocketUserId` Bearer path** — runs on every socket connection, but the cookie path (Path 1) is tried first and returns early for the 99.99% case (same-origin host/participant UIs carry the NextAuth cookie). The Bearer DB lookup (Path 2) only fires when there's no valid cookie AND a Bearer token present — i.e., only add-in taskpanes. Normal participants/hosts never hit the extra `SELECT id FROM "User" WHERE "apiKey" = $1` query.
- **The `globalThis.__quizoticLiveControl` bridge** — registered once at boot, adds one object to the global. The socket `create_session` handler now calls `createLiveSessionInternal` instead of inlining the same logic — same work, same DB calls, same Redis persistence, just refactored. No new per-request overhead.
- **New HTTP routes** (`/api/v1/sessions/*`, `/api/embed/snapshot`) — only execute when called. They reuse existing `rateLimit`, `authenticateApiKey`, and the bridge. No background timers, no polling of their own.
- **`/embed/*` pages** — Next.js routes that render on request; no cost when not visited.
- **Tests** — verified: full Vitest suite 566 pass, Playwright 54 pass (+2 new E2E). The 4 Playwright failures (`host-stage-fit`, `join-page-ui`) pre-exist on `main` and are unrelated (confirmed by running them against unmodified `main`).
- **Bundle size** — embed/taskpane routes are separate Next.js pages; they don't bloat the main bundle. The join page bundle budget check still passes.

**Net: the merged code adds capability without taking anything away. Users running normal live quizzes today experience zero change.**

## Side benefit worth noting when resuming

The HTTP control surface also **unblocks the MCP server** (`mcp/quizotic-mcp-server.mjs`), which could create quizzes + publish self-paced links but could NOT start or drive a live session. With this merged, agent-driven live quizzes are now possible — a natural follow-up is exposing `start_live_session` / `advance_session` MCP tools. Not required for the add-ins, but a cheap win.

## Key files to touch when resuming

| Task | File(s) |
|---|---|
| API key UI | new page under `src/app/host/(dashboard)/settings/` (or similar); calls `src/app/api/user/api-key/route.ts` |
| Office slide insertion | `src/components/embed/TaskpaneApp.tsx` (add Office.js calls after `handleStart`) |
| Office manifest tweaks | `public/manifest.xml` |
| Google add-on changes | `addons/google-slides/Code.gs`, `Sidebar.html` |

## Origin context

This work came out of a competitor survey (AhaSlides, Kahoot, Mentimeter, Slido). The survey's #1 recommended gap-closer was "PowerPoint / Google Slides live add-in — the Slido/Mentimeter moat." The full survey + recommendations live in the conversation that produced this branch. The two other surveyed recommendations (gamification dopamine layer, AI flashcards) were deferred — see the survey's prioritized list if you want to revisit them.
