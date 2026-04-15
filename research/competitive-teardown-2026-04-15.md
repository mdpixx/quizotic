# Competitive Teardown: Mentimeter & Kahoot vs. Quizotic
**Date:** 2026-04-15 | **Scope:** Public sources only | **Purpose:** Quizotic product strategy

---

## Section 1: Kahoot Engine Breakdown

### A. Quiz Builder (Editor)
**14+ question types.** Free tier gets: multiple choice, true/false, image answer, poll, multi-select.
Paid gates: scale/rating ($7/mo), slider ($12/mo), type answer + word cloud + brainstorm ($25/mo).

**Media:** Images, YouTube embeds, video, audio per question. AI image generation via GPT-4 (paid).

**AI generation (2024–2026):** Generate from topic, PDF, URL, Wikipedia, Google Slides, PowerPoint, or handwritten notes photo. Underlying model: GPT-4. Available on Gold ($12/mo) or 360 Pro ($25/mo). 58 languages.

**Import:** XLSX spreadsheet template + Google Slides sync.

→ **Quizotic:** AI generation from PDF/URL is now table stakes — build it early. Word cloud and type-answer should be FREE; Kahoot gates these at $25/mo — that's a wedge.

---

### B. Game / Session Engine
**PIN system:** 6-digit numeric code, server-generated on game start. Expires when session ends (live) or at deadline (async). No app required — kahoot.it browser works.

**Player join flow:** PIN → nickname (no account needed) → lobby → game. Question text appears on HOST screen; player device shows only colored answer buttons. This split-screen model creates room energy.

**Question reveal:** Auto-countdown 5→1, per-question timer configurable (5 sec to 4 min). Lecture Mode lets host advance manually.

**Answer submission:** Millisecond-precision, server-authoritative. Tap = locked.

**Game modes:** Classic (free), Team Mode (limited free), Ghost Mode (free), Accuracy Mode (Silver+), Lecture Mode (Silver+), Self-Paced async (all plans).

**Team Mode:** Auto-assigned teams, 5-second team discussion window, score = team average. Two configs: one shared device or all individual devices.

→ **Quizotic:** 6-digit PIN + split-screen architecture is correct. Ghost Mode (replay yourself) is high-value, cheap to build. Team Mode should be free up to N teams — Kahoot hard-restricts it as a premium lever.

---

### C. Real-Time Transport
**Kahoot's actual stack:** CometD (Bayeux protocol) — NOT Socket.io. Backend is a Java gameserver called "Merlin," JVM-optimized for month-long uptime. Time synchronization built into handshake (network lag + clock offset) enables fair millisecond scoring.

**Connection flow (reverse-engineered):**
```
GET  kahoot.it/reserve/session/{pin}/?{timestamp}  → session token
POST kahoot.it/cometd/{pin}/{token}/handshake       → establishes session
Channels: /service/controller (host), /service/player (players), /service/status (broadcast)
```

**OSS clone consensus:** Every serious clone (Rahoot, etc.) uses **Socket.io v4**. Supabase Realtime emerging as simpler alternative.

→ **Quizotic:** Socket.io 4.x is the right choice — it's what the whole community converged on. Build server-side clock sync into answer submission for fair speed scoring. The Rahoot monorepo pattern (packages/socket + packages/web + packages/common) is a clean architecture reference.

---

### D. Scoring System
**Formula:**
```
Points = floor( (1 - (response_time / question_timer) / 2) × 1000 )
```
- Instant answer: 1,000 pts
- At deadline: 500 pts (never 0 for correct)
- Linear decay (not exponential)
- Under 0.5 seconds = full 1,000

**Streak bonuses:** 2-in-a-row = +100, 3 = +200, 5+ = +500 (capped). Resets on wrong answer. Badge shown to player.

**Power-ups:** 2x Points, Eliminate (removes wrong answers), Ghost replay. Stacking works (2x + 2x = 4x).

**Leaderboard:** Top 5 after each question. Top 3 podium at end. Full data in reports only.

→ **Quizotic:** Copy this formula exactly — it's proven. The 500-point floor is good UX. Streak system is cheap to build and adds depth. Server-side timing is mandatory — never trust client timestamps.

---

### E. Reports & Analytics
- Per-player per-question: answer chosen, points earned, time taken
- Question-level accuracy %
- **Export:** XLSX native. Google Sheets only via third-party browser extension (known pain point).
- **LMS integrations:** Canvas, Blackboard, Moodle, Brightspace, Schoology, Clever (acquired for K-12 SSO)
- **API:** Reporting API exists but enterprise-only

→ **Quizotic:** XLSX export is mandatory day one. Native Google Sheets push immediately beats Kahoot (their users hate the extension workaround). The per-player × per-question data structure is what teachers care about.

---

### F. Monetization Gates

