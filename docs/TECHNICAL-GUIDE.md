# Quizotic — Complete Technical Guide

_Last updated: 8 April 2026_
_Written for: Mahesh Dhiman (non-developer owner)_

This document explains everything about Quizotic — what it is, how it works, where the code lives, what services power it, and how to manage it independently.

---

## Table of Contents

1. [What is Quizotic?](#1-what-is-quizotic)
2. [Where Does the Code Live?](#2-where-does-the-code-live)
3. [Tech Stack — Plain English](#3-tech-stack--plain-english)
4. [External Services & APIs](#4-external-services--apis)
5. [All Website Pages — What They Do](#5-all-website-pages--what-they-do)
6. [How Pages Connect to Each Other](#6-how-pages-connect-to-each-other)
7. [Database — What Data is Stored](#7-database--what-data-is-stored)
8. [Real-Time Quiz Engine (Socket.io)](#8-real-time-quiz-engine-socketio)
9. [Free vs Pro Plan Limits](#9-free-vs-pro-plan-limits)
10. [All Environment Variables (Secrets)](#10-all-environment-variables-secrets)
11. [File Structure — Where Everything Is](#11-file-structure--where-everything-is)
12. [How to Deploy Changes](#12-how-to-deploy-changes)
13. [How to Make Edits Without Claude](#13-how-to-make-edits-without-claude)
14. [Monthly Costs & Service Limits](#14-monthly-costs--service-limits)
15. [Emergency Troubleshooting](#15-emergency-troubleshooting)

---

## 1. What is Quizotic?

Quizotic is a live interactive quiz and presentation platform — think Kahoot + Mentimeter, built for India.

**What it does:**
- Hosts create quizzes or interactive presentations
- Participants join on their phones by entering a 6-digit code
- Questions appear in real-time, participants answer on their phones
- Live leaderboard, scores, and analytics after each session
- AI can auto-generate quizzes from topics, URLs, or uploaded documents

**Live at:** https://quizotic.live

---

## 2. Where Does the Code Live?

The code exists in **three places**. Think of it like a document that has copies:

### A. Your MacBook (the original)

```
/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/
```

This is where all development happens. Every file, every change starts here. To open it in Finder: open Finder → press Cmd+Shift+G → paste the path above.

To open it in VS Code and actually read the code:
1. Open VS Code
2. File → Open Folder
3. Navigate to: `/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/`
4. Click Open — you'll see all files in the left sidebar

---

### B. GitHub (the backup)

**Repository:** https://github.com/mdpixx/claude-zector (private)

**Direct link to Quizotic code on GitHub:**
```
https://github.com/mdpixx/claude-zector/tree/main/projects/Quizotic
```

**Why you didn't see it:** The GitHub repo is named `claude-zector` — it's a master repo that holds ALL your projects in one place (Newsletter, CityIndex, Quizotic, etc.). Quizotic is inside the folder `projects/Quizotic/`. You won't find a separate repo called "quizotic" — it's a subfolder.

**How to navigate to Quizotic code on GitHub, step by step:**
1. Go to https://github.com/mdpixx/claude-zector
2. You'll see a list of folders — click on `projects/`
3. Inside `projects/`, click on `Quizotic/`
4. You're now looking at all the Quizotic source code
5. Click `src/` → `app/` to see all the website pages
6. Click any `.tsx` file to read the actual code for that page

**What you'll see:** Each file shows its complete source code with syntax highlighting. You can see exactly how long each file is, what it does, and the full history of every change ever made.

---

### C. Railway (the live server)

**Dashboard:** https://railway.app/dashboard

Railway is where the website actually runs. It does NOT show you the code — it just runs it. When we run `railway up`, it takes the code from your MacBook, uploads it to Railway, builds it, and starts the server. Users visit quizotic.live → Railway serves the pages.

**In the Railway dashboard, you'll see two cards:**
- **Postgres** — this is your database (stores user data, quizzes, sessions)
- **Quizotic** — this is the web server running your website

The code itself is NOT visible in Railway. Railway is like a factory — it takes your code and runs it, but the code blueprint stays on your Mac and GitHub.

---

### Summary: Three Places, Three Purposes

| Where | What's there | How to see it |
|-------|-------------|---------------|
| **Your MacBook** | The working code — all files | Open VS Code → Open Folder → `/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/` |
| **GitHub** | Backup + version history | https://github.com/mdpixx/claude-zector → projects/ → Quizotic/ |
| **Railway** | The running live website | https://railway.app/dashboard → Quizotic → Deployments |

### How a change flows:

```
Your MacBook (Claude edits the code)
     |
     v
GitHub (git push — saves a backup copy with history)
     |
     v
Railway (railway up — makes the change live for all users)
```

---

## 3. Tech Stack — Plain English

| Technology | What it is | Why we use it |
|------------|-----------|---------------|
| **Next.js 16** | The framework that builds the website | Industry standard for modern websites, handles both the pages users see and the server logic |
| **React 19** | The UI library | Makes the website interactive — buttons, forms, animations |
| **Tailwind CSS** | Styling system | Makes things look good — colors, spacing, fonts, responsive design |
| **Socket.io** | Real-time communication | The magic that makes quizzes "live" — when host shows a question, all participants see it instantly |
| **PostgreSQL** | Database | Stores all data — users, quizzes, sessions, payments |
| **Prisma** | Database toolkit | Makes it easy to read/write data from the database using JavaScript |
| **NextAuth.js** | Login system | Handles Google login, email login, session management |
| **Node.js** | Server runtime | The engine that runs your JavaScript code on the server |
| **TypeScript** | Programming language | JavaScript with extra safety checks — catches errors before they reach users |

---

## 4. External Services & APIs

These are the third-party services Quizotic depends on. Think of them as suppliers to a restaurant — each provides a specific ingredient.

### 4.1 Google OAuth (Login)

| Detail | Value |
|--------|-------|
| **What it does** | Lets users sign in with their Google account |
| **Where configured** | Google Cloud Console (console.cloud.google.com) |
| **Used on** | Sign-in page (`/auth/signin`) |
| **Cost** | Free |
| **Limit** | Unlimited |
| **If it goes down** | Users can't log in (no alternative login currently active) |

### 4.2 Neon (Database)

| Detail | Value |
|--------|-------|
| **What it does** | Hosts the PostgreSQL database (all user data, quizzes, sessions) |
| **Dashboard** | https://console.neon.tech |
| **Used by** | Every page that reads or writes data |
| **Cost** | Free tier: 0.5 GB storage, 1 compute. Pro: ~$19/month |
| **Limit** | Free tier: 500 MB storage, 190 compute hours/month |
| **If it goes down** | Entire website stops working — nothing can load or save |

### 4.3 Railway (Hosting)

| Detail | Value |
|--------|-------|
| **What it does** | Runs the website server 24/7 |
| **Dashboard** | https://railway.app/dashboard |
| **Cost** | Pay-as-you-go: ~$5-15/month depending on traffic |
| **Limit** | No hard limit — scales with traffic |
| **If it goes down** | Website is completely offline |

### 4.4 Razorpay (Payments — Primary)

| Detail | Value |
|--------|-------|
| **What it does** | Handles Pro subscription payments in INR (UPI, cards, netbanking) |
| **Dashboard** | https://dashboard.razorpay.com |
| **Used on** | Billing page (`/host/billing`) |
| **Cost** | 2% per transaction |
| **Limit** | No limit |
| **Webhook URL** | `https://quizotic.live/api/webhooks/razorpay` |
| **If it goes down** | Users can't upgrade to Pro, but existing Pro users keep working |

### 4.5 Stripe (Payments — Secondary)

| Detail | Value |
|--------|-------|
| **What it does** | Backup payment processor for USD payments |
| **Dashboard** | https://dashboard.stripe.com |
| **Cost** | 2.9% + 30 cents per transaction |
| **Status** | Configured but secondary to Razorpay |

### 4.6 OpenRouter (AI Quiz Generation)

| Detail | Value |
|--------|-------|
| **What it does** | Powers AI quiz generation — turns topics/documents into quiz questions |
| **Dashboard** | https://openrouter.ai |
| **Model used** | Google Gemini 2.5 Flash Preview |
| **Used on** | Quiz creator (`/host/create`) — AI tab |
| **Cost** | Pay per token (~$0.001 per quiz generation) |
| **Limit** | Based on your OpenRouter balance |
| **If it goes down** | AI generation fails, but manual quiz creation still works |

### 4.7 Cloudflare R2 (Image Storage)

| Detail | Value |
|--------|-------|
| **What it does** | Stores images uploaded to quiz questions |
| **Dashboard** | Cloudflare Dashboard > R2 |
| **Cost** | Free: 10 GB storage, 10M reads/month |
| **Limit** | Very generous free tier |
| **If it goes down** | Image uploads fail, but existing images still show (cached) |

### 4.8 PostHog (Analytics)

| Detail | Value |
|--------|-------|
| **What it does** | Tracks user behavior — page views, button clicks, feature usage |
| **Dashboard** | https://eu.posthog.com (EU region) |
| **Cost** | Free: 1M events/month |
| **Limit** | 1M events/month on free tier |
| **If it goes down** | No impact on users — just loses analytics data |

### 4.9 Resend (Email)

| Detail | Value |
|--------|-------|
| **What it does** | Sends magic link login emails |
| **Dashboard** | https://resend.com/dashboard |
| **Status** | DEFERRED — not active yet (waiting for Cloudflare DNS setup) |
| **Cost** | Free: 100 emails/day |

### 4.10 Cloudflare (DNS & CDN)

| Detail | Value |
|--------|-------|
| **What it does** | Manages quizotic.live domain, security headers, image CDN |
| **Dashboard** | https://dash.cloudflare.com |
| **Cost** | Free |

---

## 5. All Website Pages — What They Do

### Public Pages (anyone can see)

| URL | What it shows | File location |
|-----|--------------|---------------|
| `/` | Landing page — features, demo, pricing, CTA | `src/app/page.tsx` |
| `/demo` | Interactive demo of quiz components | `src/app/demo/page.tsx` |
| `/join` | Where participants enter the session code | `src/app/join/page.tsx` |
| `/terms` | Terms of service | `src/app/terms/page.tsx` |
| `/privacy` | Privacy policy | `src/app/privacy/page.tsx` |
| `/r/[code]` | Referral link tracker | `src/app/r/[code]/page.tsx` |

### Auth Pages (login flow)

| URL | What it shows | File location |
|-----|--------------|---------------|
| `/auth/signin` | Google login + email login form | `src/app/auth/signin/page.tsx` |
| `/auth/verify` | "Check your email" message after magic link | `src/app/auth/verify/page.tsx` |
| `/auth/error` | Error message when login fails | `src/app/auth/error/page.tsx` |
| `/auth/onboard` | First-time user profile setup (role, organization) | `src/app/auth/onboard/page.tsx` |

### Host Dashboard (logged-in users)

| URL | What it shows | File location |
|-----|--------------|---------------|
| `/host` | Analytics dashboard (or onboarding for new users) | `src/app/host/(dashboard)/page.tsx` |
| `/host/quizzes` | All saved quizzes — edit, start, delete | `src/app/host/(dashboard)/quizzes/page.tsx` |
| `/host/presentations` | All saved presentations — present, edit, delete | `src/app/host/(dashboard)/presentations/page.tsx` |
| `/host/sessions` | History of all past sessions | `src/app/host/(dashboard)/sessions/page.tsx` |
| `/host/participants` | All participants across sessions | `src/app/host/(dashboard)/participants/page.tsx` |
| `/host/billing` | Subscription, payments, AI usage | `src/app/host/(dashboard)/billing/page.tsx` |
| `/host/admin` | Admin panel (only for admins) | `src/app/host/(dashboard)/admin/page.tsx` |

### Creation Pages

| URL | What it shows | File location |
|-----|--------------|---------------|
| `/host/create` | Quiz builder (manual + AI + templates) | `src/app/host/create/page.tsx` |
| `/host/present/create` | Presentation builder | `src/app/host/present/create/page.tsx` |
| `/host/templates` | Quiz template library | `src/app/host/templates/page.tsx` |

### Live Session Pages

| URL | What it shows | File location |
|-----|--------------|---------------|
| `/host/session` | Host's view during a live quiz (controls, leaderboard) | `src/app/host/session/page.tsx` |
| `/host/present/session` | Host's view during a live presentation | `src/app/host/present/session/page.tsx` |

---

## 6. How Pages Connect to Each Other

### User Journey — Host

```
Landing Page (/)
    |
    v
Sign In (/auth/signin) ──> Google Login
    |
    v
Onboarding (/auth/onboard) ──> Fill name, role, organization
    |
    v
Dashboard (/host) ──> See analytics (or onboarding if new)
    |
    ├──> My Quizzes (/host/quizzes)
    |       ├──> Create Quiz (/host/create)
    |       ├──> Edit Quiz (/host/create?edit=abc123)
    |       └──> Start Quiz ──> Live Session (/host/session)
    |
    ├──> My Presentations (/host/presentations)
    |       ├──> Create Slides (/host/present/create)
    |       └──> Present ──> Live Session (/host/present/session)
    |
    ├──> Sessions (/host/sessions) ──> View past results
    |
    ├──> Participants (/host/participants) ──> See who played
    |
    ├──> Billing (/host/billing) ──> Upgrade to Pro
    |
    └──> Admin (/host/admin) ──> Platform stats (admins only)
```

### User Journey — Participant

```
Receives a 6-digit code from host
    |
    v
Opens quizotic.live/join
    |
    v
Enters code + name ──> Chooses an avatar
    |
    v
Waits in lobby (sees other participants joining)
    |
    v
Question appears ──> Answers on phone
    |
    v
Sees correct/wrong + position on leaderboard
    |
    v
Next question... (repeats)
    |
    v
Final leaderboard + podium
```

### Which Pages Call Which APIs

| Page | APIs it uses |
|------|-------------|
| Dashboard (`/host`) | `GET /api/analytics` |
| My Quizzes | `GET /api/quizzes`, `DELETE /api/quizzes/[id]` |
| My Presentations | `GET /api/presentations`, `DELETE /api/presentations/[id]` |
| Sessions | `GET /api/sessions` |
| Participants | `GET /api/analytics/participants` |
| Billing | `GET /api/billing/status`, `GET /api/billing/payments`, `POST /api/billing/checkout` |
| Quiz Creator | `POST /api/generate-quiz`, `POST /api/quizzes`, `POST /api/upload-image` |
| Slide Creator | `POST /api/presentations`, `POST /api/upload-image` |
| Admin | `GET /api/admin/stats`, `POST /api/admin/grant-pro` |
| Live Quiz Session | WebSocket (Socket.io) — not HTTP API |
| Join Page | WebSocket (Socket.io) — not HTTP API |

---

## 7. Database — What Data is Stored

The database has 11 tables. Here's what each stores:

| Table | What it stores | Example |
|-------|---------------|---------|
| **User** | Every registered user | Name, email, Google profile, role, organization, referral code |
| **Account** | Google login details | OAuth tokens, provider IDs |
| **Session** | Login sessions | Who's currently logged in |
| **VerificationToken** | Magic link tokens | Email verification codes |
| **Subscription** | Pro plan status | Plan type, start/end dates, payment provider |
| **Payment** | Payment receipts | Amount, currency, invoice URL, status |
| **UsageLog** | AI generation tracking | How many AI questions a user has generated |
| **Quiz** | Saved quizzes | Title, subject, all questions (as JSON) |
| **Presentation** | Saved presentations | Title, all slides (as JSON) |
| **GameSession** | Live session results | 6-digit code, participants, scores, leaderboard |
| **Referral** | Referral tracking | Who referred whom, reward status |

### Key Relationships

- One **User** can have many **Quizzes**, **Presentations**, **GameSessions**
- One **User** has one **Subscription**
- One **GameSession** links to one **Quiz** or one **Presentation**
- **Referrals** link two **Users** (referrer and referee)

---

## 8. Real-Time Quiz Engine (Socket.io)

This is the most complex part of Quizotic. Socket.io enables "instant" communication between the host and all participants.

### How it works (simplified)

```
Host's browser <──WebSocket──> Server (server.mjs) <──WebSocket──> Participant's phone
```

Unlike normal web pages where you click and wait for a response, WebSocket keeps a permanent connection open. When the host clicks "Next Question", the server instantly pushes that question to every participant's phone.

### The Server File

**File:** `server.mjs` (788 lines — the heart of the real-time system)
**Location:** `/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/server.mjs`

This is a custom Node.js server that runs both:
1. The Next.js website (pages, APIs)
2. The Socket.io real-time engine

**This is critical:** Socket.io CANNOT run on normal hosting (like Vercel). It needs a persistent server, which is why Quizotic runs on Railway with a custom server.

### What happens during a live quiz

1. **Host creates session** → Server generates 6-digit code, stores session in memory
2. **Participant joins** → Enters code, server adds them to the session room
3. **Host starts quiz** → Server sends first question to all participants
4. **Participant answers** → Server records answer, sends confirmation
5. **Time runs out** → Server calculates scores, sends leaderboard update
6. **Host clicks next** → Server sends next question
7. **Quiz ends** → Server saves all results to database, sends final leaderboard

### In-Memory Storage (Important Limitation)

Active quiz sessions are stored in server memory, NOT in the database. This means:
- **Max 500 concurrent sessions** (configurable)
- If Railway restarts the server, sessions are rehydrated from Redis when
  `REDIS_URL` is set (participants reconnect via their stored participantId);
  without Redis, active sessions are lost
- Completed session results ARE saved to the database permanently

### Tested Capacity Per Session (July 2026)

Measured with `scripts/load-test-session.mjs` (real Socket.io clients against a
spawned server + the production Postgres):

| Players in one quiz | Result | Reveal fan-out p95 | Event-loop probe p95 | End-session DB burst |
|---|---|---|---|---|
| 500 | Clean pass | 20ms | 2ms | 2.3s |
| 750 | Clean pass | 32ms | 2ms | 3.2s |

- **500 participants in one Pro session is verified working**, including all
  500 joining within 60 seconds from a single venue IP (school/office NAT).
  750 also passed; beyond that is untested, not known-broken.
- Join flood policy (server.mjs, `JOIN_*` constants): unknown-code attempts are
  throttled globally per IP (code-enumeration guard, 100/min); joins to a real
  session are counted per IP **per game code** — 100/min for free sessions,
  600/min for Pro, so a large venue behind one NAT IP can fill a Pro room.
- Re-run before raising declared limits:
  `ulimit -n 16384 && node scripts/load-test-session.mjs --players=500 --shared-ip`
  (see the script header for flags; `--bench-serialize` measures the Redis
  snapshot cost, `--enum-check` verifies the enumeration guard).

---

## 9. Free vs Pro Plan Limits

| Feature | Free Plan | Pro Plan |
|---------|-----------|----------|
| Participants per quiz session | 100 (Early Supporter boost; standard 50) | Unlimited (500 load-tested) |
| Participants per presenter session | 50 | Unlimited |
| AI questions per month | 30 | 750 |
| Questions per AI generation | 10 | 25 |
| Saved quizzes | 5 | Unlimited |
| Saved presentations | 3 | Unlimited |
| Slides per presentation | 10 | Unlimited |
| Session history | 3 | 50 |
| Image uploads per month | 20 | 500 |
| CSV export | No | Yes |
| PDF export | No | Yes |
| Spaced retrieval | No | Yes |
| Quizotic branding | Shown | Hidden |

**Enforcement file:** `src/lib/limits.ts`

---

## 10. All Environment Variables (Secrets)

These are the secret keys and passwords that make everything work. They're stored in:

```
/Users/mahesh/Claude/CLAUDE ZECTOR/secrets/env/quizotic.env
```

The Quizotic project reads this file via a symlink: `.env` -> `../../secrets/env/quizotic.env`

### Complete List

| Variable | Service | What it is |
|----------|---------|-----------|
| `PORT` | Server | Which port the server runs on (4000) |
| `NODE_ENV` | Server | "development" or "production" |
| `DATABASE_URL` | Neon | Database connection URL |
| `AUTH_SECRET` | NextAuth | Secret key for encrypting login tokens |
| `NEXTAUTH_SECRET` | NextAuth | Same as AUTH_SECRET |
| `NEXTAUTH_URL` | NextAuth | Base URL of the website |
| `GOOGLE_CLIENT_ID` | Google | OAuth app ID |
| `GOOGLE_CLIENT_SECRET` | Google | OAuth app secret |
| `RAZORPAY_KEY_ID` | Razorpay | Payment API key |
| `RAZORPAY_KEY_SECRET` | Razorpay | Payment API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay | Webhook verification secret |
| `RAZORPAY_PLAN_MONTHLY` | Razorpay | Monthly subscription plan ID |
| `RAZORPAY_PLAN_YEARLY` | Razorpay | Yearly subscription plan ID |
| `STRIPE_SECRET_KEY` | Stripe | Payment API secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook verification secret |
| `STRIPE_PRICE_MONTHLY` | Stripe | Monthly price ID |
| `STRIPE_PRICE_YEARLY` | Stripe | Yearly price ID |
| `RESEND_API_KEY` | Resend | Email API key (not active yet) |
| `EMAIL_FROM` | Resend | Sender email address |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog | Analytics public key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog | Analytics server URL |
| `R2_ACCOUNT_ID` | Cloudflare | R2 storage account |
| `R2_ACCESS_KEY_ID` | Cloudflare | R2 API key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare | R2 API secret |
| `R2_BUCKET_NAME` | Cloudflare | R2 bucket name |
| `R2_PUBLIC_URL` | Cloudflare | Public URL for uploaded images |
| `OPENROUTER_API_KEY` | OpenRouter | AI API key |
| `QUIZ_AI_MODEL` | OpenRouter | Which AI model to use |
| `ADMIN_EMAILS` | App | Comma-separated admin email addresses |
| `HOST_DOMAIN` | Socket.io | Production host domain (CORS) |
| `JOIN_DOMAIN` | Socket.io | Production join domain (CORS) |

### Where to find/change these

1. **Railway dashboard** → Your project → Variables tab (production values)
2. **Local file** → `/Users/mahesh/Claude/CLAUDE ZECTOR/secrets/env/quizotic.env` (development values)
3. **Each service's dashboard** → To get new keys if compromised

---

## 11. File Structure — Where Everything Is

The entire Quizotic codebase is at:
```
/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/
```
On GitHub, the same folder is at:
```
https://github.com/mdpixx/claude-zector/tree/main/projects/Quizotic
```

**Scale of the codebase:** ~12,000 lines of code across ~60 files. The 5 largest files do most of the heavy lifting.

---

### The 5 Most Important Files (Start Here)

| File | Lines | What it does | View on GitHub |
|------|-------|-------------|----------------|
| `server.mjs` | ~800 | The real-time quiz engine — the heart of the system | `projects/Quizotic/server.mjs` |
| `src/app/host/session/page.tsx` | ~800 | Host's live quiz control page | `src/app/host/session/page.tsx` |
| `src/app/join/page.tsx` | ~950 | Everything a participant sees during a quiz | `src/app/join/page.tsx` |
| `src/app/host/create/page.tsx` | ~900 | The quiz builder (all tabs — manual, AI, templates) | `src/app/host/create/page.tsx` |
| `src/app/page.tsx` | ~700 | The public landing page | `src/app/page.tsx` |

---

### Top-Level Files

| File | Lines | What it does |
|------|-------|-------------|
| `server.mjs` | ~800 | The custom server — runs Next.js + Socket.io together. This is what Railway runs. |
| `package.json` | ~60 | Lists all 35 dependencies and run scripts |
| `next.config.ts` | ~40 | Next.js configuration (image domains, security headers) |
| `railway.json` | ~10 | Railway deployment settings |
| `Dockerfile` | ~20 | Instructions for Railway to build the project |
| `prisma/schema.prisma` | ~120 | Database blueprint — defines all 11 tables |
| `.env` | — | Secrets file (symlinked to secrets vault — not in GitHub) |
| `tsconfig.json` | ~20 | TypeScript configuration |

---

### All Pages (`src/app/`) — Complete File List

#### Public Pages (anyone can access)

| File | Lines | What users see |
|------|-------|---------------|
| `src/app/page.tsx` | ~700 | Landing page — features, pricing, sign-up CTA |
| `src/app/join/page.tsx` | ~950 | Participant quiz experience — code entry, avatar, questions, results |
| `src/app/demo/page.tsx` | ~100 | Interactive component demo |
| `src/app/terms/page.tsx` | ~80 | Terms of service |
| `src/app/privacy/page.tsx` | ~80 | Privacy policy |
| `src/app/r/[code]/route.ts` | ~30 | Referral link tracker (redirects to home) |

#### Auth Pages

| File | Lines | What users see |
|------|-------|---------------|
| `src/app/auth/signin/page.tsx` | ~150 | Google login + email login form |
| `src/app/auth/verify/page.tsx` | ~40 | "Check your email" message |
| `src/app/auth/error/page.tsx` | ~40 | Login error message |
| `src/app/auth/onboard/page.tsx` | ~200 | First-time user setup (name, role, org) |

#### Host Dashboard

| File | Lines | What hosts see |
|------|-------|---------------|
| `src/app/host/(dashboard)/page.tsx` | ~350 | Analytics overview (or onboarding for new users) |
| `src/app/host/(dashboard)/quizzes/page.tsx` | ~250 | List of all saved quizzes |
| `src/app/host/(dashboard)/presentations/page.tsx` | ~240 | List of all saved presentations |
| `src/app/host/(dashboard)/sessions/page.tsx` | ~280 | History of all past quiz sessions |
| `src/app/host/(dashboard)/participants/page.tsx` | ~250 | All participants across all sessions |
| `src/app/host/(dashboard)/billing/page.tsx` | ~400 | Subscription, payment history, plan usage |
| `src/app/host/(dashboard)/admin/page.tsx` | ~300 | Admin-only: user stats, grant Pro access |

#### Creation Pages

| File | Lines | What hosts do here |
|------|-------|------------------|
| `src/app/host/create/page.tsx` | ~900 | Full quiz builder (manual + AI + templates + image upload) |
| `src/app/host/present/create/page.tsx` | ~700 | Presentation slide builder |
| `src/app/host/templates/page.tsx` | ~200 | Browse and use built-in quiz templates |

#### Live Session Pages

| File | Lines | What happens here |
|------|-------|------------------|
| `src/app/host/session/page.tsx` | ~800 | Host controls during a live quiz (timer, votes, leaderboard) |
| `src/app/host/present/session/page.tsx` | ~500 | Host controls during a live presentation |

---

### API Routes (`src/app/api/`) — 27 Backend Endpoints

These are NOT pages — they're the server functions that pages call to fetch or save data.

| Folder | What it handles |
|--------|----------------|
| `api/auth/[...nextauth]/` | Login, logout, session management |
| `api/quizzes/` | Save, fetch, delete quizzes |
| `api/presentations/` | Save, fetch, delete presentations |
| `api/sessions/` | Fetch session history and results |
| `api/analytics/` | Dashboard stats, participant data |
| `api/billing/status/` | Check if user is Pro or Free |
| `api/billing/payments/` | List payment history |
| `api/billing/checkout/` | Create Razorpay/Stripe payment link |
| `api/admin/stats/` | Platform-wide stats (admin only) |
| `api/admin/grant-pro/` | Manually grant Pro to a user |
| `api/user/profile/` | Read/update user profile |
| `api/user/referrals/` | Referral tracking and rewards |
| `api/generate-quiz/` | AI quiz generation via OpenRouter |
| `api/translate-quiz/` | Translate quiz to another language |
| `api/upload-image/` | Upload images to Cloudflare R2 |
| `api/webhooks/razorpay/` | Handle Razorpay payment confirmations |
| `api/webhooks/stripe/` | Handle Stripe payment confirmations |

---

### Reusable Components (`src/components/`)

| File | What it does |
|------|-------------|
| `CircularTimer.tsx` | The countdown circle shown during questions |
| `Podium.tsx` | Top-3 podium animation at quiz end |
| `SessionReport.tsx` | Full results breakdown after a session |
| `ReflectionInsights.tsx` | AI-generated debrief after a session |
| `Avatar.tsx` | Generates participant avatar images |
| `ImageUpload.tsx` | Drag-and-drop image uploader |
| `landing/` (folder) | 13 sections of the landing page, each in its own file |
| `host/HostSidebar.tsx` | Left sidebar navigation in the host dashboard |

---

### Shared Logic (`src/lib/`)

| File | What it does |
|------|-------------|
| `auth.ts` | Login configuration (Google OAuth, magic links) |
| `prisma.ts` | Database connection client |
| `billing.ts` | Pro/Free plan checking logic |
| `limits.ts` | All plan limits in one place (change here to update everywhere) |
| `quiz-types.ts` | Data types for quizzes, questions, options |
| `quiz-templates.ts` | 10+ built-in quiz templates |
| `razorpay.ts` | Razorpay payment client |
| `stripe.ts` | Stripe payment client |
| `referral.ts` | Referral code generation |
| `archetypes.ts` | Participant avatar personality types |
| `sounds.ts` | Quiz sound effect URLs |

---

### Documentation (`docs/`)

| File | What it contains |
|------|-----------------|
| `docs/PRD.md` | Product Requirements Document — the original spec |
| `docs/brainstorm.md` | Initial brainstorm and feature ideas |
| `docs/feature-comparison.md` | Quizotic vs Kahoot vs Mentimeter comparison |
| `docs/cost-analysis.md` | Detailed cost breakdown |
| `docs/TECHNICAL-GUIDE.md` | THIS document |
| `docs/TECHNICAL-GUIDE.pdf` | PDF version of this document |

---

## 12. How to Deploy Changes

When code changes are made and need to go live:

### Step 1: Commit the changes (save to history)
```bash
cd "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic"
git add -A
git commit -m "description of what changed"
```

### Step 2: Push to GitHub (backup)
```bash
git push
```

### Step 3: Deploy to Railway (make it live)
```bash
cd "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic"
railway up --detach
```

This uploads the code to Railway, which then:
1. Installs all dependencies
2. Builds the website
3. Starts the server
4. Makes it live at quizotic.live

**Build time:** Usually 2-4 minutes.

### Monitoring the deployment
- Go to https://railway.app/dashboard
- Click on your Quizotic project
- You'll see build logs in real-time
- Green = success, Red = something broke

---

## 13. How to Make Edits Without Claude

### Option A: Use Claude Code (Recommended)

Even without this specific conversation, you can start a new Claude Code session:

1. Open Terminal
2. Navigate to the project: `cd "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic"`
3. Run `claude` to start Claude Code
4. Tell it what you want to change
5. It will read the code, make changes, and you approve

### Option B: Use VS Code (for small text edits)

1. Open VS Code
2. Open the folder: `/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/`
3. Navigate to the file you want to edit
4. Make changes
5. Deploy using the terminal commands from Section 12

### Option C: Edit directly on Railway

Railway has an online editor, but it's very limited. Not recommended for code changes.

### Option D: Hire a developer

If you need changes beyond what Claude can do, share:
- This document
- The GitHub repo link (github.com/mdpixx/claude-zector)
- Access to Railway, Neon, and other service dashboards

Any Next.js developer can understand and modify this codebase.

### Running the website locally (for testing before deploying)

```bash
cd "/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic"
npm run dev
```

Then open http://localhost:4000 in your browser. Changes you make to files will show up instantly (hot reload).

---

## 14. Monthly Costs & Service Limits

### Current Monthly Cost Estimate

| Service | Plan | Cost | Usage |
|---------|------|------|-------|
| Railway | Pay-as-you-go | ~$5-15/mo | Depends on traffic |
| Neon (Database) | Free | $0 | 500 MB storage |
| Google OAuth | Free | $0 | Unlimited |
| Cloudflare | Free | $0 | DNS + R2 storage |
| PostHog | Free | $0 | 1M events/month |
| OpenRouter | Pay-per-use | ~$1-5/mo | Depends on AI usage |
| Razorpay | Per transaction | 2% of payments | Only when users pay |
| Resend | Free | $0 | Not active yet |
| **TOTAL** | | **~$6-20/mo** | |

### Service Limits to Watch

| Service | Limit | What happens when exceeded |
|---------|-------|---------------------------|
| Neon (Free) | 500 MB database | Need to upgrade ($19/mo) or clean old data |
| PostHog (Free) | 1M events/month | Stops tracking, no user impact |
| OpenRouter | Balance runs out | AI quiz generation stops working |
| Cloudflare R2 | 10 GB storage | Need to upgrade or clean old images |
| Railway | $5 included credit | Billing starts after credit used |

---

## 15. Emergency Troubleshooting

### "Website is down"

1. Go to https://railway.app/dashboard
2. Check if the server is running (green status)
3. Click on the service → Deployments tab → check for errors
4. If it's crashing, check the logs for error messages

### "Users can't log in"

1. Check Google Cloud Console → your OAuth app → is it still active?
2. Check Railway → environment variables → are `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set?
3. Check the `NEXTAUTH_URL` matches `https://quizotic.live`

### "AI generation not working"

1. Check OpenRouter dashboard → is there balance remaining?
2. Check Railway env vars → is `OPENROUTER_API_KEY` set?

### "Payments not processing"

1. Check Razorpay dashboard → are there any failed webhooks?
2. Verify the webhook URL is `https://quizotic.live/api/webhooks/razorpay`
3. Check Railway env vars → are all Razorpay variables set?

### "Database is full"

1. Go to Neon console → check storage usage
2. Old `GameSession` records with large `results` JSON are the biggest space users
3. You can delete old sessions via the Neon SQL editor:
   ```sql
   DELETE FROM "GameSession" WHERE "endedAt" < NOW() - INTERVAL '6 months';
   ```

### Need to change admin emails

Update the `ADMIN_EMAILS` environment variable in Railway → Variables tab. Comma-separated list of email addresses.

---

## Quick Reference Card

| What | Where |
|------|-------|
| **Live website** | https://quizotic.live |
| **Code on your Mac** | `/Users/mahesh/Claude/CLAUDE ZECTOR/projects/Quizotic/` |
| **GitHub backup** | https://github.com/mdpixx/claude-zector (private) |
| **Railway dashboard** | https://railway.app/dashboard |
| **Database dashboard** | https://console.neon.tech |
| **Google OAuth** | https://console.cloud.google.com |
| **Razorpay dashboard** | https://dashboard.razorpay.com |
| **PostHog analytics** | https://eu.posthog.com |
| **OpenRouter (AI)** | https://openrouter.ai |
| **Cloudflare (DNS/CDN)** | https://dash.cloudflare.com |
| **Secrets file** | `/Users/mahesh/Claude/CLAUDE ZECTOR/secrets/env/quizotic.env` |
| **Deploy command** | `cd projects/Quizotic && railway up --detach` |
| **Run locally** | `cd projects/Quizotic && npm run dev` → localhost:4000 |

---

_This document was auto-generated by Claude Code on 7 April 2026. Update it whenever major changes are made to the architecture._
