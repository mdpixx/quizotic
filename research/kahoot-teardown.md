# Kahoot Competitive Intelligence Teardown
**For: Quizotic (quizotic.live)**
**Date: 2026-04-15**
**Sources: Public pages, support docs, OSS clone analysis, engineering blog, protocol reverse-engineering**

---

## Executive Summary

Kahoot is a $1.7B-acquired gamified learning platform (Goldman Sachs + LEGO + General Atlantic, Jan 2024) with dominant mindshare in K-12 education and a serious enterprise push. Their core moat is the PIN-based group play model, a massive content library, and deep LMS integrations. Their weaknesses: stale real-time architecture (CometD/Bayeux over Java — a 2015-era choice), aggressive paywalling of basic features (team mode, AI, advanced question types), and an increasingly bloated product covering too many segments.

---

## A. Quiz Builder (Editor)

### Question Types

| Type | Available On | Notes |
|------|-------------|-------|
| Multiple choice (2-4 answers) | Free | Core type |
| True/False | Free | |
| Image answer | Free | |
| Poll (no scoring) | Free | |
| Multi-select (multiple correct) | Free | Up to 500pts per correct answer |
| Drop pin (click on image area) | Silver+ ($7/mo) | |
| Scale/Rating | Silver+ | |
| Slider (numeric range) | Gold+ ($12/mo) | 80% precision + 20% speed scoring |
| Type answer (open text) | 360 Standard+ ($25/mo) | |
| Pin answer (place on image) | 360 Standard+ | |
| Brainstorm | 360 Standard+ | Collaborative ideation |
| Word cloud | 360 Standard+ | Aggregate player responses visually |
| Q&A | 360 Standard+ | Audience questions to host |
| Puzzle (sequence ordering) | Bronze+ ($3/mo) | |

**Total confirmed types: 14+**

### Media Support
- Images: yes (URLs or upload, free)
- YouTube embed: yes (confirmed by Rahoot clone support pattern)
- Video: yes
- Audio: mentioned in OSS clone spec; not confirmed free vs paid on Kahoot proper
- AI-generated images: Gold+ (type a prompt, GPT-4 generates image)

### Character Limits
- Not publicly documented. Community reports suggest ~95 characters for questions, ~60 for answers.

### AI Question Generation (2024-2026)
- **Generate from topic**: type a subject, select language/difficulty/count → full quiz
- **Generate from PDF**: upload document → extract or generate questions
- **Generate from URL**: paste any webpage → generate questions
- **Generate from Wikipedia**: article → quiz
- **Generate from slides**: import Google Slides/PowerPoint → quiz
- **Handwritten notes scanner**: photo → flashcards/quiz (mobile)
- **Question extraction**: pull exact questions from uploaded PDFs (Q2 2025 launch)
- **AI Image Generator**: generate images for questions via text prompt (Q2 2025)
- Underlying model: **GPT-4** (confirmed)
- Supports **58 languages**
- Available on: Gold ($12/mo) for edu, 360 Pro ($25/mo) for business

### Import
- Spreadsheet import (XLSX template)
- Google Forms → Kahoot via spreadsheet importer
- Slides sync from Google Slides and PowerPoint (auto-link)

### Max Questions per Quiz
- Not officially stated. Community reports suggest 100+ supported.

### Templates
- Thousands of community and official templates
- Content library with branded collections (BBC, TED-Ed, Disney, Marvel, Wikipedia)
- Standards-alignment tool: search by US state/national curriculum standard (April 2026)

→ **Quizotic implication:** Kahoot's 14-type question library is overkill for most users but a selling point in enterprise RFPs. Prioritize: multiple choice, true/false, type answer (open text), poll, word cloud. Skip slider/drop-pin for now. AI generation from PDF/URL is table stakes by 2026 — build this early, even if basic. The image generator is a nice-to-have but not a differentiator.

---

## B. Game / Session Engine

