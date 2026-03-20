# Phase 4 — Visual Redesign + Avatar System

## Goal

Elevate Quizotic's visual design from a functional developer skeleton to a top-notch, game-quality experience. Introduce a combinatorial avatar system that gives every participant a unique identity throughout the session.

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

**Package:** `@dicebear/core` + `@dicebear/pixel-art` (client-side SVG generation — no external API call, works offline)

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

**Solution:** Create `src/lib/archetypes.mjs` (pure ESM JS, no TypeScript) imported by `server.mjs`. The same data is exported from `src/lib/archetypes.ts` for Next.js components. **Both files must be kept in sync manually** — add a comment at the top of each: `// SYNC: keep in sync with archetypes.mjs / archetypes.ts`.

**Participant object shape** — add `archetype`, keep `answers` as array (compatible with existing `countAnswers`, `countAnswersByOption`, `buildLeaderboard` helpers):
```js
{ displayName, archetype, score: 0, answers: [] }
```

**Socket handler changes:**
- `join_session`: call `assignArchetype()`, store on participant, return in callback: `{ success, status, quizTitle, archetype }`
- `participant_joined` emit: `{ name, archetype }` — host lobby uses this to build avatar grid
- `participant_left` emit: keep as `{ name, count }` — host removes by matching `name`; host state is `Map<name, archetype>` so removal by name is straightforward
- Leaderboard entries: `{ name, archetype, score }`

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

### Mid-session Join

If participant joins while session is `active`, avatar is still assigned and returned. The reveal animation is skipped — client detects `status === 'active'` and goes directly to question phase. Archetype still shows in answered/ended screens.

### Play Again — Archetype Reset

"Play Again" resets all state including `archetype` (set to `null`). Next join call receives a freshly assigned archetype.

---

## Join Page — URL Pre-fill (QR Scan)

`useSearchParams()` in Next.js 16 requires a `Suspense` boundary — without it the build throws a static generation error.

```tsx
// src/app/join/page.tsx
import { Suspense } from 'react'

function JoinPageInner() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  // ... rest of component
}

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
- Bouncing indigo dots (3 dots, `bg-indigo-300 animate-bounce`, staggered delays) — `animate-bounce` loops forever here intentionally; this is a waiting indicator, not a one-shot reveal

**Question phase**
- `<CircularTimer />` top-right
- Progress bar: indigo gradient, switches to red at ≤5s
- Small avatar (32px) + archetype label `text-gray-500 text-xs` top-left
- Question card: `bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400 p-5`
- Answer buttons: full gradient + shadow, `rounded-2xl p-5`, white circle badge `w-8 h-8 rounded-full bg-white/25`
- Selected: `ring-4 ring-white scale-[0.97]`
- Unselected after answer: `opacity-50 pointer-events-none`

**Answered phase**
- Icon: `w-28 h-28 rounded-full` — correct: `bg-green-50 border-2 border-green-300`, wrong: `bg-red-50 border-2 border-red-300`
- Label: correct `text-green-600`, wrong `text-red-500`, `font-black text-3xl`
- Points: `text-indigo-600 font-bold` with `transition-transform` scale-up on mount
- Score card: `bg-white rounded-2xl shadow-sm border border-gray-200`, score in `text-indigo-600 text-5xl font-black`

**Ended phase**
- Leaderboard rows: `Avatar` (40px) + name + archetype label `text-gray-500 text-xs` + score `tabular-nums`
- #1: `bg-lime-400 text-black`, #2: `bg-gray-200 text-black`, #3: `bg-amber-200 text-amber-900`, rest: `bg-white border border-gray-200`
- "Play Again": `border border-gray-300 text-gray-600 rounded-xl hover:border-gray-400` — resets all state incl. archetype

---

### `/host/session` — Session Runner

**Idle phase**
- `<Background />` applied
- Quiz title: `text-gray-900 text-3xl font-black`
- Question preview: white cards with `border border-gray-200 shadow-sm`
- "Create Session" button: `bg-lime-400 text-black font-black rounded-2xl w-full py-4`

**Lobby phase**
- Game code: `text-indigo-600 text-6xl font-black tracking-[0.3em]`
- QR code + game code in 2-column white card, side by side
- QR foreground: indigo `#4f46e5`
- Avatar grid: participant avatars (48px) with `ring-2 ring-indigo-100`, pop in with `scale-0 → scale-100` transition as `participant_joined` events arrive. Name + archetype `text-xs text-gray-400` below each.
- Host tracks `Map<name, archetype>` — `participant_left` removes by name
- "Start Quiz →": `bg-lime-400 text-black font-black rounded-2xl`, `opacity-40 pointer-events-none` until ≥1 participant

**Question phase**
- Question card: `bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-lime-400`
- Vote bars: each option color (pink/orange/blue/green), `opacity-80`, `transition-all duration-500`
- Answer count: `bg-indigo-50 text-indigo-600 border border-indigo-100` glass pill top-right
- "Next Question →": `animate-pulse` when all answered

**Ended phase**
- #1: `bg-lime-400 text-black`, #2: `bg-gray-200 text-black`, #3: `bg-amber-200 text-amber-900`, rest: `bg-white border border-gray-200`
- Each row: `Avatar` (40px) + name + archetype + score
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

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/archetypes.ts` | 300-entry archetype pool + `assignArchetype()` for Next.js |
| `src/lib/archetypes.mjs` | Same data as pure ESM JS — imported by `server.mjs` |
| `src/components/Avatar.tsx` | DiceBear pixel-art avatar component |
| `src/components/CircularTimer.tsx` | SVG circular progress timer |
| `src/components/Background.tsx` | Dot-grid + corner glow orbs — shared across all pages |

### Modified files
| File | Changes |
|------|---------|
| `server.mjs` | Import `archetypes.mjs`, assign archetype on join, include in all responses + leaderboard |
| `src/app/join/page.tsx` | Full visual redesign + Suspense wrapper + avatar state + URL pre-fill |
| `src/app/host/page.tsx` | Visual redesign — light theme, glass cards |
| `src/app/host/session/page.tsx` | Visual redesign + QR code + avatar grid |
| `src/app/host/create/page.tsx` | Visual redesign — light cards, indigo accents |
| `package.json` | Add `react-qr-code`, `@dicebear/core`, `@dicebear/pixel-art` |

---

## New Packages

```bash
npm install react-qr-code @dicebear/core @dicebear/pixel-art
```

---

## Out of Scope (future specs)

- Landing page / hero section (superr.ai-inspired, scroll animations)
- Dark theme toggle (scientific case made — projector visibility chosen as default)
- Accessibility toggles (OpenDyslexic font, large-text mode, high-contrast)
- Backend persistence (auth, database, Razorpay)
