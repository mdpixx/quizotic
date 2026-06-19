# Competitor Feature Gap Analysis

**Date:** 2026-06-19
**Competitors compared:** AhaSlides · Slido · Wayground (formerly Quizizz)
**Ranking lens:** General market popularity — features ranked by how heavily they are used / sought after across each competitor's *entire* user base, not just Quizotic's India-first segment.
**Baseline:** Gaps are measured against **Quizotic's current codebase** (`src/lib/quiz-types.ts`, `src/lib/presentation-types.ts`, `server.mjs`), not the docs — Quizotic already ships far more than `docs/feature-comparison.md` implies (see "What Quizotic already has" below). Only **genuine gaps** are listed.

---

## What Quizotic already has (so it's NOT in the gap list)

To keep this analysis honest, these competitor-style features are **already implemented** and are deliberately excluded from the gaps below:

- **11 quiz question types:** MCQ, Multi-Select, True/False, Poll, Word Cloud, Open-Ended, Q&A, Rating, Ranking, Case Study, Drawing.
- **18 presentation slide types:** incl. Image Choice, Scale-100, Pinpoint (≈hotspot), Grid 2×2, Word Duel, Live Race, Emoji Pulse, Quick Fire, plus Title/Bullets/Quote/Video/Image content slides.
- **Live engine:** real-time leaderboard, speed bonus, **streak bonus**, **team mode**, **ghost players**, host pause/resume/reveal controls, confetti + sound + milestone alerts.
- **AI quiz generation** from text/PDF/DOCX/URL, AI translate, AI enhance.
- **Self-paced + scheduled async** quizzes, PPTX *import*, CSV import, public REST API v1.
- **Reports:** CSV / XLSX / PDF / Google-Sheets export, **Bloom's-taxonomy tagging**, **Confidence Grid + misconception detection**, learner analytics.
- **Billing:** Razorpay (INR/UPI/GST) + Stripe; NextAuth (Google + magic link).

> Net: Quizotic already matches or beats these three on raw question/slide variety and on learning-science depth. The gaps below are about **distribution, specific assessment types, classroom gamification polish, and integrations** — not core interactivity.

---

## TL;DR — Top gap features ranked by general popularity

| # | Feature | Who has it | Popularity signal | In Quizotic? | Effort |
|---|---------|-----------|-------------------|--------------|--------|
| 1 | **Slide-tool & video-conf integrations** (PowerPoint / Google Slides add-in; Zoom / Teams / Webex) | Slido, AhaSlides | Slido's single most-praised capability in reviews; AhaSlides PPT add-in exposes 19 slide types | ❌ (PPTX *import* only, no live embed) | High |
| 2 | **Education assessment question types** — Fill-in-the-Blank, Matching, Drag-and-Drop, Drop-Down, Labeling, Math Response, Graphing | Wayground | Core to Wayground's ~15-type K-12 dominance | ⚠️ Partial (Ranking≈Reorder, Pinpoint≈Hotspot, Drawing≈Draw; the 7 listed are missing) | Medium each |
| 3 | **Spinner Wheel / Wheel of Names** | AhaSlides | AhaSlides signature; massive classroom use as a random picker / decision tool | ❌ (stubbed `coming_soon`) | Low |
| 4 | **Power-ups, themes & memes** | Wayground | The arcade-style gamification that drives Quizizz/Wayground K-12 stickiness | ⚠️ Partial (has streaks/confetti, no power-ups/memes/theme packs) | Medium |
| 5 | **Brainstorm / idea board** (collect → upvote → group ideas) | AhaSlides | Standard ideation slide; distinct from open-text + Q&A | ❌ | Low–Medium |
| 6 | **Multi-question Survey slide** (one form mixing MCQ/open/rating/ranking) | AhaSlides, Slido | "Quietly one of the most-used features for L&D teams" (AhaSlides) | ❌ (only single-question slides) | Medium |
| 7 | **Q&A moderation queue UI** (anonymous submit → upvote → host approve/dismiss/spotlight) | Slido | Slido's most-loved feature in testimonials | ⚠️ Partial (Q&A type + `submit_presenter_response` event exist; no host moderation queue) | Low–Medium |
| 8 | **Google Classroom / LMS integration** | Wayground, Kahoot | Standard adoption driver for schools | ❌ (on v2 roadmap, not built) | Medium–High |
| 9 | **Public content library / template marketplace** | Wayground | Millions of public quizzes = a primary adoption funnel | ⚠️ Partial (internal templates only, not public/searchable) | High (content-ops) |
| 10 | **Courses / lesson bundles + mastery-by-standard reporting** | Wayground | Bundles content + assessment + standards mastery tracking | ❌ | High |

