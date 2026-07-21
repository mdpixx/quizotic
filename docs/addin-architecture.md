# Add-ins architecture (PowerPoint + Google Slides)

This doc explains the infrastructure the Office/Google Slides add-ins sit on,
why Office can use Socket.IO but Google can't, the embed CSP decision, and how
this work also unblocks the MCP server's live-session blind spot.

## Mental model

```
┌─────────────────────────┐         ┌────────────────────────────────────┐
│  PowerPoint add-in      │         │  Quizotic (single Next.js + custom │
│  (taskpane iframe +     │         │  Socket.IO server in one process)  │
│   on-slide live iframe) │ ◄─────► │                                    │
├─────────────────────────┤         │  ┌──────────────────────────────┐  │
│  Google Slides add-on   │ ◄─────► │  │  HTTP control surface (NEW)  │  │
│  (Apps Script sidebar,  │         │  │  POST /api/v1/sessions/create│  │
│   polling-only)         │         │  │  GET  /api/v1/sessions/:code │  │
└─────────────────────────┘         │  │       /snapshot              │  │
                                    │  │  POST /api/v1/sessions/:code │  │
                                    │  │       /control               │  │
                                    │  └──────────────┬───────────────┘  │
                                    │                 │ globalThis       │
                                    │                 ▼ bridge           │
                                    │  ┌──────────────────────────────┐  │
                                    │  │ server.mjs in-memory sessions│  │
                                    │  │ Map + Socket.IO io  ◄──┐     │  │
                                    │  └────────────────────────┼─────┘  │
                                    │                           │ emits  │
                                    │           ┌───────────────┘        │
                                    │           ▼                        │
                                    │  participants (Socket.IO phones)   │
                                    └────────────────────────────────────┘
```

Both add-ins ultimately drive the **same in-memory `sessions` Map** the
Socket.IO layer uses. The HTTP control surface is a new front door into the
same room — there is no forked state machine.

## The three pieces of Phase 1 (shared infrastructure)

### 1. CSP carve-out (`next.config.ts`)

