# Quizotic — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-19
**Author:** Mahesh (product vision) + Claude (documentation)
**Status:** Pre-development

---

## 1. Product Vision & Positioning

**One-liner:** India's first live interactive quiz and presentation platform — a homegrown Kahoot + Mentimeter built for Indian classrooms, coaching centres, and corporate training rooms.

**Vision:** Every Indian teacher, trainer, and presenter should have access to a world-class interactive engagement tool — in their language, at their price, on their infrastructure.

**Positioning:**
- Not a "cheap Kahoot clone" — a product built ground-up for Indian realities
- Combines quiz gamification (Kahoot's strength) with presentation interactivity (Mentimeter's strength) in one platform
- Local advantage: INR billing, UPI payments, GST invoices, regional languages, CBSE/NCERT content, low-bandwidth design

**Tagline candidates:**
- "Quiz. Engage. Learn. In your language."
- "India's interactive classroom."
- "Make every session count."

---

## 2. Target Market & Segments

### Primary — v1 Launch

**Segment A: School Teachers (CBSE/ICSE/State Board Private Schools)**
- ~300K private schools in India with budget for edtech
- Use case: Live classroom quizzes for revision, assessment, engagement
- Current tool: Kahoot (if any) — most use no tool at all
- Pain: USD pricing, no curriculum alignment, no Hindi
- Decision maker: Individual teacher (free tier) or school admin (paid tier)

**Segment B: Coaching Institute Owners**
- ~40,000+ registered coaching centres
- Use case: Mock tests, revision quizzes, batch engagement
- Current tool: Custom apps or nothing
- Pain: No affordable live quiz tool designed for Indian competitive exams
- Decision maker: Institute owner/director

### Secondary — v1+ Expansion

**Segment C: College Professors**
- ~50,000+ colleges, growing post-NEP 2020
- Use case: Lecture engagement, seminar Q&A, feedback collection
- Need: Polls, word cloud, Q&A — Mentimeter features

**Segment D: Corporate L&D Trainers**
- Large market but competitive
- Use case: Training assessments, onboarding quizzes, workshop engagement
- Need: Full Mentimeter feature set + GST invoicing
- Wedge: INR billing removes procurement friction vs USD platforms

### Market Size

| Segment | Total Institutions | Addressable | Revenue at ₹3,000/yr avg |
|---|---|---|---|
| Private schools | ~300,000 | 50,000 (realistic 5yr) | ₹15 Cr |
| Coaching institutes | ~40,000 | 10,000 | ₹3 Cr |
| Colleges | ~50,000 | 15,000 | ₹4.5 Cr |
| Corporate | Thousands | 5,000 | ₹5 Cr (higher ARPU) |
| **Total addressable** | | **80,000** | **₹27.5 Cr** |

---

## 3. Competitive Analysis

### Kahoot (USA) — $600M+ revenue, 9B+ cumulative participants

**Strengths:** Brand recognition, massive content library, mobile app, AI quiz generation, Google Classroom integration, polished UX.

