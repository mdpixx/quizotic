# Quizotic Feedback Audit — 2026-05-20

Sources: EmailLog (Neon DB), Railway stdout logs, ModerationFlag (Neon DB)
Note: Sentry not configured (no SENTRY_DSN on Railway).

---

## Summary

| Signal | Count |
|--------|-------|
| Feedback submissions (total) | 10 |
| — Real user feedback | 7 |
| — Mahesh self-tests | 2 |
| — Accidental / meaningless | 1 |
| Moderation flags | 0 |
| Deletion requests | 0 |
| Recurring production errors | 4 types |

---

## Feature Requests

### 1 — Self-serve / always-on quiz (no live host required)
**From:** citieyamy05@gmail.com  
**Date:** 2026-05-20  
**Exact message:** "HOW TO MAKE THIS QUIZ AVAILABLE FOR EVERYONE ANYTIME AND WITHOUT HOST, NO NEED CODE TO ENTER"  
**What they want:** A shareable link that lets anyone take a quiz at any time, independently, without a host starting a live session and generating a join code — essentially an async quiz mode (think Google Form style).  
**Impact:** High — this unlocks self-paced learning and assessment use cases. Currently only live sessions are supported.

---

### 2 — Optional background music
**From:** dhiman.mahesh@gmail.com  
**Date:** 2026-05-09  
**Message:** "Slides are getting jumbled and you can keep music optional"  
**What they want:** Background music should be opt-in, not forced on every session.

---

### 3 — Less boring waiting lobby / start without participants
**From:** dhiman.mahesh@gmail.com  
**Date:** 2026-05-09  
**Preview:** "It can start without people and it is being a little boring.…" *(full text rolled off Railway logs)*  
**What they want:** Either allow the host to start immediately with 0 participants, or improve the lobby/waiting screen so it feels less static.

---

## Bugs Reported by Users

### BUG-1 — Can't navigate slides in presenter mode [HIGH]
**From:** pandeyA15@indianoil.in (real IndianOil user)  
**Date:** 2026-05-16  
**Page:** `/join?code=419068&mode=presenter`  
**Message:** "Unable to move futher in slides"  
**What happened:** User in presenter mode could not advance slides. A second user on the same session also submitted feedback (anonymous "100KLPM" — accidental tap). This was a real session with at least 2 participants.  
**Priority:** Fix before next IndianOil distribution.

---

### BUG-2 — Question 1 not showing [HIGH]
**From:** dhiman.mahesh@gmail.com  
**Date:** 2026-05-09  
**Page:** `/host/present/session`  
**Message:** "Not showing Q.1"  
**What happened:** During a live session, the first question did not render. Likely related to BUG-3 (slide ordering).

---

### BUG-3 — Slides getting jumbled during session [HIGH]
**From:** dhiman.mahesh@gmail.com  
**Date:** 2026-05-09  
**Page:** `/host/present/session`  
**Message:** "Slides are getting jumbled and you can keep music optional"  
**What happened:** Slide order/layout was incorrect during a live session presentation.

---

### BUG-4 — Join code not opening (session may have expired) [MEDIUM]
**From:** anonymous  
**Date:** 2026-05-06  
**Page:** `/join?code=610677`  
**Message:** "It's not opening"  
**What happened:** User couldn't enter the session via join code. Could be expired session with no clear error message shown.

---

## Production Errors (from Railway logs)

### ERROR-1 — Stale Server Action after deploy [HIGH, Recurring daily]
```
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
```
**Frequency:** Multiple occurrences per day — observed May 17, 19 (7 times), 20.  
**What happens:** Users with an open browser tab before a deployment hit this silently. Their UI actions fail (form submits, mutations) until they hard-reload.  
**Fix:** Add a Next.js `onRecoverableError` or deploy version header check that prompts the user to reload when a Server Action hash mismatch is detected. Or configure `next.config.ts` `serverExternalPackages` / deployment overlap handling.

---

### ERROR-2 — Neon DB cold-start connection failures [MEDIUM, Intermittent]
```
Error [DriverAdapterError]: Couldn't connect to compute node
```
**Frequency:** 4 occurrences on 2026-05-19 ~04:55 UTC (cluster woke from sleep).  
**What happens:** Neon free tier spins the Postgres compute node down after ~5 min idle. First request on a cold start can fail before the pg pool reconnects.  
**Fix:** Add connection retry logic in the `pg.Pool` config (`idleTimeoutMillis`, reconnect on connection error) or upgrade Neon to a plan with always-on compute.

---

### ERROR-3 — AI quiz generation: Gemini 429 rate limit [LOW, Handled]
```
[generate-quiz] attempt 1/3 failed (model=google/gemini-2.0-flash-001 status=429)
```
**Frequency:** Sporadic — 1 occurrence in the log window.  
**What happens:** Gemini rate limit hit on first attempt; retry (1/3) recovers. User sees slight delay.  
**Fix:** Monitor frequency. If it increases, add exponential backoff or use a fallback model.

---

### ERROR-4 — AI quiz generation: malformed JSON from model [LOW, Handled]
```
[generate-quiz] attempt 1/3 failed ... Unexpected token ']' ... malformed JSON
```
**Frequency:** Sporadic — 1 occurrence.  
**What happens:** Model returned invalid JSON; retry recovers. User sees slight delay.  
**Fix:** Add JSON repair (e.g. `jsonrepair` package) before retry, to avoid burning an attempt.

---

## Fix Priority List

| # | Bug/Error | Priority | Effort |
|---|-----------|----------|--------|
| 1 | BUG-1: Can't navigate slides in presenter mode | 🔴 High | Medium |
| 2 | BUG-2 + BUG-3: Q1 not shown / slides jumbled | 🔴 High | Medium |
| 3 | ERROR-1: Stale Server Action post-deploy | 🔴 High | Low |
| 4 | BUG-4: Join code "not opening" — better expired-session error | 🟡 Medium | Low |
| 5 | ERROR-2: Neon cold-start retry | 🟡 Medium | Low |
| 6 | Feature: Self-serve async quiz (no host required) | 🟢 Feature | Large |
| 7 | Feature: Optional music | 🟢 Feature | Small |
| 8 | Feature: Start session without participants | 🟢 Feature | Small |
| 9 | ERROR-3/4: AI retry improvements | ⚪ Low | Low |

---

## Metadata

- Feedback window: 2026-05-02 → 2026-05-20 (18 days)
- Pages with most feedback: `/join` (4), `/host/present/session` (3), `/host` (2), `/host/create` (1)
- External users who left feedback: pandeyA15@indianoil.in, citieyamy05@gmail.com, 2× anonymous
- Railway log retention covers: ~last 2000 lines (approx. May 19–20 only); older feedback text not recoverable from logs
- Full feedback emails are in the `info@quizotic.live` Gmail Workspace inbox (not accessible via Claude's connected account)