| Plan | Price | Player Limit |
|------|-------|-------------|
| Free | $0 | ~10 live |
| Plus Bronze | $3/mo | 50 |
| Plus Silver | $7/mo | 100 |
| Plus Gold | $12/mo | 200 |
| ONE | $19/mo | 800 |
| 360 Pro Start | $19/mo | 50 |
| 360 Pro Standard | $25/mo | 200 |
| 360 Pro Plus | $39/mo | 1,000 |
| 360 Pro Max | $59/mo | 2,000 |
| Enterprise | Custom | Custom |

Other gates: Team Mode (paid), word cloud ($25/mo), AI Generator (Silver+), LMS, API (enterprise).

→ **Quizotic:** 10-player free limit = most complained-about Kahoot restriction. Offer 35–50 free players and you've already won the trial. Gate on storage/export/AI, not player counts.

---

### G. Kahoot Strategic Direction (2024–2026)
- **Jan 2024:** $1.7B private equity acquisition (Goldman Sachs / KIRKBI). Delisted. M&A agenda.
- Past acquisitions: Clever (K-12 rostering), Motimate (corporate LMS), Whiteboard.fi — 7 total
- **AI:** GPT-4 question generation from PDFs, URLs, images, handwritten notes. AI image generator.
- **New 2025:** Standards-alignment tool (US curriculum), BBC Learning partnership, Kahoot! Coding
- **Enterprise push:** SOC2 Type 2, SCIM/SSO, custom branding (112 fonts), Reporting API, Missions

→ **Quizotic window:** Kahoot is going upmarket under PE. Their free tier will shrink further. The abandoned middle — modern product, generous free tier, developer-friendly, no LMS complexity — is Quizotic's lane.

---

## Section 2: Mentimeter Engine Breakdown

### A. Presentation Editor
**13 interactive slide types:**
Multiple Choice, Word Cloud, Open Ended, Scales, Ranking, Q&A, 100 Points, 2×2 Grid, Pin on Image, Who Will Win, Select Answer (Quiz), Type Answer (Quiz), Quick Form (Pro only).

**Editor mechanics:**
- 100 slides max per presentation
- Import: .ppt, .pptx, .key, .pdf (Basic+ only — locked on free)
- Embed PowerPoint / Google Slides within Menti (Pro)
- PowerPoint Add-in on Microsoft AppSource
- Mentimote: remote control from any device while presenting
- Multi-user editing with Ably presence awareness

**AI features:**
- AI Menti Builder: prompt → full interactive presentation draft
- AI Question Suggestions from topic
- AI Response Grouping: clusters open-ended answers into labeled groups
- AI Quiz Generator from topic

→ **Quizotic:** Mentimeter AI is creation-side (build faster). Quizotic should differentiate with audience-side AI: adaptive difficulty, live topic generation, post-quiz insight summaries per participant.

---

### B. Audience Join Flow
**Three methods:** menti.com + 6-digit code, QR code, direct link. No app required. No account required. Anonymous by default; optional named voting.

**Audience limits:**
| Plan | Limit |
|------|-------|
| Free | 50 participants/month total |
| Basic ($11.99/mo) | Unlimited |
| Pro ($24.99/mo) | Unlimited |
| Enterprise | Unlimited |

→ **Quizotic:** 50/month cap (not per-session) is Mentimeter's top pain point. Quizotic should offer per-session limits, not monthly aggregation. Code + QR + link all three are table stakes.

---

### C. Real-Time Architecture
**Confirmed stack (Ably case study + StackShare):**
- Frontend: React + Redux
- Backend: Ruby + Node.js
- Real-time layer: **Ably** (WebSocket pub/sub, managed)
- DB: PostgreSQL (Heroku Postgres) + Redis
- Analytics: AWS Kinesis
- Cloud: Heroku + AWS (CloudFront, S3, Lambda, SQS, SNS, Redshift)
- Scale: Kubernetes, 70,000+ concurrent verified, targeting 150,000+

**Vote flow:** Presenter opens slide → Ably channel activated → audience votes POST to Node.js → stored in Postgres → count published to Ably channel → all subscribers re-render live.

→ **Quizotic:** Socket.IO + Redis is the proven open-source equivalent. No need for Ably until 50k+ concurrent events. The gap to close now: vote animation quality — Mentimeter's word cloud growth and bar chart animations are polished and delightful. That visual feedback is a core UX win.

---

### D. Quiz / Competition Mode
- Mentimeter quiz is embedded in slide decks — hybrid (normal slides + quiz slides)
- Kahoot is pure quiz-first — every screen is a question
- **Mentimeter lacks:** team mode, randomized order, power-ups, per-player post-game breakdown
- **Mentimeter has:** flexible insertion mid-deck, quiz music, manual answer override by host

**Scoring:** Speed mode (500–1000 pts linear) or Accuracy mode (1000 flat). Wrong = 0.