### Game PIN
- Format: **6-digit numeric code** (e.g., `438291`)
- Generated **server-side** when host starts a session
- Only the host triggers generation — players cannot create PINs
- Live game PIN expires when the game ends
- Assignment (async) PIN is deadline-based, lasts until set date
- Entry points: kahoot.it browser OR mobile app (no app required for players)

### Player Join Flow
1. Host presses "Start" → 6-digit PIN shown on screen
2. Player opens kahoot.it or app → enters PIN
3. Player enters nickname (free text, no account needed)
4. Player lands in lobby → waits for host to begin
5. Questions display on **host's shared screen** — players only see answer buttons on personal device
6. After each question: correct answer revealed on host screen + speed podium
7. After each question: leaderboard (top 5 shown on shared screen by default)
8. End screen: podium (top 3), full results, share/download

### Host View vs Player View Architecture
- **Split screen model**: critical to Kahoot's design
- Host screen (TV/projector): question text + media + countdown timer + live answer distribution bar
- Player screen (phone): only answer buttons (A/B/C/D colored shapes) — question text NOT shown on player device in classic mode
- This forces players to look at the shared screen, creating group engagement

### Question Reveal Mechanism
- Host presses "Start" → countdown begins automatically (5-4-3-2-1)
- Timer is per-question (configurable from 5 seconds to 4 minutes)
- Question auto-advances after timer ends OR host can advance manually in Lecture Mode
- Cooldown period between questions (customizable)

### Answer Submission
- Players tap one of 2-4 colored buttons on their device
- Submission is timed from question reveal to button tap
- **Precision**: millisecond-level (used for speed scoring calculation)
- After submission: player device shows "answer submitted" state; no ability to change
- Answer lock: once submitted, final

### Game Modes
| Mode | Description | Plan |
|------|-------------|------|
| Classic | Speed + accuracy scoring | Free |
| Team Mode | Grouped scoring (shared or individual device) | Limited free; paid for full |
| Ghost Mode | Play against your own previous scores | Free |
| Accuracy Mode | No speed factor, correct answers only | Silver+ |
| Lecture Mode | Host controls pacing (no auto-countdown) | Silver+ |
| Self-Paced | Async, deadline-based | All plans |

### Spectator Mode
- Not a formal named feature. Players who join late or watch can observe but cannot submit. No dedicated spectator URL or experience.

### Team Mode Mechanics
- Automatic team assignment (host sets team count)
- Team Talk: 5-second built-in discussion window
- Score = average of all team members' scores
- Auto-rebalances if players drop mid-game
- Shared device OR individual device configurations

→ **Quizotic implication:** The split-screen model (question on big screen, only answer buttons on phone) is Kahoot's most important UX decision — it creates room energy. Quizotic should replicate this by default. The 6-digit PIN is simple and works; stick with it. Ghost Mode is cheap to build and high perceived value. Team Mode is a meaningful paid differentiator.

---

## C. Real-Time Transport

### What Kahoot Actually Uses
- **Protocol: CometD (Bayeux protocol)**
- CometD is a publish/subscribe messaging framework built on the Bayeux specification
- It uses **WebSocket as preferred transport** and falls back to **HTTP long-polling** automatically
- This is NOT plain Socket.io — Kahoot built on Java's CometD implementation

### Connection URL Structure (Reverse-Engineered)
```
GET  https://kahoot.it/reserve/session/{pin}/?{timestamp}
     → Returns x-kahoot-session-token header

GET  https://kahoot.it/cometd/{pin}/{session-token}
     → Returns 400 (initializes slot)

POST https://kahoot.it/cometd/{pin}/{session-token}/handshake
     → JSON: channel, advice (timeout: 60000ms), ext (time sync), version "1.0"
```

### Service Channels
- `/service/controller` — host commands (start, advance, end)
- `/service/player` — player events (join, answer submit)
- `/service/status` — game state broadcasting

### Time Synchronization
Built-in at the handshake level: the protocol syncs client clock to server clock to compute fair speed scores (accounts for network lag). Parameters: `l` (lag), `o` (offset), `tc` (client timestamp in ms).

