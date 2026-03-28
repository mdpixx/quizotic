# Phase 5 — Landing Page + Authentication Design Spec

**Date:** 2026-03-20
**Author:** Mahesh Dhiman (via brainstorming session)
**Status:** Draft — pending user review

---

## Goal

Ship a production-ready marketing landing page and Google OAuth authentication for Quizotic. After Phase 5, a visitor can:
1. Discover Quizotic via the landing page
2. Sign in with Google (one click)
3. Access the quiz builder and host dashboard (protected routes)
4. Be redirected to sign-in if they try to access /host/* unauthenticated

Quizzes remain in localStorage for now — database persistence of quiz data is Phase 6.

---

## Scope

| In Scope | Out of Scope |
|----------|-------------|
| Full landing page (7 sections) | Moving quiz storage from localStorage to DB |
| Google OAuth via NextAuth.js | Email/magic link auth |
| PostgreSQL User table via Prisma | Quiz, Session, or other DB tables |
| Protected routes middleware (/host/*) | Admin dashboard |
| Sign-in page | Billing / Razorpay integration |
| Scroll-driven video section (placeholder; video TBD) | Social auth beyond Google |

---

## Design Decisions

### Landing Page Visual Direction
- **Inspired by:** superr.ai — warm cream background, massive rounded display font, scroll animations, full-bleed sections
- **Background:** `#fdfbf9` (warm cream) — NOT the dark quiz-builder aesthetic
- **Font:** Nunito (Google Fonts, weight 800/900) for display headings; Inter for body
- **Colors:** Near-black `#171717` text, lime `#84cc16` as primary accent, warm orange `#f97316` and blue `#3b82f6` as section accents
- **Animations:** CSS scroll-triggered reveal (Intersection Observer). Scroll-scrubbed video section when AI video is ready.
- **Positioning:** "The quiz platform built for Indian classrooms"

### Authentication
- **Library:** NextAuth.js v5 (App Router compatible)
- **Provider:** Google OAuth only (Phase 5). Covers the vast majority of teachers who already use Google.
- **Session strategy:** JWT (no DB session table needed — simpler, stateless)
- **User persistence:** On first sign-in, upsert a User record in PostgreSQL via Prisma

### Database
- **ORM:** Prisma
- **DB:** PostgreSQL (Railway.app — already the deployment target)
- **Phase 5 schema:** User table only

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Protected Routes
- Next.js middleware (`middleware.ts`) at the project root
- Matcher: `/host/:path*`
- Unauthenticated → redirect to `/signin`
- Authenticated → pass through

---

## Landing Page — Section Architecture

### Section 1: Navigation
- Fixed, sticky, blur-backdrop
- Logo (Quizotic with lime accent) · Feature links · "Sign in with Google" pill CTA
- Collapses to hamburger on mobile

### Section 2: Hero
- **Headline:** "The quiz platform built for Indian classrooms"
- **Sub:** "Run live, scored quizzes your students actually look forward to. AI-powered, low-bandwidth, ₹299/mo."
- **Label badge:** "Made for India 🇮🇳"
- **CTAs:** "Get Started Free" (Google OAuth) + "Watch a live demo →" (link to video section)
- **Visual:** Live quiz card mockup (question + 4 options with correct highlighted, timer, student count, floating AI badge + leaderboard badge)
- **Social proof:** Avatar stack + "500+ teachers across India already using Quizotic"
- **Background:** Warm cream with soft lime + orange radial blobs

### Section 3: How It Works (Video / Scroll-scrubbed)
- Dark background (`#0f0f0f`)
- **Headline:** "From topic to live quiz in under 60 seconds"
- Scroll-scrubbed video area (placeholder `<div>` with quiz mockup until AI video is delivered)
- 4 numbered steps below: Type a topic → Share the code → Go live → See the report
- **Video spec (for AI generation):**
  - 25–30s, 16:9, 1080p+, 60fps, no audio
  - Scene: laptop + 2–3 phones, bright neutral background
  - Flow: type topic → questions appear → code shared → students join → question on projector → students tap → leaderboard
  - Slow deliberate motion (no fast cuts) — critical for smooth scroll-scrubbing
- **Implementation:** `<video muted playsinline>`, `currentTime` driven by scroll position via `requestAnimationFrame`

### Section 4: Feature Deep-Dives
Four full-bleed alternating sections (image left / text right, then text left / image right), each with a different background tint:

| # | Feature | Accent Color | Visual |
|---|---------|-------------|--------|
| 4a | AI Quiz Generator | Lime | Animated: topic typed → question cards appearing |
| 4b | Live Leaderboard | Orange | Animated leaderboard with scores ticking up |
| 4c | Bloom's Taxonomy | Blue/indigo | Tagging UI — question tagged to "Analyse" level |
| 4d | India Pricing | Purple | Pricing card with UPI/₹ highlight |

Each section has: eyebrow label · large heading with accent word · 3-bullet feature list · numbered feature items (I, II, III like superr.ai)

### Section 5: Pricing
- Monthly / Yearly toggle (yearly = 20% discount)
- 3-tier card grid: Free · Pro ₹299/mo · Institute ₹999/mo
- Pro card: scaled up 3%, dark border, "Most Popular" badge in lime
- Feature comparison list per card (✓ included / — not included)
- Payment trust strip: Razorpay · UPI · Debit card · Net banking · GST invoice · Cancel anytime

| Plan | Price | Students/session | Quizzes | AI generation |
|------|-------|-----------------|---------|--------------|
| Free | ₹0 | 20 | 5 saved | 10/month |
| Pro | ₹299/mo | Unlimited | Unlimited | Unlimited |
| Institute | ₹999/mo | Unlimited | Unlimited | Unlimited + 10 teachers |

### Section 6: Testimonials
- Dark background, 3 teacher quote cards
- Each card: star rating · quote · avatar emoji + name + school/institute
- Stats strip below: 500+ teachers · 40K+ students · 4.9★
- Copy is placeholder — replace with real quotes at launch

### Section 7: FAQ
- Light background, single-column accordion
- 6 questions with answers:

  1. **Do students need to create an account?**
     No. Students go to Quizotic.net and enter the 6-digit game code. No sign-up, no app install — works on any phone with a browser.

  2. **Does it work on slow school WiFi?**
     Yes. The student join page is under 100KB and designed for 1–2 Mbps connections. Real-time events are under 1KB each over WebSocket.

  3. **What AI model powers quiz generation?**
     Google Gemini 2.0 Flash via OpenRouter. Generate from a topic name, a URL, or by uploading a PDF or Word document (up to 5MB).

  4. **Can I use it for JEE/NEET/UPSC coaching?**
     Absolutely. Create quizzes manually or via AI for any subject. Bloom's taxonomy tagging helps track higher-order thinking questions separately from recall.

  5. **Can I get a GST invoice?**
     Yes. Pro and Institute plans include a GST-compliant invoice. Institute plan invoices can be addressed to the school or institute directly.

  6. **What happens to my quizzes if I downgrade to Free?**
     Your quizzes are saved. You can still view and edit them, but sessions are limited to 20 students until you re-upgrade.

### Section 8: CTA Banner + Footer
- **CTA Banner:** Dark rounded card, lime CTA button, "Your next class quiz starts right here"
- **Footer:** Dark (`#0f0f0f`), 4-column: brand description · Product links · Company links · Legal links
- Bottom bar: copyright + "Designed and built in India 🇮🇳"

---

## Authentication Flow

```
/ (landing page)
  └── "Get Started Free" → /signin
        └── Google OAuth → callback → upsert User in DB → redirect to /host

/host/* (protected)
  └── No session? → redirect to /signin?callbackUrl=/host
  └── Has session? → render page
```

### Sign-in Page (`/signin`)
- Centered card on warm cream background
- Quizotic logo
- Headline: "Welcome back" / "Start teaching smarter"
- Single button: "Continue with Google" (Google logo + text)
- Sub-copy: "No credit card. Free to start."
- On success: redirect to `callbackUrl` or `/host`

### NextAuth Configuration
- Provider: GoogleProvider with `clientId` + `clientSecret` from env
- Callbacks:
  - `signIn`: always allow
  - `session`: attach `user.id` to session
  - `jwt`: on first sign-in, upsert User in Prisma, store `id` in token
- Secret: `NEXTAUTH_SECRET` env var
- Base URL: `NEXTAUTH_URL` env var

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    ← Full landing page (replaces placeholder)
│   ├── signin/
│   │   └── page.tsx                ← Sign-in page
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts        ← NextAuth handler
│   └── host/                       ← Already exists — now protected
├── components/
│   ├── landing/
│   │   ├── Nav.tsx
│   │   ├── Hero.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Features.tsx
│   │   ├── Pricing.tsx
│   │   ├── Testimonials.tsx
│   │   ├── Faq.tsx
│   │   └── Footer.tsx
│   └── ScrollVideo.tsx             ← Scroll-scrubbed video component
├── lib/
│   └── auth.ts                     ← NextAuth config (authOptions)
└── middleware.ts                   ← Route protection

prisma/
└── schema.prisma                   ← User model

.env (symlinked to secrets vault)
  NEXTAUTH_SECRET=
  NEXTAUTH_URL=
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  DATABASE_URL=
```

---

## Scroll Animations

Two levels:

**1. Intersection Observer reveals (all sections)**
- Every section heading, card, and feature item starts `opacity: 0; transform: translateY(24px)`
- On entering viewport: transition to `opacity: 1; transform: translateY(0)` over 0.5s
- Stagger children 80ms apart
- CSS class: `.reveal` + `.revealed` (toggled by JS)
- No library needed — pure IntersectionObserver API

**2. Scroll-scrubbed video (Section 3)**
- `<video>` element with `preload="auto" muted playsinline`
- On scroll inside the section: `video.currentTime = progress * video.duration`
- `progress` = how far the sticky container has scrolled through its scroll-track height
- Section height = `100vh + video.duration * 100px` (e.g., 30s video → ~3100px section)
- Graceful fallback: if video not yet loaded, show static quiz mockup

---

## Environment Variables Required

```env
# NextAuth
NEXTAUTH_SECRET=<random 32-char string>
NEXTAUTH_URL=http://localhost:3001

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://...
```

---

## Dependencies to Add

| Package | Why |
|---------|-----|
| `next-auth@beta` | Auth (App Router compatible v5) |
| `@auth/prisma-adapter` | NextAuth ↔ Prisma bridge |
| `@prisma/client` | Prisma query client |
| `prisma` (dev) | Prisma CLI |

---

## What Does NOT Change

- Quiz builder (`/host/create`) — unchanged
- Participant join page (`/join`) — public, unchanged
- Live session (`/host/session`) — now protected, but no logic change
- Quiz localStorage storage (`quiz-storage.ts`) — unchanged
- Socket.io server (`server.mjs`) — unchanged
- All existing components — unchanged

---

## Verification Checklist

- [ ] Landing page renders correctly on mobile (375px) and desktop (1280px+)
- [ ] All 7 sections visible when scrolling
- [ ] Intersection Observer reveals work on scroll
- [ ] "Get Started Free" → redirects to /signin
- [ ] Sign-in page → "Continue with Google" → completes OAuth flow
- [ ] After sign-in → redirects to /host
- [ ] Visiting /host without session → redirects to /signin
- [ ] User record created in DB on first sign-in
- [ ] Revisiting /host with active session → no redirect
- [ ] Sign-out clears session → /host redirects again
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` completes successfully
