# Phase 3 — Quiz Builder, AI Generation & Visual Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete quiz creation system on top of the existing walking skeleton — quiz library, 4-tab builder (Manual/AI Topic/AI URL/AI Doc), AI generation via Gemini Flash, Indian language translation, and a visual refresh of the participant experience.

**Architecture:** New pages at `/host` (library), `/host/session` (runner moved here), and `/host/create` (builder). Two new API routes handle AI generation and translation. Shared types and localStorage helpers live in `src/lib/`. All quiz data persists in `localStorage` until Phase 4 adds a database.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, TypeScript, Socket.io, OpenAI SDK (OpenRouter), pdf-parse, mammoth

**Spec:** `docs/superpowers/specs/2026-03-19-quiz-builder-ai-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/quiz-types.ts` | Create | Shared TypeScript types for Quiz, Question, etc. |
| `src/lib/quiz-storage.ts` | Create | localStorage CRUD helpers (`quizotic_quizzes`, `quizotic_active_session`) |
| `src/app/host/session/page.tsx` | Create | Quiz runner (moved from `/host`; reads from `quizotic_active_session`) |
| `src/app/host/page.tsx` | Modify | Quiz library — list saved quizzes, start session, navigate to builder |
| `src/app/host/create/page.tsx` | Create | 4-tab quiz builder (Manual / AI Topic / AI URL / AI Doc) + translate + save |
| `src/app/api/generate-quiz/route.ts` | Create | AI generation — topic, URL, and document modes via OpenRouter |
| `src/app/api/translate-quiz/route.ts` | Create | Translation — strips non-translatable fields, calls Gemini, re-merges |
| `src/app/join/page.tsx` | Modify | New colors (pink/orange/blue/green), letter badges, visual feedback enhancements |
| `next.config.ts` | Modify | Add `serverExternalPackages: ['pdf-parse']` |
| `.env.example` | Modify | Add `OPENROUTER_API_KEY` and `QUIZ_AI_MODEL` |
| `package.json` | Modify | Add `openai`, `pdf-parse`, `@types/pdf-parse`, `mammoth` |

---

## Task 1: Install Dependencies + Update Config Files

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install new packages**

```bash
cd "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic"
npm install openai pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

Expected: `node_modules/openai/`, `node_modules/pdf-parse/`, `node_modules/mammoth/` present.

- [ ] **Step 2: Add `serverExternalPackages` to next.config.ts**

Replace the entire file:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
```

Why: `pdf-parse` uses `require()` on local file paths at module load time. Without this, Next.js webpack tries to bundle it and fails.

- [ ] **Step 3: Add AI env vars to `.env.example`**

Append to the file after the existing PORT/NODE_ENV block:

```env
# AI Generation (OpenRouter — reuse from secrets vault)
OPENROUTER_API_KEY=
QUIZ_AI_MODEL=google/gemini-2.0-flash-001
```

- [ ] **Step 4: Add the vars to the actual `.env` symlink**

The `.env` file is a symlink to `../../secrets/env/quizotic.env`. Open that file and add:

```env
OPENROUTER_API_KEY=<your key from secrets vault — same as Social Media project>
QUIZ_AI_MODEL=google/gemini-2.0-flash-001
```

- [ ] **Step 5: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build, no errors about pdf-parse or missing modules.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts .env.example
git commit -m "chore: add AI/doc deps and serverExternalPackages config"
```

---

## Task 2: Shared Types + Storage Helpers

**Files:**
- Create: `src/lib/quiz-types.ts`
- Create: `src/lib/quiz-storage.ts`

- [ ] **Step 1: Create `src/lib/quiz-types.ts`**

```typescript
export type QuestionType =
  | 'mcq'
  | 'truefalse'
  | 'poll'
  | 'openended'
  | 'wordcloud'
  | 'qa'
  | 'rating'
  | 'ranking'

