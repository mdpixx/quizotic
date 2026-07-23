# Session Feedback & Participant→Host Conversion — Plan

**Date:** 2026-07-23
**Author:** Mahesh (product) + Claude
**Status:** Proposal, pre-build
**Scope:** A frictionless smiley-based feedback capture at the end of every quiz / presentation session (both host and participant), plus a DPDP-safe mechanism to convert participants into hosts.

---

## 1. Why this, and what already exists

Every session ends with 1 host and 20–70 participants sitting on a high-emotion screen (the podium). That is the single most valuable, least-used real-estate in the product. Two jobs to do there:

1. **Learn** — capture how the session felt, with near-zero friction, from both sides.
2. **Grow** — turn a few of those 20–70 participants into hosts, without being creepy and without breaking Indian children's-data law.

We are **not starting from zero**. The codebase already has:

- `FeedbackModal.tsx` — a text-only feedback dialog (message + optional email) posting to `POST /api/feedback`, opened deliberately from the account menu, footer, and a "post-session" prompt via `FeedbackProvider`/`useFeedback()`.
- `CreateYourOwnCTA.tsx` — the participant→host card ("Liked this quiz? Make your own — free") shown on `quiz-ended` / `selfpaced-done`, linking to `/auth/signin?intent=signup&callbackUrl=/host/build` with UTM params, already firing a `participant_create_cta_click` PostHog event.
- The participant `join/page.tsx` has an explicit `'ended'` phase; the host has `RemoteEnded.tsx` (already imports `useFeedback`) and session reports.
- PostHog analytics (`captureRaw`, `src/lib/analytics.ts`) and NextAuth (Google + magic link).

**So this plan is an *evolution*:** add a one-tap **smiley scale** as the frictionless front-door to feedback (today it jumps straight to a text box, which is high-friction), sequence it correctly against the podium, wire it to analytics, and tighten the existing conversion CTA rather than replacing it.

---

## 2. Design principles

- **Frictionless first, depth optional.** The default action is one tap on a face. Text is never required. (Smiley micro-surveys get 40–70% response vs. 10–15% for text-first forms.)
- **Peak-end, not peak-interrupt.** Ask *right after* the emotional peak (podium reveal), never during it. The celebration must finish first.
- **Anonymous by default, PII by exception.** The rating and comment collect **no personal data**. Email stays optional and clearly labelled. This keeps it clean under India's DPDP Act (see §7).
- **Respect the participant page budget.** The participant view targets < 100 KB and 1–2 Mbps. The smiley strip must be inline CSS/SVG, no new heavy deps, < 1 KB socket payload.
- **Ask once, remember the answer.** One prompt per session per device; a submit or dismiss is remembered (localStorage) so we never nag.
- **Two audiences, two intents.** Host feedback is about the *product* (did the tool work, will they run another). Participant feedback is about the *experience* (was it fun) and doubles as a soft top-of-funnel for new hosts.

---

## 3. How competitors do it (benchmark)

