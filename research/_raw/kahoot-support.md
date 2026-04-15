# Kahoot Support Documentation — Raw Scrape

Source: support.kahoot.com articles (scraped via web search + individual article fetches)
Scraped: 2026-04-15

---

## Scoring System — How Points Work

### Base Formula
```
Points = floor( (1 - (response_time / question_timer) / 2) × points_possible )
```

- Default max per question: **1,000 points**
- Answering under **0.5 seconds** = maximum points (full 1,000)
- Answering at exactly the deadline = **500 points** (half maximum)
- The formula is **linear** — speed penalty is proportionate
- Wrong answer = **0 points** (no negative scoring by default)

### Special Question Scoring
- **Multi-select**: up to 500 points per correct answer
- **Slider / Matching**: 80% precision score + 20% speed score (NOT pure speed)
- **Accuracy Mode**: only correct answers count — speed is irrelevant

### Streak Bonus System (Answer Streaks)
- 2 correct in a row: **+100 bonus points**
- 3 correct in a row: **+200 bonus points**
- 5+ correct in a row: **+500 bonus points** (capped)
- Streak resets on wrong answer
- Design intent: incentivize careful thinking, not just speed

---

## Game PIN System

- Format: **6-digit numeric code** (e.g., 438291)
- Generated **server-side** when host starts a game
- Only the host can generate a PIN
- **Expiry**: live game PINs expire when the game ends; assignment PINs last until the deadline
- Players join at kahoot.it or via app — no app required for players

---

## Real-Time Protocol (Reverse-Engineered via Community Docs)

### Protocol: CometD over Bayeux
Kahoot uses **CometD** (Bayeux protocol) — NOT plain Socket.io or plain WebSocket.
CometD uses WebSocket as its preferred transport, falling back to HTTP long-polling.

### Connection Flow
1. GET `https://kahoot.it/reserve/session/{pin}/?{timestamp}` → returns `x-kahoot-session-token` header
2. GET `https://kahoot.it/cometd/{pin}/{session-token}` → 400 response (initializes connection)
3. POST `https://kahoot.it/cometd/{pin}/{session-token}/handshake` → JSON payload with:
   - `channel`: `/meta/handshake`
   - `advice`: timeout=60000ms, interval settings
   - `ext`: time sync (network lag, clock offset, client timestamp in ms)
   - `id`: incremental counter
   - `version`: "1.0"

### Service Channels
- `/service/controller` — host controls (start game, next question, end game)
- `/service/player` — player actions (join, submit answer)
- `/service/status` — game state updates

### Frontend Tech Stack (Confirmed)
- **TypeScript** on frontend
- **Java** on backend (gameserver codenamed **"Merlin"**)
- Schema validation at runtime for WebSocket data (extra safety layer)

---

## Game Modes

### Classic Mode
- Standard speed-based scoring
- Full leaderboard after each question (top 5 shown on screen)

### Team Mode
- Players divided into teams automatically
- Two configurations:
  1. Shared device — one device per team, team nominates a player to input answers
  2. Individual devices — all players answer, score is team average
- Team Talk: 5-second discussion window before answering
- Teams auto-rebalanced if players drop
- Limited in free plans (5 teams max in free higher ed)

### Accuracy Mode (Education, Silver+)
- No speed bonus — only correct answers count
- Removes speed anxiety; encourages careful thinking

### Lecture Mode (Education, Silver+)
- Teacher controls pacing — questions advance only when teacher decides
- No auto-countdown pressure

### Ghost Mode
- Players replay the same quiz competing against their own previous session score
- The "ghost" represents their historical answers and response times
- Encourages practice and self-improvement

### Self-Paced Mode
- Async kahoots — players complete on their own time
- Deadline-based rather than live session

---

## Post-Game Reports

### Available Data
- Overview sheet: session metadata, host, participant count, overall performance
- Player leaderboard: nickname, total score, correct/incorrect counts
- Detailed per-player results: every question, points earned, answer chosen, time taken
- Question-level sheet: per-player breakdown including answer chosen + time
- Pivot-table friendly data table

### Export Formats
- **XLSX** (spreadsheet download)
- Direct export to **Google Sheets** via Grading Assistant extension
- Not native PDF export (third-party tools needed)

### LMS Integrations
- Canvas, Blackboard, Moodle, Brightspace, Schoology — direct SSO login
- Clever integration (acquired)
- Automated grading and attendance reporting

### API Access
- Reporting API: available in **enterprise plans only** (not in standard 360 plans)

---

## Player Join Flow

1. Host starts game → PIN displayed on screen
2. Players go to kahoot.it or open Kahoot app
3. Enter 6-digit PIN
4. Enter nickname (free-form text, no login required for players)
5. Wait in lobby screen while host admits players
6. Game begins — questions shown on host screen, answer choices on player device
7. After each question: correct answer revealed + speed podium
8. After each question: leaderboard (top 5 displayed by default)

---

## Power-Ups (Game Power-Ups)

- **2x Points**: doubles points earned for one question
- **Ghost Mode**: reuse previous session for competition (see above)
- **Eliminate**: removes wrong answers one by one
- **2x stacking**: if host and player both apply 2x, result is 4x
- Power-ups are designed to stack, not cancel each other