export interface Question {
  id: string
  type: QuestionType
  text: string
  options?: string[]        // undefined for openended/wordcloud/qa
  correctAnswer?: string    // string index "0"/"1"/"2"/"3"; undefined for poll/openended/etc
  timerSeconds: 10 | 15 | 20 | 30 | 60
  points: 500 | 1000 | 2000
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
```

- [ ] **Step 2: Create `src/lib/quiz-storage.ts`**

```typescript
import type { Quiz } from './quiz-types'

const QUIZZES_KEY = 'quizotic_quizzes'
const SESSION_KEY = 'quizotic_active_session'

export function loadQuizzes(): Quiz[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUIZZES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveQuiz(quiz: Quiz): void {
  const quizzes = loadQuizzes()
  const existing = quizzes.findIndex(q => q.id === quiz.id)
  if (existing >= 0) {
    quizzes[existing] = quiz
  } else {
    quizzes.push(quiz)
  }
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function deleteQuiz(id: string): void {
  const quizzes = loadQuizzes().filter(q => q.id !== id)
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function setActiveSession(quiz: Quiz): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(quiz))
}

export function getActiveSession(): Quiz | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearActiveSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/quiz-types.ts src/lib/quiz-storage.ts
git commit -m "feat: add shared quiz types and localStorage helpers"
```

---

## Task 3: Create Quiz Runner at `/host/session`

The existing `src/app/host/page.tsx` quiz runner logic moves here. It reads the active quiz from `localStorage.quizotic_active_session` instead of the hardcoded `TEST_QUIZ`.

**Files:**
- Create: `src/app/host/session/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/src/app/host/session"
```

- [ ] **Step 2: Create `src/app/host/session/page.tsx`**

This is a near-copy of the current `host/page.tsx` runner with these changes:
- Import `Quiz` type from `src/lib/quiz-types`
- Import `getActiveSession, clearActiveSession` from `src/lib/quiz-storage`
- Load quiz from `getActiveSession()` on mount instead of using `TEST_QUIZ`
- Show error state if no active session found
- "Back to Library" button (on ended phase) calls `clearActiveSession()` then `router.push('/host')`
- Update OPTION_COLORS to the new palette (pink/orange/blue/green) per spec
- Add color dot swatches next to each answer option in the question view

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { getActiveSession, clearActiveSession } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

type Phase = 'loading' | 'error' | 'idle' | 'lobby' | 'question' | 'ended'

interface LeaderboardEntry {
  name: string
  score: number
}

const OPTION_COLORS = [
  'bg-pink-500',
  'bg-orange-500',
  'bg-blue-600',
  'bg-green-600',
]

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function SessionPage() {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [gameCode, setGameCode] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const currentQuestion = quiz?.questions[questionIndex] ?? null

  useEffect(() => {
    const session = getActiveSession()
    if (!session) {
      setPhase('error')
      return
    }
    setQuiz(session)
    setPhase('idle')
  }, [])

  useEffect(() => {
    if (phase === 'loading' || phase === 'error') return
    const socket = io()
    socketRef.current = socket

    socket.on('participant_joined', ({ name }: { name: string }) => {
      setParticipants(prev => [...prev, name])
    })

    socket.on('participant_left', ({ name }: { name: string }) => {
      setParticipants(prev => prev.filter(n => n !== name))
    })

    socket.on('answer_received', ({ count }: { count: number }) => {
      setAnswered(count)
    })

    socket.on('session_end', ({ leaderboard }: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(leaderboard)
      setPhase('ended')
    })

    return () => { socket.disconnect() }
  }, [phase])

  function createSession() {
    if (!quiz) return
    socketRef.current?.emit('create_session', { quizData: quiz }, (res: { success: boolean; gameCode: string }) => {
      if (res.success) {
        setGameCode(res.gameCode)
        setPhase('lobby')
      }
    })
  }

  function startQuiz() {
    socketRef.current?.emit('start_quiz', { gameCode })
    setAnswered(0)
    setQuestionIndex(0)
    setPhase('question')
  }

  function nextQuestion() {
    if (!quiz) return
    const nextIndex = questionIndex + 1
    if (nextIndex >= quiz.questions.length) {
      socketRef.current?.emit('end_session', { gameCode })
    } else {
      socketRef.current?.emit('next_question', { gameCode })
      setQuestionIndex(nextIndex)
      setAnswered(0)
    }
  }

  function goBackToLibrary() {
    clearActiveSession()
    router.push('/host')
  }

  if (phase === 'loading') {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">No active quiz session found.</p>
        <button onClick={() => router.push('/host')} className="px-6 py-3 bg-lime-400 text-zinc-950 font-bold rounded-xl">
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
          <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">Host</span>
        </span>
        {phase !== 'idle' && (
          <span className="text-sm text-zinc-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">

        {/* IDLE — waiting to create session */}
        {phase === 'idle' && quiz && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">{quiz.title}</h1>
              <p className="text-zinc-400">{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-2">
              {quiz.questions.map((q, i) => (
                <div key={q.id} className="flex gap-3 text-sm text-zinc-400">
                  <span className="text-zinc-600">{i + 1}.</span>
                  <span>{q.text}</span>
                </div>
              ))}
            </div>
            <button onClick={createSession} className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors">
              Create Session
            </button>
          </div>
        )}

        {/* LOBBY */}
        {phase === 'lobby' && (
          <div className="space-y-8 text-center">
            <div>
              <p className="text-zinc-400 mb-2">Share this code with participants</p>
              <p className="text-xs text-zinc-500 mb-4">Go to <span className="text-lime-400">quizotic.net</span> and enter code:</p>
              <div className="inline-block bg-zinc-900 border border-zinc-700 rounded-2xl px-10 py-6">
                <span className="text-6xl font-bold tracking-[0.3em] text-lime-400">
                  {gameCode.slice(0, 3)} {gameCode.slice(3)}
                </span>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 text-left">
              <p className="text-sm text-zinc-500 mb-3">
                {participants.length === 0 ? 'Waiting for participants...' : `${participants.length} joined:`}
              </p>
              {participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {participants.map((name, i) => (
                    <span key={i} className="px-3 py-1 bg-zinc-800 rounded-full text-sm">{name}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={startQuiz}
              disabled={participants.length === 0}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {participants.length === 0 ? 'Waiting for players...' : 'Start Quiz →'}
            </button>
          </div>
        )}

        {/* QUESTION */}
        {phase === 'question' && currentQuestion && quiz && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Question {questionIndex + 1} of {quiz.questions.length}</span>
              <span className="text-sm px-3 py-1 bg-zinc-800 rounded-full">
                <span className="text-lime-400 font-bold">{answered}</span>
                <span className="text-zinc-500"> / {participants.length} answered</span>
              </span>
            </div>

            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-lime-400 rounded-full transition-all duration-300"
                style={{ width: participants.length > 0 ? `${(answered / participants.length) * 100}%` : '0%' }}
              />
            </div>

            <div className="bg-zinc-900 rounded-xl p-6 border-t-4 border-lime-400">
              <p className="text-xl font-semibold leading-snug">{currentQuestion.text}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options?.map((opt, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-4 flex items-center gap-3 ${
                    String(i) === currentQuestion.correctAnswer
                      ? 'ring-2 ring-lime-400 bg-lime-400/10'
                      : 'bg-zinc-800'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${OPTION_COLORS[i]}`}>
                    {OPTION_LABELS[i]}
                  </span>
                  <span className="text-sm">{opt}</span>
                  {String(i) === currentQuestion.correctAnswer && (
                    <span className="ml-auto text-lime-400 text-xs font-bold">✓</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={nextQuestion}
              className={`w-full py-4 font-bold text-lg rounded-xl transition-colors ${
                answered === participants.length && participants.length > 0
                  ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300 animate-pulse'
                  : 'bg-lime-400 text-zinc-950 hover:bg-lime-300'
              }`}
            >
              {questionIndex + 1 >= (quiz?.questions.length ?? 0) ? 'End Quiz' : 'Next Question →'}
            </button>
          </div>
        )}

