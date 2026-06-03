# Quizotic — Quiz Builder, AI Generation & Visual Design Spec

**Date:** 2026-03-19
**Status:** Approved (post-review)
**Scope:** Phase 3 — Quiz builder with AI generation, visual refresh, and language translation

---

## Context

The walking skeleton (Phase 2) proved the real-time quiz engine works. Phase 3 makes the product usable:
- Replace the hardcoded test quiz with a real quiz builder
- Add AI-powered question generation (topic / URL / document)
- Refresh visual design with a distinct Indian-inspired color scheme
- Add language translation at quiz creation time

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Color palette | Bold Festive (Pink · Orange · Blue · Green) | Energetic, school-friendly, distinctly non-Kahoot |
| AI generation mode | Batch (all questions at once, host reviews) | Simpler UX, less back-and-forth |
| Builder layout | Mode tabs (Manual / AI Topic / AI URL / AI Doc) | Puts AI front and center as the differentiator |
| Language support | At creation time (host translates before saving) | Host controls quality, no per-participant real-time cost |
| AI model | `google/gemini-2.5-flash-lite` via OpenRouter | Best Indian language support, ~6× cheaper than Claude Haiku |
| API key | Reuse existing `OPENROUTER_API_KEY` from secrets vault | No new signup needed |
| Data storage | localStorage (`quizotic_quizzes`) | No DB yet — added in Phase 4 |

---

## Pages & Routes

| Route | Purpose |
|---|---|
| `/host` | Quiz library — list saved quizzes, "Create New Quiz" button, "Start Session" on a selected quiz |
| `/host/session` | Quiz runner — lobby → active quiz → leaderboard (moved from `/host`, receives quiz via localStorage `quizotic_active_session`) |
| `/host/create` | Quiz builder — 4-tab creation page |
| `/api/generate-quiz` | API route — calls Gemini Flash via OpenRouter, returns question JSON |
| `/api/translate-quiz` | API route — strips non-translatable fields, translates text, re-merges server-side |
| `/join` | Participant page — visual refresh only |

### Route flow

```
/host (library) → select quiz → "Start Session"
  → writes quiz to localStorage key `quizotic_active_session`
  → navigates to /host/session
  → /host/session reads `quizotic_active_session`, emits `create_session` with quiz data
  → lobby, questions, leaderboard as before
  → on end → "Back to Library" → /host
```

---

## Quiz Builder (`/host/create`)

### Tab Structure

```
[ ✏️ Manual ] [ ✨ AI Topic ] [ 🔗 AI URL ] [ 📄 AI Doc ]
```

### Tab: Manual

- Quiz title input (required)
- Subject/tag input (optional)
- Question list — expandable cards, drag-to-reorder
- Per question:
  - Type selector: MCQ / True-False / Poll / Open-ended / Word Cloud / Q&A / Rating / Ranking
  - Question text input
  - Options (dynamic: 2 for T/F, 2–4 for MCQ, none for open-ended/word cloud/Q&A)
  - Correct answer picker — clicking an option marks it correct; stored as string index `"0"` / `"1"` / `"2"` / `"3"`
  - Timer selector: 10s / 15s / 20s / 30s / 60s (no other values)
  - Points selector: 500 / 1000 / 2000
- Add Question button
- Delete question button per card
- **`correctAnswer` is always stored as a string index into the `options` array (e.g. `"0"`, `"1"`). This applies to all tabs.**

### Tab: AI Topic

- Topic input: "What topic should the quiz cover?" (e.g. "Indian Independence Movement")
- Number of questions: 5 / 8 / 10
- Difficulty: Easy / Medium / Hard
- "✨ Generate Questions" button → POST to `/api/generate-quiz` with `mode: "topic"`
- Loading state: spinner with "Generating your quiz..."
- Result: editable question cards (same UI as Manual tab)
- Client assigns `crypto.randomUUID()` to each returned question before rendering
- Host can edit any question before saving

