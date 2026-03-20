# Phase 4 — Visual Redesign + Avatar System

## Goal

Elevate Quizotic's visual design from a functional developer skeleton to a top-notch, game-quality experience. Introduce a combinatorial avatar system that gives every participant a unique identity throughout the session.

## Design Direction

**Neon-Glow Dark** — true black background, lime-400 accent, gradient answer cards with color glow, radial glow orbs on key screens. Inspired by 21st.dev / linear.app aesthetic. Same energy on both host and participant screens.

---

## Design Tokens

| Token | Value |
|-------|-------|
| Background | `#000000` — true black everywhere |
| Surface | `bg-white/[0.03]` with `border border-white/[0.08]` |
| Accent | Lime `#a3e635` (`text-lime-400`) |
| Lime glow | `text-shadow: 0 0 30px rgba(163,230,53,0.35)` — game code, scores |
| Lime radial bg | `radial-gradient(circle, rgba(163,230,53,0.06) 0%, transparent 65%)` — hero glow on key screens |
| Answer A | `bg-gradient-to-br from-pink-700 to-pink-500` + `shadow-[0_4px_24px_rgba(236,72,153,0.3)]` |
| Answer B | `bg-gradient-to-br from-orange-700 to-orange-500` + `shadow-[0_4px_24px_rgba(249,115,22,0.3)]` |
| Answer C | `bg-gradient-to-br from-blue-700 to-blue-500` + `shadow-[0_4px_24px_rgba(59,130,246,0.3)]` |
| Answer D | `bg-gradient-to-br from-green-700 to-green-500` + `shadow-[0_4px_24px_rgba(34,197,94,0.3)]` |
| Border radius | `rounded-2xl` (16px) cards, `rounded-xl` (12px) smaller elements |
| Timer | SVG circular progress arc component — see implementation below |

---

## Avatar System

### Concept

Every participant gets a **real display name** (typed by them) plus an **auto-assigned archetype** with a matching pixel-art avatar. The archetype is shown throughout the session — on the join lobby, host lobby, leaderboard.

Example: "Priya" joins → assigned "Crystal Fox" → shown as "Priya · Crystal Fox" with a pixel-art fox avatar.

### Archetype Pool — 300 combinations

**20 Elements:**
Fire, Ice, Storm, Shadow, Thunder, Solar, Lunar, Cosmic, Iron, Crystal, Void, Phoenix, Neon, Obsidian, Glacier, Inferno, Titan, Mystic, Blood, Sakura

**15 Types:**
Dragon, Tiger, Ninja, Samurai, Wizard, Wolf, Eagle, Fox, Cobra, Knight, Archer, Panther, Viper, Monk, Phoenix

Assignment is random per participant per session. Same participant rejoining a different session may get a different archetype — this is intentional (keeps it fresh).

### Avatar Rendering

**Package:** `@dicebear/core` + `@dicebear/pixel-art` (client-side SVG generation — no external API call, works offline)

**Seed:** archetype name with spaces removed, e.g. `"CrystalFox"` — so the same archetype always renders the same pixel-art face across all sessions.

**Component:** `src/components/Avatar.tsx`
```tsx
'use client'
import { createAvatar } from '@dicebear/core'
import { pixelArt } from '@dicebear/pixel-art'

export function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const svg = createAvatar(pixelArt, { seed: archetype.replace(/\s/g, ''), size }).toString()
  return (
    <div
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
```

### Server Changes (`server.mjs`)

`server.mjs` is **native ESM** (`.mjs` extension, uses `import` statements). It cannot import TypeScript files directly — Node runs it without TypeScript transpilation.

**Solution:** Create `src/lib/archetypes.mjs` (pure ESM JavaScript, no TypeScript) and import from there in `server.mjs`. The same data is also exported from `src/lib/archetypes.ts` for use in Next.js components.

**Participant object shape** — add `archetype` field, keep `answers` as array (not object) to stay compatible with existing `countAnswers()`, `countAnswersByOption()`, and `buildLeaderboard()` helpers:
```js
// participant shape in server.mjs sessions Map
{ displayName, archetype, score: 0, answers: [] }
```

**Changes to socket handlers:**
- `join_session`: call `assignArchetype()`, store on participant, return in callback: `{ success, status, quizTitle, archetype }`
- `participant_joined` emit: `{ name, archetype }` — host lobby uses this to build avatar grid
- `participant_left` emit: keep as `{ name, count }` — host lobby removes by matching `name`; host-side state is `Map<name, archetype>` so removal by name is straightforward
- Leaderboard entries: `{ name, archetype, score }`

