# Phase 4 — Visual Redesign + Avatar System + Learning Science Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Quizotic's UI to a light-vivid design with avatar identities, QR code join, and five learning science features (answer explanations, confidence tap, practice mode, Bloom's tags, session report).

**Architecture:** All changes are in-memory (no database); learning science data lives on the session object and is computed at session end. New shared components (Background, CircularTimer, Avatar, SessionReport) are consumed by all pages. Server changes are backward-compatible except the `session_end` → `session_ended` rename (all three files updated together in Task 6).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, Socket.io, DiceBear v9 (pixel-art avatars), react-qr-code

**Spec:** `docs/superpowers/specs/2026-03-20-phase4-visual-redesign-avatars.md`

---

## Task 1: Install New Packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic"
npm install react-qr-code @dicebear/core@^9 @dicebear/pixel-art@^9
```

Expected: packages install without peer dependency errors. Both `@dicebear/core` and `@dicebear/pixel-art` should be on the same major version (v9). Run `npm list @dicebear/core @dicebear/pixel-art` to confirm.

- [ ] **Step 2: Verify TypeScript types are present**

```bash
npx tsc --noEmit
```

Expected: no errors (existing code compiles cleanly).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install react-qr-code and dicebear packages"
```

---

## Task 2: Extend Quiz Types

**Files:**
- Modify: `src/lib/quiz-types.ts`

Add `BloomsLevel`, `ConfidenceGrid`, `QuestionStat` types and extend `Question` with `explanation` and `bloomsLevel`.

- [ ] **Step 1: Replace `src/lib/quiz-types.ts` with the extended version**

```ts
export type QuestionType =
  | 'mcq'
  | 'truefalse'
  | 'poll'
  | 'openended'
  | 'wordcloud'
  | 'qa'
  | 'rating'
  | 'ranking'

// All six levels of Anderson & Krathwohl's revised Bloom's Taxonomy (2001)
export type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create'

export interface Question {
  id: string
  type: QuestionType
  text: string
  options?: string[]        // undefined for openended/wordcloud/qa
  correctAnswer?: string    // string index "0"/"1"/"2"/"3"; undefined for poll/openended/etc
  timerSeconds: 10 | 15 | 20 | 30 | 60
  points: 500 | 1000 | 2000
  explanation?: string      // shown to host + participant after answer reveal (max ~300 chars)
  bloomsLevel?: BloomsLevel // optional tag for session report Bloom's distribution
}

export interface Quiz {
  id: string
  title: string
  subject?: string
  language?: string
  createdAt: string         // ISO timestamp
  updatedAt: string         // ISO timestamp
  questions: Question[]
}

// ─── Learning Science types ───────────────────────────────────────────────────

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/quiz-types.ts
git commit -m "feat: extend Question type with explanation + bloomsLevel; add BloomsLevel, ConfidenceGrid, QuestionStat"
```

---

## Task 3: Archetype System

**Files:**
- Create: `src/lib/archetypes.ts`
- Create: `src/lib/archetypes.mjs`

Both files must export identical data. `archetypes.ts` is for Next.js pages (TypeScript). `archetypes.mjs` is for `server.mjs` (native ESM, cannot import TypeScript).

- [ ] **Step 1: Create `src/lib/archetypes.ts`**

```ts
// SYNC: keep in sync with archetypes.mjs

const ELEMENTS = [
  'Fire', 'Ice', 'Storm', 'Shadow', 'Thunder',
  'Solar', 'Lunar', 'Cosmic', 'Iron', 'Crystal',
  'Void', 'Phoenix', 'Neon', 'Obsidian', 'Glacier',
  'Inferno', 'Titan', 'Mystic', 'Blood', 'Sakura',
]

const TYPES = [
  'Dragon', 'Tiger', 'Ninja', 'Samurai', 'Wizard',
  'Wolf', 'Eagle', 'Fox', 'Cobra', 'Knight',
  'Archer', 'Panther', 'Viper', 'Monk', 'Phoenix',
]

// 20 × 15 = 300 unique archetypes
export const ARCHETYPES: string[] = ELEMENTS.flatMap(e => TYPES.map(t => `${e} ${t}`))

export function assignArchetype(): string {
  return ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]
}
```

- [ ] **Step 2: Create `src/lib/archetypes.mjs`**

```js
// SYNC: keep in sync with archetypes.ts
// Pure ESM JS — imported by server.mjs (cannot import TypeScript)

const ELEMENTS = [
  'Fire', 'Ice', 'Storm', 'Shadow', 'Thunder',
  'Solar', 'Lunar', 'Cosmic', 'Iron', 'Crystal',
  'Void', 'Phoenix', 'Neon', 'Obsidian', 'Glacier',
  'Inferno', 'Titan', 'Mystic', 'Blood', 'Sakura',
]

const TYPES = [
  'Dragon', 'Tiger', 'Ninja', 'Samurai', 'Wizard',
  'Wolf', 'Eagle', 'Fox', 'Cobra', 'Knight',
  'Archer', 'Panther', 'Viper', 'Monk', 'Phoenix',
]

export const ARCHETYPES = ELEMENTS.flatMap(e => TYPES.map(t => `${e} ${t}`))

export function assignArchetype() {
  return ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]
}
```

- [ ] **Step 3: Verify — check pool size**

```bash
node -e "import('./src/lib/archetypes.mjs').then(m => console.log('count:', m.ARCHETYPES.length, 'sample:', m.assignArchetype()))"
```

