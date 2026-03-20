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
| Timer | SVG circular progress arc — replaces plain number circle |

---

## Avatar System

### Concept

Every participant gets a **real display name** (typed by them) plus an **auto-assigned archetype** with a matching pixel-art avatar. The archetype is shown throughout the session — on the join lobby, host lobby, leaderboard.

Example: "Priya" joins → assigned "Crystal Fox" → shown as "Priya · Crystal Fox 🦊" with a pixel-art fox avatar.

### Archetype Pool — 300 combinations

**20 Elements:**
Fire, Ice, Storm, Shadow, Thunder, Solar, Lunar, Cosmic, Iron, Crystal, Void, Phoenix, Neon, Obsidian, Glacier, Inferno, Titan, Mystic, Blood, Sakura

**15 Types:**
Dragon, Tiger, Ninja, Samurai, Wizard, Wolf, Eagle, Fox, Cobra, Knight, Archer, Panther, Viper, Monk, Phoenix

Assignment is random per participant per session. Same participant rejoining a different session may get a different archetype — this is intentional (keeps it fresh).

### Avatar Rendering

**Package:** `@dicebear/core` + `@dicebear/pixel-art` (client-side SVG generation, no API call)

**Seed:** archetype name, e.g. `"CrystalFox"` — so the same archetype always renders the same pixel-art face.

**Component:** `src/components/Avatar.tsx`
```tsx
import { createAvatar } from '@dicebear/core'
import { pixelArt } from '@dicebear/pixel-art'

export function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const svg = createAvatar(pixelArt, { seed: archetype.replace(/\s/g, ''), size }).toString()
  return <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}
```

### Server Changes (`server.mjs`)

- Import archetypes list from `src/lib/archetypes.ts` (or duplicate inline since server.mjs is CJS — keep a `archetypes.mjs` or inline the array)
- On `join_session`: randomly assign archetype, store on participant object: `{ displayName, archetype, score, answers: {} }`
- Return `archetype` in join response: `{ success, status, quizTitle, archetype }`
- Emit `participant_joined` with `{ name, archetype }` so host lobby can show avatar
- Include `archetype` in leaderboard entries: `{ name, archetype, score }`

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/archetypes.ts` | 300-entry archetype pool + `assignArchetype()` function |
| `src/components/Avatar.tsx` | DiceBear pixel-art avatar component |

### Modified files
| File | Changes |
|------|---------|
| `server.mjs` | Avatar assignment on join, archetype in all responses |
| `src/app/join/page.tsx` | Full visual redesign + avatar reveal + archetype display |
| `src/app/host/page.tsx` | Visual redesign — glass cards, lime glow, black bg |
| `src/app/host/session/page.tsx` | Visual redesign + QR code + avatar grid in lobby |
| `src/app/host/create/page.tsx` | Visual redesign — glass tabs and question panels |
| `package.json` | Add react-qr-code, @dicebear/core, @dicebear/pixel-art |

---

## Screen Specifications

### `/join` — Participant Join Page

**Form phase**
- Background: `bg-black`
- Inputs: glass style — `bg-white/[0.04] border border-white/[0.08] rounded-2xl` with `focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20`
- Join button: `bg-lime-400 text-black font-black rounded-2xl` full-width
- No top navbar — clean, full-screen entry

**Lobby phase** (after joining, waiting for host)
- Radial lime glow orb top-center
- Avatar revealed with scale-in + bounce animation (`animate-bounce` once on mount, then settle)
- Large avatar (96px) centered
- Archetype title: `"You are the Crystal Fox"` in lime, bold
- Display name below in zinc-400
- Bouncing lime dots (existing) kept

**Question phase**
- SVG circular timer (top-right): lime stroke when >5s, red when ≤5s, number centered
- Linear progress bar below timer row: lime → red as time decreases
- Question card: `bg-white/[0.03] border border-white/[0.08] border-t-4 border-t-lime-400 rounded-2xl`
- Answer buttons: full-color gradient (A/B/C/D) with drop-shadow glow, `rounded-2xl`, white circle badge for letter, larger padding (`p-5`)
- Selected state: `ring-4 ring-white scale-[0.97]`
- Small avatar (32px) + archetype name shown top-left (participant sees their own identity)

**Answered phase**
- Icon circle: `w-28 h-28`, correct = green glow border, wrong = red glow border
- Correct: `text-green-400 font-black text-3xl` "Correct!"
- Points: `text-lime-400 font-bold animate-bounce`
- Score card: glass panel, score in lime-400 `text-5xl font-black`

**Ended phase**
- Leaderboard rows: avatar (40px) + display name + archetype label + score
- Top 3: lime / zinc-300 / amber highlight rows
- "Play Again" ghost button

---

### `/host` — Quiz Library

- `bg-black` full page
- Radial lime glow top-center
- Header: logo + "Host" badge + "+ New Quiz" lime button
- Quiz cards: `bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5`
  - Left: emoji icon in a `rounded-xl` colored bg chip + title + metadata
  - Right: "Start →" lime button
  - Selected: `border-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.1)]`
- Empty state: large glow orb + text + CTA

---

### `/host/session` — Session Runner

**Lobby phase**
- Game code: `text-lime-400 text-6xl font-black tracking-[0.3em]` with lime text-shadow glow
- QR code: white background `rounded-2xl p-3`, encodes `https://quizotic.net?code=XXXXXX`
- Code + QR in a 2-column glass card side by side
- Avatar grid below: participant avatars (48px) animate in with `scale-0 → scale-100` bounce as each joins, name + archetype label below each
- "Start Quiz →" lime button, disabled (opacity-40) until ≥1 participant

**Question phase**
- Question card: glass + lime top border
- Vote bars: each option's bar uses its answer color (pink/orange/blue/green) with `opacity-70` — width = live vote percentage
- Answer count badge: `answered / total` as glass pill top-right
- "Next Question →" button pulses with `animate-pulse` when all answered

**Ended phase**
- Podium: #1 `bg-lime-400 text-black`, #2 `bg-zinc-300 text-black`, #3 `bg-amber-700 text-white`, rest `bg-white/[0.05]`
- Each row: avatar (40px) + name + archetype + score
- "Back to Library" ghost button

---

### `/host/create` — Quiz Builder

- `bg-black`
- Tab bar: glass pills — active tab `bg-lime-400 text-black`, inactive `bg-white/[0.05] text-zinc-400`
- Question cards: `bg-white/[0.03] border border-white/[0.08] rounded-2xl`
- Form inputs: glass style consistent with join page
- Drag handle: subtle `text-zinc-600` grip icon on left
- Generate / Translate buttons: lime outline style

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

The join page (`/join`) must read `?code` from the URL and pre-fill the game code input if present.

---

## Join Page URL Pre-fill

When QR is scanned, user lands on `quizotic.net?code=482937`. The join page should:
```tsx
const searchParams = useSearchParams()
const [code, setCode] = useState(searchParams.get('code') ?? '')
```
So the code input is pre-filled — user only needs to type their name and hit Join.

---

## New Packages

```bash
npm install react-qr-code @dicebear/core @dicebear/pixel-art
```

---

## Out of Scope (future specs)

- Landing page / hero section (superr.ai-inspired)
- Light / fun theme toggle for classrooms
- Accessibility toggles (OpenDyslexic font, large-text mode)
- Backend persistence (auth, database, Razorpay)