### Mid-session join behaviour

If a participant joins while session is `active` (host already started), they receive their archetype in the join response the same way. The avatar reveal lobby animation is **skipped** — client detects `status === 'active'` in the join callback and goes directly to the question phase, same as today. The archetype is still stored in state and shown in the answered/ended screens.

### Play Again — archetype reset

When "Play Again" is tapped on the ended screen, the client resets all state including `archetype` (set to `null`). The next join call will receive a freshly assigned archetype from the server.

---

## SVG Circular Timer Component

**Component:** `src/components/CircularTimer.tsx`

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
        {/* Track */}
        <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="#27272a" strokeWidth="3" />
        {/* Progress arc */}
        <circle
          cx="24" cy="24" r={RADIUS} fill="none"
          stroke={isLow ? '#ef4444' : '#a3e635'}
          strokeWidth="3"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${isLow ? 'text-red-400' : 'text-lime-400'}`}>
        {timeLeft}
      </span>
    </div>
  )
}
```

---

## Avatar Reveal Animation

On the **join lobby** phase, the avatar animates in on mount. Use a CSS transition, not `animate-bounce` (which loops forever in Tailwind):

```tsx
// Mount with opacity-0 scale-75, transition to opacity-100 scale-100
// Then a single bounce via a short keyframe, then settle
const [revealed, setRevealed] = useState(false)
useEffect(() => { const t = setTimeout(() => setRevealed(true), 100); return () => clearTimeout(t) }, [])

<div className={`transition-all duration-500 ${revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
  <Avatar archetype={archetype} size={96} />
</div>
```

On the **host lobby**, each avatar pops in as participants join. Use the same `scale-0 → scale-100` transition triggered by the avatar being added to the list — React's render will apply the transition naturally when the element mounts if the initial class is `scale-0` and a `useEffect` flips it to `scale-100`.

---

## Join Page URL Pre-fill

**`useSearchParams()` requires a `Suspense` boundary in Next.js 16.** Without it, the build will fail with a static generation error.

Wrap the join page export:
```tsx
// src/app/join/page.tsx
import { Suspense } from 'react'

function JoinPageInner() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  // ... rest of component
}

export default function JoinPage() {
  return <Suspense><JoinPageInner /></Suspense>
}
```

When QR is scanned, user lands on `quizotic.net?code=482937`. The code input is pre-filled — user only needs to type their name and hit Join.

---

## QR Code Implementation

Package: `react-qr-code`

```tsx
import QRCode from 'react-qr-code'

<div className="bg-white rounded-2xl p-3">
  <QRCode
    value={`https://quizotic.net?code=${gameCode}`}
    size={120}
    bgColor="#ffffff"
    fgColor="#000000"
  />