**Leaderboard:** Top 10 only. Insert at any point in deck.

→ **Quizotic:** Quiz-first is a structural advantage over Mentimeter. Prioritize: team mode, power-ups, per-player analytics. Quiz music is a small but high-impact touch — add it. Host manual override for Type Answer is genuinely useful — copy it.

---

### E. Mentimeter Monetization

| Feature | Free | Basic ($11.99) | Pro ($24.99) | Enterprise |
|---------|------|----------------|--------------|------------|
| Audience/session | 50/month | Unlimited | Unlimited | Unlimited |
| Slide import (.pptx) | No | Yes | Yes | Yes |
| Excel/CSV export | No | Yes | Yes | Yes |
| Embed PPT/Google Slides | No | No | Yes | Yes |
| Custom branding | No | No | Yes | Yes |
| Collaboration | No | No | Yes | Yes |
| Private presentations | No | No | Yes | Yes |
| SSO / SCIM | No | No | No | Yes |
| API access | No | No | No | Yes |
| **Billing** | — | Annual only | Annual only | Custom |
| One-time event | — | — | — | $350+ |

→ **Quizotic:** Annual-only billing is Mentimeter's most-cited pricing complaint on G2/Capterra. Add monthly billing and you'll capture users who've left Mentimeter for this reason alone.

---

### F. Mentimeter Strategic Direction (2024–2026)
- AI Menti Builder, Response Grouping, Quiz Generator all launched
- 45% YoY growth in enterprise accounts (2025)
- Async survey mode matured
- Ably at 70k+ proven; targeting 150k+
- **Open gaps:** no team quiz mode, no randomized order, no per-player breakdown, no monthly billing, no numeric input type, no drawing/whiteboard

→ **Quizotic:** Mentimeter is chasing Fortune 500. Own the live social/competitive quiz space — the fun, gamified, mobile-first experience Mentimeter is too corporate to commit to.

---

## Section 3: Feature Matrix

| Dimension | Kahoot | Mentimeter | Quizotic Today | Gap to Close |
|-----------|--------|------------|----------------|-------------|
| **Core identity** | Gamified quiz | Interactive presentation | Live quiz platform | Quiz-first, no slide bloat |
| **Free player limit** | 10 live | 50/month | — | 35+ per session free |
| **Billing** | Monthly or annual | Annual only | — | Offer monthly |
| **Real-time stack** | CometD / Java ("Merlin") | Ably (managed) | Socket.IO | Add server-side clock sync |
| **Answer timing** | Millisecond, server-auth | Seconds | — | Implement server-side timing |
| **PIN join** | 6-digit, no app | 6-digit + QR + link | — | All three methods |
| **Split-screen UX** | Yes (host vs. player) | No (shared view) | — | Implement split-screen |
| **Team mode** | Paid gate | Not available | — | Free up to 4 teams |
| **Streak bonuses** | Yes | No | — | Copy Kahoot formula |
| **Power-ups** | 2x, Eliminate, Ghost | No | — | Build 2x + Eliminate |
| **Scoring formula** | Linear decay, 500pt floor | Linear or flat | — | Copy Kahoot formula |
| **Question types** | 14+ (some paid) | 13 (most free) | — | 6-8 done excellently |
| **AI generation** | Yes (from PDF/URL) | Yes (from prompt) | No | Topic → questions first |
| **AI response analysis** | No | Yes (grouping) | No | Post-quiz insight summaries |
| **Word cloud** | $25/mo gate | Free | — | Keep free |
| **Open-ended / type** | $25/mo gate | Free | — | Keep free |
| **Quiz music** | No | Yes | No | Add — cheap, high UX value |
| **Host manual override** | No | Yes (type answer) | — | Add for type-answer questions |
| **Reports** | Per-player × per-Q | Top-10 only | — | Full per-player breakdown |
| **Export** | XLSX (no Google Sheets) | Excel on Basic+ | — | Native Google Sheets push |
| **Ghost mode** | Free | N/A | No | Build — replay vs. yourself |
| **Public API** | Enterprise only | Enterprise only | — | Publish basic API (differentiate) |
| **LMS integrations** | 6 (paid) | Limited (paid) | No | Canvas/Google Classroom (roadmap) |
| **One-time event pricing** | Tiered plans | $350+ | — | Simple flat event ticket |

---

## Section 4: Quizotic Opportunity Backlog

Ranked by **differentiation value**. Tagged: **effort** (S/M/L), **novelty** (me-too / differentiator / leapfrog).

### Tier 1 — Build First (Table Stakes + Clear Wins)

