# Lifecycle Automation — Design Spec (Phase 1)

**Status:** Draft for review · **Date:** 2026-07-31 · **Owner:** Mahesh
**Scope:** Welcome + activation nudges only. Report cards, testimonials, churn, and
internal digests are deliberately out of scope for Phase 1.

---

## 1. Governing principle

> A lifecycle email is a withdrawal from a finite trust account. We only spend it
> when the user has already shown intent and the message can plausibly change
> their behaviour.

Three hard rules, agreed with Mahesh:

1. **Max 2 lifecycle emails per user per rolling 30 days.** Enforced in code, not
   in a spreadsheet. Transactional mail (magic link, session invite, receipt,
   payment failure) is exempt and uncapped.
2. **Intent-gated only.** A user who signed up and never came back receives the
   welcome email and then silence. Forever.
3. **In-app first, email as the fallback.** Both channels are used, but never for
   the same nudge at the same time — see §4.

---

## 2. Intent tiers

Derived entirely from data already in the schema. No new tracking required.

| Tier | Definition (all from existing tables) | Treatment |
|---|---|---|
| **0 — Ghost** | `onboarded = false` AND `quizzes = 0` AND `lastActiveAt ≈ createdAt` | Welcome email only. **Never nudged.** |
| **1 — Explorer** | `onboarded = true` OR returned at least once (`lastActiveAt > createdAt + 24h`), but `quizzes = 0` | Eligible for `activation.create_first_quiz` |
| **2 — Builder** | `quizzes ≥ 1` AND `gameSessions = 0` | Eligible for `activation.host_first_session` — **highest priority nudge** |
| **3 — Host** | ≥1 `GameSession` with `participantCount > 0` | **Exits the activation sequence permanently.** |

Tier 0 is expected to be 40–60% of signups. Excluding them is the single largest
reduction in send volume and the main protection for sender reputation.

Tier 2 is where the money is. People who build a quiz and never press "Go Live"
are the highest-intent, highest-recoverable segment in the funnel.

---

## 3. The nudge ladder

Not a fixed drip. A **priority queue with a budget** — the worker picks the single
highest-value eligible nudge per user per cycle and spends budget on it.

| campaignKey | Priority | Trigger condition | Earliest send |
|---|---|---|---|
| `activation.host_first_session` | 1 (highest) | Tier 2, quiz created ≥48h ago, never hosted | signup + 48h |
| `activation.create_first_quiz` | 2 | Tier 1, no quiz | signup + 72h |
| `activation.last_touch` | 3 (lowest) | Tier 1 or 2, still not activated | signup + 10d |

Because the budget is 2 and there are 3 possible nudges, a user who moves through
the funnel naturally consumes the two most valuable slots and the last-touch is
simply never sent. That is the intended behaviour, not a bug.

**Hard exit:** the moment a user reaches Tier 3, every pending nudge is cancelled
and the sequence closes. Exit conditions are re-evaluated *at send time*, not at
enqueue time — this is what prevents the classic "you haven't created a quiz yet!"
email landing forty minutes after they created one.

**Sequence window:** 30 days from signup. After that, no activation nudges ever
again, regardless of tier.

---

## 4. In-app + email coordination

New `Nudge` row is created by the evaluator. It surfaces **in-app first**:

```
pending → shown (user saw the card on the dashboard)
        → acted (clicked through)  → done, never emailed
        → dismissed               → done, never emailed
        → (unseen for 48h)        → eligible for email
```

**Email fires only if `shownAt IS NULL` after 48 hours** *and* the user has not been
active in that window. Logic: if they are already in the product and chose to
ignore the in-app card, mailing them the same message is exactly the irritation we
are trying to avoid. Email exists to reach people who did not come back.

In-app nudges do **not** count against the 2/month email budget.

---

## 5. Guardrails (the anti-spam engine)

Every one of these is a blocking check in the send path. Order matters.

1. **Kill switch** — `FeatureFlag: lifecycle_emails_enabled`. Model already exists.
2. **Global suppression** — existing `EmailSuppression` table, checked by email.
3. **Per-user opt-out** — new `User.lifecycleOptOutAt`. One-click unsubscribe.
4. **Idempotency** — `@@unique([userId, campaignKey])` on `Nudge`. A campaign can
   physically never be sent twice to the same person.
5. **Rolling budget** — `EmailLog` count where `category = 'lifecycle'` and
   `createdAt > now() - 30d` must be `< 2`.
6. **Cooldown** — minimum 72h between any two lifecycle emails.
7. **Quiet hours** — send window 09:00–19:00 in the user's timezone, derived from
   `User.country` / `User.locale`, defaulting to IST. No 3am mail.
8. **Exit re-check** — recompute the user's tier immediately before send.
9. **Dry-run mode** — `LIFECYCLE_DRY_RUN=true` logs intended sends without
   dispatching. Default ON until we have watched a full week of output.
10. **Allowlist** — `LIFECYCLE_TEST_EMAILS` restricts real sends during rollout.

---

## 6. Where it runs

**Railway cron service → authenticated endpoint → Redis lock.**

- `POST /api/internal/lifecycle/tick`, guarded by `CRON_SECRET` bearer token.
- Railway cron service hits it hourly. Reuses the existing image and deploy — no
  second codebase, no new vendor.