### Backend Architecture
- **Gameserver "Merlin"**: Java application designed for months of uninterrupted uptime
- JVM-optimized with custom flags: `-XX:CompressedClassSpaceSize=256m`, `-XX:MaxMetaspaceSize=256m`, `MALLOC_ARENA_MAX=4`
- Each game creates and disposes of session/client objects — ephemeral session model
- Stress tested for "massive traffic load" + memory leak validation

### OSS Clone Stack (What Community Uses)
- **Socket.io v4** is universal in community clones (Rahoot, kahoot-clone-nodejs, KahootAlternative)
- Supabase Realtime (PostgreSQL pub/sub) emerging as alternative
- Firebase Realtime Database used in older clones (AngularJS-era)

→ **Quizotic implication:** Kahoot's CometD/Java stack is legacy. Socket.io 4.x is the right choice for Quizotic (simpler, Node.js native, auto WebSocket+polling fallback, battle-tested). The time-sync handshake is critical for fair speed scoring — build clock sync into your answer submission flow. Supabase Realtime is worth considering as a simpler alternative if you want to reduce infra overhead.

---

## D. Scoring System

### Base Formula
```
Points = floor( (1 - (response_time / question_timer) / 2) × points_possible )
```

- Default max: **1,000 points per question**
- At 0 seconds (instant): **1,000 points**
- At full timer elapsed: **500 points** (never 0 for correct answer in classic mode)
- Decay is **linear** (not exponential)
- Answering in under **0.5 seconds** = full points awarded
- Wrong answer = **0 points**

### Speed Bonus Mechanics
- The "half at deadline" formula means speed is meaningful but never catastrophic
- Waiting 4 extra seconds can cost 600+ points on a 10-second question
- This creates real urgency without punishing slow thinkers entirely (500pts floor)

### Streak Bonuses
| Streak Level | Bonus Points |
|-------------|-------------|
| 2 in a row | +100 |
| 3 in a row | +200 |
| 5+ in a row | +500 (capped) |

- Streak badge shown to player (psychological reward beyond points)
- Resets on first wrong answer
- Design intent: reduce guessing, reward consistent knowledge

### Special Scoring Modes
- **Accuracy Mode**: speed irrelevant — 1,000 pts for correct, 0 for wrong
- **Slider/Matching**: 80% precision score + 20% speed score
- **Multi-select**: up to 500 pts per correct answer (partial credit possible)
- **No negative scoring** by default

### Power-Ups
- **2x Points**: doubles score for one question
- **Eliminate**: removes incorrect answers one by one (helps weak players)
- **Ghost Mode replay**: competes against personal historical scores
- **Stacking**: two 2x power-ups = 4x (they combine, not cancel)

### Leaderboard
- After each question: top 5 shown on host/shared screen
- End of game: podium (top 3) on shared screen, full list available in reports
- No full live leaderboard during game (intentional — reveals top performers only)

→ **Quizotic implication:** Copy Kahoot's linear decay formula exactly — it's proven and fair. The 500-point floor for slow-but-correct answers is good UX, keeps engagement. Streak bonuses are cheap to build and add psychological depth — implement these. Build in "Accuracy Mode" toggle from day one (removes speed anxiety, broader appeal). The millisecond precision requires server-authoritative timing, not client-side timing.

---

## E. Reports & Analytics

### Post-Game Data Available
- Session metadata (date, host, participant count)
- Player leaderboard (nickname, score, correct/incorrect counts)
- Per-player per-question breakdown: answer chosen, points earned, time taken
- Question-level accuracy: % of players who answered correctly
- Pivot-table friendly raw data sheet

### Export Formats
- **XLSX** download (native)
- Google Sheets (via Grading Assistant browser extension — third party)
- No native PDF export
- No native Google Sheets direct push (requires extension)

