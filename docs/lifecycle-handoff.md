# Handoff — Lifecycle Automation, Phase 1

**For:** Claude Code, continuing autonomously
**From:** Cowork session, 31 Jul 2026
**Design spec:** `docs/lifecycle-automation-spec.md` — read it first, it is the source of truth for behaviour
**Do not delete** `HANDOFF.md` in the repo root — that is unrelated post-#109 work.

---

## Mission

Build an automated customer lifecycle system for Quizotic that nudges users
toward activation without spamming them. Phase 1 scope is **welcome +
activation nudges only**. Report cards, testimonials, churn detection and
internal digests are explicitly out of scope for now.

The governing constraint, agreed with Mahesh and non-negotiable:

> **Maximum 2 lifecycle emails per user per rolling 30 days**, enforced in
> code. Only users who have shown intent get nudged at all. A user who signs
> up and never returns receives the welcome email and then silence, forever.

---

## Part 1 — Already done (verified, do not redo)

### Email infrastructure

DKIM was **never configured** on `quizotic.live`. It is now. Verified end to
end via mail-tester: SPF pass, DKIM valid, DMARC pass.

A second sending channel is live on an isolated subdomain. All three DNS
records were verified from public resolvers and the key parsed with OpenSSL:

| Record | Name | Value |
|---|---|---|
| DKIM (Google) | `google._domainkey.quizotic.live` | 2048-bit, valid |
| DKIM (Resend) | `resend._domainkey.mail.quizotic.live` | 1024-bit, valid |
| MX (Resend) | `send.mail.quizotic.live` | `10 feedback-smtp.ap-northeast-1.amazonses.com` |
| SPF (Resend) | `send.mail.quizotic.live` | `v=spf1 include:amazonses.com ~all` |

Root SPF is still `include:_spf.google.com ~all` and root MX still points at
Google — **the two sender reputations are isolated and must stay that way.**

Resend: domain `mail.quizotic.live`, region `ap-northeast-1` (Tokyo),
status verified. Free tier — 3,000/month, 100/day.

### Code (uncommitted, in the working tree)

| File | State |
|---|---|
| `src/lib/email.ts` | Modified — channel-aware transport |
| `src/__tests__/email-channels.test.ts` | New — 11 tests |
| `.env.example` | Modified — documents the new vars |
| `docs/lifecycle-automation-spec.md` | New — design spec |

`sendEmail` now takes an optional `channel`. Default `'transactional'` keeps
the existing Gmail API path untouched; `'lifecycle'` routes via Resend from
`mail.quizotic.live`. `SendEmailArgs` is a **discriminated union** — a
lifecycle send without `unsubscribeUrl` will not compile. Suppression is
enforced inside the transport (lifecycle only) and fails closed.

Verified: `npx tsc --noEmit` clean, `npx vitest run` → **636 passing / 61 files**.

---

## Part 2 — Do these first (operational)

### 2.1 Secrets vault

`.env` symlinks to `../../secrets/env/quizotic.env`, which was outside the
Cowork sandbox. You can reach it. Add:

```
RESEND_API_KEY=<already created in Resend, named for lifecycle sending>
EMAIL_FROM_LIFECYCLE=Quizotic <hello@mail.quizotic.live>
EMAIL_REPLY_TO=info@quizotic.live
```

If `RESEND_API_KEY` is not in the vault, ask Mahesh — he created the key and
added it to Railway but not locally. Do not invent one.

### 2.2 Railway

Service is `quizotic-beta`. `RESEND_API_KEY` is already set there.
Add `EMAIL_FROM_LIFECYCLE` and `EMAIL_REPLY_TO`. Both have defaults baked
into `email.ts`, so nothing breaks without them — but explicit beats hidden.

### 2.3 Git

Repo is `mdpixx/quizotic`; Railway deploys `main`. Per `AGENTS.md`: branch,
check, PR. **Never rsync a monorepo snapshot over this repo** — that caused
the June 2026 signup outage.

The working tree is currently on `feat/shuffle-options-and-feature-requests`
and is **messy** — dozens of untracked screenshots under `exports/` and
`test-results/`, plus unrelated modified files. Stage only what belongs to
this work. Suggested branch: `feat/lifecycle-email-channels`.

Files for the first PR:

```
src/lib/email.ts
src/__tests__/email-channels.test.ts
.env.example
docs/lifecycle-automation-spec.md
docs/lifecycle-handoff.md
```

Run `npm run predeploy` before merging.

---

## Part 3 — Build (in this order)

Each step is independently shippable. Do not batch them into one PR.

### 3.1 Schema

One migration adding:

**`Nudge`** — the in-app/email state machine.
```
id, userId, campaignKey, priority Int
state          String @default("pending")   // pending|shown|acted|dismissed|emailed|expired|cancelled
createdAt, shownAt?, actedAt?, dismissedAt?, emailedAt?, expiresAt
@@unique([userId, campaignKey])   // idempotency — a campaign can never fire twice
@@index([state, createdAt])
```

