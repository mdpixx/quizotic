# Performance & Sync — Review Notes

Full findings from the deep review of the realtime layer, host side, and
participant side. The **P0 wave is implemented** (see "Implemented" below);
P1/P2 are documented for future passes.

The codebase is already well-hardened for 500 users — load-tested at 500 and
750 players (`docs/TECHNICAL-GUIDE.md:447-467`, commit `b70d3a6`,
p95 fan-out ≤32ms). The work below addresses the *actual* remaining
bottlenecks, not imagined ones.

---

## Implemented (P0 wave)

### A. O(1) answer aggregation  — server CPU under answer bursts
`submit_answer` used to run **four O(n) loops** recomputed from scratch on
every accepted answer (`countAnswers`, `getConnectedCount` ×2,
`countAnswersByOption`) plus a fifth O(n) "everyone answered?" scan —
**O(N²) work across a burst of N answers**. For 500 players answering in 5s
that was ~1M participant-iterations on the Node event loop.

**Fix:** per-question `answerCounts` / `answerOptionCounts` Maps mutated in
O(1) on accept (`src/lib/session-state.mjs`), reset on `presentQuestion`,
bumped in both `submit_answer` branches + the drawing path. The O(n)
helpers stay as a reconciliation fallback (return -1 sentinel → recompute).
Excluded from Redis serialization so a redeploy falls back to O(n) for the
current question only, then O(1) for the rest.

- `src/lib/session-state.mjs` — `ensureAnswerCounters`, `resetAnswerCountersForQuestion`, `bumpAnswerCounters`, `getAnswerCount`, `getAnswerOptionCounts`
- `server.mjs` — `presentQuestion` reset, both accept branches + drawing bump, `countAnswers`/`countAnswersByOption` fast-path
- `src/__tests__/answer-counters.test.ts` — 18 tests

### B. Fire-and-forget join DB write  — 500-user join thundering-herd
`join_session` `await`ed `ensureGameSessionRow` + `insertAttendee` before
the success callback. With `dbPool.max = 20` and 500 concurrent joins,
joins 21–500 queued → up to ~700ms p99 "Joining…" lag — the single most
visible 500-user artifact on the join/loading path.

**Fix:** fire the callback immediately after the in-memory Map mutation;
run the DB writes in an IIFE without `await`. `participant.attendeeId`
backfills onto the live record when the write resolves. Mirrors the existing
`persistAnswer` fire-and-forget pattern. The `_pendingPersist` queue +
`_dbInsertPromise` flush machinery (already tested in
`participant-lifecycle.test.ts`) handles fast answers that land before
`session.dbId` resolves.

- `server.mjs:~2578` — `join_session` reorder
- `src/__tests__/join-fireandforget.test.ts` — 4 tests

### C. Host render: throttle emits + memoize  — host browser render storm
1. `answer_received` was emitted to the host **once per answer, unthrottled**
   — 100 answers in 2s = 100 re-renders of a 4111-line component.
2. `buildLeaderboardStageRows(...)` was called **inline in JSX** and
   `LeaderboardView.tsx:61` then **sorted again** — O(n log n) twice per
   render, on every answer and every 100ms timer tick.
3. Zero `React.memo` across all host components.

**Fix:**
- Server-side coalesce: per-session 150ms window collapses a burst into
  ~1 emit. Flush immediately on question advance/reveal so the host sees
  the true final tally the instant it matters.
- Memoized `buildLeaderboardStageRows` via `useMemo` in the host page.
- Removed the redundant re-sort in `LeaderboardView` (caller pre-sorts).
- `React.memo` on `LeaderboardView`, `HostOptionTile`, `Avatar`. `Avatar`
  also gets a module-level SVG cache (same archetype → same SVG, generated
  once) — eliminates ~99% of DiceBear cost in a 500-tile roster.

- `server.mjs` — `scheduleAnswerReceivedEmit` / `flushAnswerReceivedNow`, flush in `presentQuestion` + `emitQuestionEnded` + `stopSessionStateBroadcast`
- `src/app/host/session/page.tsx` — `leaderboardStageRows` / `standingsStageRows` memos
- `src/components/LeaderboardView.tsx`, `src/components/Avatar.tsx`, `src/components/host/HostOptionTile.tsx` — memo + cache
- `src/__tests__/answer-emit-coalesce.test.ts` — 5 tests

### D. Timer drift → perceptually-perfect <16ms sync
The architecture was already correct (server-anchored absolute `startAt` +
NTP offset). The residual drift came from six compounding sources — none
"microseconds," realistically tens to hundreds of ms:

1. 100ms poll + `Math.ceil` rounding → up to ~100ms visible delta.
2. No half-RTT correction on the display deadline (scoring used `rtt/2`,
   display didn't).
3. `resyncClock` fired only on `question_show`, not pause/resume/extend —
   offset went stale during pauses.
4. Best-of-N locked in a possibly-noisy offset permanently.
5. Clients derived `endAt` instead of receiving it (offset snapped
   mid-question with a 600ms settle).
6. 100ms `setInterval` re-rendered the entire participant component 10×/sec.

**Fixes applied (the "<16ms" option):**
- Server broadcasts absolute `endAt` in `question_show` (already computed
  `session.questionEndsAt`; now sent to clients).
- Both clients prefer server `endAt`, apply half-RTT correction so host and
  participant share identical deadline math (mirrors scoring's `rtt/2`).
- `resyncClock` fires on `quiz_resumed` and `timer_adjusted` (both clients),
  not just `question_show`.
- `Math.ceil` → `Math.round` in all displayed-second math on both clients.
- Moving-median offset (`clock-sync.ts`): rolling 8-sample window, median
  of the lowest-RTT half. Rejects outliers, tracks real drift, never
  permanently locks in. The 2 best surviving samples are kept on `resyncClock`
  so a single bad burst can't wipe prior convergence.

- `src/lib/clock-sync.ts` — rolling window + median recompute + test helpers
- `server.mjs:~3648` — `endAt` + `timerSeconds` in `question_show` payload
- `src/app/join/page.tsx`, `src/app/host/session/page.tsx` — deadline math, pause/resume handlers
- `src/__tests__/clock-sync.test.ts` (9), `src/__tests__/timer-deadline.test.ts` (10)

---

## Deferred (P1 — structural)

### Host session page refactor
The `/host/session` page is a single 4111-line `'use client'` component.
Any state change anywhere walks the whole tree. Split into per-phase
components (`Lobby`, `QuestionStage`, `Standings`, `Ended`) to shrink the
initial render and isolate re-renders.

### Participant timer extraction
The 100ms `setInterval` in `src/app/join/page.tsx` re-renders the entire
3,922-line component 10×/sec for the duration of every question. Extract
`<QuestionTimer>` into its own component with its own state so only it
re-renders at 10Hz. Real CPU/battery drain on low-end Androids over a
20-minute session.

### Host roster virtualization
`src/app/host/session/page.tsx:~2123` renders all 500 participant tiles
unvirtualized. Use `react-window` / `@tanstack/react-virtual`. (The `Avatar`
SVG cache from P0/C already eliminates the DiceBear cost; this addresses the
DOM node count.)

### Builder re-render scope
- `QuestionCard` (`src/components/host/builder/QuestionList.tsx:39`) has no
  `React.memo` — editing one question re-renders all 50+ cards.
- `validateQuizQuestions(questions)` runs on every keystroke.
- No virtualization for 50+ question quizzes.

### `socketId → gameCode` reverse index
The disconnect handler iterates ALL sessions (`server.mjs:~2989`) on every
disconnect — O(sessions) per disconnect. Trivial at observed scale; matters
only at extreme session-count.

### Decouple `saveSession` from the 5s broadcast tick
The 5s `session_state` broadcast also snapshots the full session to Redis
(`server.mjs:~3471`). For 500 participants the serialized blob is large.
Move to mutation-debounced saves.

### Zod validation on hot events
`validateSocketPayload` runs Zod `safeParse` on every `ping_time` and
`submit_answer` (thousands of parses/min at 500 players). Consider a faster
validator (ajv / valibot / hand-rolled guards) for the per-event path.

---

## Deferred (P2 — polish)

### `next/image` + responsive R2 variants
No `next/image` anywhere; full-resolution R2 images shipped to projector and
phones. Add `images.remotePatterns` for the R2 host in `next.config.ts` and
either adopt `next/image` or add `srcset`/sized variants. Configure explicit
`width`/`height` on `<img>` to prevent CLS during question reveal.

### Host bundle-budget gate
`scripts/check-bundle-budget.mjs` enforces a 250KB gz cap on `/join`
(participant) only. `/host/session` and `/host/build` have no gate. Add
assertions for host routes.

### `next/dynamic` for host phase-specific widgets
Celebration/confetti, `SessionReport`, `QaModerationPanel`, `Podium`,
drawing/wordcloud widgets are statically imported into the host session
page's first paint. Dynamically import with `next/dynamic({ ssr: false })`
keyed to the `ended`/`standings` phase.

### Host session SSR
The host session page bypasses SSR entirely (loads quiz from localStorage).
Moving to a server-fetched `/host/session?quiz=<id>` would let SSR prefetch
the quiz so the lobby paints before JS hydrates. Intentional localStorage
handoff today — needs a product decision.

---

## Architectural caveat — single-instance scaling

**Quizotic is committed to single-instance-with-failover deployment.** This
is fine for the target audience and keeps the codebase simple.

If you ever run 2+ instances behind a non-sticky load balancer, **joins will
break**: the in-memory `sessions` Map (`server.mjs`) is authoritative, and
Redis is durability-only — NOT a shared read-through cache. A participant
whose socket lands on instance B for a session created on instance A will
hit "Game not found" (`server.mjs:~2391-2403`).

**If multi-instance becomes a requirement**, the fix is to promote Redis (or
Postgres) to a real shared session store with read-through on miss. That's a
meaningful architectural change — scoped as a future option, not built here.

---

## Verification

- `npm test` — 457 tests pass (429 original + 28 new across the 4 workstreams).
- `npm run predeploy` — Playwright E2E critical path (run before merge).
- `node scripts/load-test-session.mjs --players=500` — join p50/p95 + answer-ack p95 under a 500-player burst.
- **Manual smoke check:** host + participant side-by-side, watch the timer in the final 3 seconds — digits flip together within one animation frame, no drift, no mid-question snap.

All payload additions are additive — clients fall back to existing behavior
if a field is absent. No DB migrations, no schema changes, no breaking
wire-protocol changes.
