# Phase 4 — Visual Redesign + Avatar System + Learning Science

## Goal

Elevate Quizotic's visual design from a functional developer skeleton to a top-notch, game-quality experience. Introduce a combinatorial avatar system that gives every participant a unique identity throughout the session. Fold in five learning science features — Answer Explanations, Confidence Tap, Practice Mode, Bloom's Taxonomy tags, and an End-of-Session Report — that differentiate Quizotic from Kahoot on pedagogical depth.

## Design Direction

**Light + Vivid** — warm white background with a subtle indigo dot-grid pattern and soft corner glow orbs, vivid gradient answer cards, indigo accent for timer/game code, lime accent for CTAs and question card border. Optimised for classroom projectors, wide age ranges, and mobile screens simultaneously.

Inspired by: superr.ai (spacing, warmth, organic feel), Kahoot (vivid color blocks on light bg), 21st.dev (dot-grid texture).

---

## Design Tokens

| Token | Value | Reason |
|-------|-------|--------|
| Page background | `#fafaf8` | Warm white — reduces blue-light glare vs pure white, projects perfectly in ambient classroom light |
| Surface / cards | `#ffffff` + `shadow-sm` + `border border-gray-200` | Maximum legibility, projects cleanly |
| Primary text | `#111111` | Near-black, warmer than pure black |
| Secondary text | `#52525b` | Zinc-600 — readable, not harsh |
| Muted text | `#9ca3af` | Labels, metadata |
| Accent — lime | `#a3e635` / `lime-400` | Brand color — used for question card top border, CTA buttons, logo |
| Accent — indigo | `#4f46e5` / `indigo-600` | Timer, progress bar, game code — 8.6:1 contrast on white (WCAG AAA). Indigo = creativity + engagement in education research |
| Timer track | `#e0e7ff` / `indigo-100` | Soft, non-intrusive ring background |
| Progress track | `#e0e7ff` / `indigo-100` | Matches timer track |
| Low-time color (≤5s) | `#ef4444` / `red-500` | Universal urgency signal |
| Answer A | `bg-gradient-to-br from-pink-700 to-pink-500` + `shadow-[0_4px_16px_rgba(236,72,153,0.25)]` | Vivid blocks pop harder on white than on black |
| Answer B | `bg-gradient-to-br from-orange-700 to-orange-500` + `shadow-[0_4px_16px_rgba(249,115,22,0.25)]` | |
| Answer C | `bg-gradient-to-br from-blue-700 to-blue-500` + `shadow-[0_4px_16px_rgba(59,130,246,0.25)]` | |
| Answer D | `bg-gradient-to-br from-green-700 to-green-500` + `shadow-[0_4px_16px_rgba(34,197,94,0.25)]` | |
| Border radius | `rounded-2xl` (16px) cards, `rounded-xl` (12px) smaller elements | |

---

## Background Pattern

Applied to every page as a fixed full-screen layer behind all content (`pointer-events-none`, `fixed inset-0 -z-10`):

```tsx
// Two layers stacked:

// 1. Dot grid — subtle indigo dots at 20px intervals
<div
  className="fixed inset-0 -z-10"
  style={{
    background: '#fafaf8',
    backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
    backgroundSize: '20px 20px',
  }}
/>

// 2. Corner glow orbs — soft indigo top-right, soft lime bottom-left
<div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
  <div style={{
    position: 'absolute', top: -120, right: -120,
    width: 400, height: 400,
    background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 65%)',
    filter: 'blur(40px)',
  }} />
  <div style={{
    position: 'absolute', bottom: -120, left: -120,
    width: 360, height: 360,
    background: 'radial-gradient(circle, rgba(163,230,53,0.09) 0%, transparent 65%)',
    filter: 'blur(40px)',
  }} />
</div>
```

Implement as a shared `<Background />` component (`src/components/Background.tsx`) added **once in `src/app/layout.tsx`** — not per-page. Placing it in the root layout guarantees a single render across all routes and avoids accidental double-rendering.

---

## CircularTimer Component

`src/components/CircularTimer.tsx`

