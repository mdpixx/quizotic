# Quizotic — Project Instructions

## What is Quizotic?
India-first live interactive quiz + presentation platform. Combines Kahoot's quiz engine with Mentimeter's interactive features. Targets schools, coaching institutes, colleges, and corporate trainers.

## Domains
- **Quizotic.live** — Global platform (quiz builder, presentations, live sessions, reports)

## Tech Stack
- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Real-time:** Socket.io (Node.js custom server)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js (Google OAuth + email)
- **Payments:** Razorpay (INR, UPI, cards, subscriptions)
- **Hosting:** Railway.app
- **Email:** Resend.com
- **CDN:** Cloudflare

## Key Design Principles
1. **Participant page must be ultra-lightweight** — target < 100KB initial load
2. **INR-first** — all pricing, invoices, and payment flows in Indian Rupees
3. **No app install** — everything works in the browser
4. **Low-bandwidth friendly** — design for 1-2 Mbps classroom connections
5. **Mobile-first responsive** — participants are mostly on phones

## Project Structure
```
Quizotic/
├── CLAUDE.md              # This file
├── AGENTS.md              # Next.js version warnings — read before coding
├── docs/                  # Product documentation
│   ├── brainstorm.md
│   ├── PRD.md
│   ├── feature-comparison.md
│   └── cost-analysis.md
├── src/
│   └── app/               # Next.js App Router pages
├── server.mjs             # Custom Node.js server (Next.js + Socket.io together)
├── package.json
└── .env → ../../secrets/env/quizotic.env
```

## Deploy to Railway (IMPORTANT)
**`mdpixx/quizotic` is the single source of truth.** Railway watches this repo and
deploys from its `main` branch. Make changes on a branch in this repository,
open a PR, and merge only after CI passes. The merge to `main` triggers Railway.
Live at www.quizotic.live.

⚠️ **Do NOT edit these files in the `mdpixx/claude-zector` monorepo and rsync them over.**
The retired `npm run deploy` flow (`scripts/deploy-to-railway.sh`) rsynced a monorepo
snapshot **on top of** this repo with `--delete`, which silently reverted fixes that
were committed here directly. In June 2026 a stale sync (`@ 8745ae3`) stripped the
`StickyNav` (logo / Sign in / Sign up) off every SEO landing page, dropping signups to
zero while traffic looked healthy. The destructive script and package aliases were
removed on June 20, 2026. `src/__tests__/deployment-safety.test.ts` prevents their
return, while `src/__tests__/seo-signup-path.test.ts` protects the signup path.
If you must reconcile with the monorepo, port changes **into** this repo through a
reviewed commit; never overwrite this repo from a snapshot.

## Custom Server (IMPORTANT)
Socket.io requires a persistent server — it does NOT work with Next.js serverless/edge functions.
We use `server.mjs` — a custom Node.js server that boots Next.js + Socket.io in one process.
Dev: `npm run dev` → runs `node server.mjs`
Prod: Railway runs `node server.mjs`

## Important Rules
- Never hardcode API keys or secrets — use .env (symlinked to secrets vault)
- JavaScript only — no Python
- Minimal dependencies — don't add packages for one-time operations
- All WebSocket events must be < 1KB payload
- Test real-time features with at least 2 browser tabs (host + participant)
- **Read AGENTS.md before writing Next.js code** — this is Next.js 16, not 14

## Reference Docs
- **Releasing / deploy / rollback:** `docs/RELEASING.md` ← start here for all deploy questions
- PRD: `docs/PRD.md`
- Feature comparison: `docs/feature-comparison.md`
- Cost analysis: `docs/cost-analysis.md`
- Brainstorm context: `docs/brainstorm.md`
