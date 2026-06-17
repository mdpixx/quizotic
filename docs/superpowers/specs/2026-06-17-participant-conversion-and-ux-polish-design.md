# Participant Conversion + UX Polish — Design

_Date: 2026-06-17_

## Context

Quizotic has near-zero organic traffic and almost all visitors arrive via live-quiz `/join` links (participants), not the marketing site. Two problems compound this:

1. **Polish gaps** make the product feel unfinished — tiny character-arrow nav buttons (`←`, `›`) scattered across host/builder/presentation views, and a plain Confidence Grid table in reports that reads as "off."
2. **No conversion path** from participant → host. The quiz-end screen only offers "Attempt Again" and a weak "Share Quizotic →" link. Participants — our largest traffic source — are never invited to become hosts.

This change polishes the navigation + report visuals and adds a frictionless post-quiz CTA that converts participants into hosts at the ideal moment (quiz end, when they're relaxed and impressed — not the start, when they're rushing to enter a name).

## Scope (4 parts)

### 1. Reusable navigation buttons
New `src/components/ui/NavButton.tsx`:
- Inline SVG chevron (not text glyphs), min 44px tap target, `tone: 'light' | 'dark'`.
- Variants: `pill` (`‹ Back` / `Next ›` with label) and `circle` (outlined circle, navy ring + chevron) for tight spots.
- Props: `direction: 'back' | 'forward'`, `variant`, `label?`, `tone?`, `onClick`, `disabled?`.
- Migrate existing char-arrow nav buttons across host builder top bar, live host controls, presentation nav, and self-paced participant nav. Pill where width allows; circle where tight.

### 2. Confidence Grid → 2×2 quadrant matrix
Rewrite `ConfidenceGridDisplay` and its PDF-export HTML twin in `src/components/SessionReport.tsx`:

|        | Correct        | Wrong               |
|--------|----------------|---------------------|
| Sure   | 🟢 Mastery     | 🔴 Misconception ⚠  |
| Not sure | 🟡 Lucky     | ⚪ Gap              |

- Color-coded quadrant cells, count per cell, named quadrants.
- Emphasize the **Sure + Wrong "Misconception"** cell — the key teaching insight (confident but wrong).
- Keep the web component and the PDF-safe inline-style version visually consistent.

### 3. Remove Hindi + de-clutter join
- Delete the en/hi language toggle (`src/app/join/page.tsx` ~L1540-1556); default locale to English.
- Keep i18n infrastructure (`useI18n`, locale files) intact — only remove the toggle UI.
- Remove the start-screen "Share Quizotic →" nudge (~L1651) — participants are rushing at join.

### 4. "Create your own quiz" CTA at quiz end
New `src/components/CreateYourOwnCTA.tsx`:
- Subtle card (brand-yellow `#F5E642` accent, matches existing card style), shown below the podium on both end states: live `ended` (~L2320) and `selfpaced-done`.
- Primary button **"Create your own — free"** → `/auth/signin?callbackUrl=/host/build&utm_source=participant&utm_medium=quiz-end&utm_campaign=create-cta`.
- Subtext: "Free · ready in 10 minutes". Keep "Attempt Again" + Share; Create is the visual primary.
- Fire PostHog `participant_create_cta_click` on tap (non-blocking, mirrors `ShareQuizotic` tracking).

## Non-goals
- No change to live quiz engine, scoring, or socket protocol.
- No removal of Hindi locale files or i18n system — toggle only.
- No new backend endpoints.

## Verification
- `npx tsc --noEmit` clean on changed files; `npm run build` succeeds.
- E2E `predeploy` gate (17 tests) passes — covers landing funnel + live quiz critical path.
- Manual: host builder/live nav shows new buttons; report shows quadrant grid; `/join` has no Hindi toggle; quiz-end shows Create CTA; CTA click fires PostHog event with UTM-tagged URL.