```tsx
'use client'
const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // 125.66

export function CircularTimer({ timeLeft, total }: { timeLeft: number; total: number }) {
  const progress = total > 0 ? timeLeft / total : 0
  const offset = CIRCUMFERENCE * (1 - progress)
  const isLow = timeLeft <= 5

  return (
    <div className="relative w-12 h-12">
      <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="#e0e7ff" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={RADIUS} fill="none"
          stroke={isLow ? '#ef4444' : '#4f46e5'}
          strokeWidth="3"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${isLow ? 'text-red-500' : 'text-indigo-600'}`}>
        {timeLeft}
      </span>
    </div>
  )
}
```

---

## Progress Bar

Linear bar below the timer row:

```tsx
<div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
  <div
    className={`h-full rounded-full transition-all duration-1000 ${
      timeLeft <= 5
        ? 'bg-red-500'
        : 'bg-gradient-to-r from-indigo-600 to-indigo-400'
    }`}
    style={{ width: `${(timeLeft / total) * 100}%` }}
  />
</div>
```

---

## Avatar System

### Concept

Every participant types their **real display name** and receives an **auto-assigned archetype** with a matching pixel-art avatar. The archetype persists for the whole session and is visible on both the participant's phone and the host's screen.

Example: "Priya" joins → assigned "Crystal Fox" → shown as "Priya · Crystal Fox" with a pixel-art fox avatar.

### Archetype Pool — 300 combinations

**20 Elements:**
Fire, Ice, Storm, Shadow, Thunder, Solar, Lunar, Cosmic, Iron, Crystal, Void, Phoenix, Neon, Obsidian, Glacier, Inferno, Titan, Mystic, Blood, Sakura

**15 Types:**
Dragon, Tiger, Ninja, Samurai, Wizard, Wolf, Eagle, Fox, Cobra, Knight, Archer, Panther, Viper, Monk, Phoenix

Assignment is random per participant per session. Same participant rejoining a new session may get a different archetype — intentional (keeps it fresh).

### Avatar Rendering

**Package:** `@dicebear/core` + `@dicebear/pixel-art` — both are standalone npm packages in DiceBear v9+. Verify they install together without peer dependency errors; they should be on matching major versions.

**Seed:** archetype name with spaces removed e.g. `"CrystalFox"` — same archetype always renders the same pixel-art face.

**Component:** `src/components/Avatar.tsx`
```tsx
'use client'
// DiceBear SVGs are generated locally from a string seed — no network call, no user-controlled HTML.
// dangerouslySetInnerHTML is safe here. Keep it if DiceBear ever adds sanitisation.
import { createAvatar } from '@dicebear/core'
import { pixelArt } from '@dicebear/pixel-art'