Expected output: `count: 300 sample: <some archetype>`

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archetypes.ts src/lib/archetypes.mjs
git commit -m "feat: add 300-entry archetype pool (archetypes.ts + archetypes.mjs)"
```

---

## Task 4: Background Component + Layout

**Files:**
- Create: `src/components/Background.tsx`
- Modify: `src/app/layout.tsx`

The Background component renders the dot-grid + corner glow orbs. It goes into the root layout so it renders once across all pages.

- [ ] **Step 1: Create `src/components/Background.tsx`**

```tsx
// Dot-grid pattern + soft corner glow orbs.
// Placed in root layout — do NOT add to individual pages.
export function Background() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: '#fafaf8',
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      {/* Corner glow orbs */}
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
    </>
  )
}
```

- [ ] **Step 2: Update `src/app/layout.tsx` to include Background**

Replace the entire file:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/Background";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quizotic — India's Live Quiz Platform",
  description: "Live interactive quizzes for Indian schools, coaching institutes, and corporates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Background />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: builds without errors. The background should now appear on all pages.

- [ ] **Step 4: Commit**

```bash
git add src/components/Background.tsx src/app/layout.tsx
git commit -m "feat: add Background component (dot-grid + glow orbs) to root layout"
```

---

## Task 5: CircularTimer and Avatar Components

**Files:**
- Create: `src/components/CircularTimer.tsx`
- Create: `src/components/Avatar.tsx`

- [ ] **Step 1: Create `src/components/CircularTimer.tsx`**

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

- [ ] **Step 2: Create `src/components/Avatar.tsx`**

```tsx
'use client'
// DiceBear SVGs are generated locally from a string seed — no network call, no user-controlled HTML.
// dangerouslySetInnerHTML is safe here: DiceBear output is a sanitized SVG element.
import { createAvatar } from '@dicebear/core'
import { pixelArt } from '@dicebear/pixel-art'

export function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const svg = createAvatar(pixelArt, { seed: archetype.replace(/\s/g, ''), size }).toString()
  return (
    <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
```

- [ ] **Step 3: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/CircularTimer.tsx src/components/Avatar.tsx
git commit -m "feat: add CircularTimer and Avatar (DiceBear pixel-art) components"
```

---

## Task 6: Server Changes

**Files:**
- Modify: `server.mjs`

This task covers all server-side changes:
1. Import `assignArchetype` from `./src/lib/archetypes.mjs`
2. Accept `practiceMode` in `create_session`
3. Assign archetype on `join_session`
4. Accept `confidence` in `submit_answer`
5. Update `buildLeaderboard` to include archetype
6. Add `emitQuestionEnded` helper
7. Add `buildQuestionStats` helper
8. Rename `session_end` → `session_ended` (ALL occurrences)
9. Split `session_ended` emit: host gets `questionStats`, participants don't

**Important:** `session_end` → `session_ended` rename must be done in server.mjs AND both client pages (Tasks 8 and 11 handle the client side).

- [ ] **Step 1: Replace `server.mjs` with the updated version**

```js
import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { assignArchetype } from './src/lib/archetypes.mjs'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// In-memory session store (replace with DB in a future phase)
const sessions = new Map()

function generateGameCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.HOST_DOMAIN, process.env.JOIN_DOMAIN].filter(Boolean)
        : '*',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`)

    // ─── HOST EVENTS ───────────────────────────────────────────────

    socket.on('create_session', ({ quizData, practiceMode }, callback) => {
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      sessions.set(gameCode, {
        hostSocketId: socket.id,
        quizData,
        currentQuestionIndex: -1,
        participants: new Map(), // socketId → { name, archetype, score, answers }
        status: 'lobby',
        practiceMode: practiceMode ?? false,
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      console.log(`[session] created: ${gameCode}`)
      callback({ success: true, gameCode })
    })

    socket.on('start_quiz', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.status = 'active'
      session.currentQuestionIndex = 0
      const question = sanitizeQuestion(session.quizData.questions[0])

      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: 0,
        total: session.quizData.questions.length,
      })

      console.log(`[session] started: ${gameCode}`)
    })

    socket.on('next_question', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.currentQuestionIndex++
      const { currentQuestionIndex, quizData } = session

      if (currentQuestionIndex >= quizData.questions.length) {
        // Quiz over — this path is dead code: the host client emits end_session
        // on the last question instead of next_question. Kept for safety.
        emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)
        const leaderboard = buildLeaderboard(session.participants)
        const questionStats = buildQuestionStats(session)
        session.status = 'ended'
        socket.emit('session_ended', { leaderboard, practiceMode: session.practiceMode, questionStats })
        socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, practiceMode: session.practiceMode })
        console.log(`[session] ended: ${gameCode}`)
        return
      }

      emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)

      const question = sanitizeQuestion(quizData.questions[currentQuestionIndex])
      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: currentQuestionIndex,
        total: quizData.questions.length,
      })
    })

    socket.on('end_session', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)

      const leaderboard = buildLeaderboard(session.participants)
      const questionStats = buildQuestionStats(session)
      session.status = 'ended'
      // Host gets full data including questionStats
      socket.emit('session_ended', { leaderboard, practiceMode: session.practiceMode, questionStats })
      // Participants only get leaderboard + practiceMode flag
      socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, practiceMode: session.practiceMode })
      console.log(`[session] force-ended: ${gameCode}`)
    })

    // ─── PARTICIPANT EVENTS ─────────────────────────────────────────

    socket.on('join_session', ({ gameCode, displayName }, callback) => {
      const session = sessions.get(gameCode)

      if (!session) {
        callback({ success: false, error: 'Game not found. Check the code and try again.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'This game has already ended.' })
        return
      }

      const archetype = assignArchetype()
      const participant = { name: displayName, archetype, score: 0, answers: [] }
      session.participants.set(socket.id, participant)
      socket.join(`session:${gameCode}`)

      callback({
        success: true,
        status: session.status,
        quizTitle: session.quizData.title,
        archetype,
        practiceMode: session.practiceMode,
      })

      io.to(`host:${gameCode}`).emit('participant_joined', {
        name: displayName,
        archetype,
        count: session.participants.size,
      })

      console.log(`[session] ${displayName} (${archetype}) joined ${gameCode}`)
    })

    socket.on('submit_answer', ({ gameCode, answer, timeMs, confidence }) => {
      const session = sessions.get(gameCode)
      if (!session || session.status !== 'active') return

      const participant = session.participants.get(socket.id)
      if (!participant) return

      const qi = session.currentQuestionIndex
      const question = session.quizData.questions[qi]

      if (participant.answers[qi] !== undefined) return

      const isCorrect = checkAnswer(question, answer)
      const points = isCorrect ? calcPoints(question.points || 1000, timeMs, question.timerSeconds || 20) : 0

      participant.answers[qi] = { answer, isCorrect, points, timeMs, confidence: confidence ?? 'unsure' }
      participant.score += points

      socket.emit('answer_confirmed', { isCorrect, points, totalScore: participant.score })

      const numOptions = question.options?.length ?? 4
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: session.participants.size,
        optionCounts: countAnswersByOption(session, qi, numOptions),
      })
    })

    // ─── DISCONNECT ─────────────────────────────────────────────────

    socket.on('disconnect', () => {
      for (const [code, session] of sessions.entries()) {
        if (session.hostSocketId === socket.id) {
          io.to(`session:${code}`).emit('host_disconnected')
          sessions.delete(code)
          console.log(`[session] deleted (host left): ${code}`)
        }
        if (session.participants.has(socket.id)) {
          const name = session.participants.get(socket.id).name
          session.participants.delete(socket.id)
          io.to(`host:${code}`).emit('participant_left', {
            name,
            count: session.participants.size,
          })
        }
      }
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Quizotic running at http://localhost:${port} [${dev ? 'dev' : 'production'}]`)
  })
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sanitizeQuestion(q) {
  const { correctAnswer, ...safe } = q
  return safe
}