### LMS Integrations
- Canvas, Blackboard, Moodle, Brightspace, Schoology — SSO login integration
- Clever (acquired — deep integration for K-12 school rostering)
- Automated grading and attendance reporting

### API Access
- **Reporting API**: enterprise plans only — NOT in any standard paid tier
- No public API for quiz creation/management

→ **Quizotic implication:** XLSX export is table stakes — ship it. Native Google Sheets push would be a differentiator over Kahoot (their users hate the extension workaround). Per-question accuracy + per-player breakdown is what teachers actually use for formative assessment — prioritize this data structure. LMS integrations are a moat for enterprise/education; defer but put Clever/Canvas on the roadmap.

---

## F. Monetization Gates

### Free Tier
- Multiple choice, true/false, image answers, polls, multi-select
- Basic reports (view + download)
- Classic game mode
- Player limit: ~10 concurrent players for live games (higher ed; varies by context)
- Ghost mode
- 1 free team mode test then upgrade required

### Paid Progression (Education)

| Gate | Plan Required | Price |
|------|--------------|-------|
| 50 players | Plus Bronze | $3/mo |
| 100 players | Plus Silver | $7/mo |
| Accuracy Mode | Plus Silver | $7/mo |
| Lecture Mode | Plus Silver | $7/mo |
| AI Generator (basic) | Plus Silver | $7/mo |
| 200 players | Plus Gold | $12/mo |
| AI Generator (unlimited, PDF) | Plus Gold | $12/mo |
| Slider question type | Plus Gold | $12/mo |
| 800 players | ONE | $19/mo |
| All features | ONE | $19/mo |

### Paid Progression (Business 360)

| Gate | Plan Required | Price |
|------|--------------|-------|
| 50 players | Pro Start | $19/mo |
| Type answer, word cloud, brainstorm | Pro Standard | $25/mo |
| 200 players | Pro Standard | $25/mo |
| Courses with certificates | Pro Plus | $39/mo |
| NPS surveys | Pro Plus | $39/mo |
| 1,000 players | Pro Plus | $39/mo |
| Custom branding, 112 fonts | Pro Max | $59/mo |
| 2,000 players | Pro Max | $59/mo |
| SSO, SCIM, reporting API | Enterprise | Custom |

### Player Limit as Primary Paywall
Kahoot's main monetization lever is player count per session. Free tier is deliberately crippled (10 players) to force upgrade for any real classroom (typically 25-35 students).

### What Competitors Exploit
- Gimkit, Blooket — more free player capacity
- Quizizz — unlimited players free for basic
- Mentimeter — better free tier for word clouds / open-ended

→ **Quizotic implication:** Free tier player limits are Kahoot's most resented paywall — "I can't use it with my class without paying" is the #1 complaint on Reddit/Twitter. Quizotic should offer at least 30-40 free players to beat Kahoot's free tier as a wedge. Word cloud and open-ended questions should be free — Kahoot gates these at $25/mo. Team Mode should be free up to a limit (Kahoot restricts it hard). The player-limit paywall model itself is valid — just set the floor higher.

---

## G. Recent Strategic Bets (2024-2026)

