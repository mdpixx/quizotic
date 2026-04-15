# Mentimeter OSS Clones — Raw Research Dump
_Collected: April 2026 | Source: GitHub public repos_

---

## Clone Repos Found (gh search repos "mentimeter clone" --sort stars)

| Repo | Stars | Language | Key Tech |
|------|-------|----------|----------|
| RikhiSingh/mentimeter | 8 | TypeScript | Next.js, Express, Socket.IO, Redis, TailwindCSS |
| Anju-c/Mentimeter-Clone | 1 | JavaScript | React, Node.js, WebSocket (native), Prisma ORM |
| developershad/Mentimeter_Clone | ~0 | HTML/CSS | Static clone (UI only, no real-time) |
| mhtbansal11/Mentimeter-clone | ~0 | — | Not analyzed |
| azamshaikh1103/Mentimeter | ~0 | — | Not analyzed |
| Maha-Houidi/mentimeter_clone | ~0 | Flutter | Flutter app for live interactive quizzes |
| chumanfu/mentimeter-clone | ~0 | — | Created April 2026, not analyzed |

---

## Tech Stack Signals from Clones

### RikhiSingh/mentimeter (8 stars — highest)
- **Framework**: Next.js + Express.js
- **Real-time**: Socket.IO
- **Cache/State**: Redis
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Deploy**: Vercel (live demo at mentibyrikhi.vercel.app)
- **Architecture note**: Socket.IO chosen for bidirectional real-time vote sync; Redis for session/state management

### Anju-c/Mentimeter-Clone
- **Framework**: React (frontend) + Node.js (backend)
- **Real-time**: Native WebSocket
- **Persistence**: Prisma ORM (likely PostgreSQL or SQLite)
- **Join mechanic**: Unique codes (same as production Mentimeter)
- **Visualization**: Live charts (vote results update in real-time)
- **Architecture note**: Backend maintains session states and vote logs; WebSocket handles push

### Maha-Houidi/mentimeter_clone
- **Platform**: Flutter (mobile)
- **Purpose**: Live interactive quizzes
- Confirms demand for mobile-native Mentimeter experience

---

## Architecture Consensus from Clones

All functional clones converge on the same pattern:
1. Presenter creates session → unique join code generated
2. Participants join at a separate URL with the code
3. WebSocket / Socket.IO connection established per session
4. Votes sent over WS → server aggregates → broadcast back to presenter view
5. Results rendered as live charts (bars, word clouds)
6. Redis for session state; PostgreSQL/Prisma for persistence

**Quizotic already uses this pattern** — confirms Quizotic's architecture is sound.

---

## Real-Time Library Options (observed in wild)
- **Socket.IO**: Most common in clones (handles reconnection, namespaces, rooms natively)
- **Native WebSocket**: Used in simpler clones; less resilient
- **Ably**: What production Mentimeter uses (managed service, 70k+ concurrent)
- **Pusher**: Common alternative in the space (not seen in these clones)
- **SSE (Server-Sent Events)**: Not seen in any clone; used for one-directional push

---

## Key Observations for Quizotic

1. **Socket.IO + Redis** is the validated pattern for this category at indie/mid scale
2. Production Mentimeter uses Ably — relevant only when Quizotic needs 50k+ concurrent users
3. All clones use unique code join mechanic — confirms this is the expected UX pattern
4. No clone attempted AI features — that's a differentiation gap Quizotic can exploit
5. Flutter clone confirms mobile-first opportunity exists in this space