### Tab: AI from URL

- URL input field (must start with `https://`)
- "Fetch & Generate" button → POST to `/api/generate-quiz` with `mode: "url"`
- Server-side: validates `https://` protocol → fetch with 5s timeout → strip HTML tags → truncate to 3,000 chars → send to Gemini
- Same editable question card result as AI Topic

### Tab: AI from Document

- File upload: `multipart/form-data`, accepts `.pdf` and `.docx` only, max 5MB
- Client sends file as `FormData`
- "Generate from Document" button → POST to `/api/generate-quiz` with `mode: "document"`
- Server-side: `request.formData()` → extract file → `Buffer.from(await file.arrayBuffer())` → pass to `pdf-parse` (PDF) or `mammoth` (DOCX) → extract plain text → truncate to 3,000 chars → send to Gemini
- Same editable question card result

### Bottom of Page (all tabs)

**Translate Quiz section:**
- Dropdown: Hindi / Tamil / Telugu / Bengali / Marathi / Kannada / Gujarati / Malayalam / Punjabi / Odia
- "Translate" button → POST to `/api/translate-quiz`
- Replaces question text in the builder — host sees translated version before saving

**Save Quiz button:**
- Assigns `crypto.randomUUID()` as quiz `id` if not present
- Sets `createdAt` and `updatedAt` to current ISO timestamp
- Saves to localStorage under `quizotic_quizzes`
- Redirects to `/host`

---

## API Routes

### `POST /api/generate-quiz`

**Request (topic mode):** `application/json`
```json
{
  "mode": "topic",
  "topic": "Indian Independence Movement",
  "questionCount": 5,
  "difficulty": "medium"
}
```

**Request (url mode):** `application/json`
```json
{
  "mode": "url",
  "url": "https://example.com/article",
  "questionCount": 5,
  "difficulty": "medium"
}
```

**Request (document mode):** `multipart/form-data`
- `file`: PDF or DOCX binary
- `questionCount`: number
- `difficulty`: string

**Behaviour:**
- Uses OpenRouter base URL: `https://openrouter.ai/api/v1`
- Model: `process.env.QUIZ_AI_MODEL` (default: `google/gemini-2.5-flash-lite`)
- Auth: `OPENROUTER_API_KEY` env var
- System prompt: "You are a quiz generator. Return only valid JSON — no markdown, no explanation."
- Prompt instructs model to use only these `timerSeconds` values: 10, 15, 20, 30, or 60
- Output schema enforced in prompt:
```json
[
  {
    "type": "mcq",
    "text": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "1",
    "timerSeconds": 20,
    "points": 1000
  }
]
```
- `correctAnswer` is always a string index (`"0"`, `"1"`, `"2"`, `"3"`)
- Parse response JSON, validate structure, return to client (client adds `id` fields)

**Error handling:**
- Invalid JSON from model → retry once → return 500 with `{ error: "Generation failed" }`
- URL not `https://` → return 400 with `{ error: "Only https:// URLs are supported" }`
- URL fetch timeout (5s) → return 400 with `{ error: "Could not fetch URL — try another" }`
- File too large or wrong type → return 400 with descriptive error
- Note: SSRF mitigation (blocking private IPs) deferred to Phase 4

### `POST /api/translate-quiz`

**Request:** `application/json`
```json
{
  "questions": [...],
  "targetLanguage": "Hindi"
}
```

**Behaviour:**
- Server strips non-translatable fields before sending to Gemini: `id`, `correctAnswer`, `timerSeconds`, `points`, `type`
- Sends only `{ text, options }` per question to the model
- Prompt: "Translate these quiz questions to [language]. Return identical JSON. Translate all text values."
- After receiving translated `{ text, options }`, server re-merges stripped fields back into original question objects
- Returns complete translated question array (with all original fields intact)

---

## Data Structure (localStorage)

**Key: `quizotic_quizzes`** — array of saved quizzes