Quizotic globally ships `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
The add-ins need to iframe Quizotic pages (`/embed/session/:code` for the
on-slide live view, `/embed/taskpane` for the Office host surface). The fix
adds a **second** header rule scoped to `/embed/:path*` only that overrides
`frame-ancestors` to Microsoft's `officeapps.live.com` and Google's
`docs.google.com` / `usercontent.google.com` origins. The global policy is
unchanged — the rest of the app stays un-frameable. Also whitelists the
Office.js CDN in `script-src` for those routes only.

This is security-sensitive: any future widening of the allowed origins (e.g.
for a new partner) must stay scoped to `/embed/*`. Never loosen the global
policy.

### 2. HTTP control surface (the long pole)

Until this work, the v1 API could author quizzes and read reports but could
not create or drive a **live** session — that was sockets-only, gated by the
NextAuth cookie. Both add-ins run in cross-origin iframes (Office) or the
Apps Script sandbox (Google) and can't carry the cookie, so they had no path
to host a session.

The new surface adds three Bearer-authenticated endpoints that mirror the
socket host events:

| Route | Socket equivalent | Purpose |
|---|---|---|
| `POST /api/v1/sessions/create` | `create_session` | Mint a live session from an owned quiz |
| `GET  /api/v1/sessions/:code/snapshot` | `session_state` broadcast | Read phase / question / counts |
| `POST /api/v1/sessions/:code/control` | `start_quiz` / `next_question` / `end_question` / `show_standings` / `end_session` | Drive the session |

A separate **public** snapshot (`GET /api/embed/snapshot?code=X`, no auth) and
`publicSnapshotLiveSession` bridge function back the audience-facing
`/embed/session/:code` view — strips PII vs the owner snapshot (no leaderboard
names, just counts) so any observer can render the on-slide live view safely.

#### Single source of truth — how

`server.mjs` exposes three internal functions on `globalThis.__quizoticLiveControl`:

- `createLiveSession` — builds the in-memory session record, mints the game
  code + resume token, starts the state-broadcast loop. The socket
  `create_session` handler now delegates to this same function (with
  `primaryHostSocketId` set so the projector becomes the primary host).
- `controlLiveSession` — applies a host action (`start`, `next`,
  `end_question`, `show_standings`, `end`) by calling the SAME primitives the
  socket handlers use: `presentQuestion`, `emitQuestionEnded`,
  `buildLeaderboard`, `persistGameSession`, `scheduleEndedSessionCleanup`.
- `snapshotLiveSession` / `publicSnapshotLiveSession` — read the in-memory
  session and return a sanitized view.

The typed client (`src/lib/live-control.ts`) wraps that bridge with optional
chaining so it degrades to a safe no-op when the custom server isn't running
(tests, serverless). Routes enforce Bearer auth + ownership BEFORE delegating
to the bridge — the bridge itself trusts its caller (mirroring how
`isHostSocket` gates the socket path).

#### The bridge pattern

`server.mjs` and Next.js route handlers run in the **same process** (custom
Node server), but Next bundles routes separately so a module export from
`server.mjs` isn't importable. The established channel is `globalThis` — the
same pattern already used for `__quizoticNudgeAsyncSweep`.

### 3. Socket auth via Bearer API key (`server.mjs`)

The Office taskpane CAN open a Socket.IO connection from its iframe (the
socket client works cross-origin), but it can't carry the NextAuth cookie
across origins — so `getSocketUserId` previously returned null and every host
event rejected with "Sign in to host a session."

`getSocketUserId` now has two identity paths tried in order:
1. NextAuth JWT from the cookie (same-origin host UI — unchanged).
2. Bearer API key from `socket.handshake.auth.bearer` (or `auth.token`, or
   the `Authorization` header) → `User.apiKey` lookup.

Both resolve to a userId on `socket.data`, so every downstream host gate
(`isHostSocket`, ownership) works identically. The API key is the same one
the REST API and MCP server accept — no new credential.

> **Why Google can't use this:** Apps Script's `google.script.run` sandbox
> has no persistent connection, no WebSocket, no client-side `fetch` to
> arbitrary origins. The Google add-on is therefore polling-only (uses the
> HTTP snapshot + control endpoints). The Office add-in could use Socket.IO
> for true realtime but v1 polls too, for simplicity and uniformity; a
> follow-up can wire Socket.IO into the taskpane for sub-second updates.

## The Office add-in (Phase 2)

- **`public/manifest.xml`** — Office web add-in manifest. Points the taskpane
  at `https://www.quizotic.live/embed/taskpane`. `ReadWriteDocument`
  permission lets the taskpane store the active `gameCode` on the document
  settings.
- **`/embed/taskpane`** (`TaskpaneApp.tsx`) — host control surface: connect
  (API key), pick quiz, start session, insert on-slide placeholder, drive
  with buttons. Uses the HTTP control API exclusively.
- **`/embed/session/:code`** (`EmbedLiveView.tsx`) — audience-facing live
  view. Polls the public snapshot endpoint every 1.5s and renders lobby /
  question / standings / ended phases. Designed to be iframed onto a slide
  during present mode (Office's `ActiveViewChanged` event triggers the swap).
  Self-contained inline CSS so it renders inside a foreign-origin iframe
  without depending on the global stylesheet.

## The Google Slides add-on (Phase 3)

- **`addons/google-slides/appsscript.json`** — manifest with Slides scopes
  and a `urlFetchWhitelist` scoped to `quizotic.live` (Apps Script gates
  outbound fetches via this list).
- **`addons/google-slides/Code.gs`** — `onOpen` menu, sidebar RPCs
  (`connectAccount`, `listQuizzes`, `startSession`, `controlSession`,
  `getSnapshot`). API key stored in `PropertiesService` user properties.
- **`addons/google-slides/Sidebar.html`** — host control surface, structurally
  similar to the Office taskpane but polling-only and without the on-slide
  live iframe (Apps Script can't insert a live web view onto a slide).

## Side benefit: unblocks the MCP server

The MCP server (`mcp/quizotic-mcp-server.mjs`) could create quizzes and
publish self-paced links but could NOT start or drive a live session — the
same blind spot the add-ins hit. With the HTTP control surface in place, the
MCP server (and any future agent integration) can now run a live quiz
programmatically. A follow-up can expose `start_live_session` /
`advance_session` MCP tools.

## Test coverage

- **`src/__tests__/live-control.test.ts`** (15 tests) — the typed client's
  no-op behavior when the bridge is absent + delegation wiring when a mock
  bridge is registered.
- **`src/__tests__/v1-sessions-live-control.test.ts`** (16 tests) — each new
  route's auth, ownership, validation, and response shape, with the
  live-control client and prisma mocked.
- **`tests/e2e/http-live-control.spec.ts`** (Playwright) — proves HTTP-created
  sessions are visible to socket participants and HTTP control emits the same
  socket events. Also covers foreign-API-key rejection.
