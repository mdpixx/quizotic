# Section 1: Show HN Post

## Show HN: Quizotic — live quiz platform grounded in learning science

Hi HN, I built Quizotic: a free live quiz and interactive presentation platform for classrooms, coaching institutes, trainers, and teams. The basic flow is familiar: a host creates a quiz or deck, shares a room code, participants join from their phones, and the room sees answers, results, and leaderboards update live. The product is at https://quizotic.live.

The technical stack is fairly straightforward: Next.js 15 with the App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL on Railway, and a WebSocket layer for room state, answer submission, timer sync, and leaderboard updates. The realtime server keeps the host and participant views in sync while Prisma/Postgres preserve sessions, answers, reports, and historical quiz snapshots.

The part I am most interested in feedback on is the learning-science layer. Quizotic is not only trying to be another quiz game. Questions can be tagged by Bloom's Taxonomy level, AI-generated quizzes can be shaped around cognitive depth, and reports can show whether a session mostly tested recall or pushed students into application, analysis, evaluation, and creation. There are 19 slide types, so a host can mix scored questions with polls, word clouds, Q&A, rating, ranking, and presentation content.

I would love feedback from teachers, trainers, edtech builders, and anyone who has built realtime classroom tools: does the learning-science angle make the product more useful, or does it risk making a simple quiz tool feel too heavy? Also happy to answer technical questions about the WebSocket/session architecture, Railway deployment, or how the Bloom reporting works.

# Section 2: dev.to Full Article

## How I Built a Real-Time Quiz Platform with Next.js, WebSockets, and Learning Science

Tags: #nextjs #websocket #typescript #edtech #webdev

A good live quiz has two jobs.

First, it should make a room feel awake. Participants join quickly, tap answers from their phones, see feedback, and feel the tension of a leaderboard moving in real time.

Second, it should help the teacher or trainer understand what actually happened. Did learners only remember terms? Could they apply the idea? Were they confidently wrong? Which question exposed the misconception?

Quizotic is my attempt to combine those two jobs in one free platform: live quizzes, interactive presentations, AI question generation, 19 slide types, realtime leaderboards, and reports grounded in Bloom's Taxonomy.

This is a look at how I built it with Next.js 15, TypeScript, Prisma, PostgreSQL on Railway, Socket.IO/WebSockets, and a small learning-science layer that sits inside the quiz model instead of being bolted on at the end.

## The problem with existing quiz tools

Most quiz tools optimize for energy. That is useful. A fast leaderboard can turn a quiet classroom into a competitive one in seconds.

But after the session ends, many tools leave the teacher with a shallow artifact: a score, a percentage, and maybe a question-by-question breakdown. That tells you who won. It does not always tell you what kind of thinking was tested.

For a trainer, that gap matters. A compliance session where everyone scores 90% on recall questions is not the same as a session where people can apply a policy to a messy case. A math quiz full of formula recognition is not the same as one that asks students to choose a method, explain a pattern, or evaluate an approach.

That is why Quizotic treats every question as both an interaction and a diagnostic object. A question can be scored, timed, tagged, explained, and later included in reports. A deck can mix a normal presentation slide with polls, word clouds, open-ended responses, ranking, Q&A, and quiz questions. The host still gets the simple live-room experience, but the data model keeps enough structure to produce useful follow-up.

The product goal became:

- Make joining frictionless: no app install, just a code.
- Keep the live room responsive: answers, timers, and leaderboard state should feel immediate.
- Preserve the teaching artifact: sessions should remain understandable after the quiz is edited later.
- Add learning depth without making the host fill a research form before launching.

## Architecture deep-dive

Quizotic is a Next.js App Router application with a custom Node server for realtime sessions. The UI, dashboard, API routes, auth flow, reports, and content pages live in Next.js. The live quiz room runs through Socket.IO so host and participant clients can exchange events with low latency.

The high-level shape looks like this:

```txt
Host browser ----\
                  +-- Next.js app routes and React UI
Participant ------/

Host browser ----\
                  +-- Socket.IO rooms: session:{code}, host:{code}
Participant ------/

Socket server -> Prisma -> PostgreSQL on Railway
```

The database model is intentionally boring. Quizzes and presentations store flexible JSON content because slide and question types evolve quickly. Sessions, attendees, and answers are relational because they need auditability, reports, and deduplication.

One important design choice was adding immutable quiz versions. If a host runs a quiz on Monday and edits the same quiz on Tuesday, Monday's report should still show the exact questions participants saw.

```prisma
model Quiz {
  id        String   @id @default(cuid())
  title     String
  questions Json
  versions  QuizVersion[]
  sessions  GameSession[]
}

model QuizVersion {
  id            String   @id @default(cuid())
  quizId        String?
  title         String
  snapshot      Json
  questionCount Int      @default(0)
  createdAt     DateTime @default(now())
}

model GameSession {
  id            String   @id @default(cuid())
  code          String   @unique
  quizVersionId String?
  status        String   @default("waiting")
  results       Json?
  attendees     Attendee[]
  answers       Answer[]
}
```

The realtime layer keeps active session state in memory for speed, then persists the critical events. Every answer is also written to the `Answer` table with a uniqueness constraint over session, participant, and question index. That gives the client room to retry safely when the network is weak.

```prisma
model Answer {
  id            String @id @default(cuid())
  sessionId     String
  participantId String
  questionIndex Int
  answer        Json
  isCorrect     Boolean?
  points        Int    @default(0)
  timeMs        Int    @default(0)
  confidence    String?

  @@unique([sessionId, participantId, questionIndex])
}
```

Socket payloads are validated with Zod before they touch session state. This matters more than it sounds. In a live quiz, a bad event can break the room for everyone.

```ts
const SubmitAnswerSchema = z.object({
  gameCode: z.string().min(4).max(10),
  participantId: z.string().uuid().optional(),
  answer: z.union([
    z.string().max(2048),
    z.number(),
    z.array(z.string()).max(10),
    z.array(z.number()).max(10),
  ]),
  timeMs: z.number().int().min(-10000).max(600000),
  confidence: z.enum(['sure', 'unsure']).nullable().optional(),
  serverSubmittedAt: z.number().positive().optional(),
})
```

Deployment is on Railway because the app needs a Node process, a PostgreSQL database, and environment-managed services without a lot of ceremony. The production script runs the custom server, which prepares the Next.js handler and attaches Socket.IO to the same HTTP server. The code also supports a Redis adapter path for horizontal Socket.IO broadcasts when needed.

## The Bloom's Taxonomy engine

Bloom's Taxonomy is the part that makes Quizotic different from a normal quiz app.

In the question model, every question can carry a cognitive level:

```ts
export type BloomsLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyse'
  | 'evaluate'
  | 'create'

export interface Question {
  id: string
  type: QuestionType
  text: string
  correctAnswer?: string
  explanation?: string
  bloomsLevel?: BloomsLevel
}
```

That tag is small, but it changes the report. A quiz with ten questions is no longer only "8 out of 10 correct." It can also show that seven questions were recall, two were understanding, and only one required application. That gives the host a practical design signal: the next session should probably go deeper.

AI generation also uses this structure. Instead of asking the model for "some quiz questions," the app can ask for a balanced set: a few recall questions, some understanding questions, and application or analysis questions where the source material supports them. The host can still edit everything before launching.

Reports carry the Bloom level forward with question stats:

```ts
interface QuestionStat {
  index: number
  text: string
  correctPct: number | null
  confidenceGrid: ConfidenceGrid | null
  bloomsLevel: BloomsLevel | null
  explanation: string | null
}
```

The useful part is combining Bloom with confidence. After answering, participants can mark whether they were sure or unsure. That creates a simple confidence grid:

```ts
interface ConfidenceGrid {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}
```