**Weaknesses in India:** USD-only pricing ($5-17/month per teacher), no UPI, no GST invoice, no Indian language support, no CBSE/NCERT content, credit card required (low penetration in India's education sector).

### Mentimeter (Sweden) — Used by 200M+ participants globally

**Strengths:** Interactive presentation tool (word cloud, polls, Q&A, rating), clean real-time visualizations, PowerPoint integration.

**Weaknesses in India:** USD pricing ($8-16/month), no Indian language support, free tier limited to 2 question slides, no quiz gamification (leaderboard-driven competition).

### Quizizz (USA, Indian-origin founders)

**Strengths:** Self-paced homework mode, AI quiz generation, gamification.

**Weaknesses in India:** US-focused, USD pricing, not designed for Indian curriculum.

### Our Position

Quizotic is the **only** platform that:
1. Combines Kahoot's quiz engine + Mentimeter's interactive features
2. Bills in INR with UPI/Razorpay
3. Provides GST invoices for B2B
4. Will support Hindi + regional languages
5. Will include CBSE/NCERT question banks
6. Is designed for 1-2 Mbps Indian classroom bandwidth

---

## 4. Domain Architecture

### Quizotic.in — Host Platform
- Teacher/trainer sign-up and login
- Quiz and presentation builder
- Dashboard (my quizzes, session history)
- Live session control panel (host view)
- Reports and analytics
- Billing and subscription management
- Institute admin panel

### Quizotic.net — Participant Join Page
- Ultra-lightweight (target: < 100KB initial load)
- Enter game code or scan QR
- No sign-up required for participants
- Works on 1-2 Mbps connections
- Mobile-first responsive design
- Minimal JavaScript — fast on low-end phones

**Why two domains:** Clean separation. Teacher shares "go to quizotic.live, enter code 1234" — no confusion between host dashboard and player join. The .net domain loads fast because it serves only the participant experience.

---

## 5. Feature Specification — v1 (Launch)

### 5.1 Quiz Engine (Kahoot-equivalent)

**Live Quiz Mode:**
- Host creates a quiz with multiple questions
- Host starts a live session — gets a unique game code (6-digit)
- Participants join via Quizotic.net + game code (or QR code or WhatsApp link)
- Host controls the pace — advances to next question manually
- Each question has a configurable timer (5s / 10s / 15s / 20s / 30s / 60s / 90s)
- Participants see the question + answer options on their device
- After timer expires (or all answer), host sees result breakdown
- Points awarded based on correctness + speed
- Real-time leaderboard updates after each question
- Final leaderboard at end of quiz with podium animation

**Question Types (v1):**

| Type | Description |
|---|---|
| Multiple Choice (MCQ) | 2-4 options, single correct answer |
| True / False | Binary choice |
| Multi-Select | Multiple correct answers (partial scoring) |
| Poll (ungraded) | No correct answer, shows live vote distribution |
| Open-Ended Text | Participants type free-text response, host reviews |
| Rating / Scale | 1-5 or 1-10 scale, shows average + distribution |
| Word Cloud | Participants submit words/phrases, displayed as weighted cloud |
| Q&A | Participants submit questions, others upvote, host picks to address |
| Ranking | Participants drag items into preferred order, shows aggregate |

**Question Builder:**
- Add text question
- Add image to question (upload or URL)
- Set correct answer(s)
- Set timer duration
- Set point value (default: 1000 base, adjusted by speed)
- Preview question as participant would see it
- Reorder questions via drag-and-drop

### 5.2 Session Management

**Creating a Session:**
- Host selects a saved quiz → clicks "Start Live Session"
- System generates a unique 6-digit game code
- System generates a QR code pointing to `quizotic.live/join/<code>`
- System generates a WhatsApp share link with pre-filled text: "Join my quiz on Quizotic! Go to quizotic.live and enter code: XXXXXX"
- Host sees a lobby screen showing participants joining in real-time

**Joining a Session (Participant Flow):**
1. Open `quizotic.live`
2. Enter 6-digit game code (or scan QR, or click WhatsApp link)
3. Enter display name (no sign-up required)
4. Wait in lobby until host starts

**During Session:**
- Host screen: shows question, timer, response count, correct answer reveal, leaderboard
- Participant screen: shows question + answer options, feedback after each question (correct/wrong + points earned)
- Real-time sync via WebSocket (Socket.io)

**After Session:**
- Final leaderboard with top 3 podium
- Host gets a session report (per-question breakdown, per-participant scores)
- Export report as CSV or PDF

### 5.3 Quiz Builder & Management

**Quiz CRUD:**
- Create new quiz (title, description, subject tag)
- Add/edit/delete/reorder questions
- Save as draft or publish
- Duplicate an existing quiz
- Delete quiz

**Quiz Library (Host Dashboard):**
- List all my quizzes (grid or list view)
- Search and filter by subject/tag
- Sort by date created, date last used, title

### 5.4 Interactive Presentation Mode (Mentimeter-equivalent)

Beyond quizzes, hosts can create "interactive presentations" — a sequence of slides that mix:
- Quiz questions (graded, with timer and leaderboard)
- Polls (ungraded, live bar chart)
- Word clouds (text collection, visual display)
- Open-ended responses (text feed)
- Rating/scale (average + distribution)
- Q&A (audience-submitted questions with upvotes)
- Content slides (text + image, no interaction — for context between questions)

This makes Quizotic usable for both:
- **Competitive quizzes** (school revision, coaching mock tests)
- **Interactive presentations** (corporate workshops, college seminars)

### 5.5 Real-Time Leaderboard & Scoring

**Scoring system:**
- Base points per correct answer: 1,000
- Speed bonus: up to 500 extra points (faster answer = more bonus)
- Streak bonus: 2x multiplier after 3 correct in a row
- Leaderboard shows top 5 after each question (with animations)
- Final leaderboard shows all participants ranked

**Display:**
- Host screen: full leaderboard (projector-friendly, large fonts)
- Participant screen: their rank + points + how far from next rank

### 5.6 Authentication

**Hosts (teachers/trainers):**
- Sign up with Google OAuth or email + password
- Email verification for email sign-ups
- Password reset flow

**Participants:**
- No sign-up required
- Join with game code + display name only
- Optional: "Remember me" via local storage for repeat participants

**Institute Admin (paid tier):**
- Manage teacher accounts under one institute
- View aggregate reports across all teachers
- Manage billing

### 5.7 Reports & Analytics

**Per-Session Report:**
- Total participants, completion rate
- Per-question: correct %, avg time to answer, most selected option
- Per-participant: score, rank, question-by-question breakdown
- Export: CSV, PDF

**Dashboard Overview (for hosts):**
- Total quizzes created, total sessions run, total participants
- Last 10 sessions with quick stats

### 5.8 India-First Features

**INR Billing:**
- All prices displayed in ₹
- No currency conversion, no international card required

**Razorpay Integration:**
- UPI (QR + intent link for mobile)
- Credit/debit cards
- Net banking
- Wallets (Paytm, PhonePe, etc.)
- Auto-recurring for subscriptions (Razorpay Subscriptions API)

**GST Invoice:**
- Paid customers get a GST-compliant invoice (auto-generated)
- Institute name, GSTIN, address fields in billing
- Required for B2B sales in India

**WhatsApp Join Link:**
- One-click share from host dashboard
- Pre-formatted message: "Join my quiz! Go to quizotic.live, code: XXXXXX"
- Uses `wa.me` deep link — works on any device with WhatsApp

**Low-Bandwidth Optimization:**
- Participant page (quizotic.live) target: < 100KB initial load
- Minimal JavaScript on participant side
- WebSocket messages are tiny (JSON payloads < 1KB)
- No heavy animations on participant screen
- Images compressed and lazy-loaded
- Works on 2G/3G connections

---

## 6. Feature Specification — v2 (Growth)

Target: After first 50 paying customers and validated PMF.

### 6.1 Language Support

**Hindi UI:**
- Full interface translation (host dashboard + participant screens)
- Hindi question text rendering (Unicode, already supported in browsers)

**Regional Languages (phased):**
- Phase 1: Hindi, Tamil, Telugu, Bengali, Marathi
- Phase 2: Kannada, Gujarati, Malayalam, Punjabi, Odia
- Implementation: i18n framework (next-intl or react-i18next)

### 6.2 CBSE/NCERT Question Banks

- Pre-built quiz question sets aligned to CBSE/NCERT curriculum
- Organized by: Class (6-12) → Subject → Chapter
- Teachers pick a chapter → instant quiz (no creation needed)
- AI-assisted generation: use Claude API to generate questions from NCERT textbook content
- Community contributions: teachers can submit questions, reviewed before publishing

### 6.3 AI Quiz Generator

- Host pastes a topic, text, or URL
- Claude API generates 5-20 quiz questions with options and correct answers
- Host reviews, edits, then saves
- Supports: MCQ, True/False, open-ended
- Claude API cost: ~₹1-2 per quiz generation (acceptable as a premium feature)

### 6.4 Self-Paced / Homework Mode

- Host assigns a quiz as homework
- Students complete at their own pace (within a deadline)
- No live session needed
- Results collected and shown to host after deadline
- Great for coaching institutes running weekly tests

### 6.5 Team Mode

- Participants grouped into teams (random or manual)
- Team scores aggregated
- Team leaderboard alongside individual leaderboard
- Good for school events, inter-class competitions

### 6.6 Google Classroom Integration

- Host can push quiz assignments to Google Classroom
- Students click and join directly
- Results sync back to Classroom gradebook

### 6.7 Import Questions from Excel/CSV

- Upload an Excel or CSV with questions, options, and correct answers
- Bulk quiz creation for coaching institutes with existing question banks

### 6.8 Advanced Analytics

- Per-student progress tracking across multiple sessions
- Weak topic identification (which chapters students struggle with)
- Exportable student reports for parent-teacher meetings

### 6.9 Custom Branding (White-Label Lite)

- Institute logo on quiz screens
- Custom color theme
- Institute name in reports
- Custom domain mapping (e.g., quiz.myinstitute.com → Quizotic)

---

## 7. Feature Specification — v3 (Moat)

Target: 500+ paying customers, clear market position established.

### 7.1 Regional Language Question Banks
- Question banks in Hindi, Tamil, Telugu, Bengali, Marathi
- Aligned to State board curricula (not just CBSE)

### 7.2 Video Questions
- Embed a short video clip as the question
- Participants watch, then answer
- Good for science demos, case studies

### 7.3 Gamification Beyond Quizzes
- Student profiles with XP, levels, badges
- Streak tracking (daily login, quiz completion)
- School/institute leaderboards (weekly, monthly)
- Achievement badges (e.g., "Quiz Master", "Perfect Score", "10-day Streak")

### 7.4 API for LMS Integration
- REST API for third-party LMS platforms
- Create quizzes, fetch results programmatically
- Webhook notifications for quiz completion

### 7.5 Offline-First Mode
- Pre-download quiz content when online
- Run quiz locally when internet drops
- Sync results when connectivity returns
- Critical for rural Indian schools with unreliable power/internet

### 7.6 Mobile App
- Only if validated by demand (web-first approach)
- React Native (code sharing with Next.js)
- Host app: create and manage quizzes
- Player app: faster join experience

---

## 8. User Flows

### 8.1 Host Flow — First Time

```
1. Visit quizotic.live
2. Click "Sign Up" → Google OAuth or email
3. Land on empty dashboard → "Create Your First Quiz" CTA
4. Quiz builder: Add title → Add questions (MCQ, T/F, poll, etc.)
5. Save quiz → "Start Live Session" button
6. Get game code + QR + WhatsApp share link
7. Share with students/audience
8. Control quiz flow from host screen (advance questions, see results)
9. End session → View report → Export if needed
```

### 8.2 Participant Flow

```
1. Receive code via WhatsApp / teacher says "go to quizotic.live"
2. Open quizotic.live on phone/laptop
3. Enter 6-digit code → Enter display name
4. Wait in lobby (see fun animations or quiz topic)
5. Question appears → Select answer before timer runs out
6. See instant feedback (correct/wrong, points earned)
7. See leaderboard update
8. After final question → See final rank and podium
```

### 8.3 Institute Admin Flow

```
1. Sign up for Institute plan on quizotic.live
2. Add teachers to institute account
3. Each teacher creates and runs quizzes independently
4. Admin sees aggregate dashboard: total sessions, total participants, top quizzes
5. Download GST invoice from billing section
```

---

## 9. Technical Architecture

### Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR + SPA, great DX, Mahesh knows it |
| Styling | Tailwind CSS | Fast to build, responsive by default |
| Real-time | Socket.io (Node.js server) | Battle-tested WebSocket library, handles 1000s concurrent |
| Database | PostgreSQL (via Prisma ORM) | Relational data (users, quizzes, sessions, responses), reliable |
| Auth | NextAuth.js | Google OAuth + email, well-documented |
| Payments | Razorpay | INR, UPI, cards, subscriptions, GST invoice support |
| File Storage | Cloudflare R2 or Supabase Storage | Image uploads in questions |
| Email | Resend.com | Transactional emails (welcome, password reset, reports) |
| Hosting | Railway.app | Full-stack deploy, PostgreSQL included, ~$5/month |
| CDN | Cloudflare (free tier) | Fast global delivery for static assets |
| Word Cloud | wordcloud2.js | Lightweight, client-side rendering |
| Charts | Chart.js or Recharts | Poll results, analytics visualizations |
| QR Code | qrcode.js | Generate join QR codes |

### Architecture Diagram (Simplified)

```
                    ┌──────────────────┐
                    │   Cloudflare CDN  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐  ┌───▼────────┐  ┌──▼───────────┐
    │  quizotic.live   │  │quizotic.live│  │ Socket.io    │
    │  (Host App)    │  │(Join Page) │  │ Server       │
    │  Next.js SSR   │  │ Lightweight│  │ (Real-time)  │
    └─────────┬──────┘  └───┬────────┘  └──┬───────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Railway.app    │
                    │  Node.js Server  │
                    │  + PostgreSQL    │
                    └──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │    Razorpay      │
                    │  (Payments)      │
                    └──────────────────┘
```

### Database Schema (Core Tables)

```
users           — id, name, email, role (teacher/admin), institute_id, plan, created_at
institutes      — id, name, gstin, address, plan, created_at
quizzes         — id, user_id, title, description, subject, is_published, created_at
questions       — id, quiz_id, type, text, image_url, options (JSONB), correct_answer, timer_seconds, points, order
sessions        — id, quiz_id, host_user_id, game_code, status (lobby/active/ended), started_at, ended_at
participants    — id, session_id, display_name, joined_at
responses       — id, session_id, participant_id, question_id, answer, is_correct, points_earned, time_taken_ms
subscriptions   — id, user_id, plan, razorpay_subscription_id, status, current_period_start, current_period_end
```

### Real-Time Events (Socket.io)

```
Host → Server:
  start_session, next_question, end_session, skip_question

Server → All Participants:
  question_show, timer_tick, question_end, leaderboard_update, session_end

Participant → Server:
  join_session, submit_answer

Server → Host:
  participant_joined, answer_received, response_summary
```

---

## 10. Monetization & Pricing

### Free Tier
- Up to 10 participants per session
- Up to 5 saved quizzes
- All question types available
- Basic session report (no export)
- Quizotic branding on participant screens

### Pro Plan — ₹299/month or ₹2,499/year (save 30%)
- Unlimited participants per session
- Unlimited saved quizzes
- Export reports (CSV, PDF)
- Session history (last 50 sessions)
- No Quizotic branding on participant screens
- Priority support via email

### Institute Plan — ₹999/month or ₹7,999/year (save 33%)
- Everything in Pro
- Up to 10 teacher accounts under one institute
- Aggregate dashboard for admin
- GST invoice (auto-generated)
- Custom institute logo on quiz screens
- Phone support

### Enterprise (custom pricing, v2+)
- Unlimited teachers
- SSO integration
- Custom domain mapping
- API access
- Dedicated support

### Pricing Rationale
- Kahoot charges ~₹400-1,400/month per teacher (USD converted)
- Mentimeter charges ~₹650-1,300/month per presenter
- Quizotic Pro at ₹299/month is 50-80% cheaper than either
- Institute plan at ₹100/teacher/month (10 teachers) is extremely competitive
- Free tier is more generous than both (Kahoot free: limited features, Mentimeter free: 2 question slides)

---

## 11. India-First Differentiators (Detailed)

### 11.1 INR Billing
- No currency conversion needed
- No "declined: international transaction" from Indian bank cards
- Price perception: ₹299 feels affordable; $5 feels foreign and uncertain
- Schools can pay from petty cash or small budgets without forex approval

### 11.2 UPI Payments
- UPI processes 12B+ transactions/month in India
- Most teachers/admin staff use UPI daily (PhonePe, Google Pay, Paytm)
- One-tap payment — no card number entry
- Razorpay handles UPI QR, intent, and collect flows

### 11.3 GST Invoice
- Any Indian business/institute paying for software needs a GST-compliant invoice
- Foreign platforms (Kahoot, Mentimeter) don't provide Indian GST invoices
- This is a dealbreaker for many B2B purchases — finance departments refuse to process payments without GST invoice
- We auto-generate invoices with GSTIN, HSN code (998314 — IT services), and correct tax breakup

### 11.4 WhatsApp Distribution
- Teacher sends join link via WhatsApp class group — zero friction
- 500M+ WhatsApp users in India
- Replaces "download our app" friction with "click this link"
- `wa.me` deep links work on all devices

### 11.5 Low-Bandwidth Design
- Indian classroom reality: shared WiFi, 20-40 devices, 2-10 Mbps total
- Per-device bandwidth: often < 1 Mbps
- Quizotic.net participant page: < 100KB initial load
- WebSocket messages: < 1KB per event
- No heavy JavaScript frameworks on participant side
- No auto-playing videos or animations on participant screen
- Graceful degradation: if connection drops, participant can rejoin same session

### 11.6 Regional Languages (v2)
- Kahoot: English only
- Mentimeter: English + European languages
- Quizotic v2: Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Gujarati, Malayalam, Punjabi, Odia
- Both UI translation AND support for question content in any language (Unicode)

### 11.7 CBSE/NCERT Content (v2)
- No global platform offers Indian curriculum-aligned question banks
- Teacher selects Class 10 → Science → Chapter 5 → instant quiz
- Saves hours of quiz creation for teachers
- Competitive moat: content library grows over time, hard to replicate

---

## 12. Go-to-Market Strategy

### Phase 1: Personal Network (Month 1-2)
- Mahesh's IOCL/PSU contacts (corporate training use case)
- Friends/family who are teachers or run coaching centres
- Goal: 10 free users providing feedback

### Phase 2: WhatsApp/Telegram Groups (Month 2-3)
- Indian teacher communities on WhatsApp
- Coaching institute owner groups
- EdTech discussion groups on Telegram
- "Free Kahoot alternative for Indian teachers" messaging
- Goal: 100 free sign-ups

### Phase 3: LinkedIn Content (Month 3-6)
- Mahesh's existing LinkedIn presence (@mdpixx)
- Content: "Why Indian teachers still pay in dollars for quiz tools"
- Demo videos: "How I run live quizzes in my class using Quizotic"
- Goal: Build awareness, drive sign-ups from teacher/trainer audience

### Phase 4: SEO (Month 3-12)
- Target keywords:
  - "free Kahoot alternative India"
  - "quiz app for Indian schools"
  - "live quiz platform INR"
  - "CBSE quiz generator"
  - "interactive classroom tool India"
- Blog content: "5 Best Quiz Tools for Indian Teachers (2026)"
- Goal: Organic traffic from teachers searching for solutions

### Phase 5: Direct Sales + Conferences (Month 6+)
- EdTech conferences (DIDAC India, EdTechReview summits)
- Direct outreach to school chains (DPS, Ryan, DAV — centralized decision-making)
- Coaching chains (FIITJEE, Allen, Aakash — already tech-savvy)
- Goal: Enterprise/institute sales

---

## 13. Cost Analysis

### Pre-Revenue Monthly Costs

| Item | Cost/month |
|---|---|
| Railway.app (server + DB) | ₹420 ($5) |
| Domain (Quizotic.in + .net, amortized) | ~₹100 |
| Cloudflare CDN | ₹0 (free tier) |
| Resend.com (email) | ₹0 (free: 3,000/month) |
| Razorpay | ₹0 (pay per transaction) |
| SSL | ₹0 (Let's Encrypt) |
| **Total pre-revenue** | **~₹520/month** |

### Scaling Costs

| Scale | Server | DB | Email | Total/month |
|---|---|---|---|---|
| 0-100 users | Railway $5 | Railway included | Resend free | ₹420 |
| 100-500 users | Railway $10 | Railway included | Resend free | ₹840 |
| 500-2000 users | Railway $20 + Redis $5 | Neon.tech $19 | Resend $20 | ₹3,700 |
| 2000+ users | DigitalOcean $48 + Redis | Managed PG $50 | Resend $50 | ₹12,500 |

### Revenue vs Cost Scenarios

| Paying customers | Monthly revenue | Monthly cost | Profit |
|---|---|---|---|
| 1 Pro (₹299) | ₹299 | ₹520 | -₹221 |
| 2 Pro | ₹598 | ₹520 | +₹78 (break-even) |
| 10 Pro | ₹2,990 | ₹840 | +₹2,150 |
| 50 Pro + 5 Institute | ₹19,945 | ₹3,700 | +₹16,245 |
| 200 Pro + 20 Institute | ₹79,780 | ₹12,500 | +₹67,280 |

**Break-even: 2 Pro customers.**

---

## 14. Success Metrics

### Launch Milestones (First 12 Months)

| Metric | 3 months | 6 months | 12 months |
|---|---|---|---|
| Registered hosts (teachers/trainers) | 100 | 500 | 2,000 |
| Paying customers | 5 | 25 | 100 |
| Monthly sessions run | 200 | 1,000 | 5,000 |
| Total participants (cumulative) | 5,000 | 30,000 | 150,000 |
| MRR | ₹1,500 | ₹10,000 | ₹50,000 |
| NPS | > 30 | > 40 | > 50 |

### Key Ratios to Track
- Free → Paid conversion rate (target: 5-10%)
- Session completion rate (target: > 80%)
- Repeat host rate (target: > 40% hosts run 2+ sessions/month)
- Average participants per session (target: 15-25)

---

## 15. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Kahoot launches INR pricing | Medium | High | Our moat is language + curriculum + WhatsApp, not just price |
| Low teacher adoption (inertia) | High | Medium | Free tier is generous; find 10 champion teachers who demo to peers |
| Technical scaling issues at 500+ concurrent | Low | High | Socket.io + Redis horizontal scaling; test before scaling push |
| Content quality for question banks (v2) | Medium | Medium | AI generation + teacher community review; start with CBSE Class 10 Science/Math only |
| Regulatory: data privacy for student information | Medium | High | Minimal data collection (display name only for participants); no student accounts in v1 |
| Razorpay account approval delays | Low | Medium | Apply early; have Cashfree as backup payment gateway |
| Competitor copies India-first approach | Low | Medium | First-mover advantage in India; build community and content moat |

---

## 16. Non-Goals (Explicitly Out of Scope)

- **Not a test-prep platform** — we don't compete with TestBook/Unacademy on content
- **Not an LMS** — we don't manage courses, attendance, or grades (that's Google Classroom / Classplus territory)
- **Not a video platform** — no live video streaming, no recorded lectures
- **No mobile app in v1** — web-first; mobile app only if demand validates it
- **No PowerPoint plugin** — Mentimeter's niche; not our priority
- **No marketplace** — teachers don't sell quizzes to each other (unlike Teachers Pay Teachers)

---

## Appendix A: Name — "Quizotic"

**Wordplay:** Quiz + Quixotic (bold, idealistic, ambitious)
**Domains:** Quizotic.live (single global platform)
**Tone:** Playful, energetic, memorable — fits an education engagement product