</div>
```

---

## Screen Specifications

### `/join` — Participant Join Page

**Form phase**
- Background: `bg-black`, full-screen, no navbar
- Radial lime glow orb top-center (decorative, `pointer-events-none`)
- Inputs: `bg-white/[0.04] border border-white/[0.08] rounded-2xl` with `focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20`
- Join button: `bg-lime-400 text-black font-black rounded-2xl` full-width

**Lobby phase** (waiting for host to start)
- Radial lime glow orb
- Avatar reveal: `scale-0 opacity-0 → scale-100 opacity-100` CSS transition on mount (see Avatar Reveal Animation above)
- Avatar size: 96px, centered
- Archetype title: `"You are the Crystal Fox"` — `text-lime-400 font-black text-xl`
- Display name: `text-zinc-400 text-sm mt-1`
- Bouncing lime dots below (keep existing)

**Question phase**
- `CircularTimer` component top-right (see SVG Circular Timer above)
- Linear progress bar: lime when >5s, red when ≤5s, `transition-all duration-1000`
- Question card: `bg-white/[0.03] border border-white/[0.08] border-t-4 border-t-lime-400 rounded-2xl p-5`
- Small avatar (32px) + archetype label top-left — participant sees their own identity
- Answer buttons: full-color gradient + drop-shadow glow, `rounded-2xl p-5`, white circle badge `w-8 h-8 rounded-full bg-white/25`
- Selected: `ring-4 ring-white scale-[0.97]`

**Answered phase**
- Icon: `w-28 h-28 rounded-full` — correct: `bg-green-500/20 border-2 border-green-500/40`, wrong: `bg-red-500/20 border-2 border-red-500/40`
- Label: `text-green-400` / `text-red-400`, `font-black text-3xl`
- Points: `text-lime-400 font-bold` with single-fire CSS transition (not Tailwind animate-bounce)
- Score card: glass panel, `text-lime-400 text-5xl font-black`

**Ended phase**
- Rows: `Avatar` (40px) + name + archetype label + score tabular-nums
- Top 3 highlight: `bg-lime-400 text-black` / `bg-zinc-300 text-black` / `bg-amber-700 text-white`
- "Play Again": ghost button — resets all state including archetype

---

### `/host/session` — Session Runner

**Idle phase** (before createSession is called)
- `bg-black`
- Quiz title: `text-white text-3xl font-black`
- Question preview: glass cards list
- "Create Session" button: `bg-lime-400 text-black font-black rounded-2xl w-full py-4`

**Lobby phase**
- Game code: `text-lime-400 text-6xl font-black tracking-[0.3em]` with `style={{ textShadow: '0 0 30px rgba(163,230,53,0.35)' }}`
- QR code + code in 2-column glass card side by side
- Avatar grid: each participant `{ name, archetype }` — avatar (48px) + name + archetype, pops in with `scale-0 → scale-100` transition as each `participant_joined` event arrives
- Host tracks participants as `Map<name, archetype>` — `participant_left` removes by name
- "Start Quiz →" lime button, `disabled opacity-40` until ≥1 participant

**Question phase**
- Question card: glass + `border-t-4 border-t-lime-400`
- Vote bars: colored (pink/orange/blue/green), `opacity-80`, `transition-all duration-500`
- Answer count: glass pill badge top-right
- "Next Question →" / "End Quiz": `animate-pulse` when all answered

**Ended phase**
- Podium rows with Avatar (40px): #1 `bg-lime-400 text-black`, #2 `bg-zinc-300 text-black`, #3 `bg-amber-700 text-white`, rest `bg-white/[0.05]`
- "Back to Library" ghost button

---

### `/host` — Quiz Library

- `bg-black`
- Radial lime glow top-center
- Header: logo + "Host" badge + `+ New Quiz` lime button
- Quiz cards: `bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5`
  - Left: emoji icon in colored `rounded-xl` chip + title + question count + subject
  - Right: "Start →" `bg-lime-400 text-black font-bold rounded-xl px-4 py-2`
  - Selected: `border-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.1)]`
- Empty state: large glow orb + heading + CTA button

---

### `/host/create` — Quiz Builder

- `bg-black`
- Tab bar: glass pill tabs — active `bg-lime-400 text-black font-bold`, inactive `bg-white/[0.05] text-zinc-400`
- Question cards: `bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5`
- Form inputs: glass style (`bg-white/[0.04] border-white/[0.08]`) consistent with join page
- Drag handle: `⠿` or grip icon `text-zinc-600` on left of each card
- AI generate / Translate buttons: lime outline (`border border-lime-400/50 text-lime-400 hover:bg-lime-400/10`)

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/archetypes.ts` | 300-entry archetype pool + `assignArchetype()` for Next.js components |
| `src/lib/archetypes.mjs` | Same data as pure ESM JS — imported by `server.mjs` |
| `src/components/Avatar.tsx` | DiceBear pixel-art avatar component |
| `src/components/CircularTimer.tsx` | SVG circular progress timer |

### Modified files
| File | Changes |
|------|---------|
| `server.mjs` | Import `archetypes.mjs`, assign archetype on join, include in all responses and leaderboard |
| `src/app/join/page.tsx` | Full visual redesign + Suspense wrapper + avatar state + URL pre-fill |
| `src/app/host/page.tsx` | Visual redesign — black bg, glass cards, lime glow |
| `src/app/host/session/page.tsx` | Visual redesign + QR code + avatar grid in lobby |
| `src/app/host/create/page.tsx` | Visual redesign — black bg, glass tabs and question panels |
| `package.json` | Add `react-qr-code`, `@dicebear/core`, `@dicebear/pixel-art` |

---

## New Packages

```bash
npm install react-qr-code @dicebear/core @dicebear/pixel-art
```

---

## Out of Scope (future specs)

- Landing page / hero section (superr.ai-inspired, scroll animations)
- Light / fun theme toggle for classrooms
- Accessibility toggles (OpenDyslexic font, large-text mode, high-contrast)
- Backend persistence (auth, database, Razorpay)
