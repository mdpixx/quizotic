# Quizotic — Brainstorming Session

**Date:** 2026-03-19
**Context:** Branched from side-income strategy brainstorm. Mahesh identified a market gap for India-first live quizzing platform.

---

## The Problem

India has no homegrown live interactive quiz + presentation platform. Schools, coaching institutes, colleges, and corporates all depend on foreign platforms:

| Platform | Origin | Problem for Indian users |
|---|---|---|
| **Kahoot** | USA | USD pricing, no UPI, no Indian curriculum, no Hindi |
| **Quizizz** | USA (Indian-origin founders) | US-focused, USD pricing |
| **Mentimeter** | Sweden | USD pricing, no Indian language support |
| **Slido** | Slovakia (Cisco) | Enterprise-focused, no classroom use |

### Indian alternatives that exist but don't solve this:

| Platform | What it does | Why it's not the answer |
|---|---|---|
| **Classplus** | LMS for coaching institutes | No live gamified quiz engine |
| **BYJU's / PW** | Has quizzes, locked in ecosystem | Not a standalone tool |
| **TestBook / PrepInsta** | Test prep platforms | No real-time game mode |
| **Mettl / iMocha** | Enterprise hiring assessments | Not for classrooms |

---

## The Opportunity

An India-first platform that combines Kahoot's quiz engine + Mentimeter's interactive features, with:

- **INR pricing** — schools can't process USD payments easily; ₹2,000-5,000/year vs Kahoot's ~$120/year
- **UPI / Razorpay** — India's most used digital payment method
- **GST invoices** — B2B procurement in India requires this
- **CBSE/NCERT/State board question banks** — no foreign platform offers this
- **Hindi + regional language support** — zero Indian language support from competitors
- **WhatsApp join links** — India's #1 messaging app, no app install needed
- **Low-bandwidth optimized** — designed for 1-2 Mbps Indian classroom reality
- **Offline-first fallback** — for power-cut zones

### Market Size

| Segment | Total | Addressable |
|---|---|---|
| Schools (CBSE + State board) | ~1.5 million | ~300K private schools |
| Coaching institutes | ~40,000+ registered | High — already pay for tech |
| Colleges | ~50,000+ | Growing fast post-NEP 2020 |
| Corporate L&D | Large | Secondary target |

Even 5,000 paying institutes at ₹2,000-5,000/year = **₹1-2.5 Cr ARR**.

---

## Target Customers

**Primary (v1):**
- School teachers (CBSE/ICSE private schools) — classroom engagement
- Coaching institute owners (JEE/NEET/competitive) — revision tests, mock quizzes

**Secondary (v1+):**
- College professors — seminars, classroom participation
- Corporate trainers — L&D, onboarding quizzes

---

## Key Decisions Made

### Pricing Model: Freemium
- Free tier with limits (10 players/session, 5 saved quizzes)
- Paid tier removes limits
- Rationale: Indian schools/corporates won't pay upfront for unproven product. Let them get hooked, then convert.

### Primary Wedge: INR Billing
- Dollar billing isn't just about price — it's procurement friction
- A corporate training department needs finance approval to pay a foreign vendor in USD
- An INR invoice from a GST-registered Indian company gets processed in days, not weeks
- This alone is a real reason to switch

### Build Approach: Lean Clone + India Wrapper
- Build the core quiz engine + Mentimeter interactive features
- Wrap with India-first features (INR, UPI, GST, WhatsApp, low bandwidth)
- Validate whether Indian customers actually pay before investing in content/question banks
- Moat is distribution + pricing + localization, not features alone

---

## Why Include Mentimeter Features in v1

Original plan deferred Mentimeter features (polls, word cloud, Q&A, rating) to v2. Mahesh challenged this:

> "If our customer currently pays for both Kahoot AND Mentimeter, and we only replace Kahoot, they still need Mentimeter. We haven't solved their problem."

Technical reality: Mentimeter features are NOT complex:

| Feature | Complexity | Reason |
|---|---|---|
| Polls (ungraded) | Easy | Simpler than quiz engine — no scoring, no timer |
| Open-ended / free text | Easy | Collect text → display on host screen |
| Rating / scale | Easy | Same as poll, different input widget |
| Q&A (audience questions) | Easy | Message board with upvote — simpler than a quiz |
| Word cloud | Medium | Need wordcloud2.js library — one dependency |
| Ranking | Medium | Drag-to-rank UI + aggregate results |

All run on the same WebSocket infrastructure as the quiz engine. Just new slide types.

**Decision:** Include polls, open-ended, rating, Q&A, word cloud, and ranking in v1.

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Free |
| Real-time | Socket.io (Node.js) | Free |
| Database | PostgreSQL | Free |
| Auth | NextAuth.js | Free |
| Payments | Razorpay | Free setup, 2% per txn |
| Word cloud | wordcloud2.js | Free |
| Charts | Chart.js or Recharts | Free |
| Email | Resend.com | Free tier: 3,000/month |
| Hosting | Railway.app | ~$5/month (₹420) |

**Zero paid libraries.** Everything is open source.

---

## Cost to First Customer

| Item | Cost |
|---|---|
| Railway hosting | ₹420/month |
| Domain (already owned) | ₹1,200/year (Quizotic.in + Quizotic.net) |
| Everything else | ₹0 |
| **Total for 2-month build** | **~₹2,000-2,500** |

Break-even: 1 paying customer at ₹500/month covers all infrastructure.

---

## Domains

- **Quizotic.in** — host/teacher side (dashboard, quiz builder, reports, billing)
- **Quizotic.net** — participant join page (ultra-lightweight, fast-loading, works on 1 Mbps)

Separate domains = clean UX. Teacher says: "Go to quizotic.net, enter code 1234."

---

## Technical Feasibility (Claude Code)

Confirmed buildable with Claude Code (VS Code). Mahesh has already shipped products using this workflow (CityIndex, Newsletter poster system, Social Media automation).

Socket.io handles 30 simultaneous students trivially. Up to ~50 concurrent players per session on a single server is no problem for v1. Scaling to 300+ concurrent needs Redis + horizontal scaling — not Day 1 concern.

**Estimated build time:** 6-10 weeks of vibe coding sessions (evenings/weekends).