**`User`** additions: `lifecycleOptOutAt DateTime?`, `unsubscribeToken String? @unique`.

Existing models you should reuse rather than duplicate: `EmailLog` (has
`category`, `metadata`, indexes), `EmailSuppression`, `FeatureFlag` +
`FeatureFlagAssignment` (kill switch and percentage rollout),
`TestimonialInvite` / `Testimonial` (Phase 3), `SessionFeedback`, `Referral`.

### 3.2 `GET /api/unsubscribe/[token]`

Must exist before any lifecycle email is sent — the transport refuses to send
without an `unsubscribeUrl`. Requirements: idempotent, no login required,
works on a bare GET (Google's one-click sends a POST too — handle both),
sets `lifecycleOptOutAt`, writes an `EmailSuppression` row, renders a plain
confirmation page with a re-subscribe link.

### 3.3 `src/lib/lifecycle/`

- **`tiers.ts`** — compute tier 0–3 from `User`, `Quiz`, `GameSession`. Definitions in spec §2.
- **`guards.ts`** — the ten blocking checks in spec §5, in order. Kill switch, suppression, opt-out, idempotency, rolling budget, 72h cooldown, quiet hours (09:00–19:00 in user's tz from `User.country`/`locale`, default IST), exit re-check, dry-run, allowlist.
- **`worker.ts`** — evaluator + priority queue + budget. Picks the single highest-value eligible nudge per user per cycle. Re-evaluates exit conditions **at send time, not enqueue time**.

### 3.4 `POST /api/internal/lifecycle/tick`

Guarded by `CRON_SECRET` bearer token. Redis lock via the existing `ioredis`
client so it is multi-replica safe. Fully idempotent — recomputes from
scratch each run, so a missed run costs nothing and a double-fire is
harmless. Railway cron service hits it hourly.

### 3.5 Templates + in-app card

Two emails matching the existing welcome-email brand styling in
`src/lib/auth.ts` (`buildWelcomeHtml`). Campaign keys and copy direction in
spec §3. Then `<NudgeCard>` on the host dashboard with the state transitions
from spec §4 — email only fires if `shownAt IS NULL` after 48h **and** the
user has not been active.

---

## Hard constraints

1. **Never break magic links.** They are the login mechanism. Transactional
   email must keep flowing over the Gmail API, and suppression must never
   block it.
2. **Never send lifecycle mail from the root domain.** The subdomain
   isolation is the entire point.
3. **Ship with `LIFECYCLE_DRY_RUN=true`.** Watch a week of logged intent
   before a single real nudge goes out. Then allowlist, then 10% via feature
   flag, then ramp.
4. This is **Next.js 16**, not 14. Read `AGENTS.md` and the relevant guide in
   `node_modules/next/dist/docs/` before writing route handlers.
5. JavaScript/TypeScript only, no Python. Minimal new dependencies — the
   `resend` package is installed but deliberately unused; the transport uses
   plain `fetch`.

---

## Verification gates

- `npx tsc --noEmit` clean
- `npx vitest run` — 636 passing today, must not regress
- `npm run predeploy` before any merge
- New tests required for: budget cap, idempotency (unique constraint holds
  under concurrency), exit-condition cancellation, quiet hours, dry-run
- Success metric is **activation** — % of signups hosting a session with ≥5
  participants within 14 days — not opens. Guardrails: unsubscribe >0.5% or
  complaints >0.1% pauses the system.

---

## Parked / blocked

**Google Workspace billing is still resold by Wix** (`reseller.gappsemail.wix.com`).
Google support confirmed only Wix can release it to direct billing; the
Admin console offers no "Transfer to Google" path. A support ticket with Wix
is pending.

This does **not** block anything here. Once magic links move to Resend
(a later phase), Workspace becomes just a human inbox and the dependency
stops being a product risk. Until then, note that a lapse in Wix billing
would suspend `info@quizotic.live` and take logins down with it.

Also outstanding, both trivial and independent:
- A stray DMARC string sits in the **root** TXT records; DMARC belongs only at `_dmarc`. Delete the root copy.
- DMARC is `p=none`. Now that DKIM passes, move to `p=quarantine` after a few weeks of clean reports.
- Do **not** delete the `railway-verify` or `google-site-verification` TXT records — they are load-bearing.

---

## Open questions — both answered (2026-08-01)

1. **Reply-to** — `info@quizotic.live`, confirmed monitored by Mahesh himself. The founder-voice copy stands as written.
2. **Tier-1 starter quiz** — a named template, not AI generation. Generating a quiz into someone's library would flip them Tier 1 → Tier 2 and corrupt both the exit re-check and the activation metric. Full reasoning in `docs/lifecycle-automation-spec.md` under "Resolved decisions".