function checkAnswer(question, answer) {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'multiselect') {
    const correct = [...question.correctAnswer].sort().join(',')
    const given = [...answer].sort().join(',')
    return correct === given
  }
  return false
}

function calcPoints(base, timeMs, timerSeconds) {
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  const speedBonus = Math.round(500 * speedRatio)
  return base + speedBonus
}

function countAnswers(session, questionIndex) {
  let count = 0
  for (const p of session.participants.values()) {
    if (p.answers[questionIndex] !== undefined) count++
  }
  return count
}

function countAnswersByOption(session, questionIndex, numOptions) {
  const counts = Array(numOptions).fill(0)
  for (const p of session.participants.values()) {
    const a = p.answers[questionIndex]
    if (a !== undefined) {
      const idx = Number(a.answer)
      if (idx >= 0 && idx < numOptions) counts[idx]++
    }
  }
  return counts
}

// Updated: takes participants Map directly; callers pass session.participants
function buildLeaderboard(participants) {
  return Array.from(participants.values())
    .sort((a, b) => b.score - a.score)
    .map(p => ({ name: p.name, archetype: p.archetype, score: p.score }))
}

// Emit question_ended to the whole room (reveal moment — correctAnswer intentionally exposed)
function emitQuestionEnded(io, gameCode, session, questionIndex) {
  const q = session.quizData.questions[questionIndex]
  if (!q) return
  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? null,
  })
}