### Acquisition & Corporate Restructuring
- **January 2024**: Taken private at **$1.7 billion** by Goldman Sachs Asset Management, General Atlantic, and KIRKBI (LEGO Group's investment arm)
- Delisted from Oslo Børs
- New mission: invest privately in product + targeted M&A for enterprise growth
- Past acquisitions: **Clever** (K-12 SSO/LMS platform), **Motimate** (mobile corporate learning), **Whiteboard.fi** (collaborative whiteboard)

### AI Push (2023-2026)
- 2023: AI Question Generator launched (topic/URL/Wikipedia → quiz)
- Jan 2024: AI PDF-to-Kahoot generator for educators
- Q2 2025: Question extraction from PDF (not just generation)
- Q2 2025: Slide-based AI generation (auto-import Google Slides/PowerPoint)
- Q2 2025: AI Image Generator (GPT-4 image generation for questions)
- Custom fonts expanded from 6 to 112 (targeting enterprise branding)
- Underlying model: OpenAI GPT-4
- Privacy stance: does not train on user data

### New Question/Content Types
- Standards-alignment tool (April 2026) — map questions to US curriculum standards
- BBC Learning content partnership (April 2026) — ready-to-use science/history/geography kahoots
- Kahoot! Coding questions (Scratch-like block coding in quiz format)

### Enterprise Moves
- SOC2 Type 2 compliance
- SCIM + SSO (Federated Identity Management)
- Custom domain hosting for 360 Pro Max
- NPS survey capabilities within quiz sessions
- Courses with certificates (self-paced LMS functionality)
- "Missions" feature — team achievement gamification for corporate use
- Reporting API (enterprise only)
- Commercial/advertising usage rights tier (Pro Max)

### Education Expansion
- FE Maths Challenge: 58,000 Further Education students (UK, March 2026)
- Kahootopia! class-wide rewards system (engagement layer beyond individual scoring)
- Partnership with Lean In Girls (leadership development)

→ **Quizotic implication:** Kahoot is going deep on enterprise and institutional (not casual/consumer). Their AI investment is real but locked behind paywalls. Their coding questions show product creativity but niche appeal. The private-equity acquisition means they're optimizing for revenue/EBITDA — expect more paywalling, less free tier generosity. Quizotic's window: own the "powerful free tier + modern UX + developer-friendly" segment before Kahoot closes the gap.

---

## Competitive Position Summary

### Kahoot's Moats
1. **Brand awareness** — "let's do a Kahoot" is a verb in classrooms
2. **Content library** — millions of community-made kahoots + branded partnerships
3. **LMS integrations** — Clever acquisition + Canvas/Blackboard native support
4. **Enterprise deals** — Fortune 500 clients (Amazon, Meta, Salesforce, HP)
5. **PIN-based simplicity** — zero friction for players (no account needed)

### Kahoot's Weaknesses
1. **Aggressive paywalling** — basic features like team mode, AI, and advanced question types behind $7-$25/mo gates
2. **Legacy tech stack** — CometD/Java gameserver vs. modern Socket.io/Node.js alternatives
3. **Question text on big screen only** — no mobile question reading (accessibility issue)
4. **Slow product iteration** — tech blog last updated December 2023
5. **Over-segmented** — 10+ pricing tiers creates confusion and decision fatigue
6. **No public API** — locked ecosystem, developer-hostile
7. **Bloated surface area** — trying to be quiz platform + LMS + flashcard app + coding tool simultaneously

### What Quizotic Should Copy
- 6-digit PIN join flow (no friction)
- Split-screen architecture (group energy)
- Linear speed-decay scoring formula with 500pt floor
- Streak bonus system (psychological depth)
- Per-question timer + cooldown UX
- XLSX post-game reports with per-player/per-question breakdown
- Free player tier generosity (undercut Kahoot's 10-player free limit)

### What Quizotic Should Improve On
- Modern real-time stack (Socket.io 4.x vs. Kahoot's CometD/Java)
- More question types free (word cloud, open-ended should not cost $25/mo)
- Question text visible on player device (not just host screen) — accessibility + mobile-first
- Simpler pricing (2-3 tiers max vs. Kahoot's 10+)
- Public API from day one (developer ecosystem)
- Native Google Sheets/Notion export (not extension workaround)
- Self-hostable option (Rahoot proves demand exists)

### What Quizotic Should Avoid
- Trying to be an LMS (Kahoot's Motimate/courses play is a strategic dead end for a quiz platform)
- Gating team mode behind a paywall (it's the best feature)
- Per-player pricing without a generous free floor

---

## Raw Sources

- Raw homepage + schools + business data: `research/_raw/kahoot-homepage.md`
- Scoring, PIN, game modes, protocol: `research/_raw/kahoot-support.md`
- OSS clone analysis + Rahoot stack: `research/_raw/kahoot-oss-clones.md`