---

## Per-competitor breakdown

### AhaSlides
**Most-used features:** live polls, gamified quizzes with leaderboards, **word clouds**, **Q&A with upvoting**, **brainstorm boards**, **spinner wheel**, a **multi-question Survey slide**, and a **PowerPoint add-in (19 interactive slide types)**, plus AI slide/quiz generation and post-session analytics. Reviewers cite ~90% attendee interaction rates.

**What's missing in Quizotic:**
- **Spinner Wheel / Wheel of Names** (Quizotic stub is `coming_soon`).
- **Brainstorm / idea board** with audience upvoting + grouping.
- **Multi-question Survey slide** (Quizotic slides are single-question).
- **PowerPoint add-in** for live in-deck interactivity (Quizotic only imports PPTX).

Sources: [AhaSlides product/site](https://ahaslides.com/), [slide-type tutorials](https://ahaslides.com/blog/ahaslides-tutorials/), [Spinner Wheel feature](https://ahaslides.com/features/spinner-wheel/), [Capterra profile](https://www.capterra.com/p/193878/AhaSlides/).

### Slido
**Most-used features:** live polls (5 poll types), **anonymous Q&A with upvoting + moderation**, quizzes (timer + leaderboard), surveys (before/during/after), word clouds, and — most distinctively — **deep integrations**: PowerPoint, Google Slides, Zoom, Microsoft Teams, Webex. Reviewers most often single out the PowerPoint integration and the anonymous-Q&A experience.

**What's missing in Quizotic:**
- **PowerPoint / Google Slides live add-in** + **Zoom / Teams / Webex** embedding — Slido's flagship value (no screen-switching). This is the highest-impact gap.
- **Q&A host-moderation queue UI** (approve / dismiss / spotlight, mark answered). Quizotic has the Q&A primitive but no presenter moderation surface.
- **Survey** (collect multi-question feedback asynchronously around a meeting).

Sources: [Slido product](https://www.slido.com/product), [integrations](https://www.slido.com/features-integrations), [5 must-have features](https://blog.slido.com/slido-features-engagement/), [Capterra profile](https://www.capterra.com/p/154051/Slido/).

### Wayground (formerly Quizizz)
**Most-used features:** ~12–15 question types — Multiple Choice, **Reorder**, **Match**, **Fill-in-the-Blank**, **Drag-and-Drop**, **Drop-Down**, **Math Response**, **Labeling**, **Hotspot**, **Graphing**, **Draw**, Open-Ended; **arcade gamification** (power-ups, themes, memes, redemption questions, leaderboards); **AI question generation** from documents/topics; **self-paced** activities; **courses/lessons**; a huge **public library** of ready quizzes; and standards/mastery analytics + Google Classroom integration.

**What's missing in Quizotic:**
- **Assessment question types:** Fill-in-the-Blank, Matching, Drag-and-Drop, Drop-Down, Labeling, Math Response, Graphing. (Quizotic's Ranking, Pinpoint, and Drawing already approximate Reorder/Hotspot/Draw.)
- **Power-ups / memes / theme packs** — the kid-facing dopamine layer beyond streaks + confetti.
- **Google Classroom / LMS** push + grade sync.
- **Public, searchable content library / marketplace.**
- **Courses / lesson bundles** with **mastery-by-standard** reporting.

Sources: [Wayground question-type help center](https://support.wayground.com/hc/en-us/sections/16356540533657-Use-Different-Question-Types), [Hotspot questions](https://wayground.com/home/en/hotspot-questions), [drag-and-drop / drop-down](https://help.wayground.com/support/solutions/articles/158000405103-question-types-drop-down-drag-and-drop), [Softwareadvice profile](https://www.softwareadvice.com/student-engagement/quizizz-profile/), [Jotform guide](https://www.jotform.com/ai/how-to-create-a-quiz-on-quizizz/).

---

## Gap matrix

✅ has it · ❌ doesn't · ⚠️ partial

### Features Quizotic should consider adding
| Feature | AhaSlides | Slido | Wayground | Quizotic today |
|---------|:--------:|:-----:|:---------:|:--------------:|
| PowerPoint / Google Slides live add-in | ✅ | ✅ | ❌ | ❌ (import only) |
| Zoom / Teams / Webex integration | ❌ | ✅ | ❌ | ❌ |
| Fill-in-the-Blank | ❌ | ❌ | ✅ | ❌ |
| Matching | ❌ | ❌ | ✅ | ❌ |
| Drag-and-Drop | ❌ | ❌ | ✅ | ❌ |
| Drop-Down | ❌ | ❌ | ✅ | ❌ |
| Labeling / Graphing / Math Response | ❌ | ❌ | ✅ | ❌ |
| Spinner Wheel / Wheel of Names | ✅ | ❌ | ❌ | ⚠️ `coming_soon` |
| Power-ups / memes / theme packs | ⚠️ themes | ❌ | ✅ | ⚠️ streaks/confetti |
| Brainstorm / idea board (+upvote/group) | ✅ | ❌ | ❌ | ❌ |
| Multi-question Survey slide | ✅ | ✅ | ❌ | ❌ |
| Q&A moderation queue UI | ✅ | ✅ | ❌ | ⚠️ type exists, no queue |
| Google Classroom / LMS sync | ❌ | ❌ | ✅ | ❌ (v2 roadmap) |
| Public content library / marketplace | ⚠️ templates | ❌ | ✅ | ⚠️ internal templates |
| Courses / lessons + mastery-by-standard | ❌ | ❌ | ✅ | ❌ |

### Where Quizotic already leads
| Feature | AhaSlides | Slido | Wayground | Quizotic today |
|---------|:--------:|:-----:|:---------:|:--------------:|
| Confidence Grid + misconception detection | ❌ | ❌ | ❌ | ✅ |
| Bloom's-taxonomy tagging in reports | ❌ | ❌ | ⚠️ standards | ✅ |
| Case Study question type | ❌ | ❌ | ❌ | ✅ |
| Ghost players (replay past top-3) | ❌ | ❌ | ❌ | ✅ |
| Streak bonus scoring | ❌ | ❌ | ✅ | ✅ |
| INR / UPI / GST invoicing | ❌ | ❌ | ❌ | ✅ |
| Sub-100KB low-bandwidth participant page | ❌ | ❌ | ❌ | ✅ |

---

## Quick-win shortlist (high popularity ÷ low effort)

These three are the fastest follows — popular features that fit Quizotic's existing Socket.io engine with minimal new infrastructure:

1. **Spinner Wheel / Wheel of Names** — the slide type is already stubbed `coming_soon` in `src/lib/presentation-types.ts`; finish it. Pure client-side animation + a name/entry list, no scoring path needed.
2. **Q&A moderation queue UI** — the Q&A type and the `submit_presenter_response` socket event already exist; add a host-side approve / dismiss / spotlight / mark-answered surface on top.
3. **Brainstorm / idea board** — reuse the open-text collection + an upvote tally (Q&A already upvotes); add optional idea grouping. Lands an AhaSlides-signature slide cheaply.

---

## Sources

- AhaSlides: <https://ahaslides.com/> · <https://ahaslides.com/blog/ahaslides-tutorials/> · <https://ahaslides.com/features/spinner-wheel/> · <https://www.capterra.com/p/193878/AhaSlides/> · <https://research.com/software/reviews/aha-slides-review>
- Slido: <https://www.slido.com/product> · <https://www.slido.com/features-integrations> · <https://blog.slido.com/slido-features-engagement/> · <https://www.capterra.com/p/154051/Slido/>
- Wayground (Quizizz): <https://support.wayground.com/hc/en-us/sections/16356540533657-Use-Different-Question-Types> · <https://wayground.com/home/en/hotspot-questions> · <https://help.wayground.com/support/solutions/articles/158000405103-question-types-drop-down-drag-and-drop> · <https://www.softwareadvice.com/student-engagement/quizizz-profile/> · <https://www.jotform.com/ai/how-to-create-a-quiz-on-quizizz/>