        {/* ENDED */}
        {phase === 'ended' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-zinc-500 uppercase tracking-widest mb-1">Quiz Complete</p>
              <h1 className="text-3xl font-bold">{quiz?.title}</h1>
            </div>
            <div className="space-y-3">
              {leaderboard.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-xl px-5 py-4 ${
                    i === 0 ? 'bg-lime-400 text-zinc-950'
                    : i === 1 ? 'bg-zinc-300 text-zinc-950'
                    : i === 2 ? 'bg-amber-700 text-white'
                    : 'bg-zinc-800 text-white'
                  }`}
                >
                  <span className="text-2xl font-black w-8 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <span className="font-semibold flex-1">{entry.name}</span>
                  <span className="font-bold tabular-nums">{entry.score.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
            <button
              onClick={goBackToLibrary}
              className="w-full py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:border-zinc-500 transition-colors"
            >
              Back to Library
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/host/session` — should show "No active quiz session found" with a "Back to Library" button.

- [ ] **Step 5: Update `server.mjs` to send per-option answer counts**

In `server.mjs`, find the `countAnswers` helper and add a new one after it:

```javascript
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
```

Then find the `answer_received` emit inside `submit_answer` and update it:

```javascript
// Before:
io.to(`host:${gameCode}`).emit('answer_received', {
  count: countAnswers(session, qi),
  total: session.participants.size,
})

// After:
const numOptions = question.options?.length ?? 4
io.to(`host:${gameCode}`).emit('answer_received', {
  count: countAnswers(session, qi),
  total: session.participants.size,
  optionCounts: countAnswersByOption(session, qi, numOptions),
})
```

- [ ] **Step 6: Display colored vote bars in session page**

In the session page (`src/app/host/session/page.tsx`), add `optionCounts` to state:

```typescript
const [optionCounts, setOptionCounts] = useState<number[]>([])
```

Update the `answer_received` listener to capture it:

```typescript
socket.on('answer_received', ({ count, optionCounts: counts }: { count: number; optionCounts?: number[] }) => {
  setAnswered(count)
  if (counts) setOptionCounts(counts)
})
```

Reset on question advance (add to `nextQuestion` and `startQuiz`):
```typescript
setOptionCounts([])
```

Then in the QUESTION phase, update the options grid to show vote bars:

```tsx
<div className="grid grid-cols-2 gap-3">
  {currentQuestion.options?.map((opt, i) => {
    const votes = optionCounts[i] ?? 0
    const pct = participants.length > 0 ? (votes / participants.length) * 100 : 0
    const barColors = ['bg-pink-500', 'bg-orange-500', 'bg-blue-600', 'bg-green-600']
    return (
      <div
        key={i}
        className={`rounded-xl overflow-hidden ${
          String(i) === currentQuestion.correctAnswer
            ? 'ring-2 ring-lime-400'
            : 'bg-zinc-800'
        }`}
      >
        <div className="p-4 flex items-center gap-3">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${OPTION_COLORS[i]}`}>
            {OPTION_LABELS[i]}
          </span>
          <span className="text-sm flex-1">{opt}</span>
          {String(i) === currentQuestion.correctAnswer && (
            <span className="text-lime-400 text-xs font-bold">✓</span>
          )}
        </div>
        {/* Vote bar */}
        <div className="h-1.5 bg-zinc-700">
          <div
            className={`h-full transition-all duration-500 ${barColors[i]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  })}
</div>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/host/session/page.tsx server.mjs
git commit -m "feat: add quiz runner at /host/session with live vote bars"
```

---

## Task 4: Refactor `/host/page.tsx` → Quiz Library

Replace the entire current host page (hardcoded quiz runner) with the quiz library UI.

**Files:**
- Modify: `src/app/host/page.tsx`

- [ ] **Step 1: Replace `src/app/host/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadQuizzes, deleteQuiz, setActiveSession } from '@/lib/quiz-storage'
import type { Quiz } from '@/lib/quiz-types'

export default function HostLibraryPage() {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setQuizzes(loadQuizzes())
  }, [])

  function handleStartSession() {
    const quiz = quizzes.find(q => q.id === selected)
    if (!quiz) return
    setActiveSession(quiz)
    router.push('/host/session')
  }

  function handleDelete(id: string) {
    deleteQuiz(id)
    setQuizzes(loadQuizzes())
    if (selected === id) setSelected(null)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
          <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">Host</span>
        </span>
        <button
          onClick={() => router.push('/host/create')}
          className="px-4 py-2 bg-lime-400 text-zinc-950 font-bold rounded-lg hover:bg-lime-300 transition-colors text-sm"
        >
          + Create New Quiz
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {quizzes.length === 0 ? (
          <div className="text-center space-y-4 py-20">
            <p className="text-4xl">📋</p>
            <h2 className="text-xl font-semibold">No quizzes yet</h2>
            <p className="text-zinc-400 text-sm">Create your first quiz to get started.</p>
            <button
              onClick={() => router.push('/host/create')}
              className="px-6 py-3 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 transition-colors"
            >
              Create Quiz
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Quizzes</h1>
            <div className="space-y-3">
              {quizzes.map(quiz => (
                <div
                  key={quiz.id}
                  onClick={() => setSelected(quiz.id === selected ? null : quiz.id)}
                  className={`rounded-xl p-5 border cursor-pointer transition-all ${
                    selected === quiz.id
                      ? 'border-lime-400 bg-lime-400/5'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{quiz.title}</h3>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                        {quiz.subject && ` · ${quiz.subject}`}
                        {quiz.language && quiz.language !== 'English' && ` · ${quiz.language}`}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(quiz.id) }}
                      className="text-zinc-600 hover:text-red-400 transition-colors text-xs px-2 py-1 flex-shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <button
                onClick={handleStartSession}
                className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors"
              >
                Start Session →
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 3: Manually verify**

```bash
npm run dev
```

- Open `http://localhost:3000/host` — should show "No quizzes yet" empty state with "Create Quiz" button.
- "Create New Quiz" button in header should navigate to `/host/create` (404 for now — that's fine).
- Open browser dev tools → Application → Local Storage → add a sample quiz manually, refresh — should appear in list.

- [ ] **Step 4: Commit**

```bash
git add src/app/host/page.tsx
git commit -m "feat: refactor /host to quiz library page"
```

---

## Task 5: Quiz Builder — `/host/create` (Tab Shell + Manual Tab)

Build the full 4-tab quiz builder page. In this task: the tab shell, the Manual creation tab (question cards, type selector, options, correct answer picker, timer, points), and the Save Quiz button.

**Files:**
- Create: `src/app/host/create/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/src/app/host/create"
```

- [ ] **Step 2: Create `src/app/host/create/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveQuiz } from '@/lib/quiz-storage'
import type { Question, QuestionType } from '@/lib/quiz-types'

type Tab = 'manual' | 'aitopic' | 'aiurl' | 'aidoc'

const TIMER_OPTIONS: (10 | 15 | 20 | 30 | 60)[] = [10, 15, 20, 30, 60]
const POINTS_OPTIONS: (500 | 1000 | 2000)[] = [500, 1000, 2000]
const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'truefalse', label: 'True / False' },
  { value: 'poll', label: 'Poll' },
  { value: 'openended', label: 'Open-ended' },
  { value: 'wordcloud', label: 'Word Cloud' },
  { value: 'qa', label: 'Q&A' },
  { value: 'rating', label: 'Rating' },
  { value: 'ranking', label: 'Ranking' },
]

const INDIAN_LANGUAGES = [
  'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi',
  'Kannada', 'Gujarati', 'Malayalam', 'Punjabi', 'Odia',
]

function makeQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: 'mcq',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '0',
    timerSeconds: 20,
    points: 1000,
  }
}

function optionsForType(type: QuestionType): string[] | undefined {
  if (type === 'truefalse') return ['True', 'False']
  if (type === 'mcq') return ['', '', '', '']
  if (type === 'rating') return ['1', '2', '3', '4', '5']
  return undefined
}

function hasCorrectAnswer(type: QuestionType): boolean {
  return type === 'mcq' || type === 'truefalse'
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: Question
  index: number
  onChange: (q: Question) => void
  onDelete: () => void
}) {
  function handleTypeChange(type: QuestionType) {
    const options = optionsForType(type)
    const correctAnswer = hasCorrectAnswer(type) ? '0' : undefined
    onChange({ ...question, type, options, correctAnswer })
  }

  function handleOptionChange(i: number, value: string) {
    const options = [...(question.options ?? [])]
    options[i] = value
    onChange({ ...question, options })
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Q{index + 1}</span>
        <button onClick={onDelete} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Remove</button>
      </div>

      {/* Type */}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Question Type</label>
        <select
          value={question.type}
          onChange={e => handleTypeChange(e.target.value as QuestionType)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
        >
          {QUESTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Question text */}
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Question</label>
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder="Enter your question..."
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 resize-none"
        />
      </div>

      {/* Options */}
      {question.options && question.type !== 'rating' && question.type !== 'ranking' && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">
            Options{hasCorrectAnswer(question.type) ? ' — click to mark correct' : ''}
          </label>
          <div className="space-y-2">
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasCorrectAnswer(question.type)}
                  onClick={() => hasCorrectAnswer(question.type) && onChange({ ...question, correctAnswer: String(i) })}
                  className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                    question.correctAnswer === String(i)
                      ? 'bg-lime-400 text-zinc-950'
                      : 'bg-zinc-700 text-zinc-400'
                  } ${hasCorrectAnswer(question.type) ? 'cursor-pointer hover:bg-zinc-600' : 'cursor-default'}`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  disabled={question.type === 'truefalse'}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timer + Points */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-zinc-500 mb-1 block">Timer</label>
          <select
            value={question.timerSeconds}
            onChange={e => onChange({ ...question, timerSeconds: Number(e.target.value) as Question['timerSeconds'] })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
          >
            {TIMER_OPTIONS.map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-zinc-500 mb-1 block">Points</label>
          <select
            value={question.points}
            onChange={e => onChange({ ...question, points: Number(e.target.value) as Question['points'] })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
          >
            {POINTS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── Main Builder Page ────────────────────────────────────────────────────────

export default function CreateQuizPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('manual')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [questions, setQuestions] = useState<Question[]>([makeQuestion()])
  const [saveError, setSaveError] = useState('')

  // Whether current questions came from AI generation (controls display in AI tabs)
  const [aiGenerated, setAiGenerated] = useState(false)

  // AI Topic state
  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // AI URL state
  const [aiUrl, setAiUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  // AI Doc state
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState('')

  // Translate state
  const [translateLang, setTranslateLang] = useState('Hindi')
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [translatedTo, setTranslatedTo] = useState<string | null>(null)  // tracks applied language

  // ── Question mutations ──────────────────────────────────────────────────────

  function addQuestion() {
    setQuestions(prev => [...prev, makeQuestion()])
  }

  function updateQuestion(index: number, q: Question) {
    setQuestions(prev => prev.map((item, i) => i === index ? q : item))
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  function setGeneratedQuestions(raw: Question[]) {
    const withIds = raw.map(q => ({ ...q, id: crypto.randomUUID() }))
    setQuestions(withIds)
    setAiGenerated(true)
  }

  // ── AI Topic generate ───────────────────────────────────────────────────────

  async function handleAiTopicGenerate() {
    if (!aiTopic.trim()) { setAiError('Enter a topic first'); return }
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'topic', topic: aiTopic, questionCount: aiCount, difficulty: aiDifficulty }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Generation failed'); return }
      setGeneratedQuestions(data)
    } catch {
      setAiError('Network error. Try again.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── AI URL generate ─────────────────────────────────────────────────────────

  async function handleUrlGenerate() {
    if (!aiUrl.startsWith('https://')) { setUrlError('URL must start with https://'); return }
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'url', url: aiUrl, questionCount: 5, difficulty: 'medium' }),
      })
      const data = await res.json()
      if (!res.ok) { setUrlError(data.error ?? 'Generation failed'); return }
      setGeneratedQuestions(data)
    } catch {
      setUrlError('Network error. Try again.')
    } finally {
      setUrlLoading(false)
    }
  }

  // ── AI Doc generate ─────────────────────────────────────────────────────────

  async function handleDocGenerate() {
    if (!docFile) { setDocError('Select a file first'); return }
    setDocLoading(true)
    setDocError('')
    try {
      const formData = new FormData()
      formData.append('file', docFile)
      formData.append('questionCount', '5')
      formData.append('difficulty', 'medium')
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { setDocError(data.error ?? 'Generation failed'); return }
      setGeneratedQuestions(data)
    } catch {
      setDocError('Network error. Try again.')
    } finally {
      setDocLoading(false)
    }
  }

  // ── Translate ───────────────────────────────────────────────────────────────

  async function handleTranslate() {
    if (questions.length === 0) { setTranslateError('No questions to translate'); return }
    setTranslateLoading(true)
    setTranslateError('')
    try {
      const res = await fetch('/api/translate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, targetLanguage: translateLang }),
      })
      const data = await res.json()
      if (!res.ok) { setTranslateError(data.error ?? 'Translation failed'); return }
      setQuestions(data)
      setTranslatedTo(translateLang)
    } catch {
      setTranslateError('Network error. Try again.')
    } finally {
      setTranslateLoading(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!title.trim()) { setSaveError('Quiz title is required'); return }
    if (questions.length === 0) { setSaveError('Add at least one question'); return }
    setSaveError('')

    const now = new Date().toISOString()
    saveQuiz({
      id: crypto.randomUUID(),
      title: title.trim(),
      subject: subject.trim() || undefined,
      language: translatedTo ?? 'English',
      createdAt: now,
      updatedAt: now,
      questions,
    })
    router.push('/host')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'manual', label: '✏️ Manual' },
    { id: 'aitopic', label: '✨ AI Topic' },
    { id: 'aiurl', label: '🔗 AI URL' },
    { id: 'aidoc', label: '📄 AI Doc' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Quizo<span className="text-lime-400">tic</span>
          <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">Create Quiz</span>
        </span>
        <button onClick={() => router.push('/host')} className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Library
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Quiz meta */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Quiz title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-lime-400"
          />
          <input
            type="text"
            placeholder="Subject / tag (optional)"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-lime-400 text-lime-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Manual Tab ── */}
        {tab === 'manual' && (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                onChange={updated => updateQuestion(i, updated)}
                onDelete={() => removeQuestion(i)}
              />
            ))}
            <button
              onClick={addQuestion}
              className="w-full py-3 border border-dashed border-zinc-700 text-zinc-400 rounded-xl hover:border-lime-400 hover:text-lime-400 transition-colors text-sm"
            >
              + Add Question
            </button>
          </div>
        )}

        {/* ── AI Topic Tab ── */}
        {tab === 'aitopic' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Topic</label>
              <input
                type="text"
                placeholder='e.g. "Indian Independence Movement"'
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Questions</label>
                <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400">
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Difficulty</label>
                <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
            <button
              onClick={handleAiTopicGenerate}
              disabled={aiLoading}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? 'Generating...' : '✨ Generate Questions'}
            </button>
            {aiGenerated && (
              <div className="space-y-4 mt-2">
                <p className="text-xs text-zinc-500">Generated — edit before saving:</p>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => removeQuestion(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AI URL Tab ── */}
        {tab === 'aiurl' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">URL (must start with https://)</label>
              <input
                type="url"
                placeholder="https://example.com/article"
                value={aiUrl}
                onChange={e => setAiUrl(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
              />
            </div>
            {urlError && <p className="text-red-400 text-sm">{urlError}</p>}
            <button
              onClick={handleUrlGenerate}
              disabled={urlLoading}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {urlLoading ? 'Fetching & Generating...' : '🔗 Fetch & Generate'}
            </button>
            {aiGenerated && (
              <div className="space-y-4 mt-2">
                <p className="text-xs text-zinc-500">Generated — edit before saving:</p>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => removeQuestion(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AI Doc Tab ── */}
        {tab === 'aidoc' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Upload PDF or DOCX (max 5MB)</label>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-zinc-300 file:text-sm"
              />
              {docFile && <p className="text-xs text-zinc-500 mt-1">{docFile.name} ({(docFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
            </div>
            {docError && <p className="text-red-400 text-sm">{docError}</p>}
            <button
              onClick={handleDocGenerate}
              disabled={docLoading || !docFile}
              className="w-full py-4 bg-lime-400 text-zinc-950 font-bold rounded-xl hover:bg-lime-300 disabled:opacity-50 transition-colors"
            >
              {docLoading ? 'Reading & Generating...' : '📄 Generate from Document'}
            </button>
            {aiGenerated && (
              <div className="space-y-4 mt-2">
                <p className="text-xs text-zinc-500">Generated — edit before saving:</p>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => removeQuestion(i)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Translate Section (all tabs) ── */}
        <div className="border-t border-zinc-800 pt-6 space-y-3">
          <p className="text-sm font-medium text-zinc-300">Translate Quiz (optional)</p>
          <div className="flex gap-3">
            <select
              value={translateLang}
              onChange={e => setTranslateLang(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-lime-400"
            >
              {INDIAN_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
            <button
              onClick={handleTranslate}
              disabled={translateLoading}
              className="px-6 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:border-lime-400 hover:text-lime-400 transition-colors text-sm disabled:opacity-50"
            >
              {translateLoading ? 'Translating...' : 'Translate'}
            </button>
          </div>
          {translateError && <p className="text-red-400 text-sm">{translateError}</p>}
        </div>

        {/* ── Save ── */}
        <div className="border-t border-zinc-800 pt-6 space-y-3">
          {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
          <button
            onClick={handleSave}
            className="w-full py-4 bg-lime-400 text-zinc-950 font-bold text-lg rounded-xl hover:bg-lime-300 transition-colors"
          >
            Save Quiz
          </button>
        </div>

      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Manually verify Manual tab**

```bash
npm run dev
```

- Open `http://localhost:3000/host/create`
- Should show title input, subject input, 4 tabs, one empty question card
- Add a question, select True/False — options should auto-populate "True"/"False"
- Change to MCQ — should show 4 editable option inputs
- Click letter badge (A/B/C/D) — should highlight that option as correct
- Change timer to 30s, points to 2000
- Fill in title, click "Save Quiz" — should navigate to `/host`
- Open `/host` — saved quiz should appear in list

- [ ] **Step 5: Add drag-to-reorder to question list**

Add drag state to `CreateQuizPage`:

```typescript
const dragIndex = useRef<number | null>(null)
```

Update the question list rendering in the Manual tab:

```tsx
{questions.map((q, i) => (
  <div
    key={q.id}
    draggable
    onDragStart={() => { dragIndex.current = i }}
    onDragOver={e => { e.preventDefault() }}
    onDrop={() => {
      const from = dragIndex.current
      if (from === null || from === i) return
      const reordered = [...questions]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(i, 0, moved)
      setQuestions(reordered)
      dragIndex.current = null
    }}
    className="cursor-grab active:cursor-grabbing"
  >
    <QuestionCard
      question={q}
      index={i}
      onChange={updated => updateQuestion(i, updated)}
      onDelete={() => removeQuestion(i)}
    />
  </div>
))}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/host/create/page.tsx
git commit -m "feat: add quiz builder /host/create with manual tab, drag-to-reorder, and save"
```

---

## Task 6: AI Generation API Route

Create the single API route that handles all three AI generation modes.

**Files:**
- Create: `src/app/api/generate-quiz/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/src/app/api/generate-quiz"
```

- [ ] **Step 2: Create `src/app/api/generate-quiz/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

const SYSTEM_PROMPT = `You are a quiz generator. Return only valid JSON — no markdown, no explanation, no code fences.`

function buildUserPrompt(text: string, questionCount: number, difficulty: string): string {
  return `Generate ${questionCount} ${difficulty} quiz questions based on the following content.

Return a JSON array. Each item must have exactly this shape:
{
  "type": "mcq",
  "text": "Question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "1",
  "timerSeconds": 20,
  "points": 1000
}

Rules:
- "correctAnswer" is always a string index into the options array ("0", "1", "2", or "3")
- "timerSeconds" must be one of: 10, 15, 20, 30, 60
- "points" must be one of: 500, 1000, 2000
- All questions must be MCQ with exactly 4 options
- Return nothing except the JSON array

Content:
${text}`
}

async function callModel(prompt: string, questionCount: number, difficulty: string): Promise<unknown[]> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(prompt, questionCount, difficulty) },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  return JSON.parse(raw)
}

function validateQuestions(data: unknown): boolean {
  if (!Array.isArray(data)) return false
  return data.every((q: unknown) => {
    if (typeof q !== 'object' || q === null) return false
    const item = q as Record<string, unknown>
    return (
      typeof item.text === 'string' &&
      Array.isArray(item.options) &&
      typeof item.correctAnswer === 'string' &&
      typeof item.timerSeconds === 'number' &&
      typeof item.points === 'number'
    )
  })
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''

  let mode: string
  let questionCount = 5
  let difficulty = 'medium'
  let contentText = ''

  try {
    // ── Document mode ──────────────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      questionCount = Number(formData.get('questionCount') ?? 5)
      difficulty = (formData.get('difficulty') as string) ?? 'medium'
      mode = 'document'

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.pdf')) {
        const pdfParse = (await import('pdf-parse')).default
        const parsed = await pdfParse(buffer)
        contentText = parsed.text.slice(0, 3000)
      } else if (fileName.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        contentText = result.value.slice(0, 3000)
      } else {
        return NextResponse.json({ error: 'Only .pdf and .docx files are supported' }, { status: 400 })
      }
    }
    // ── JSON modes (topic / url) ───────────────────────────────────────────────
    else {
      const body = await req.json()
      mode = body.mode
      questionCount = body.questionCount ?? 5
      difficulty = body.difficulty ?? 'medium'

      if (mode === 'topic') {
        if (!body.topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
        contentText = `Topic: ${body.topic}`
      } else if (mode === 'url') {
        const url: string = body.url ?? ''
        if (!url.startsWith('https://')) {
          return NextResponse.json({ error: 'Only https:// URLs are supported' }, { status: 400 })
        }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        let html: string
        try {
          const res = await fetch(url, { signal: controller.signal })
          html = await res.text()
        } catch {
          return NextResponse.json({ error: 'Could not fetch URL — try another' }, { status: 400 })
        } finally {
          clearTimeout(timeout)
        }
        // Strip HTML tags, collapse whitespace, truncate
        contentText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
      } else {
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
      }
    }

    // ── Call model, validate, retry once on bad JSON ───────────────────────────
    let questions: unknown[]
    try {
      questions = await callModel(contentText, questionCount, difficulty)
    } catch {
      // Retry once
      try {
        questions = await callModel(contentText, questionCount, difficulty)
      } catch {
        return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
      }
    }

    if (!validateQuestions(questions)) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    return NextResponse.json(questions)
  } catch (err) {
    console.error('[generate-quiz]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Manually test topic mode**

```bash
npm run dev
```

In a separate terminal:

```bash
curl -s -X POST http://localhost:3000/api/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{"mode":"topic","topic":"Indian History","questionCount":3,"difficulty":"easy"}' | head -c 500
```

Expected: JSON array of 3 question objects.

- [ ] **Step 5: Manually test URL mode**

```bash
curl -s -X POST http://localhost:3000/api/generate-quiz \
  -H "Content-Type: application/json" \
  -d '{"mode":"url","url":"https://en.wikipedia.org/wiki/Mahatma_Gandhi","questionCount":3,"difficulty":"medium"}' | head -c 500
```

Expected: JSON array of questions about Gandhi.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/generate-quiz/route.ts
git commit -m "feat: add AI generation API route (topic/url/document modes)"
```

---

## Task 7: Translation API Route

**Files:**
- Create: `src/app/api/translate-quiz/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/src/app/api/translate-quiz"
```

- [ ] **Step 2: Create `src/app/api/translate-quiz/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { Question } from '@/lib/quiz-types'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.0-flash-001'

export async function POST(req: NextRequest) {
  try {
    const { questions, targetLanguage }: { questions: Question[]; targetLanguage: string } = await req.json()

    if (!questions?.length) return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
    if (!targetLanguage) return NextResponse.json({ error: 'targetLanguage is required' }, { status: 400 })

    // Strip non-translatable fields — only send text content to the model
    const translatable = questions.map(q => ({
      text: q.text,
      options: q.options,
    }))

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a translation assistant. Return only valid JSON — no markdown, no explanation.',
        },
        {
          role: 'user',
          content: `Translate these quiz questions to ${targetLanguage}. Return the identical JSON structure with all text values translated. Do not translate anything except text content.

${JSON.stringify(translatable)}`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const translated: Array<{ text: string; options?: string[] }> = JSON.parse(raw)

    // Re-merge translated text fields back into original questions (preserving all other fields)
    const merged: Question[] = questions.map((q, i) => ({
      ...q,
      text: translated[i]?.text ?? q.text,
      options: translated[i]?.options ?? q.options,
    }))

    return NextResponse.json(merged)
  } catch (err) {
    console.error('[translate-quiz]', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Manually test translation**

```bash
npm run dev
```

```bash
curl -s -X POST http://localhost:3000/api/translate-quiz \
  -H "Content-Type: application/json" \
  -d '{
    "targetLanguage": "Hindi",
    "questions": [{
      "id": "test-1",
      "type": "mcq",
      "text": "Which company made ChatGPT?",
      "options": ["Google", "OpenAI", "Meta", "Microsoft"],
      "correctAnswer": "1",
      "timerSeconds": 20,
      "points": 1000
    }]
  }' | python3 -m json.tool
```

Expected: same question structure with Hindi text, `correctAnswer`/`timerSeconds`/`points`/`id` intact.

- [ ] **Step 5: End-to-end test in builder**

- Go to `/host/create`
- Create a question manually
- In the Translate section, select Hindi, click Translate
- Question text and options should appear in Hindi
- Save — quiz should save with translated content
- Start a session from the library — leaderboard should work normally

- [ ] **Step 6: Commit**

```bash
git add src/app/api/translate-quiz/route.ts
git commit -m "feat: add translation API route with field stripping/re-merging"
```

---

## Task 8: Visual Refresh — Participant Join Page

Update `src/app/join/page.tsx` with the new color scheme and visual enhancements from the spec.

**Files:**
- Modify: `src/app/join/page.tsx`

Changes needed:
1. `OPTION_COLORS` — red→`bg-pink-500`, blue→`bg-blue-600`, amber→`bg-orange-500`, green stays `bg-green-600`
2. Answer button layout — large letter badge left-aligned + option text right
3. Selected state — `ring-4 ring-white scale-95` (already partially there, refine)
4. Question card — add `border-t-4 border-lime-400` top border
5. Correct result — large green ✓ icon + "+N pts" text
6. Wrong result — large red ✗ icon + "No points" message (already there, enhance visuals)
7. Timer circle — turns red under 5s (already done, keep)

- [ ] **Step 1: Update `OPTION_COLORS` constant**

In `src/app/join/page.tsx`, find:
```typescript
const OPTION_COLORS = [
  'bg-red-500 active:bg-red-400',
  'bg-blue-500 active:bg-blue-400',
  'bg-amber-500 active:bg-amber-400',
  'bg-green-600 active:bg-green-500',
]
```

Replace with:
```typescript
const OPTION_COLORS = [
  'bg-pink-500 active:bg-pink-400',
  'bg-orange-500 active:bg-orange-400',
  'bg-blue-600 active:bg-blue-500',
  'bg-green-600 active:bg-green-500',
]
```

- [ ] **Step 2: Update answer button layout**

Find the answer button JSX (inside `{phase === 'question' && question && ...}`):

```tsx
<button
  key={i}
  onClick={() => submitAnswer(String(i))}
  disabled={selectedAnswer !== null || timeLeft === 0}
  className={`rounded-xl p-4 text-left transition-all ${
    selectedAnswer === String(i)
      ? 'ring-4 ring-white opacity-90 scale-95'
      : selectedAnswer !== null || timeLeft === 0
      ? 'opacity-40 cursor-not-allowed'
      : 'active:scale-95'
  } ${OPTION_COLORS[i]}`}
>
  <span className="text-xs font-bold opacity-70 block mb-1">{OPTION_LABELS[i]}</span>
  <span className="text-sm font-medium leading-snug">{opt}</span>
</button>
```

Replace with:
```tsx
<button
  key={i}
  onClick={() => submitAnswer(String(i))}
  disabled={selectedAnswer !== null || timeLeft === 0}
  className={`rounded-xl p-4 text-left transition-all flex items-center gap-3 ${
    selectedAnswer === String(i)
      ? 'ring-4 ring-white scale-95'
      : selectedAnswer !== null || timeLeft === 0
      ? 'opacity-40 cursor-not-allowed'
      : 'active:scale-95'
  } ${OPTION_COLORS[i]}`}
>
  <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-black flex-shrink-0">
    {OPTION_LABELS[i]}
  </span>
  <span className="text-sm font-medium leading-snug">{opt}</span>
</button>
```

- [ ] **Step 3: Update question card with lime border**

Find:
```tsx
<div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex-1 flex items-center justify-center">
  <p className="text-lg font-semibold text-center leading-snug">{question.text}</p>
</div>
```

Replace with:
```tsx
<div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 border-t-4 border-t-lime-400 flex-1 flex items-center justify-center">
  <p className="text-lg font-semibold text-center leading-snug">{question.text}</p>
</div>
```

- [ ] **Step 4: Enhance answered feedback (correct/wrong icons)**

Find the `{phase === 'answered' && ...}` section. Replace the icon div:

```tsx
{/* Current: */}
<div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl ${
  isCorrect ? 'bg-green-500/10' : 'bg-red-500/10'
}`}>
  {isCorrect ? '✓' : '✗'}
</div>
```

Replace with:
```tsx
<div className={`w-28 h-28 rounded-full flex items-center justify-center ${
  isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'
}`}>
  <span className={`text-6xl font-black ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
    {isCorrect ? '✓' : '✗'}
  </span>
</div>
```

And update the points line with a burst animation:
```tsx
{/* Current: */}
<p className="text-zinc-400 mt-1 text-sm">
  {isCorrect ? `+${pointsEarned.toLocaleString()} points` : 'No points this round'}
</p>
```

Replace with:
```tsx
<p className={`mt-1 text-sm font-semibold ${isCorrect ? 'text-green-400 animate-bounce' : 'text-zinc-400'}`}>
  {isCorrect ? `+${pointsEarned.toLocaleString()} pts` : 'No points'}
</p>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 6: Manually verify in two tabs**

```bash
npm run dev
```

- Open `/host` — start a session from a saved quiz (or create one first)
- Open `/join` in another tab — join with the game code
- Verify new pink/orange/blue/green button colors
- Verify letter badges are white squares with bold letters
- Verify selecting an answer shows ring-4 ring-white scale-95
- Verify question card has lime top border
- Verify correct answer shows large green ✓ and "+N pts" in green
- Verify wrong answer shows large red ✗ and "No points" text

- [ ] **Step 7: Commit**

```bash
git add src/app/join/page.tsx
git commit -m "feat: visual refresh on join page — new colors, letter badges, enhanced feedback"
```

---

## Task 9: End-to-End Smoke Test + Document Mode Verification

- [ ] **Step 1: Test document upload (PDF)**

```bash
npm run dev
```

- Go to `/host/create` → AI Doc tab
- Upload a small PDF (any PDF under 5MB)
- Click "Generate from Document"
- Verify questions appear and are editable
- Save the quiz

- [ ] **Step 2: Test full session flow**

- Go to `/host` — select the quiz, click "Start Session"
- Opens `/host/session` — verify quiz title and question list
- Create Session — game code appears
- In second tab, go to `/join` — enter code + name
- Participant appears in lobby
- Click "Start Quiz"
- Answer questions in participant tab
- Advance questions in host tab
- End quiz — leaderboard shows in both tabs
- Click "Back to Library" in host tab — verify returns to `/host`, session cleared

- [ ] **Step 3: Test AI generation end-to-end in builder**

- Go to `/host/create` → AI Topic tab
- Enter topic, click Generate
- Questions appear in editable cards below the generate form
- Edit one question
- Translate to Tamil
- Enter title, click Save
- Start a session from the library — quiz runs correctly

- [ ] **Step 4: Final commit (if any last fixes were needed)**

```bash
git add src/app src/lib server.mjs
git commit -m "chore: phase 3 complete — quiz builder, AI generation, visual refresh"
```

---

## Quick Reference

| Route | What it does |
|-------|-------------|
| `/host` | Quiz library — saved quizzes, Start Session |
| `/host/session` | Quiz runner (reads `quizotic_active_session`) |
| `/host/create` | 4-tab quiz builder + translate + save |
| `/join` | Participant join page (visual refresh) |
| `POST /api/generate-quiz` | AI generation — `mode: topic/url/document` |
| `POST /api/translate-quiz` | Translate questions, re-merge non-translatable fields |

| localStorage key | Content |
|-----------------|---------|
| `quizotic_quizzes` | `Quiz[]` — all saved quizzes |
| `quizotic_active_session` | `Quiz` — set by library, read by session runner |