// Compute per-question stats from participant answers for the session report
function buildQuestionStats(session) {
  const ps = Array.from(session.participants.values())
  return session.quizData.questions.map((q, i) => {
    const answered = ps.filter(p => p.answers[i] !== undefined)
    const total = answered.length
    if (total === 0) {
      return {
        index: i, text: q.text, correctPct: 0, confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
      }
    }

    const correct       = answered.filter(p => p.answers[i].answer === q.correctAnswer).length
    const sureCorrect   = answered.filter(p => p.answers[i].confidence === 'sure'   && p.answers[i].answer === q.correctAnswer).length
    const sureWrong     = answered.filter(p => p.answers[i].confidence === 'sure'   && p.answers[i].answer !== q.correctAnswer).length
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

- [ ] **Step 2: Verify server starts**

```bash
npm run dev
```

Expected: server boots at `http://localhost:3000` with no errors.

- [ ] **Step 3: Commit**

```bash
git add server.mjs
git commit -m "feat: server — archetypes, practiceMode, confidence, question_ended, session_ended split, buildQuestionStats"
```

---

## Task 7: SessionReport Component

**Files:**
- Create: `src/components/SessionReport.tsx`

Host-only component shown in the ended phase of the session page. Displays per-question stats, confidence grid, Bloom's distribution, and flags weak questions.

- [ ] **Step 1: Create `src/components/SessionReport.tsx`**

```tsx
import type { QuestionStat, BloomsLevel } from '@/lib/quiz-types'

const BLOOMS_COLORS: Record<BloomsLevel, string> = {
  remember: 'bg-blue-400',
  understand: 'bg-green-400',
  apply: 'bg-yellow-400',
  analyse: 'bg-orange-400',
  evaluate: 'bg-red-400',
  create: 'bg-purple-400',
}

const BLOOMS_LABELS: Record<BloomsLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyse: 'Analyse',
  evaluate: 'Evaluate',
  create: 'Create',
}

function BloomsDistribution({ stats }: { stats: QuestionStat[] }) {
  const tagged = stats.filter(s => s.bloomsLevel)
  if (tagged.length === 0) return null

  const counts = tagged.reduce((acc, s) => {
    if (s.bloomsLevel) acc[s.bloomsLevel] = (acc[s.bloomsLevel] ?? 0) + 1
    return acc
  }, {} as Partial<Record<BloomsLevel, number>>)

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Bloom's Distribution</p>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(counts) as [BloomsLevel, number][]).map(([level, count]) => (
          <span key={level} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700">
            <span className={`w-2 h-2 rounded-full ${BLOOMS_COLORS[level]}`} />
            {BLOOMS_LABELS[level]} ({count})
          </span>
        ))}
      </div>
    </div>
  )
}

function ConfidenceGridDisplay({ grid }: { grid: NonNullable<QuestionStat['confidenceGrid']> }) {
  const { sureCorrect, sureWrong, unsureCorrect, unsureWrong } = grid
  return (
    <table className="text-xs border-collapse mt-2 w-full max-w-[220px]">
      <thead>
        <tr>
          <th className="text-gray-400 font-normal pb-1 text-left" />
          <th className="text-gray-500 font-semibold pb-1 text-center">Correct</th>
          <th className="text-gray-500 font-semibold pb-1 text-center">Wrong</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="text-gray-500 pr-3 py-1">Sure</td>
          <td className="bg-green-50 border border-gray-100 text-center rounded-sm py-1 px-2 text-gray-700">{sureCorrect}</td>
          <td className="bg-amber-50 border border-gray-100 text-center rounded-sm py-1 px-2 text-amber-800 font-semibold">{sureWrong}</td>
        </tr>
        <tr>
          <td className="text-gray-500 pr-3 py-1">Not Sure</td>
          <td className="bg-green-50 border border-gray-100 text-center rounded-sm py-1 px-2 text-gray-700">{unsureCorrect}</td>
          <td className="border border-gray-100 text-center rounded-sm py-1 px-2 text-gray-700">{unsureWrong}</td>
        </tr>
      </tbody>
    </table>
  )
}

export function SessionReport({ questionStats }: { questionStats: QuestionStat[] }) {
  if (!questionStats || questionStats.length === 0) return null

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <p className="text-xl font-black text-gray-900 mb-4">Session Report</p>

      <BloomsDistribution stats={questionStats} />

      <div className="space-y-4">
        {questionStats.map((stat) => {
          const isWeak = stat.correctPct < 50
          const isStrong = stat.correctPct >= 80
          return (
            <div key={stat.index} className="border border-gray-100 rounded-xl p-4">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-gray-700 font-medium leading-snug">
                  Q{stat.index + 1}. {stat.text.length > 80 ? stat.text.slice(0, 80) + '…' : stat.text}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-2xl font-black ${isWeak ? 'text-red-500' : isStrong ? 'text-green-600' : 'text-gray-700'}`}>
                    {stat.correctPct}%
                  </span>
                  {isWeak && (
                    <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                      ⚠ Weak
                    </span>
                  )}
                </div>
              </div>

              {/* Bloom's tag */}
              {stat.bloomsLevel && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${BLOOMS_COLORS[stat.bloomsLevel]}`} />
                  <span className="text-xs text-gray-500">{BLOOMS_LABELS[stat.bloomsLevel]}</span>
                </div>
              )}

              {/* Confidence grid */}
              {stat.confidenceGrid && <ConfidenceGridDisplay grid={stat.confidenceGrid} />}

              {/* Explanation */}
              {stat.explanation && (
                <p className="mt-2 text-xs text-indigo-700 bg-indigo-50 rounded-lg p-2">{stat.explanation}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SessionReport.tsx
git commit -m "feat: add SessionReport component with confidence grid and Bloom's distribution"
```

---

## Task 8: Join Page — Full Redesign

**Files:**
- Modify: `src/app/join/page.tsx`

Complete rewrite. Adds: Suspense wrapper (required for `useSearchParams` in Next.js 16), light theme design, avatar system, confidence tap overlay, answer explanations, practice mode ended state.

Note: the existing `session_end` listener becomes `session_ended` here (matching Task 6's server rename).

- [ ] **Step 1: Replace `src/app/join/page.tsx` with the full redesign**

```tsx
'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { CircularTimer } from '@/components/CircularTimer'
import { Avatar } from '@/components/Avatar'

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'form' | 'connecting' | 'lobby' | 'question' | 'answered' | 'ended'

interface Question {
  id: string
  type: string
  text: string
  options?: string[]
  timerSeconds: number
  points: number
  index: number
  total: number
}

interface LeaderboardEntry {
  name: string
  archetype: string
  score: number
}

const OPTION_GRADIENTS = [
  'bg-gradient-to-br from-pink-700 to-pink-500 shadow-[0_4px_16px_rgba(236,72,153,0.25)]',
  'bg-gradient-to-br from-orange-700 to-orange-500 shadow-[0_4px_16px_rgba(249,115,22,0.25)]',
  'bg-gradient-to-br from-blue-700 to-blue-500 shadow-[0_4px_16px_rgba(59,130,246,0.25)]',
  'bg-gradient-to-br from-green-700 to-green-500 shadow-[0_4px_16px_rgba(34,197,94,0.25)]',
]
const OPTION_LABELS = ['A', 'B', 'C', 'D']

// ─── Inner Component (uses useSearchParams — requires Suspense) ───────────────
function JoinPageInner() {
  const searchParams = useSearchParams()
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answerTimeRef = useRef<number>(0)

  const [phase, setPhase] = useState<Phase>('form')
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [quizTitle, setQuizTitle] = useState('')

  // Avatar
  const [archetype, setArchetype] = useState<string | null>(null)
  const [avatarRevealed, setAvatarRevealed] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)

  // Question
  const [question, setQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  // Confidence tap
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<'sure' | 'unsure' | null>(null)

  // Answered
  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [explanation, setExplanation] = useState<string | null>(null)

  // Ended
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number>(0)

  const gameCodeRef = useRef('')
  const displayNameRef = useRef('')

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.on('question_show', ({ question, index, total }: { question: Omit<Question, 'index' | 'total'>; index: number; total: number }) => {
      setQuestion({ ...question, index, total })
      setSelectedAnswer(null)
      setPendingAnswer(null)
      setConfidence(null)
      setExplanation(null)
      setTimeLeft(question.timerSeconds)
      setPhase('question')
      answerTimeRef.current = Date.now()

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
          return prev - 1
        })
      }, 1000)
    })

    socket.on('answer_confirmed', ({ isCorrect, points, totalScore }: { isCorrect: boolean; points: number; totalScore: number }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsCorrect(isCorrect)
      setPointsEarned(points)
      setTotalScore(totalScore)
      setPhase('answered')
    })

    socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
      setExplanation(exp)
    })

    socket.on('session_ended', ({ leaderboard, practiceMode: pm }: { leaderboard: LeaderboardEntry[]; practiceMode: boolean }) => {
      setLeaderboard(leaderboard)
      setPracticeMode(pm)
      const rank = leaderboard.findIndex(e => e.name === displayNameRef.current) + 1
      setMyRank(rank)
      setPhase('ended')
    })

    socket.on('host_disconnected', () => {
      setError('The host has left. Session ended.')
      setPhase('form')
    })

    return () => { socket.disconnect() }
  }, [])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setError('')
    setPhase('connecting')

    gameCodeRef.current = code.trim()
    displayNameRef.current = name.trim()

    socketRef.current?.emit('join_session', {
      gameCode: code.trim(),
      displayName: name.trim(),
    }, (res: { success: boolean; error?: string; status?: string; quizTitle?: string; archetype?: string; practiceMode?: boolean }) => {
      if (!res.success) {
        setError(res.error ?? 'Could not join. Try again.')
        setPhase('form')
        return
      }
      setQuizTitle(res.quizTitle ?? '')
      setArchetype(res.archetype ?? null)
      setPracticeMode(res.practiceMode ?? false)

      if (res.status === 'active') {
        setPhase('question')
      } else {
        setPhase('lobby')
        setTimeout(() => setAvatarRevealed(true), 100)
      }
    })
  }

  function handleAnswerTap(idx: number) {
    if (selectedAnswer !== null || pendingAnswer !== null) return
    setSelectedAnswer(String(idx))
    setPendingAnswer(idx)
  }

  function submitWithConfidence(level: 'sure' | 'unsure') {
    if (pendingAnswer === null) return
    setConfidence(level)
    const timeMs = Date.now() - answerTimeRef.current
    socketRef.current?.emit('submit_answer', {
      gameCode: gameCodeRef.current,
      answer: pendingAnswer,
      timeMs,
      confidence: level,
    })
  }

  function handlePlayAgain() {
    setPhase('form')
    setCode('')
    setName('')
    setError('')
    setArchetype(null)
    setAvatarRevealed(false)
    setPracticeMode(false)
    setQuestion(null)
    setSelectedAnswer(null)
    setPendingAnswer(null)
    setConfidence(null)
    setExplanation(null)
    setIsCorrect(false)
    setPointsEarned(0)
    setTotalScore(0)
    setLeaderboard([])
    setMyRank(0)
  }

  // ─── Form Phase ────────────────────────────────────────────────────────────
  if (phase === 'form' || phase === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-black text-gray-900 mb-1">
            Quizo<span className="text-lime-400">tic</span>
          </h1>
          <p className="text-gray-500 text-sm mb-6">Enter your details to join</p>

          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Game code"
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold tracking-widest text-center focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
              maxLength={6}
            />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={phase === 'connecting'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
              maxLength={24}
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={phase === 'connecting'}
              className="w-full bg-lime-400 text-black font-black rounded-2xl py-4 text-base hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {phase === 'connecting' ? 'Joining…' : 'Join →'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Lobby Phase ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className={`transition-all duration-500 mb-4 ${avatarRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
            {archetype && (
              <div className="flex justify-center mb-3">
                <div className="ring-4 ring-indigo-100 rounded-full">
                  <Avatar archetype={archetype} size={96} />
                </div>
              </div>
            )}
          </div>
          {archetype && (
            <>
              <p className="text-indigo-600 font-black text-xl">You are the {archetype}</p>
              <p className="text-gray-500 text-sm mt-1">{name}</p>
            </>
          )}
          {practiceMode && (
            <span className="inline-block mt-3 bg-indigo-50 text-indigo-600 text-xs rounded-full px-3 py-1 font-semibold">
              Practice Mode — no leaderboard
            </span>
          )}
          <p className="text-gray-500 text-sm mt-6 mb-3">Waiting for host to start</p>
          <div className="flex justify-center gap-1.5">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
          <p className="text-gray-400 text-sm mt-4 font-medium">{quizTitle}</p>
        </div>
      </div>
    )
  }

  // ─── Question Phase ────────────────────────────────────────────────────────
  if (phase === 'question' && question) {
    return (
      <div className="min-h-screen p-4 flex flex-col max-w-lg mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {archetype && <Avatar archetype={archetype} size={32} />}
            <span className="text-gray-500 text-xs">{archetype}</span>
          </div>
          <CircularTimer timeLeft={timeLeft} total={question.timerSeconds} />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-400'}`}
            style={{ width: `${(timeLeft / question.timerSeconds) * 100}%` }}
          />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400 p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Q{question.index + 1} / {question.total}</span>
            <span className="text-xs text-indigo-600 font-semibold">{question.points} pts</span>
          </div>
          <p className="text-gray-900 font-bold text-lg leading-snug">{question.text}</p>
        </div>

        {/* Answer options */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {question.options?.map((opt, idx) => {
            const isSelected = selectedAnswer === String(idx)
            const isDisabled = selectedAnswer !== null
            return (
              <button
                key={idx}
                onClick={() => handleAnswerTap(idx)}
                disabled={isDisabled}
                className={`${OPTION_GRADIENTS[idx]} rounded-2xl p-5 text-white text-left transition-all
                  ${isSelected ? 'ring-4 ring-white scale-[0.97]' : ''}
                  ${isDisabled && !isSelected ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-black text-sm mb-2">
                  {OPTION_LABELS[idx]}
                </span>
                <span className="text-sm font-semibold leading-snug">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Confidence overlay */}
        {pendingAnswer !== null && confidence === null && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center p-6 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <p className="font-black text-gray-900 text-lg mb-1">How confident are you?</p>
              <p className="text-gray-500 text-sm mb-5">Your answer is locked in — this is just for you.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => submitWithConfidence('sure')}
                  className="flex-1 bg-indigo-600 text-white font-black rounded-xl py-4 text-base hover:bg-indigo-700 transition-colors"
                >
                  Sure ✓
                </button>
                <button
                  onClick={() => submitWithConfidence('unsure')}
                  className="flex-1 border-2 border-gray-300 text-gray-700 font-black rounded-xl py-4 text-base hover:border-gray-400 transition-colors"
                >
                  Not Sure ~
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Answered Phase ────────────────────────────────────────────────────────
  if (phase === 'answered') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-sm mx-auto text-center gap-4">
        <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl
          ${isCorrect ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}
        >
          {isCorrect ? '✓' : '✗'}
        </div>
        <p className={`font-black text-3xl ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrect ? 'Correct!' : 'Wrong!'}
        </p>
        {isCorrect && (
          <p className="text-indigo-600 font-bold text-xl animate-pulse">+{pointsEarned} pts</p>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 w-full">
          <p className="text-gray-500 text-sm">Your score</p>
          <p className="text-indigo-600 text-5xl font-black">{totalScore}</p>
        </div>
        {explanation && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 text-left w-full">
            <p className="font-bold text-indigo-600 mb-1 text-xs uppercase tracking-wide">Why?</p>
            <p>{explanation}</p>
          </div>
        )}
        <p className="text-gray-400 text-sm">Waiting for next question…</p>
      </div>
    )
  }

  // ─── Ended Phase ───────────────────────────────────────────────────────────
  if (phase === 'ended') {
    return (
      <div className="min-h-screen p-4 max-w-sm mx-auto">
        <h2 className="text-2xl font-black text-gray-900 mb-4 text-center">Quiz Over!</h2>

        {practiceMode ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center mb-4">
            <p className="text-5xl font-black text-indigo-600">{totalScore}</p>
            <p className="text-gray-500 mt-1">Your score</p>
            <p className="text-gray-400 text-sm mt-3">Practice session complete — no leaderboard in this mode</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {leaderboard.map((entry, i) => {
              const isMe = entry.name === displayNameRef.current
              const podiumClass = i === 0 ? 'bg-lime-400 text-black' : i === 1 ? 'bg-gray-200 text-black' : i === 2 ? 'bg-amber-200 text-amber-900' : 'bg-white border border-gray-200 text-gray-700'
              return (
                <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 ${podiumClass} ${isMe ? 'ring-2 ring-indigo-400' : ''}`}>
                  <span className="font-black w-5 text-center text-sm">{i + 1}</span>
                  <Avatar archetype={entry.archetype ?? ''} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-sm">{entry.name}</p>
                    <p className="text-xs opacity-60 truncate">{entry.archetype}</p>
                  </div>
                  <span className="font-black tabular-nums text-sm">{entry.score}</span>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={handlePlayAgain}
          className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
        >
          Play Again
        </button>
      </div>
    )
  }

  return null
}

// ─── Outer Wrapper (Suspense required for useSearchParams in Next.js 16) ──────
export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafaf8]" />}>
      <JoinPageInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
npm run build
```

Expected: builds successfully. Fix any TypeScript errors before proceeding.

- [ ] **Step 3: Smoke test manually**

Run `npm run dev`. Open two tabs:
- Tab 1: `http://localhost:3000/host/session` — create a session, note game code
- Tab 2: `http://localhost:3000/join` — enter code + name → should reach lobby with avatar and archetype name
- Verify avatar appears with scale-up animation
- If Practice Mode is on (Task 11 adds toggle), verify badge shows

- [ ] **Step 4: Commit**

```bash
git add src/app/join/page.tsx
git commit -m "feat: redesign join page — light theme, avatar, confidence tap, explanation, practice mode, session_ended rename"
```

---

## Task 9: Host Library Page Redesign

**Files:**
- Modify: `src/app/host/page.tsx`

Light theme visual redesign only — no logic changes.

- [ ] **Step 1: Read the current file**

```bash
cat src/app/host/page.tsx
```

- [ ] **Step 2: Apply light theme to the page**

Update all color/styling to match the light theme:
- Page container: `min-h-screen p-4` (Background from layout handles the bg)
- Header: `bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10 -mx-4 px-4 mb-6 py-3 flex items-center justify-between`
- Logo: `Quizo<span class="text-lime-400">tic</span>`
- "+ New Quiz" button: `bg-lime-400 text-black font-bold rounded-xl px-4 py-2 text-sm hover:bg-lime-300`
- Quiz cards: `bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between gap-4`
- Card left: quiz emoji in `rounded-xl bg-indigo-50 w-10 h-10 flex items-center justify-center text-xl` + title `text-gray-900 font-bold` + metadata `text-gray-400 text-xs`
- Card right: "Start →" `bg-lime-400 text-black font-bold rounded-xl px-4 py-2 text-sm hover:bg-lime-300`
- Selected card: add `border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]`
- Empty state: centered text, `text-gray-400`

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/host/page.tsx
git commit -m "feat: light theme redesign for host library page"
```

---

## Task 10: Quiz Builder Redesign + Learning Science Fields

**Files:**
- Modify: `src/app/host/create/page.tsx`

Add `explanation` textarea and `bloomsLevel` dropdown to each question card. Apply light theme. The `updateQuestion` function currently takes a full `Question` — use spread merge for partial updates.

- [ ] **Step 1: Read the current file**

```bash
cat "src/app/host/create/page.tsx"
```

- [ ] **Step 2: Apply light theme design tokens**

Update all styling:
- Page: `min-h-screen p-4 max-w-3xl mx-auto`
- Tab bar: active tab `bg-lime-400 text-black font-bold rounded-full px-4 py-1.5`, inactive `text-gray-500 hover:text-gray-700`
- Question cards: `bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3`
- Text inputs and textareas: `bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none`
- Answer option inputs: same styling
- AI / Translate buttons: `border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl px-3 py-1.5 text-sm`
- Drag handle `⠿`: `text-gray-300 cursor-grab`

- [ ] **Step 3: Add explanation textarea to each question card**

In the question card, below the answer options, add:

```tsx
<textarea
  placeholder="Explain the correct answer (shown after reveal)…"
  value={question.explanation ?? ''}
  onChange={e => updateQuestion(idx, { ...question, explanation: e.target.value })}
  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm resize-none h-20 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-700"
  maxLength={300}
/>
```

- [ ] **Step 4: Add Bloom's dropdown to each question card**

Below the explanation textarea:

```tsx
const BLOOMS_OPTIONS = [
  { value: '', label: 'No Bloom\'s tag' },
  { value: 'remember', label: '🔵 Remember' },
  { value: 'understand', label: '🟢 Understand' },
  { value: 'apply', label: '🟡 Apply' },
  { value: 'analyse', label: '🟠 Analyse' },
  { value: 'evaluate', label: '🔴 Evaluate' },
  { value: 'create', label: '🟣 Create' },
]

// In each question card:
<select
  value={question.bloomsLevel ?? ''}
  onChange={e => updateQuestion(idx, { ...question, bloomsLevel: (e.target.value as BloomsLevel) || undefined })}
  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-700"
>
  {BLOOMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
</select>
```

Import `BloomsLevel` from `@/lib/quiz-types` at the top of the file.

- [ ] **Step 5: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 6: Smoke test**

Open `http://localhost:3000/host/create`. Create a question:
- Verify explanation textarea appears below answer options
- Verify Bloom's dropdown shows all 6 levels + "No tag"
- Save quiz and verify `explanation` and `bloomsLevel` are included in saved data

- [ ] **Step 7: Commit**

```bash
git add src/app/host/create/page.tsx
git commit -m "feat: quiz builder — light theme, explanation textarea, Bloom's dropdown per question"
```

---

## Task 11: Host Session Page — Full Redesign

**Files:**
- Modify: `src/app/host/session/page.tsx`

This is the most complex task. Changes:
1. Light theme visual redesign across all phases
2. `participants` state: `string[]` → `Map<string, string>` (name → archetype)
3. Update all `participants.length` → `participants.size` (3 locations)
4. QR code in lobby (side-by-side with game code)
5. Avatar grid in lobby
6. Practice Mode toggle in idle phase
7. Updated `create_session` emit to include `practiceMode`
8. Explanation display after `question_ended`
9. `session_end` listener → `session_ended` (server rename from Task 6)
10. `SessionReport` in ended phase

- [ ] **Step 1: Read the full current file**

```bash
cat "src/app/host/session/page.tsx"
```

- [ ] **Step 2: Update imports**

Add these imports at the top:
```tsx
import QRCode from 'react-qr-code'
import { Avatar } from '@/components/Avatar'
import { SessionReport } from '@/components/SessionReport'
import type { QuestionStat } from '@/lib/quiz-types'
```

- [ ] **Step 3: Update type declarations**

Replace:
```tsx
interface LeaderboardEntry {
  name: string
  score: number
}
```
With:
```tsx
interface LeaderboardEntry {
  name: string
  archetype: string
  score: number
}
```

- [ ] **Step 4: Update state declarations**

Replace:
```tsx
const [participants, setParticipants] = useState<string[]>([])
```
With:
```tsx
const [participants, setParticipants] = useState<Map<string, string>>(new Map())
// key = displayName, value = archetype
const [practiceMode, setPracticeMode] = useState(false)
const [explanation, setExplanation] = useState<string | null>(null)
const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
```

- [ ] **Step 5: Update socket event handlers**

In the `useEffect` socket setup:

Replace `participant_joined` handler:
```tsx
// Before: socket.on('participant_joined', ({ name, count }) => { setParticipants(prev => [...prev, name]) })
// After:
socket.on('participant_joined', ({ name, archetype }: { name: string; archetype: string; count: number }) => {
  setParticipants(prev => new Map(prev).set(name, archetype))
})
```

Replace `participant_left` handler:
```tsx
// Before: socket.on('participant_left', ({ name, count }) => { setParticipants(prev => prev.filter(n => n !== name)) })
// After:
socket.on('participant_left', ({ name }: { name: string }) => {
  setParticipants(prev => { const next = new Map(prev); next.delete(name); return next })
})
```

Add `question_ended` listener (new):
```tsx
socket.on('question_ended', ({ explanation: exp }: { correctAnswer: string; explanation: string | null }) => {
  setExplanation(exp)
})
```

Replace `question_show` handler — add `setExplanation(null)` at the start so old explanation clears for new question:
```tsx
socket.on('question_show', (data) => {
  setExplanation(null)
  // ...existing logic
})
```

Replace `session_end` → `session_ended`:
```tsx
// Before: socket.on('session_end', ({ leaderboard }) => { ... })
// After:
socket.on('session_ended', ({ leaderboard, practiceMode: pm, questionStats: qs }: {
  leaderboard: LeaderboardEntry[];
  practiceMode: boolean;
  questionStats: QuestionStat[];
}) => {
  setLeaderboard(leaderboard)
  setPracticeMode(pm)
  setQuestionStats(qs ?? [])
  setPhase('ended')
})
```

- [ ] **Step 6: Update `createSession` function**

```tsx
// Before: socketRef.current?.emit('create_session', { quizData: quiz }, callback)
// After:
socketRef.current?.emit('create_session', { quizData: quiz, practiceMode }, callback)
```

- [ ] **Step 7: Fix all `.length` → `.size` (3 locations)**

Search for `participants.length` and replace all with `participants.size`.

- [ ] **Step 8: Apply light theme to idle phase**

```tsx
// Idle phase layout:
<div className="min-h-screen p-4 max-w-2xl mx-auto">
  <h1 className="text-3xl font-black text-gray-900 mb-2">{quiz.title}</h1>
  <p className="text-gray-500 text-sm mb-6">{quiz.questions.length} questions</p>

  {/* Question preview */}
  <div className="space-y-2 mb-6">
    {quiz.questions.map((q, i) => (
      <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
        <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
        <p className="text-sm text-gray-700 truncate">{q.text}</p>
      </div>
    ))}
  </div>

  {/* Practice Mode toggle — directly above Create Session button */}
  <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 mb-3">
    <div>
      <p className="font-bold text-gray-900 text-sm">Practice Mode</p>
      <p className="text-gray-500 text-xs mt-0.5">Hides leaderboard from participants</p>
    </div>
    <button
      onClick={() => setPracticeMode(p => !p)}
      className={`w-12 h-6 rounded-full transition-colors ${practiceMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${practiceMode ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>

  <button
    onClick={createSession}
    className="w-full bg-lime-400 text-black font-black rounded-2xl py-4 text-base hover:bg-lime-300 transition-colors"
  >
    Create Session
  </button>
</div>
```

- [ ] **Step 9: Apply light theme to lobby phase with QR code + avatar grid**

```tsx
// Lobby phase:
<div className="min-h-screen p-4 max-w-2xl mx-auto">
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-xl font-black text-gray-900">Quizo<span className="text-lime-400">tic</span></h1>
    <span className="bg-lime-50 border border-lime-200 text-lime-700 text-xs font-bold px-3 py-1 rounded-full">
      ● LIVE · {participants.size} players
    </span>
  </div>

  {/* Game code + QR code */}
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
    <div className="flex gap-4 items-center">
      <div className="flex-1 text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Game Code</p>
        <p className="text-indigo-600 text-5xl font-black tracking-[0.3em]">{gameCode}</p>
        <p className="text-gray-400 text-xs mt-2">quizotic.net</p>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Scan to Join</p>
        <div className="bg-white rounded-2xl p-3 border border-gray-200">
          <QRCode
            value={`https://quizotic.net?code=${gameCode}`}
            size={120}
            bgColor="#ffffff"
            fgColor="#4f46e5"
          />
        </div>
      </div>
    </div>
  </div>

  {/* Avatar grid */}
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{participants.size} joined</p>
    <div className="flex flex-wrap gap-3">
      {Array.from(participants.entries()).map(([pName, pArchetype]) => (
        <div key={pName} className="flex flex-col items-center gap-1">
          <div className="ring-2 ring-indigo-100 rounded-full">
            <Avatar archetype={pArchetype} size={48} />
          </div>
          <p className="text-xs text-gray-700 font-semibold max-w-[56px] truncate text-center">{pName}</p>
          <p className="text-xs text-gray-400 max-w-[56px] truncate text-center">{pArchetype}</p>
        </div>
      ))}
    </div>
  </div>

  <button
    onClick={startQuiz}
    disabled={participants.size === 0}
    className="w-full bg-lime-400 text-black font-black rounded-2xl py-4 text-base hover:bg-lime-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
  >
    Start Quiz →
  </button>
</div>
```

- [ ] **Step 10: Apply light theme to question phase + add explanation display**

```tsx
// Question phase:
// - Question card: bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400
// - Answer count pill: bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-3 py-1 text-sm font-bold
// - Vote bars: keep colors (OPTION_COLORS), add transition-all duration-500
// - "Next Question →" / "End Quiz": bg-lime-400 text-black font-black rounded-2xl
//   Add animate-pulse when answered === participants.size

// Explanation display — shown after question_ended event:
{explanation && (
  <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
    <span className="font-bold text-indigo-600">Explanation: </span>{explanation}
  </div>
)}
```

- [ ] **Step 11: Apply light theme to ended phase + add SessionReport**

```tsx
// Ended phase:
<div className="min-h-screen p-4 max-w-2xl mx-auto">
  <h2 className="text-2xl font-black text-gray-900 mb-4">Session Complete</h2>

  {/* Leaderboard — always shown to host */}
  <div className="space-y-2 mb-2">
    {leaderboard.map((entry, i) => {
      const podiumClass = i === 0 ? 'bg-lime-400 text-black' : i === 1 ? 'bg-gray-200 text-black' : i === 2 ? 'bg-amber-200 text-amber-900' : 'bg-white border border-gray-200 text-gray-700'
      return (
        <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 ${podiumClass}`}>
          <span className="font-black w-5 text-center text-sm">{i + 1}</span>
          <Avatar archetype={entry.archetype ?? ''} size={40} />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate text-sm">{entry.name}</p>
            <p className="text-xs opacity-60 truncate">{entry.archetype}</p>
          </div>
          <span className="font-black tabular-nums text-sm">{entry.score}</span>
        </div>
      )
    })}
  </div>

  {/* Session report */}
  <SessionReport questionStats={questionStats} />

  <button
    onClick={() => router.push('/host')}
    className="mt-4 w-full border border-gray-300 text-gray-600 rounded-xl py-3 hover:border-gray-400 transition-colors font-semibold"
  >
    Back to Library
  </button>
</div>
```

- [ ] **Step 12: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: no errors.

- [ ] **Step 13: Full end-to-end smoke test**

Run `npm run dev`. Open 3 browser tabs:
- Tab 1: `http://localhost:3000/host/session`
  - Enable Practice Mode toggle
  - Create session → note game code and QR code appear
- Tab 2 + Tab 3: `http://localhost:3000/join`
  - Both join → avatars appear in host lobby grid
- Start quiz → answer questions
  - Tab 2: tap answer → confidence overlay appears → tap "Sure"
  - Verify explanation appears after host clicks "Next Question"
- End quiz
  - Host sees leaderboard + SessionReport with per-question stats
  - Participant tabs: if Practice Mode ON → only own score shown, no leaderboard

- [ ] **Step 14: Commit**

```bash
git add src/app/host/session/page.tsx
git commit -m "feat: host session — light theme, QR code, avatar grid, practice mode, question_ended, session_ended, SessionReport"
```

---

## Final Verification

- [ ] **Full build check**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: Phase 4 complete — visual redesign, avatars, QR code, learning science features"
```