| Platform | End-of-session feedback | Signup nudge to players | Notable |
|---|---|---|---|
| **Kahoot** | After the podium, host can trigger **"Get feedback"** — players rate the game (⭐ / fun-o-meter: "how fun", "learned something", "recommend"), aggregated into the host's report. | Light; players are mostly anonymous nicknames. | Validates our exact model: post-podium, aggregated back to host. Not available when hosting from mobile. |
| **Wayground (Quizizz)** | Player sees score/accuracy screen with reactions. | **Aggressive** — auto-pops Google login on the score screen; one tap creates + logs in the account. | High conversion, but "creepy" (Mahesh's word) and a **DPDP problem** for under-18s. We deliberately *don't* copy this. |
| **Slido** | Post-event **survey** (rating + open text), plus live sentiment. | Minimal — B2B/event tool. | Its most-praised feature is anonymous Q&A + clean survey UX. |
| **AhaSlides** | Post-session analytics; rating/scale slides mid-deck. | Minimal. | Rating scales are a first-class slide type. |
| **Mentimeter** | Rating/scales as slides; end-of-session reactions. | Minimal. | Feedback is content, not a separate funnel. |

**Takeaways:** Kahoot proves the post-podium smiley→host-report loop works and is expected. Wayground proves the conversion opportunity is real *and* shows exactly the line we shouldn't cross. Our wedge is to get Wayground-level conversion intent with Kahoot-level tact — and stay DPDP-clean where they can't.

---

## 4. Behavioural foundations (why the timing works)

- **Peak-end rule (Kahneman).** People judge an experience by its emotional peak and its end, not its average. The podium *is* the peak; the screen immediately after is the "end" they'll remember. Placing the smiley there means we're measured against — and attached to — a good memory. It also means we must not step on the peak: let the confetti/podium resolve, *then* slide the prompt in.
- **Completion-triggered micro-surveys** outperform scheduled ones; prompts fired on task-completion hit ~40% response rates. Session-end is the textbook trigger.
- **One-tap emoji removes cognitive load.** No deciding "am I a 3 or a 4" — you tap the face that matches the feeling. ~65% of people are visual-first; a face needs no reading (matters for young/low-literacy/regional-language participants).
- **Lazy / deferred registration** converts better: deliver value *first*, ask to register only when it buys the user something. Fewer fields = more signups (≤4 fields ≈ +120% vs. long forms; value-before-commitment ≈ 2.5× conversion). So the host CTA should come *after* the good experience, and the signup itself should be one-tap Google / magic-link with fields deferred.

---

## 5. The feedback component

### 5.1 The scale — 5 faces, very sad → very happy

A horizontal strip of five faces, left (worst) to right (best), each with a micro-label:

`😞 Bad · 🙁 Meh · 😐 Okay · 🙂 Good · 😄 Loved it`

- Stored as an integer **1–5** (`rating`). One tap = submitted; that's a complete, valid response.
- Faces are inline SVG (crisp, themeable, zero network cost), sized for thumbs (≥ 44 px targets), with the selected face enlarging + colour-filling for tactile confirmation.
- Colour ramp uses brand tokens (red-ish → yellow `#FBD13B` → green), not traffic-light harsh.

### 5.2 Progressive disclosure — depth is optional

```
Tap a face  ──►  instant "Thanks!" micro-confirm
      │
      └─(only now)─►  optional reason chips + a "Anything else?" text box
                         │
                         └─►  Submit  ──►  done  ──►  (host CTA appears, participant only)
```

- **Low scores (1–2):** reveal quick reason chips ("Too fast", "Confusing", "Tech/lag", "Boring", "Other") + the free-text box. This turns a frown into a specific, actionable bug/insight instead of a dead number.
- **High scores (4–5):** reveal a lighter prompt ("What did you love?") + optional text; for *hosts*, a 5 is the moment to ask for a review / referral later (not on-screen).
- The free-text box is the **existing** `/api/feedback` message field — we're just gating it behind the tap so 90% of people never have to type.
- Nobody is ever blocked. "Skip" / tapping away = a dismissal we remember.

### 5.3 What it is NOT

- Not a blocking modal over the podium. Not a mandatory step before seeing results. Not an email wall. Not shown mid-quiz. Not shown twice.

---

## 6. Placement & timing — the crucial part

### 6.1 The full journey, and where feedback sits

**Participant journey** (`join/page.tsx` phases): `form → connecting → lobby → question → answered → standings → ended`

```
… → [final question] → [standings] → ENDED
                                        │
                                        ├─ (0.0s) Podium reveal: 3rd→2nd→1st, drumroll, confetti   ← PEAK, do not touch
                                        ├─ (~2–3s, after confetti settles) Smiley strip slides up   ← FEEDBACK
                                        │        "How was it?"  😞 🙁 😐 🙂 😄
                                        │        └─ tap → optional chips/text → "Thanks!"
                                        └─ (after feedback resolves OR is dismissed) CreateYourOwnCTA  ← CONVERSION
                                                 "Liked this quiz? Make your own — free"
```

**Self-paced** (`selfpaced-done`): same order — result summary → smiley → CTA. There's no live peak, so the smiley can appear a touch sooner.

**Host journey** (`RemoteEnded.tsx` / `host/session` end / reports):

```
End session → Final standings / winner → Host smiley prompt ("How did that session go?")
                                          └─ tap → optional text (bugs/ideas) → Thanks
           → Session report ALSO shows: aggregate participant sentiment (avg face + count)   ← closes the loop
```

### 6.2 Timing rules (the spec)

- **Wait for the peak to resolve.** Trigger the smiley only after the podium reveal sequence completes (the Podium component already "owns the full reveal sequence" per the code) — hook the smiley to its completion callback, or a ~2.5–3 s fallback timer. On self-paced, ~0.8 s after the summary paints.
- **Non-blocking entrance.** Slide up from the bottom (thumb zone) as a card *below* the result, not an overlay. The result stays visible.
- **One prompt per session per device.** Persist `qz_feedback_<sessionId> = submitted|dismissed` in localStorage; never re-show. Re-joins of the same session don't re-prompt.
- **Feedback before conversion.** Show the smiley first; reveal `CreateYourOwnCTA` only after the smiley is answered or dismissed. Rationale: capture the honest signal before we start selling, and the CTA lands warmer after a moment of reflection.
- **Host gets the same courtesy** but framed at the product ("run another?", "what broke?"), and the host prompt can be slightly more assertive since hosts are known adults and logged in.
- **Never mid-session.** No feedback between questions — it competes with the game and taxes bandwidth/attention.
- **Connection-drop grace.** If a participant dropped before the end, still let them rate on reconnect to the ended screen (they experienced the session).

### 6.3 Why this order beats Wayground's

Wayground fires the account prompt *at* the peak, hijacking the score moment. We split the moment into three clean beats — **celebrate → reflect (1 tap) → invite** — so each does one job well, none feels like a trap, and the invite is the last thing they see (recency).

---

## 7. Participant→Host conversion (soft, DPDP-safe) — chosen approach

**Decision: soft CTA, no data capture on the score screen.** (Selected over host-toggle and aggressive email-capture.)

### 7.1 The legal reason this matters (not optional)

India's **DPDP Act 2023** defines **anyone under 18 as a child** and requires **verifiable parental consent** before processing their personal data — stricter than GDPR (13–16) or COPPA (13). It **expressly prohibits tracking, profiling, and targeted advertising of children**, with penalties up to **₹200 crore**. A huge share of Quizotic participants are school/coaching students, i.e. minors. Therefore:

- **Never** auto-create accounts or auto-capture email/Google identity from the participant score screen (the Wayground pattern is a landmine here).
- The rating + comment must remain **anonymous** — no PII required, email strictly optional and labelled "so we can reply."
- Conversion must be a **deliberate, self-initiated act** by someone who chooses to become a host — at which point they self-identify as an adult educator/trainer in the normal signup, and consent is theirs to give.

### 7.2 How we still convert well

Keep and sharpen the existing `CreateYourOwnCTA`, and cut friction on the *destination*, not the score screen:

- **Sequence & framing:** show it *after* feedback, warm framing ("Liked this quiz? Make your own — free, no app"). Keep the honest sub-line ("Free · ready in 10 minutes").
- **One-tap destination:** the signup page (already `intent=signup&callbackUrl=/host/build`) should lead with **Google one-tap** and **magic-link** — no password wall. Fields deferred until after they've built something.
- **Lazy registration for hosts:** let a curious participant start building a quiz first (value delivered), and only ask them to sign in to **save/host** it. Registration becomes "just one more small step," not a gate. (This is the highest-leverage conversion change and fits the deferred-registration evidence.)
- **Carry context:** pass the source session via UTM (already there) so we can attribute which sessions mint new hosts, and optionally greet them ("You just played *[Quiz title]* — make your own like it").
- **WhatsApp echo:** offer "Send me the link" via a `wa.me` share (participant shares to *their own* WhatsApp) rather than us collecting their number — zero PII, very Indian, viral.

### 7.3 Explicitly rejected

- Auto Google-login / silent account creation on the score screen.
- Any email/phone field as a *requirement* to see results or leave feedback.
- Profiling minors or retargeting them with ads.

---

## 8. Data model, API & instrumentation

### 8.1 Storage

Add a dedicated table rather than overloading the free-text feedback endpoint:

```prisma
model SessionFeedback {
  id          String   @id @default(cuid())
  sessionId   String                       // links to sessions
  role        Role                         // HOST | PARTICIPANT  (anonymous, no participantId PII stored)
  rating      Int                          // 1..5 (the face)
  reasons     String[]                     // optional chips, e.g. ["too_fast","lag"]
  comment     String?  @db.Text            // optional free text (existing /api/feedback content)
  email       String?                      // optional, host-provided only
  createdAt   DateTime @default(now())
  @@index([sessionId])
}
```

- Store **no** participant identity — `role` + `sessionId` only, so participant rows are anonymous by construction (DPDP-clean).
- Extend the API: `POST /api/feedback` gains optional `rating`, `reasons`, `role`, `sessionId`; or add a sibling `POST /api/session-feedback`. Keep payload < 1 KB. Rate-limit by session+device to stop spam.

### 8.2 Socket vs. HTTP

Rating submit can go over plain HTTP (`fetch`, like today) — it's off the hot path and keeps the socket lean. Only the **host's live aggregate** ("live sentiment as players rate") needs a socket broadcast; that can be a v1.1 nicety, not v1.

### 8.3 Analytics (PostHog — already wired)

Fire (building on the existing `participant_create_cta_click`):

- `feedback_prompt_shown` `{ role, sessionId, phase }`
- `feedback_rating_submitted` `{ role, rating, hasComment, reasons }`
- `feedback_dismissed` `{ role }`
- `feedback_comment_submitted` `{ role, rating }`
- (existing) `participant_create_cta_click` → then `signup_started` → `signup_completed` → `first_quiz_created`

**Funnels to watch:** prompt-shown → rating (target > 35% participants, > 60% hosts); rating → comment (10–20%); CTA-shown → click → signup → first-quiz. Segment by rating (do 5-star players convert to hosts at a higher rate? almost certainly — prioritise them).

---

## 9. Edge cases & failure modes

- **Host ends abruptly / everyone drops:** still record whatever ratings arrived; show host prompt on the ended screen regardless.
- **Re-join same session:** no re-prompt (localStorage flag).
- **Offline at the end:** queue the rating and flush on reconnect; if it never reconnects, drop silently (never block).
- **Spam / bored kids tapping:** one row per session+device; ignore duplicates.
- **Very short sessions (1–2 questions):** still fine to ask, but suppress the host "run another" upsell if the session looked like a test run.
- **Accessibility:** faces have text labels + `aria-label`; keyboard/`Tab` order; not colour-only (label + shape differ). WCAG AA contrast on the strip.
- **Low bandwidth:** inline SVG only; no font/emoji-image downloads; strip renders instantly even if the socket is slow.

## 10. Phased rollout

- **P0 (ship first, ~days):** Participant smiley strip on `ended` + `selfpaced-done`, one-tap → optional text (reusing `/api/feedback`), correct post-podium timing, localStorage once-per-session, PostHog events. Host smiley on `RemoteEnded`. Keep `CreateYourOwnCTA`, just sequence it after feedback.
- **P1:** `SessionFeedback` table + rating column; aggregate participant sentiment shown in the **host session report**; reason chips for low scores; signup page one-tap Google/magic-link lead.
- **P2:** Lazy registration (build-before-signup) for participant→host; live host sentiment over socket; NPS-style follow-up for repeat hosts; WhatsApp "send me the link" echo; A/B the CTA copy and the smiley labels (incl. Hindi).

## 11. Success metrics

- Participant rating response rate **> 35%**; host **> 60%**.
- Median session rating (track weekly; watch for drops after releases — this becomes a release-health signal alongside Sentry).
- Low-score → comment rate (are we learning *why*?).
- **Participant→host conversion:** CTA-click rate, and new hosts attributed to `utm_medium=quiz-end` — the north star for this whole surface.
- No rise in participant drop-off on the ended screen (guard against the prompt annoying people).

## 12. Open decisions

- Smiley labels wording (and Hindi set) — validate with 2–3 real teachers.
- Should hosts be able to **turn off** the participant CTA for their sessions (e.g. strict K-12 settings)? Low effort, good trust signal — likely yes in P1.
- Where to surface aggregate sentiment: report only, or also a dashboard trend line?
- Whether to ever ask email from *hosts* inline for a reply (they're consenting adults) — probably yes, optional.

---

## 13. Host post-session — what follows the feedback

Once the host has celebrated and rated, their real job-to-be-done is **"what did my class actually learn, and what do I do about it?"** The end screen should serve that, not dump them back at a library grid.

**The one high-value thing: this session's report — opened directly.**

- Make the primary CTA **"See this session's report"**, deep-linked to `/host/reports/{thisSessionId}`. That route already exists and already renders the good stuff: learning-insight cards (mastered / re-teach / misconceptions), the aggregate confidence grid, score distribution, per-question accuracy scan, and the participant × question matrix. A "View Report →" link also already exists inside `CelebrationOverlay` — the fix is to make *report* the hero and demote "Back to Library".
- **Do not** send them to the `/host/reports` index (a list of every past session) — that's a navigation tax and exactly what you flagged. Land them on the report for the quiz that just ended, scrolled to the insight cards.
- Rename today's prominent **"Back to Library"** to a quiet secondary/ghost link. Label the primary for its destination ("See report", not "Done"/"Back") so the host knows one tap takes them to *this* quiz's results.

**Ranked follow-ups after the report CTA:**

1. **Review with class (projector recap).** A distinct, big-font, participant-safe view for the room — overall accuracy, the 2–3 questions most people got wrong *with the correct answer + explanation* (re-teach on the spot), and the podium recap. This is the highest in-room value and what teachers actually do next; Kahoot and Quizizz both ship a post-game review. It is separate from the dense analytics report.
2. **Re-teach loop — "Re-quiz what they missed."** One tap builds a short follow-up quiz from just the low-accuracy questions (spaced repetition; uses the existing AI generator). The single most pedagogically valuable follow-up.
3. **Play again (new code).** Re-host the same quiz for the next section — teachers run the same lesson 3–6× a day.
4. **Assign as homework / self-paced.** Convert the live quiz to async for absentees and revision — extends the session's life (self-paced mode already exists).
5. **Export / share.** CSV / PDF / Sheets (already Pro). A shareable **aggregate class summary** (no per-student PII) is DPDP-safe; per-student parent scorecards are a consent-gated v2.
6. **Edit this quiz.** Jump to the builder to fix a question the accuracy data just exposed as broken or ambiguous.

**Charts that matter immediately** (surface these at the top of the report — most are already computed): per-question accuracy bar (the re-teach signal), score-distribution histogram, the confidence grid (confident-but-wrong = genuine misconceptions), and completion/participation. For poll and word-cloud slides, the aggregate visual *is* the recap.

**Showing results to participants:** yes — but through the "Review with class" projector view (class-level aggregate + correct answers), not by exposing the analytics report or any individual data. Participants already saw their own score on their phones; the shared screen is the teaching recap, which keeps it DPDP-clean.

**Sequence on the host end screen:** celebrate → host smiley → **See this session's report** (primary) → secondary action row (Review with class · Play again · Assign homework) → ghost links (Export · Back to library).

---

*Companion mockup:* `docs/feedback-flow-mockup.html` — interactive walkthrough of both flows. Participant: podium → smiley → optional text → conversion CTA. Host: podium → smiley → "See this session's report" + next-step actions. (Toggle Participant/Host at the top. Quizotic wordmark used as the logo — no icon.)
