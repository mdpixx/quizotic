# Quizotic — Next Actions

_Update as tasks are completed or new ones emerge._

## In Progress
-

## Up Next
- Review the scheduled-quizzes build (`PORT=4000 npm run dev` to walk it; run `npm run predeploy`, then merge its PR after Mahesh's go — check for live sessions first). Railway deploys the resulting `main` commit. The landing-funnel overhaul deployed earlier on 2026-06-12 is already live.
- Set NEXT_PUBLIC_POSTHOG_KEY in Railway so funnel events (incl. new `quiz_scheduled`) actually record.

## Backlog
- Add a "sure / unsure" confidence toggle to the self-paced player (`/q/[slug]`) — the answer API now persists confidence, but the player never sends it, so the Confidence Grid stays empty for self-paced reports.
- Builder entry point for scheduling: a "Schedule for later" link in `/host/create`'s share flow that deep-links to My Quizzes → Assign (kept out of this build to avoid touching the 3,300-line builder file).
- Consider loading `.env` in `server.mjs` for local dev — dbPool is currently null in dev (env-load order; prod unaffected since Railway injects vars), so sweep/persistence side-effects only run locally when DATABASE_URL is exported.
- Replace the hero trust strip with real numbers/testimonials once usage data exists.
- Fix pre-existing lint errors: scoreRef accessed during render in Hero BrowserQuiz; unused BarChart/Bar/Cell imports in dashboard.
- Auth-flow funnel walk with a real test account (onboard → demo session → phone join) before announcing.
