# Kahoot OSS Clones — Research Notes

Source: GitHub search + README analysis
Scraped: 2026-04-15

---

## Search Results

### "kahoot clone" sorted by stars
1. **Ralex91/Rahoot** — self-hosted open-source Kahoot clone, active (updated April 2026)
2. **ethanbrimhall/kahoot-clone-nodejs** — Node.js clone with Socket.io
3. **Kahoot-Clone/kahoot-clone** — unnamed clone
4. **rotemtam/kahootClone** — AngularJS + Firebase (for Medium article)
5. **adrianboratyn/kahoot-js** — simple Kahoot clone (archived)
6. **Guy-Markman/PyHoot** — Python-based
7. **BsmhDevTeam/shablool** — open-source clone
8. **yuriy-kulakovskyi/kapoot-client** — React/Redux + Firebase
9. **r-argentina-programa/kahoot-clone** — React + Node.js + Socket.io
10. **khrj/kuizzy** — SweetAlert + WebSockets

### "kahoot alternative" sorted by stars
1. **supabase-community/kahoot-alternative** — Next.js + Supabase (Realtime)
2. **anshamray/Answr** — open source Kahoot alternative
3. **htlin222/gkahoot** — Google Slides-powered Kahoot alternative
4. **HoudaElAbbassi/KahootAlternative** — Node.js + Socket.io + React + Tailwind, 60+ players
5. **veggero/tyhoot** — Kahoot over Telegram

---

## Deep Dive: Ralex91/Rahoot (Top Clone)

**Stack:**
- Runtime: Node.js 22+, PNPM monorepo
- Real-time: **Socket.io v4.8.3** (server + client)
- Frontend: React 19 + React Router 7 + Tailwind CSS v4 + Vite
- State management: Zustand v5
- Animation: Motion (Framer Motion)
- Backend: TypeScript (tsx/esbuild)
- Validation: Zod v4
- Deployment: Docker + Docker Compose

**Quiz Data Structure:**
```json
{
  "subject": "Quiz Title",
  "questions": [
    {
      "question": "Question text",
      "answers": ["Option1", "Option2", "Option3", "Option4"],
      "image": "https://...",
      "video": "https://...",
      "audio": "https://...",
      "solution": 1,
      "cooldown": 5,
      "time": 15
    }
  ]
}
```

**Architecture:**
- Monorepo: packages/socket (backend), packages/web (frontend), packages/common (shared types)
- Supports: image, video, AND audio per question
- Per-question timer (configurable)
- Per-question cooldown period

---

## Deep Dive: supabase-community/kahoot-alternative

**Stack:**
- Framework: Next.js
- Backend/Realtime: **Supabase** (PostgreSQL + Realtime WebSockets)
- Styling: Tailwind CSS
- Architecture: /host route for host view, / root for player join
- Types: generated via `supabase gen types typescript`

**Key insight:** Uses Supabase Realtime (PostgreSQL-backed pub/sub over WebSockets) instead of Socket.io. Simpler deployment story.

---

## What OSS Clones Confirm About Kahoot's Architecture

1. **Socket.io is the dominant community choice** for cloning Kahoot's real-time model — aligns with Kahoot's own CometD/WebSocket approach
2. **Supabase Realtime** is emerging as a simpler alternative (database-backed pub/sub)
3. **Per-question timers** are the standard model (not global session timer)
4. **Monorepo** with separate socket server and web frontend is the clean architecture
5. **Media per question** (image, video, audio) is table stakes
6. **Cooldown period between questions** is standard UX

---

## Kahoot's Actual Real-Time Stack (Confirmed via Protocol Docs)

- **Protocol**: CometD (Bayeux)
- **Transport**: WebSocket (preferred) + HTTP long-polling fallback
- **Backend**: Java (gameserver "Merlin") + JVM optimized
- **Frontend**: TypeScript
- **Game server memory**: Optimized JVM flags for many concurrent sessions
- **Channels**: `/service/controller`, `/service/player`, `/service/status`
- **Time sync**: Client-server time synchronization built into handshake (for precise speed scoring)