```json
[
  {
    "id": "uuid-v4",
    "title": "AI Trivia Challenge",
    "subject": "Technology",
    "language": "English",
    "createdAt": "2026-03-19T10:00:00Z",
    "updatedAt": "2026-03-19T10:05:00Z",
    "questions": [
      {
        "id": "uuid-v4",
        "type": "mcq",
        "text": "Which company created ChatGPT?",
        "options": ["Google", "OpenAI", "Meta", "Microsoft"],
        "correctAnswer": "1",
        "timerSeconds": 20,
        "points": 1000
      }
    ]
  }
]
```

**Key: `quizotic_active_session`** — single quiz object passed from `/host` → `/host/session`

```json
{
  "id": "uuid-v4",
  "title": "AI Trivia Challenge",
  "questions": [...]
}
```

---

## Visual Design Updates

### Answer Button Colors (Participant Screen)

| Option | Color | Tailwind class |
|---|---|---|
| A | Hot Pink | `bg-pink-500` |
| B | Deep Orange | `bg-orange-500` |
| C | Electric Blue | `bg-blue-600` |
| D | Emerald Green | `bg-green-600` |

### Participant Screen Enhancements

- Option buttons: large letter badge (A/B/C/D) left-aligned + option text right
- Selected state: white ring + subtle scale-down (`ring-4 ring-white scale-95`)
- Correct result: large green ✓ icon + "+850 pts" points burst animation
- Wrong result: large red ✗ icon + "No points" message
- Timer: circular countdown ring (SVG stroke-dashoffset animation), turns red under 5s
- Question card: subtle lime-400 gradient top border

### Host Screen Enhancements (During Quiz)

- Each answer option shown with its color swatch (pink/orange/blue/green dot)
- Live vote bars: fill in each option's color as participants answer
- "Next Question" button pulses when all participants have answered
- On session end: "Back to Library" button navigates to `/host`

---

## New Dependencies

| Package | Purpose |
|---|---|
| `openai` | OpenRouter API calls (OpenAI-compatible format) |
| `pdf-parse` | Extract text from PDF uploads |
| `@types/pdf-parse` | TypeScript types for pdf-parse |
| `mammoth` | Extract text from DOCX uploads |

No Anthropic SDK needed — OpenRouter uses OpenAI-compatible API.

---

## Environment Variables

```env
# Reuse from secrets vault (already exists in Social Media project)
OPENROUTER_API_KEY=

# Configurable model (default: Gemini Flash 2)
QUIZ_AI_MODEL=google/gemini-2.5-flash-lite
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/app/host/page.tsx` | Modify — becomes quiz library (list quizzes, "Start Session" → writes to `quizotic_active_session` → navigate to `/host/session`) |
| `src/app/host/session/page.tsx` | Create — quiz runner (moved from current `/host/page.tsx`; reads quiz from `quizotic_active_session`) |
| `src/app/host/create/page.tsx` | Create — 4-tab quiz builder |
| `src/app/api/generate-quiz/route.ts` | Create — AI generation API route |
| `src/app/api/translate-quiz/route.ts` | Create — translation API route (strips/re-merges non-translatable fields) |
| `src/app/join/page.tsx` | Modify — updated color scheme + visual enhancements |
| `src/lib/quiz-types.ts` | Create — shared TypeScript types |
| `src/lib/quiz-storage.ts` | Create — localStorage helpers |
| `next.config.ts` | Modify — add `serverExternalPackages: ['pdf-parse']` to fix webpack bundling |
| `.env.example` | Modify — add `OPENROUTER_API_KEY`, `QUIZ_AI_MODEL` |
| `package.json` | Modify — add `openai`, `pdf-parse`, `@types/pdf-parse`, `mammoth` |

---

## Out of Scope (Phase 3)

- Database persistence (Phase 4)
- Auth / login (Phase 4)
- Mobile app
- PowerPoint integration
- Self-paced homework mode
- Student accounts
- SSRF mitigation for URL fetch (Phase 4)