export function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const svg = createAvatar(pixelArt, { seed: archetype.replace(/\s/g, ''), size }).toString()
  return (
    <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
```

### Server Changes (`server.mjs`)

`server.mjs` is **native ESM** (`.mjs` extension). It cannot import TypeScript — Node runs it without transpilation.

**Create `src/lib/archetypes.mjs`** (pure ESM JS, no TypeScript). Import it in `server.mjs` with a relative path:
```js
import { assignArchetype } from './src/lib/archetypes.mjs'
```

Also export the same data from `src/lib/archetypes.ts` for Next.js components. **Both files must be kept in sync manually** — add a comment at the top of each: `// SYNC: keep in sync with archetypes.mjs / archetypes.ts`.

**Participant object shape** — keep `name` (used throughout existing helpers: `countAnswers`, `countAnswersByOption`, `buildLeaderboard`, disconnect handler). Add `archetype` and `answers` array:
```js
{ name: displayName, archetype, score: 0, answers: [] }
```

**Update `buildLeaderboard` helper** to include `archetype`. The function signature changes from `buildLeaderboard(session)` to `buildLeaderboard(participants)` — also update the two existing call sites from `buildLeaderboard(session)` to `buildLeaderboard(session.participants)`:
```js
// Before: function buildLeaderboard(session) { ... }
// After:
function buildLeaderboard(participants) {
  return Array.from(participants.values())
    .sort((a, b) => b.score - a.score)
    .map(p => ({ name: p.name, archetype: p.archetype, score: p.score }))
}
// Call sites (update both): buildLeaderboard(session.participants)
```

**Socket handler changes:**
- `join_session`: call `assignArchetype()`, store on participant, return in callback: `{ success, status, quizTitle, archetype, practiceMode }`
- `participant_joined` emit: `{ name, archetype }` — host lobby uses this to build avatar grid
- `participant_left` emit: keep as `{ name, count }` — host removes by matching `name`; host state is `Map<name, archetype>` so removal by name is straightforward
- Leaderboard entries: `{ name, archetype, score }` (via updated `buildLeaderboard`)

### Avatar Reveal Animation

On the join lobby phase, use a CSS transition (not `animate-bounce` — it loops forever in Tailwind):

```tsx
const [revealed, setRevealed] = useState(false)
useEffect(() => { const t = setTimeout(() => setRevealed(true), 100); return () => clearTimeout(t) }, [])

<div className={`transition-all duration-500 ${revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
  <Avatar archetype={archetype} size={96} />
</div>
```

On the host lobby, each avatar pops in via the same `scale-0 → scale-100` transition as `participant_joined` events arrive.

### Host Participants State — type change

The existing host session page stores participants as `useState<string[]>([])`. Change this to a `Map`:

```tsx
// Before:
const [participants, setParticipants] = useState<string[]>([])

// After:
const [participants, setParticipants] = useState<Map<string, string>>(new Map())
// key = displayName, value = archetype

// participant_joined handler:
socket.on('participant_joined', ({ name, archetype }: { name: string; archetype: string }) => {
  setParticipants(prev => new Map(prev).set(name, archetype))
})

// participant_left handler:
socket.on('participant_left', ({ name }: { name: string }) => {
  setParticipants(prev => { const next = new Map(prev); next.delete(name); return next })
})
```

Render the avatar grid by iterating `Array.from(participants.entries())`.

**Also update all participant count displays:** `Map` has no `.length` — change all three occurrences to `.size`:
- Lobby header: `{participants.length}` → `{participants.size}`
- Lobby body "X joined": `${participants.length} joined` → `${participants.size} joined`
- Question phase answer counter: `/ {participants.length} answered` → `/ {participants.size} answered`

### Mid-session Join

If participant joins while session is `active`, avatar is still assigned and returned. The client detects `status === 'active'` and sets phase to `'question'` — but has no `question` data yet (the server does not re-emit `question_show` on join). The participant sees a loading/waiting state until the next `question_show` event arrives. Archetype still shows in answered/ended screens once the question starts.

### Play Again — Archetype Reset

"Play Again" resets all state including `archetype` (set to `null`). Next join call receives a freshly assigned archetype.

---

## Join Page — URL Pre-fill (QR Scan)

`useSearchParams()` in Next.js 16 requires a `Suspense` boundary — without it the build throws a static generation error.

The **entire page content** (all state declarations, socket setup, `useEffect` hooks, and all phase renders) must move into `JoinPageInner`. The outer `JoinPage` contains only the `Suspense` wrapper:

```tsx
// src/app/join/page.tsx
import { Suspense } from 'react'

// All existing JoinPage content + new Phase 4 state/logic goes here:
function JoinPageInner() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  // ... all useState, useRef, useEffect, socket setup, phase renders
}

// Outer wrapper — minimal, no logic:
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaf8]" />}>
      <JoinPageInner />
    </Suspense>
  )
}
```

---

## QR Code

Package: `react-qr-code`

```tsx
import QRCode from 'react-qr-code'

<div className="bg-white rounded-2xl p-3 border border-gray-200">
  <QRCode
    value={`https://quizotic.net?code=${gameCode}`}
    size={120}
    bgColor="#ffffff"
    fgColor="#4f46e5"  // indigo — matches game code color
  />
</div>
```

QR foreground is indigo (`#4f46e5`) to match the game code typography — visually cohesive and still scans correctly (sufficient contrast on white).

---

## Learning Science Features

These five features are buildable now (no database or auth required) and position Quizotic as pedagogically superior to Kahoot. All are in-memory during a session; persistence to PostgreSQL is a future phase.

---

### 1. Answer Explanations

**What:** After each question result is revealed, participants and the host see an optional explanation for the correct answer. Research basis: elaborative feedback improves retention by 20–30% vs right/wrong alone (Hattie & Timperley, 2007).

**Data model — `src/lib/quiz-types.ts`:**
```ts
export interface Question {
  // existing fields...
  explanation?: string  // max ~300 chars; displayed after answer reveal
}
```

