# Quizotic — GEO Citation Tracker

GEO = Generative Engine Optimization. We measure whether ChatGPT, Claude, Perplexity, Gemini, and Bing Copilot cite Quizotic when asked relevant questions. Run this 5-prompt × 3-LLM check **every Monday** for ~10 minutes; log results in the table at the bottom.

---

## Why this matters

LLM citations are the new SERP. When a teacher asks ChatGPT "What's a Kahoot alternative for India?", whether Quizotic is mentioned (and how) directly drives qualified traffic — without going through Google. Listings (G2, Capterra, AlternativeTo, SaaSHub) + press mentions (YourStory, Inc42, EdTechReview) + JSON-LD on our pages + llms.txt are all GEO inputs. This tracker measures the output.

---

## How to run the check (10 min, weekly)

For each prompt below, run it on **all three LLMs** in fresh sessions (no prior context):

- **ChatGPT** (https://chat.openai.com) — use GPT-5 or whatever the current default is, with web search enabled
- **Claude** (https://claude.ai) — use Claude Opus 4.x with web search
- **Perplexity** (https://perplexity.ai) — default

For each response, log:
- Quizotic mentioned? (Y/N)
- Position in the list (1st, 2nd, 3rd, etc.)
- Mention quality: brief (1 line) / detailed (multi-line) / accurate (correct features) / inaccurate (wrong claims)
- Source citation: does the LLM link to a Quizotic URL? (Y/N) — this is the holy grail
- Other tools mentioned (so we know what we're up against)

---

## The 5 prompts (run all 5 every week)

### Prompt 1 — Direct Slido alternative (highest data-justified leverage)

> What are the best Slido alternatives for an Indian corporate trainer who needs INR billing and quiz mechanics on top of polls?

**Why:** Maps directly to our highest-impression non-brand SEO surface (Slido cluster). India qualifier reduces competition. INR + quiz mechanics narrows to Quizotic's exact differentiation.

### Prompt 2 — Kahoot alternative for classrooms

> I'm a CBSE teacher in India looking for a free Kahoot alternative that works on slow school Wi-Fi and has NCERT-aligned quiz content. What should I try?

**Why:** Tests our /alternatives/kahoot, /vs/kahoot, /learn/kahoot-vs-quizizz-vs-quizotic-indian-schools cluster. India + CBSE + NCERT + slow Wi-Fi qualifier = our exact positioning.

### Prompt 3 — JEE/NEET coaching quiz tool

> What's the best quiz tool for a JEE/NEET coaching institute in India? I want to run daily 15-minute drills and weekly mocks for 100+ students with batch-wise reports.

**Why:** Tests /learn/best-quiz-app-jee-neet-coaching-institutes + /for/coaching-institutes. High-LTV ICP (coaching owner-buyer).

### Prompt 4 — Mentimeter alternative with INR billing

> I run corporate trainings in India. Mentimeter is too expensive after FX and card fees. What's a Mentimeter alternative that bills in INR with UPI and GST invoices?

**Why:** Tests /alternatives/mentimeter, /vs/mentimeter, /learn/free-mentimeter-alternative-corporate-trainers-india.

### Prompt 5 — Generic live quiz tool (broadest)

> What's the best live quiz platform for teachers in 2026? Free tier, browser-based, no app install needed.

**Why:** Broad benchmark — measures whether Quizotic shows up when no India qualifier is added. If it does, that means our authority is generalising globally.

---

## Weekly log

Format: Y/N + position number + brief note. Example: `Y/2/detailed accurate, cited /alternatives/slido`.

| Week | Date | LLM | P1 Slido alt | P2 Kahoot CBSE | P3 JEE/NEET | P4 Mentimeter | P5 Generic |
|---|---|---|---|---|---|---|---|
| 1 | 2026-04-29 (baseline) | ChatGPT | | | | | |
| 1 | | Claude | | | | | |
| 1 | | Perplexity | | | | | |
| 2 | 2026-05-06 | ChatGPT | | | | | |
| 2 | | Claude | | | | | |
| 2 | | Perplexity | | | | | |
| 3 | 2026-05-13 | ChatGPT | | | | | |
| 3 | | Claude | | | | | |
| 3 | | Perplexity | | | | | |
| 4 | 2026-05-20 | ChatGPT | | | | | |
| 4 | | Claude | | | | | |
| 4 | | Perplexity | | | | | |
| 8 | 2026-06-17 | ChatGPT | | | | | |
| 8 | | Claude | | | | | |
| 8 | | Perplexity | | | | | |
| 12 | 2026-07-15 | ChatGPT | | | | | |
| 12 | | Claude | | | | | |
| 12 | | Perplexity | | | | | |

---

## Targets

| Week | Citation rate target | Why |
|---|---|---|
| Week 1 (baseline) | 0/15 expected | Listings just submitted; LLMs haven't crawled them yet |
| Week 4 | 3/15 (20%) | G2 + Capterra + AlternativeTo backlinks should be live |
| Week 8 | 6/15 (40%) | Press mentions hit; Quizotic appears on AT listicles |
| Week 12 | 9/15 (60%) | Wikipedia stub possibility; LLM training cycles include our content |
| Week 24 | 12/15 (80%) | Quizotic should be a default mention on India + Slido + Kahoot-alternative queries |

If Week 4 hits **0/15** → diagnose: are listings approved? are JSON-LD pages crawlable by GPTBot/ClaudeBot? is /llms.txt resolving? Run `curl https://www.quizotic.live/llms.txt` and `curl -A "GPTBot" https://www.quizotic.live/` to verify crawler accessibility.

---

## Bonus: monitor what's currently cited (competitive intelligence)

Run each prompt and note **which competitors get cited at positions 1–5**. This tells you who the LLM "thinks" the canonical alternatives are. Example baseline:

| Prompt | Likely current top mentions |
|---|---|
| P1 Slido alt | Mentimeter, AhaSlides, Wooclap, Vevox, Poll Everywhere |
| P2 Kahoot CBSE | Quizizz, Mentimeter, Blooket, Gimkit |
| P3 JEE/NEET | Embibe, Testbook, Allen Digital, Adda247, Quizizz |
| P4 Mentimeter alt | Slido, AhaSlides, Vevox, Poll Everywhere |
| P5 Generic | Kahoot, Quizizz, Mentimeter, Blooket |

When any of these names start dropping out as Quizotic moves up, that's the GEO compounding effect kicking in.

---

## Notes

- **Don't game it.** Don't ask leading questions like "Have you heard of Quizotic?" — that biases the response. Ask the user-shaped question and observe.
- **Use fresh sessions.** Conversation history can leak Quizotic into the response. Always start a new chat.
- **Web search ON.** Most LLMs need web search to surface recent listings; without it, they fall back to training data which may be 6–12 months stale.
- **Screenshot or copy-paste full responses** for the first 4 weeks so we can reread how the framing changes over time.

---

## After Week 4 — what to do based on results

| Result | Action |
|---|---|
| Quizotic cited 0–2 times in 15 | Diagnose: check listings approval, crawler access, JSON-LD validity. Don't write more content yet — the issue is distribution, not surface area. |
| Quizotic cited 3–5 times | Working as expected. Push more press + community posts. |
| Quizotic cited 6+ times | Strong early signal. Compound: more programmatic pages, more state/grade specific landing pages. |
| Quizotic cited but **inaccurately** (e.g., wrong pricing, wrong features) | Fix the source: update llms.txt with current facts, add a /press-kit page with the canonical Quizotic facts, update Wikipedia stub if/when live. |