| # | Opportunity | Effort | Novelty | Notes |
|---|-------------|--------|---------|-------|
| 1 | **35–50 free players per session** (not per month) | S | Differentiator | Single most complained-about limit on both competitors. Unlock and communicate this loudly. |
| 2 | **6-digit PIN + QR code + direct link** (all three join methods) | S | Me-too | Table stakes. QR is essential for projected-screen use. |
| 3 | **Split-screen architecture** — question on host screen, only answer buttons on player phone | M | Me-too | Kahoot's core UX identity. Creates the "room energy" moment. |
| 4 | **Server-side clock sync + millisecond scoring** | M | Me-too | Required for fair speed scoring. Never trust client timestamps. Use Kahoot's linear decay formula (500pt floor). |
| 5 | **Streak bonus system** | S | Me-too | 2-in-a-row → +100, 3 → +200, 5+ → +500. Cheap to build, adds depth. |
| 6 | **Monthly billing option** | S | Differentiator | Neither competitor offers this on entry plans. Capture all the Mentimeter churners who left over annual commitment. |
| 7 | **XLSX + CSV export free** | S | Differentiator | Both competitors gate this. Free export = teachers choose Quizotic for assignments. |

### Tier 2 — Build Next (Strong Differentiation)

| # | Opportunity | Effort | Novelty | Notes |
|---|-------------|--------|---------|-------|
| 8 | **Team mode free up to 4 teams** | M | Differentiator | Kahoot gates this; Mentimeter doesn't have it. Team quiz is the #1 request for classroom + corporate use. |
| 9 | **Native Google Sheets export** | M | Differentiator | Kahoot users hate the third-party extension workaround. Push results directly to Drive. |
| 10 | **Quiz music + sound effects** | S | Differentiator | Mentimeter has it; Kahoot doesn't. Cheap, high-impact UX upgrade. Gameshow tracks + answer reveal SFX. |
| 11 | **Host manual answer override** | S | Differentiator | Mentimeter-only right now. Essential for type-answer questions with typos. Host can click "accept anyway." |
| 12 | **Ghost mode** (replay a quiz against past self) | M | Differentiator | Kahoot's Ghost Mode is free and loved. Good for studying / personal bests. |
| 13 | **Per-player × per-question breakdown** | M | Differentiator | Mentimeter shows only top-10 leaderboard. Full individual breakdown is what teachers and corporate hosts actually need. |
| 14 | **Power-ups: 2x Points + Eliminate** | M | Me-too (Kahoot) | Adds game-depth. Gate as optional (host enables/disables per session). |

### Tier 3 — Leapfrog Moves (6–18 month horizon)

| # | Opportunity | Effort | Novelty | Notes |
|---|-------------|--------|---------|-------|
| 15 | **AI question generation from topic / PDF / URL** | L | Me-too (both have it) | Now table stakes. Build into the quiz editor — "Generate 10 questions from this URL." |
| 16 | **Post-quiz AI insight summary** | L | Leapfrog | Neither competitor does this well. After a session: "Your audience struggled most with X. 3 participants consistently fast on Y. Suggested follow-up: Z." Monetize as premium. |
| 17 | **Public API** (basic: create quiz, start session, get results) | L | Leapfrog | Both gate API to enterprise. Even a simple REST API would attract developer integrations, embeds, and automation users. Kahoot and Mentimeter both leave this market fully unserved. |
| 18 | **Adaptive difficulty mid-session** | L | Leapfrog | AI adjusts next question difficulty based on current player performance. Neither competitor has this. High perceived value for educational use cases. |
| 19 | **Simple event ticket pricing** | S | Differentiator | Mentimeter charges $350+ for a one-time event. Quizotic could do $19–49 for a single event with 500 players. High-conversion for trivia nights, corporate game days. |
| 20 | **Word cloud + open-ended answers — always free** | S | Differentiator | Kahoot gates these at $25/mo. Keeping them free positions Quizotic as the generous alternative. |

---

## Key Takeaways

1. **Kahoot's moat is brand and content library**, not technology. Their real-time stack is legacy Java/CometD. Socket.IO is the right choice for Quizotic.

2. **Mentimeter's moat is the presentation layer**. They're going enterprise and leaving the fun, live, social quiz space. That's Quizotic's exact lane.

3. **The free tier is the acquisition lever.** 10 players (Kahoot) and 50/month total (Mentimeter) = everyone's biggest complaint. Quizotic wins conversions by being genuinely usable for free.

4. **The scoring formula is solved.** Copy Kahoot's linear decay with 500pt floor. Don't reinvent it.

5. **The single biggest technical gap** in Quizotic vs. both: server-authoritative timing + split-screen host/player UX. Build these before anything else.

6. **The single biggest business gap:** monthly billing. Neither competitor offers it. It removes the #1 adoption barrier.

---

*Generated: 2026-04-15 | Sources: Kahoot.com, support.kahoot.com, Mentimeter.com, help.mentimeter.com, Ably case study, StackShare, OSS clone analysis (gh search), web research*