- A Redis lock (`ioredis` is already a dependency) makes it multi-replica safe and
  double-fire harmless.
- Fully idempotent: every run recomputes state from scratch. Missing a run costs
  nothing; running twice costs nothing.

Rejected alternatives: in-process `node-cron` in `server.mjs` (couples the
lifecycle worker to socket uptime and restarts); n8n (correct at ~10+ workflows,
premature at 2); Customer.io / Klaviyo (per-contact pricing, and these triggers
need deep product data that is painful to mirror).

---

## 7. Sending channel — the one real gap

`src/lib/email.ts` currently sends **everything** through the Gmail API from
`info@quizotic.live`, the Google Workspace mailbox. That is fine for transactional
trickle and wrong for lifecycle mail, for three reasons:

- **Login risk.** Magic links are the login mechanism. If nudge complaints damage
  the domain's reputation, users cannot sign in. This is a product-availability
  risk, not a marketing one.
- **Bulk-sender rules.** Google's own requirements expect `List-Unsubscribe` with
  one-click support and a spam-complaint rate under 0.3%. The current sender has
  no unsubscribe header at all.
- **No feedback loop.** Gmail API gives no bounce or complaint webhooks, so
  `EmailSuppression` can never self-populate.

**Fix:** split the senders. No new vendor needed — `resend` is already a
dependency, merely unused.

| Class | Sender | From |
|---|---|---|
| Transactional (magic link, receipts, session invites) | Gmail API (unchanged) | `info@quizotic.live` |
| Lifecycle (nudges, and later report cards, testimonials) | **Resend** | `hello@mail.quizotic.live` |

Requires: verify the `mail.quizotic.live` subdomain in Resend, add SPF/DKIM/DMARC
records, add `RESEND_API_KEY`. A separate subdomain means a lifecycle complaint
cannot touch magic-link deliverability.

---

## 8. Stack audit — what exists vs. what we build

### Already in the repo (no external support needed)

- PostgreSQL + Prisma 7 · `EmailLog` (has `category`, `metadata`, indexes)
- `EmailSuppression` · `FeatureFlag` + `FeatureFlagAssignment` (kill switch/rollout)
- `User` with `onboarded`, `lastActiveAt`, `role`, `orgType`, `country`, `locale`
- `Quiz`, `GameSession`, `Attendee` — every activation signal we need
- `TestimonialInvite`, `Testimonial`, `SessionFeedback`, `Referral` — Phase 2/3 ready
- Redis (`ioredis`) for locks · Sentry for failure alerting · PostHog for verification
- `resend` package installed · `openai` for later personalisation
- Vitest + Playwright + existing deployment-safety tests

### To build (all in-house)

| # | Item | Est. |
|---|---|---|
| 1 | `Nudge` model + `User.lifecycleOptOutAt` + `unsubscribeToken` — one migration | S |
| 2 | `src/lib/lifecycle/tiers.ts` — tier computation from existing tables | S |
| 3 | `src/lib/lifecycle/guards.ts` — the 10 guardrails from §5 | M |
| 4 | `src/lib/lifecycle/worker.ts` — evaluator + priority queue + budget | M |
| 5 | `POST /api/internal/lifecycle/tick` + `CRON_SECRET` + Redis lock | S |
| 6 | `GET /api/unsubscribe/[token]` + `List-Unsubscribe` header | S |
| 7 | Resend transport in `email.ts` (channel-aware routing) | S |
| 8 | 2 email templates, matching existing welcome-email brand styling | M |
| 9 | In-app `<NudgeCard>` on the host dashboard + state transitions | M |
| 10 | Tests: budget cap, idempotency, exit conditions, quiet hours, dry-run | M |

**Verdict: no external support, no new vendor, no new subscription required.**
The only outside dependency is DNS records for the Resend subdomain, which is
configuration, not procurement.

---

## 9. Success criteria

Judged on activation, not on opens.

- **Primary:** % of signups that host a session with ≥5 participants within 14 days.
- **Guardrail metrics — any breach pauses the system:**
  - Unsubscribe rate > 0.5% per send
  - Spam complaint rate > 0.1%
  - Any user receiving > 2 lifecycle emails in 30 days (should be structurally
    impossible; alert if it ever occurs)
- **Volume target:** fewer than 35% of signups should ever receive a nudge. If the
  number climbs above that, the intent gate is too loose.

---

## 10. Rollout

1. Ship with `LIFECYCLE_DRY_RUN=true`. Watch a week of logged intent.
2. Enable for `LIFECYCLE_TEST_EMAILS` only. Verify rendering, links, unsubscribe.
3. Enable for 10% via `FeatureFlagAssignment`. Two weeks.
4. Compare activation rate between flagged and unflagged cohorts in PostHog.
5. Ramp to 100% only if activation moved and guardrail metrics held.

---

## Open questions for Mahesh

1. Confirm the reply-to address for the founder-style nudges — a real monitored
   inbox, since the whole point is that people reply.
2. Is `mail.quizotic.live` acceptable as the lifecycle subdomain?
3. Should the Tier-1 nudge include an AI-generated starter quiz for the user's
   `role` / `orgType`, or link to a static template gallery in Phase 1?