"Sure and wrong" is often more actionable than "wrong." It points to a misconception, not just a miss. "Unsure and correct" points to fragile knowledge. When those buckets are grouped by question and cognitive level, the teacher gets a better follow-up map than a raw leaderboard can provide.

## Building the real-time leaderboard

The leaderboard sounds like the easy part until you build it for real rooms.

Answers arrive at different times. Participants disconnect and reconnect. Some question types are scored, while polls, word clouds, open-ended responses, Q&A, rating, drawing, and some ranking interactions are not. Competitive mode needs speed scoring and streaks, while reflection mode should avoid turning the session into a race.

The scoring function is deliberately simple:

```ts
function calcPoints(base: number, timeMs: number, timerSeconds: number) {
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  return Math.round(base * (0.5 + 0.5 * speedRatio))
}
```

A correct answer earns between half and full base points depending on speed. Wrong answers earn zero. Streak bonuses add a little drama, but the system still stays understandable to the host.

After a question ends, the server builds a compact leaderboard snapshot and emits it to the room:

```ts
function buildLeaderboardSnapshot(participants: Map<string, Participant>) {
  return Array.from(participants.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      score: p.score,
      streakCount: p.streakCount || 0,
      team: p.team ?? null,
    }))
}
```

The server also emits personal result beats: whether the participant was correct, how many points they earned, whether they were the fastest, and whether their rank changed. This keeps the participant screen useful even when the projected host screen is showing something else.

One lesson here was to avoid making the full leaderboard the only feedback loop. The host does not need a giant standings screen after every question. Quizotic can recommend standings at natural moments: every few scored questions, near the end, or when the top three changes. That pacing keeps the room moving.

## Lessons learned building while working full-time at IndianOil

Building Quizotic while working full-time at IndianOil forced me to keep the architecture practical.

The biggest constraint was not code. It was continuity. When you only get nights, weekends, and small pockets of time, every future debugging session depends on decisions you made when tired. That pushed me toward explicit schemas, boring persistence, and small server-side helpers instead of clever abstractions.

Three lessons stood out.

First, persist the facts that matter. In-memory state makes the live room fast, but session history belongs in Postgres. Answer rows, quiz snapshots, attendees, and final results are not optional if teachers are going to trust reports.

Second, validate every boundary. Socket events feel internal because both clients are yours, but they are still public inputs. Zod schemas caught edge cases that would otherwise become weird live-room bugs.

Third, do not let gamification swallow the learning goal. Leaderboards create energy, but the report is what makes the session valuable after the room gets quiet. Bloom tags, explanations, and confidence grids are small pieces of metadata that make the same quiz much more useful.

The project is still evolving, but the direction feels right: keep the host flow simple, keep the live experience fast, and keep enough educational structure underneath to help teachers make better decisions after the quiz.

## Tech stack table

| Layer | Technology | Why it is used |
| --- | --- | --- |
| Frontend | Next.js 15 App Router, React, TypeScript | Host dashboard, participant join flow, reports, and presentation UI |
| Styling | Tailwind CSS | Fast iteration across dashboards, live screens, and mobile participant views |
| Realtime | Socket.IO over WebSockets | Room joins, answer submission, timer sync, leaderboard updates, presenter slide sync |
| Validation | Zod | Runtime validation for socket and API payloads |
| Database | PostgreSQL on Railway | Sessions, users, quiz snapshots, attendees, answers, reports |
| ORM | Prisma | Typed database access and migrations |
| Deployment | Railway | Node server, Postgres, environment configuration, deploy workflow |
| AI layer | LLM-backed generation | Quiz generation, Bloom-tagged questions, explanations, presentation enhancements |
| Reporting | Server-side aggregation plus export routes | Leaderboards, question stats, Bloom distribution, confidence grid, CSV/XLSX/PDF-style outputs |

Quizotic is live at https://quizotic.live. I am especially interested in feedback from people who have run live classroom tools, training sessions, or realtime multiplayer apps: where would you keep the architecture simple, and where would you invest more deeply in the learning-science layer?