**Builder (`host/create/page.tsx`):**
Each question card gains an `explanation` textarea below the answer options. `updateQuestion` takes a full `Question` — use spread to merge:
```tsx
<textarea
  placeholder="Explain the correct answer (shown after reveal)..."
  value={question.explanation ?? ''}
  onChange={e => updateQuestion(idx, { ...question, explanation: e.target.value })}
  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm resize-none h-20
             focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
  maxLength={300}
/>
```

**Socket event — `question_ended` (new event in `server.mjs`):**

Emit **`question_ended` in TWO places**:
1. In the `next_question` handler — when there are still questions remaining: emit before `question_show` for the next question. Use `currentQuestionIndex - 1` (after the increment).
2. In the `end_session` handler — emit before `session_ended`. Use `currentQuestionIndex` (no decrement).

**Why only two, not three:** The host client's `nextQuestion()` function (in `host/session/page.tsx`) already short-circuits: if `nextIndex >= quiz.questions.length`, it emits `end_session` instead of `next_question`. The server's `next_question` handler never executes on the last question. All session-ending flows (normal last-question AND host-triggered early-end) go through the `end_session` handler. Do not add `emitQuestionEnded` to the `next_question` quiz-over branch — it's dead code.

`question_ended` fires at the **reveal moment** — `correctAnswer` is intentionally exposed here (this is when participants find out if they were right). Do not sanitize it.

Room key convention: `session:${gameCode}` throughout.

```js
// Shared helper — pass the index explicitly so both callers are correct:
function emitQuestionEnded(io, gameCode, session, questionIndex) {
  const justFinished = session.quizData.questions[questionIndex]
  // Intentional: correctAnswer is exposed here — this is the reveal moment
  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer: justFinished.correctAnswer,
    explanation: justFinished.explanation ?? null,
  })
}

// In next_question handler (after incrementing currentQuestionIndex):
emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex - 1)

// In end_session handler (index NOT incremented — use as-is):
emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)
```

Both host and participant clients listen for `question_ended`. The host shows explanation below vote bars; the participant shows it below their result card.

**Participant screen (`join/page.tsx`):**
After receiving `question_ended`, display explanation (if present) below the correct/wrong icon in the answered phase:
```tsx
{explanation && (
  <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 text-left">
    <p className="font-bold text-indigo-600 mb-1 text-xs uppercase tracking-wide">Why?</p>
    <p>{explanation}</p>
  </div>
)}
```

**Host screen (`host/session/page.tsx`):**
During the reveal window (after `question_ended`, before host presses "Next Question →"):
```tsx
{explanation && (
  <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
    <span className="font-bold text-indigo-600">Explanation: </span>{explanation}
  </div>
)}
```

---

### 2. Confidence Tap

**What:** After selecting an answer but before final submission, participant sees a 2-button overlay: "Sure ✓" and "Not Sure ~". This second tap records metacognitive confidence. Research basis: confidence-accuracy calibration is a proven learning science intervention (Koriat, 1997); knowing "I was sure but wrong" triggers deeper processing.

**Participant flow — `join/page.tsx`:**

1. Participant taps an answer → answer is highlighted / selected but NOT yet submitted
2. Full-screen overlay appears (no timer pause — urgency preserved):

```tsx
{pendingAnswer !== null && !confidence && (
  <div className="fixed inset-0 bg-black/40 flex items-end justify-center p-6 z-50">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
      <p className="font-black text-gray-900 text-lg mb-1">How confident are you?</p>
      <p className="text-gray-500 text-sm mb-5">Your answer is locked in — this is just for you.</p>
      <div className="flex gap-3">
        <button
          onClick={() => submitWithConfidence('sure')}
          className="flex-1 bg-indigo-600 text-white font-black rounded-xl py-4 text-base hover:bg-indigo-700"
        >
          Sure ✓
        </button>
        <button
          onClick={() => submitWithConfidence('unsure')}
          className="flex-1 border-2 border-gray-300 text-gray-700 font-black rounded-xl py-4 text-base hover:border-gray-400"
        >
          Not Sure ~
        </button>
      </div>
    </div>
  </div>
)}
```

3. `submitWithConfidence(level)` calls `socket.emit('submit_answer', { answer: pendingAnswer, timeMs, confidence: level })`

**Socket payload — `server.mjs` `submit_answer` handler:**
```js
// Existing: { answer, timeMs }
// Updated: { answer, timeMs, confidence }  — 'sure' | 'unsure'
participant.answers.push({ answer, timeMs, confidence: confidence ?? 'unsure' })
```

`confidence` defaults to `'unsure'` if not provided — no breaking change for clients that don't send it.

**State variables added to participant client:**
```ts
const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
const [confidence, setConfidence] = useState<'sure' | 'unsure' | null>(null)
```

Tapping an answer → `setPendingAnswer(index)`. After confidence tap → `setConfidence(level)` + emit. Overlay clears when `confidence !== null`.

---

### 3. Practice Mode

**What:** Host toggles "Practice Mode" before starting a session. In this mode, participants see only their own score at the end — no global leaderboard. Research basis: competitive leaderboards increase anxiety in lower performers and reduce intrinsic motivation (Deci & Ryan, 1985).

**Host toggle — `host/session/page.tsx` idle phase:**

Place the toggle **directly above the "Create Session" button** in the idle phase JSX:

```tsx
const [practiceMode, setPracticeMode] = useState(false)

// Directly above the Create Session button:
<div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
  <div>
    <p className="font-bold text-gray-900 text-sm">Practice Mode</p>
    <p className="text-gray-500 text-xs mt-0.5">Hides leaderboard from participants — no competition pressure</p>
  </div>
  <button
    onClick={() => setPracticeMode(p => !p)}
    className={`w-12 h-6 rounded-full transition-colors ${practiceMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
  >
    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${practiceMode ? 'translate-x-6' : 'translate-x-0'}`} />
  </button>
</div>
```

**Updated `create_session` emit (in host's `createSession()` function):**
```js
// Before: socketRef.current?.emit('create_session', { quizData: quiz }, callback)
// After:
socketRef.current?.emit('create_session', { quizData: quiz, practiceMode }, callback)
```

**Server — `server.mjs` `create_session` handler:**
- Accept `{ quizData, practiceMode }` (was `{ quizData }`)
- Store `session.practiceMode = practiceMode ?? false`
- `join_session` callback includes `practiceMode` so participant client knows from the start

**`session_end` → `session_ended` rename:**
The existing `server.mjs` emits `session_end`. **Rename this event to `session_ended`** across all three files: `server.mjs`, `join/page.tsx`, `host/session/page.tsx`. Update every `.emit('session_end', ...)` and every `.on('session_end', ...)` in all three files.

**`session_ended` payload — sent separately to host vs room:**

The host socket triggers the end. Use `socket.emit` for the host and `socket.to(...)` for the room (excludes the host socket). **This split applies to ALL three session-end paths** — `next_question` quiz-over path, `next_question` continuing path does not end the session, and `end_session` early-end handler. Do not use `io.to(room).emit` which would send `questionStats` to all clients including participants.

```js
const questionStats = buildQuestionStats(session)
const leaderboard = buildLeaderboard(session.participants)

// To host only: full data including questionStats
socket.emit('session_ended', { leaderboard, practiceMode: session.practiceMode, questionStats })

// To participants (room excludes host socket):
socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, practiceMode: session.practiceMode })
```

Apply this split in the `end_session` handler. (The `next_question` quiz-over branch is dead code — the host client emits `end_session` on the last question, so no changes are needed there.)

**Participant — `join/page.tsx` ended phase:**

The existing variable for the participant's running score is `totalScore`. Use that — do not introduce `ownScore`:

```tsx
{practiceMode ? (
  <div className="text-center">
    <p className="text-5xl font-black text-indigo-600">{totalScore}</p>
    <p className="text-gray-500 mt-1">Your score</p>
    <p className="text-gray-400 text-sm mt-3">Practice session complete — no leaderboard in this mode</p>
  </div>
) : (
  <LeaderboardView leaderboard={leaderboard} archetype={archetype} />
)}
```

The host's ended phase **always** shows the full leaderboard and session report regardless of `practiceMode`.

---

### 4. Bloom's Taxonomy Tags

**What:** Each question in the builder can be tagged with a Bloom's Taxonomy level. Research basis: Anderson & Krathwohl's 2001 revised taxonomy is the standard framework for learning objective classification.

**Data model — `src/lib/quiz-types.ts`:**
```ts
// All six levels of the revised taxonomy:
export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create'

export interface Question {
  // existing fields...
  explanation?: string
  bloomsLevel?: BloomsLevel
}
```

**Builder (`host/create/page.tsx`):**
Each question card gains a `bloomsLevel` dropdown below the explanation textarea. Use spread to merge:
```tsx
const BLOOMS_OPTIONS: Array<{ value: BloomsLevel | ''; label: string }> = [
  { value: '', label: 'No tag' },
  { value: 'remember', label: '🔵 Remember' },
  { value: 'understand', label: '🟢 Understand' },
  { value: 'apply', label: '🟡 Apply' },
  { value: 'analyse', label: '🟠 Analyse' },
  { value: 'evaluate', label: '🔴 Evaluate' },
  { value: 'create', label: '🟣 Create' },
]

<select
  value={question.bloomsLevel ?? ''}
  onChange={e => updateQuestion(idx, { ...question, bloomsLevel: (e.target.value as BloomsLevel) || undefined })}
  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm
             focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-gray-700"
>
  {BLOOMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
</select>
```

`bloomsLevel` travels with the quiz object in memory. No server-side changes needed for this field.

---

### 5. End-of-Session Report

**What:** At session end, the host sees a `SessionReport` component with per-question breakdown: correct%, confidence grid (2×2: Sure×Correct/Wrong, Unsure×Correct/Wrong), Bloom's tag, and Bloom's distribution summary. Weak questions (correct% < 50%) are flagged.

**Types — add to `src/lib/quiz-types.ts`:**
```ts
export interface ConfidenceGrid {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}

export interface QuestionStat {
  index: number
  text: string
  correctPct: number                     // 0–100
  confidenceGrid: ConfidenceGrid | null  // null if no participants answered
  bloomsLevel: BloomsLevel | null
  explanation: string | null
}
```

**Computation — `server.mjs`:**

`session.participants` is a `Map` — convert to array first. Use `session.quizData` and `q.correctAnswer` (field names from existing code):

```js
function buildQuestionStats(session) {
  const ps = Array.from(session.participants.values())
  return session.quizData.questions.map((q, i) => {
    const answered = ps.filter(p => p.answers[i] !== undefined)
    const total = answered.length
    if (total === 0) {
      return { index: i, text: q.text, correctPct: 0, confidenceGrid: null,
               bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null }
    }

    const correct      = answered.filter(p => p.answers[i].answer === q.correctAnswer).length
    const sureCorrect  = answered.filter(p => p.answers[i].confidence === 'sure'   && p.answers[i].answer === q.correctAnswer).length
    const sureWrong    = answered.filter(p => p.answers[i].confidence === 'sure'   && p.answers[i].answer !== q.correctAnswer).length
    const unsureCorrect = answered.filter(p => p.answers[i].confidence === 'unsure' && p.answers[i].answer === q.correctAnswer).length
    const unsureWrong   = answered.filter(p => p.answers[i].confidence === 'unsure' && p.answers[i].answer !== q.correctAnswer).length

    return {
      index: i,
      text: q.text,
      correctPct: Math.round((correct / total) * 100),
      confidenceGrid: { sureCorrect, sureWrong, unsureCorrect, unsureWrong },
      bloomsLevel: q.bloomsLevel ?? null,
      explanation: q.explanation ?? null,
    }
  })
}
```

**`SessionReport` component — `src/components/SessionReport.tsx`:**

```tsx
// Props: { questionStats: QuestionStat[] }
// Host-only — rendered in ended phase of host/session/page.tsx

// Layout:
// Heading: "Session Report" text-xl font-black
//
// Bloom's distribution bar: horizontal coloured dots showing count per level
//   Remember: bg-blue-400 | Understand: bg-green-400 | Apply: bg-yellow-400
//   Analyse: bg-orange-400 | Evaluate: bg-red-400 | Create: bg-purple-400
//
// Per-question list:
//   - Question text (truncate at 60 chars)
//   - Correct %: large number
//     - red text + "⚠ Weak" badge (bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs) if correctPct < 50
//     - green text if correctPct >= 80
//   - Confidence grid: 2×2 table — rows: Sure / Not Sure, cols: Correct / Wrong
//     - "Sure + Wrong" cell: bg-amber-50 — overconfidence errors have highest teaching value
//   - Bloom's tag if set: coloured dot + label text-xs text-gray-500
```

---

## Screen Specifications

### `/join` — Participant Join Page

**Form phase**
- `<Background />` component applied
- No top navbar — full-screen, clean entry
- Card: `bg-white rounded-2xl shadow-sm border border-gray-200 p-8`
- Inputs: `bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`
- Join button: `bg-lime-400 text-black font-black rounded-2xl w-full py-4 hover:bg-lime-300`

**Lobby phase**
- Avatar reveal: `scale-75 opacity-0 → scale-100 opacity-100` CSS transition on mount (100ms delay)
- Avatar size: 96px, centered, with soft indigo ring: `ring-4 ring-indigo-100`
- Archetype title: `"You are the Crystal Fox"` — `text-indigo-600 font-black text-xl`
- Display name: `text-gray-500 text-sm mt-1`
- Bouncing indigo dots (3 dots, `bg-indigo-300 animate-bounce`, staggered delays) — loops forever intentionally (waiting indicator)
- If `practiceMode`: show "Practice Mode — no leaderboard tonight" badge in `bg-indigo-50 text-indigo-600 text-xs rounded-full px-3 py-1`

**Question phase**
- `<CircularTimer />` top-right
- Progress bar: indigo gradient, switches to red at ≤5s
- Small avatar (32px) + archetype label `text-gray-500 text-xs` top-left
- Question card: `bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400 p-5`
- Answer buttons: full gradient + shadow, `rounded-2xl p-5`, white circle badge `w-8 h-8 rounded-full bg-white/25`
- Selected: `ring-4 ring-white scale-[0.97]`
- Unselected after answer: `opacity-50 pointer-events-none`
- **Confidence overlay:** after answer tap, before emit — bottom sheet overlay (see Learning Science § 2)

**Answered phase**
- Icon: `w-28 h-28 rounded-full` — correct: `bg-green-50 border-2 border-green-300`, wrong: `bg-red-50 border-2 border-red-300`
- Label: correct `text-green-600`, wrong `text-red-500`, `font-black text-3xl`
- Points: `text-indigo-600 font-bold` with `transition-transform` scale-up on mount
- Score card: `bg-white rounded-2xl shadow-sm border border-gray-200`, score in `text-indigo-600 text-5xl font-black`
- **Explanation card:** if `explanation` present after `question_ended` — `bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800` with "Why?" label

**Ended phase**
- If `practiceMode`: show `totalScore` only (no leaderboard rows) — see Learning Science § 3
- If not practiceMode: leaderboard rows with `Avatar` (40px) + name + archetype `text-gray-500 text-xs` + score `tabular-nums`
- #1: `bg-lime-400 text-black`, #2: `bg-gray-200 text-black`, #3: `bg-amber-200 text-amber-900`, rest: `bg-white border border-gray-200`
- "Play Again": `border border-gray-300 text-gray-600 rounded-xl hover:border-gray-400` — resets all state incl. archetype

---

### `/host/session` — Session Runner

**Idle phase**
- `<Background />` applied
- Quiz title: `text-gray-900 text-3xl font-black`
- Question preview: white cards with `border border-gray-200 shadow-sm`
- **Practice Mode toggle** — directly above the "Create Session" button (see Learning Science § 3)
- "Create Session" button: `bg-lime-400 text-black font-black rounded-2xl w-full py-4`

**Lobby phase**
- Game code: `text-indigo-600 text-6xl font-black tracking-[0.3em]`
- QR code + game code in 2-column white card, side by side
- QR foreground: indigo `#4f46e5`
- Avatar grid: iterate `Array.from(participants.entries())` — avatar (48px) + `ring-2 ring-indigo-100` + name + archetype `text-xs text-gray-500`. Pop in with `scale-0 → scale-100` as `participant_joined` events arrive.
- "Start Quiz →": `bg-lime-400 text-black font-black rounded-2xl`, `opacity-40 pointer-events-none` until ≥1 participant

**Question phase**
- Question card: `bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400`
- Vote bars: each option color (pink/orange/blue/green), `opacity-80`, `transition-all duration-500`
- Answer count: `bg-indigo-50 text-indigo-600 border border-indigo-100` glass pill top-right
- **Explanation:** shown below vote bars after `question_ended` — `bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800`
- "Next Question →": `animate-pulse` when all answered

**Ended phase**
- Full leaderboard always shown to host (regardless of `practiceMode`)
- #1: `bg-lime-400 text-black`, #2: `bg-gray-200 text-black`, #3: `bg-amber-200 text-amber-900`, rest: `bg-white border border-gray-200`
- Each row: `Avatar` (40px) + name + archetype + score
- **`<SessionReport questionStats={questionStats} />`** below leaderboard
- "Back to Library": ghost button

---

### `/host` — Quiz Library

- `<Background />` applied
- Header: `bg-white/80 backdrop-blur-sm border-b border-gray-200` — sticky
- Quiz cards: `bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow`
  - Left: emoji in `rounded-xl bg-indigo-50` chip + title `text-gray-900` + metadata `text-gray-400`
  - Right: "Start →" `bg-lime-400 text-black font-bold rounded-xl px-4 py-2`
  - Selected: `border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]`
- Empty state: soft indigo illustration placeholder + heading + CTA
- "+ New Quiz" button in header: `bg-lime-400 text-black font-bold rounded-xl`

---

### `/host/create` — Quiz Builder

- `<Background />` applied
- Tab bar: active `bg-lime-400 text-black font-bold rounded-full px-4 py-1.5`, inactive `text-gray-500 hover:text-gray-700`
- Question cards: `bg-white rounded-2xl shadow-sm border border-gray-200 p-5`
- Form inputs: `bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`
- Drag handle: `⠿` icon `text-gray-300` left edge
- AI generate / Translate buttons: `border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl`
- **Explanation textarea** per question — below answer options (spread merge, see Learning Science § 1)
- **Bloom's level dropdown** per question — below explanation textarea (spread merge, see Learning Science § 4)

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/archetypes.ts` | 300-entry archetype pool + `assignArchetype()` for Next.js |
| `src/lib/archetypes.mjs` | Same data as pure ESM JS — imported by `server.mjs` via `./src/lib/archetypes.mjs` |
| `src/components/Avatar.tsx` | DiceBear pixel-art avatar component |
| `src/components/CircularTimer.tsx` | SVG circular progress timer |
| `src/components/Background.tsx` | Dot-grid + corner glow orbs — shared across all pages |
| `src/components/SessionReport.tsx` | Host-only end-of-session report with confidence grid + Bloom's distribution |

### Modified files
| File | Changes |
|------|---------|
| `src/lib/quiz-types.ts` | Add `BloomsLevel` type, `explanation?` + `bloomsLevel?` to `Question`, `ConfidenceGrid` interface, `QuestionStat` interface |
| `server.mjs` | Import `./src/lib/archetypes.mjs`; assign archetype on join; update `buildLeaderboard` to include `archetype`; accept `practiceMode` in `create_session`; accept `confidence` in `submit_answer`; add `emitQuestionEnded` helper (called in `next_question` and `end_session`); rename `session_end` → `session_ended`; send split payloads to host vs room; call `buildQuestionStats` |
| `src/app/join/page.tsx` | Wrap all content in `JoinPageInner` with `Suspense` outer; full visual redesign; avatar state; URL pre-fill; confidence overlay; explanation display; practice mode ended state; rename `session_end` → `session_ended` listener |
| `src/app/host/page.tsx` | Visual redesign — light theme, glass cards |
| `src/app/host/session/page.tsx` | Full visual redesign; QR code; change participants state to `Map<string, string>`; practice mode toggle + updated `create_session` emit; explanation reveal; `SessionReport`; rename `session_end` → `session_ended` listener |
| `src/app/host/create/page.tsx` | Visual redesign; `explanation` textarea (spread merge); `bloomsLevel` dropdown (spread merge) per question |
| `package.json` | Add `react-qr-code`, `@dicebear/core`, `@dicebear/pixel-art` |

---

## New Packages

```bash
npm install react-qr-code @dicebear/core@^9 @dicebear/pixel-art@^9
```

Pin to v9+. DiceBear v8 and v9 have different APIs — `createAvatar(...).toString()` (used in `Avatar.tsx`) is the v9 API. Without version pins npm may resolve to v8, where `createAvatar` returns a string directly and calling `.toString()` on it returns `[object Object]`.

---

## Out of Scope (future specs)

- Landing page / hero section (superr.ai-inspired, scroll animations)
- Dark theme toggle (scientific case made — projector visibility chosen as default)
- Accessibility toggles (OpenDyslexic font, large-text mode, high-contrast)
- Backend persistence (auth, database, Razorpay)
- Spaced repetition (requires per-student history across sessions — needs auth + database)
- Team mode (collaborative scoring — Phase 6+)
- Export report to PDF/CSV (future)
