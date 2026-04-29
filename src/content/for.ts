import type { FaqItem, Scenario } from '@/components/seo/UseCasePageLayout'
import type { RelatedLink } from '@/components/seo/RelatedLinks'

export interface UseCaseContent {
  persona: string
  metaTitle: string
  metaDescription: string
  h1: string
  tagline: string
  intro: string
  scenarios: Scenario[]
  keyFeatures: string[]
  faqs: FaqItem[]
  related: RelatedLink[]
  keywords: string[]
}

const COMMON_RELATED: RelatedLink[] = [
  { title: 'Live Quiz', href: '/live-quiz', description: 'Live multiplayer quiz with leaderboard.' },
  { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Polls, word clouds, Q&A in one deck.' },
  { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate quizzes from a PDF or topic.' },
  { title: 'Pricing', href: '/pricing', description: 'Free, Pro, Team — in INR with UPI.' },
]

export const USE_CASES: Record<string, UseCaseContent> = {
  teachers: {
    persona: 'Teachers',
    metaTitle: 'Quiz App for Teachers — Quizotic (Free, INR Billing, AI-Generated)',
    metaDescription:
      'Free quiz app for teachers in India. Generate quizzes from NCERT chapters or PDFs, host live sessions with up to 10 students free, and get Bloom-tagged reports.',
    h1: 'Quizotic for Teachers — Live Quizzes, AI-Generated, Built for Indian Classrooms',
    tagline:
      'Make revision classes unforgettable. Host live quizzes on classroom Wi-Fi, get Bloom-tagged reports, and skip the weekly marking.',
    intro:
      'Teachers use Quizotic to turn textbook chapters into live quizzes in minutes. Upload the chapter PDF (or pick from our NCERT library), AI generates Bloom-tagged questions with explanations, you host a live session with a 6-digit game PIN, and students join on any phone. The free plan covers up to 10 students per session — enough for most sections doing group revision. Reports show per-student accuracy, Confidence Grid, and which Bloom levels the class is weak on.',
    scenarios: [
      {
        title: 'Weekly chapter recap',
        description: 'Pick a chapter, let AI generate 15 questions, run a 10-minute live quiz at the start of Monday class.',
      },
      {
        title: 'Exam revision marathon',
        description: 'Combine multiple chapters into a single quiz. Use reflection mode (no scoring) so anxious students engage freely.',
      },
      {
        title: 'Homework review',
        description: 'Drop last week\'s missed questions into the spaced-retrieval queue; they come back automatically in the next session.',
      },
      {
        title: 'Parent-teacher meetings',
        description: 'Share the session report (per-student accuracy, Bloom coverage, confidence) — concrete data beats vague comments.',
      },
      {
        title: 'Substitute / stand-in class',
        description: 'Hand any teacher the game PIN and a projector — the quiz runs itself. No lesson-plan prep needed.',
      },
      {
        title: 'End-of-term fun session',
        description: 'Competitive mode with speed bonus and streaks — the class leaderboard becomes the memory they carry home.',
      },
    ],
    keyFeatures: [
      'NCERT Classes 6–12 chapter-wise quiz library',
      'AI generates Bloom-tagged questions from any PDF or topic',
      'Free tier: unlimited sessions, 10 participants each',
      '11 question types (MCQ, multi-select, open-ended, word cloud, rating, ranking, and more)',
      'Confidence Grid — surfaces hubris and imposter students',
      'Spaced-retrieval queue — missed questions auto-return',
      'Session report XLSX — per-student accuracy and Bloom distribution',
      'Works on 1–2 Mbps classroom Wi-Fi (<100KB participant page)',
    ],
    faqs: [
      {
        question: 'Is Quizotic free for teachers?',
        answer: 'Yes. The free plan gives unlimited live quizzes with up to 10 participants per session — enough for most classroom revision use. Pro (INR-priced) unlocks 200 participants and advanced reports.',
      },
      {
        question: 'Do I need to make questions myself?',
        answer: 'No. Upload the chapter PDF or paste notes and the AI generates Bloom-tagged questions with explanations. You can edit any question before launching.',
      },
      {
        question: 'Can students join without installing an app?',
        answer: 'Yes. Students open quizotic.live/join on any phone browser and enter the 6-digit game PIN. No account, no app, no install.',
      },
      {
        question: 'Does it work with NCERT textbooks?',
        answer: 'Yes. We have a pre-built NCERT Classes 6–12 chapter library — click the chapter and a quiz is ready to launch.',
      },
      {
        question: 'How does it help with weak students?',
        answer: 'The Confidence Grid flags students who are unsure but correct ("imposter") and overconfident but wrong ("hubris") — both need different kinds of follow-up. The spaced-retrieval queue brings missed questions back automatically.',
      },
    ],
    related: COMMON_RELATED,
    keywords: [
      'quiz app for teachers',
      'quiz tool for teachers india',
      'online quiz for classroom',
      'ncert quiz app',
      'live quiz for students',
    ],
  },

  'coaching-institutes': {
    persona: 'Coaching Institutes',
    metaTitle: 'Quiz Platform for Coaching Institutes — Quizotic (JEE, NEET, UPSC)',
    metaDescription:
      'Live quiz platform for coaching institutes. Run batch-wise mock tests, track per-student Bloom mastery, and gamify daily revision with leaderboards.',
    h1: 'Quizotic for Coaching Institutes — Batch-wise Mocks, Leaderboards, Mastery Tracking',
    tagline:
      'Run daily revision quizzes across batches. Track Bloom mastery per student. Keep the leaderboard hot.',
    intro:
      'Coaching institutes use Quizotic to run batch-wise live quizzes, weekly mock tests, and daily revision challenges. Centres like JEE, NEET, and UPSC tutors generate hundreds of questions from chapter PDFs or past papers, launch batch-specific sessions, and use the leaderboard to fuel competitive revision. Per-student reports reveal Bloom-level mastery gaps so faculty can target weak areas in the next class.',
    scenarios: [
      {
        title: 'Daily Doubt Destroyer',
        description: '10-minute live quiz at the start of every batch. AI generates questions from yesterday\'s topics.',
      },
      {
        title: 'Weekend mock test',
        description: 'Full-length sectional mock, single launch for 200+ students, auto-graded with solution explanations.',
      },
      {
        title: 'Inter-batch championship',
        description: 'Run the same quiz across morning and evening batches; compare leaderboards to spark rivalry.',
      },
      {
        title: 'Faculty review meeting',
        description: 'Per-chapter Bloom-level reports reveal where Batch A lags Batch B — faculty can target the gap.',
      },
      {
        title: 'Parent demo day',
        description: 'Live quiz on the projector during open house. Parents see their child\'s competitive rank in real time.',
      },
      {
        title: 'Previous Year Question Paper drill',
        description: 'Upload a PYQ PDF; AI extracts and tags every question. Students attempt live with speed bonus.',
      },
    ],
    keyFeatures: [
      'Team plan: 200+ participants per session, admin-level reporting',
      'AI question generation from chapter PDFs and PYQ papers',
      'Bloom-level mastery tracking per student across sessions',
      'Leaderboard with speed bonus and streak multipliers',
      'Batch-level filtering in reports',
      'Downloadable XLSX reports for faculty meetings',
      'INR billing, UPI payments, GST invoices',
    ],
    faqs: [
      {
        question: 'Can we run the same quiz across multiple batches?',
        answer: 'Yes. Save the quiz once and launch fresh sessions for each batch. Reports stay separate so you can compare performance.',
      },
      {
        question: 'What if we have 300+ students in one session?',
        answer: 'The Team plan supports larger participant counts and multi-host accounts. Contact us for institute-scale deployments.',
      },
      {
        question: 'Can we get GST invoices?',
        answer: 'Yes. All Pro and Team billing supports GST invoices in INR via Razorpay.',
      },
      {
        question: 'Does it support JEE / NEET / UPSC question formats?',
        answer: 'Yes. MCQ, multi-select, matching, case study, and numerical answer questions cover JEE/NEET formats. UPSC essay prompts work with open-ended + AI-assisted grading.',
      },
      {
        question: 'Can we export data to our own LMS?',
        answer: 'Yes. Every session generates a downloadable XLSX report; we also support webhook exports on the Team plan.',
      },
    ],
    related: COMMON_RELATED,
    keywords: [
      'quiz platform for coaching institutes',
      'jee mock test platform',
      'neet quiz app',
      'live quiz for coaching classes',
      'coaching institute quiz software india',
    ],
  },

  schools: {
    persona: 'Schools',
    metaTitle: 'Live Quiz Platform for Schools — Quizotic (CBSE, ICSE, NCERT-aligned)',
    metaDescription:
      'School-wide live quiz platform. NCERT-aligned question bank, teacher accounts with centralised admin, INR billing with GST invoices.',
    h1: 'Quizotic for Schools — NCERT-aligned Quizzes, Teacher Accounts, Central Admin',
    tagline:
      'Every teacher, every class, one platform. NCERT chapter library, central admin, INR billing.',
    intro:
      'Schools deploy Quizotic across grades to standardise revision, assessment, and gamified classroom engagement. Teachers get individual accounts under a central school admin; they can launch live quizzes, use the NCERT library, and share session reports with the principal. The school admin sees adoption, usage, and a roll-up of Bloom-level mastery across grades. INR billing, GST invoices, and an onboarding session for teachers are included.',
    scenarios: [
      {
        title: 'Friday house quiz',
        description: 'Run a school-wide house quiz on the projector during assembly. Live leaderboard builds house spirit.',
      },
      {
        title: 'End-of-chapter assessment',
        description: 'Every teacher uses the shared NCERT question bank. Principals see per-class pass rates in one dashboard.',
      },
      {
        title: 'Teacher onboarding',
        description: 'New teachers get up and running in 10 minutes — no tutorial needed. Question library is pre-loaded.',
      },
      {
        title: 'Substitute class lifesaver',
        description: 'Any stand-in teacher can launch a ready-made chapter quiz without prep.',
      },
      {
        title: 'PTA showcase',
        description: 'Parents watch their child engage with a live quiz on the projector. Concrete evidence of learning.',
      },
      {
        title: 'Teacher training',
        description: 'Use Quizotic to run interactive CPD sessions. Teachers feel the tool before they teach with it.',
      },
    ],
    keyFeatures: [
      'NCERT Classes 6–12 chapter-wise question bank',
      'Multi-teacher accounts under a central school admin',
      'Admin dashboard: adoption, usage, Bloom-level mastery roll-ups',
      'GST invoices in INR',
      'Ultra-lightweight participant page (works on school Wi-Fi)',
      'Free onboarding session for teachers',
      'Export reports to Excel for principal review',
    ],
    faqs: [
      {
        question: 'How is Quizotic priced for schools?',
        answer: 'The Team plan is priced per teacher seat with a volume discount for schools. Contact us for a school-wide quote in INR with GST.',
      },
      {
        question: 'Do teachers need training?',
        answer: 'Minimal. Most teachers launch their first live quiz within 10 minutes. We include a free onboarding webinar for school-wide deployments.',
      },
      {
        question: 'Can the principal see what every class is doing?',
        answer: 'Yes. The admin dashboard shows teacher adoption, session counts, and Bloom-level mastery roll-ups across classes.',
      },
      {
        question: 'Is student data secure?',
        answer: 'Yes. We collect only a participant nickname — no personal data. Session reports stay private to the hosting teacher and school admin.',
      },
      {
        question: 'Does it align with CBSE / ICSE?',
        answer: 'Yes. Our NCERT library covers Classes 6–12. Schools can add their own ICSE or state-board questions to the school-level bank.',
      },
    ],
    related: COMMON_RELATED,
    keywords: [
      'quiz platform for schools',
      'live quiz for schools india',
      'ncert quiz for schools',
      'cbse quiz app',
      'school quiz software india',
    ],
  },

  colleges: {
    persona: 'Colleges',
    metaTitle: 'Interactive Lecture Tool for Colleges — Quizotic (Polls, Quizzes, Q&A)',
    metaDescription:
      'Interactive classroom tool for college faculty. Polls, live quizzes, Q&A, and attendance — all in one platform. INR billing, free tier.',
    h1: 'Quizotic for Colleges — Interactive Lectures, Live Polls, In-Class Quizzes',
    tagline:
      'Break the silence in 300-seater lecture halls. Live polls, backchannel Q&A, and quick quizzes without switching tools.',
    intro:
      'College faculty use Quizotic to break the passive-lecture cycle. Run a quick pulse poll mid-lecture, launch a 3-question recap at the end, or open a backchannel Q&A students can submit to anonymously. Works in 300-seater halls because the participant page is <100KB. Faculty get attendance-grade participation data, and department heads can standardise assessment across sections.',
    scenarios: [
      {
        title: 'Mid-lecture pulse poll',
        description: 'Two slides in, ask "Which concept is cloudy so far?" — adjust the rest of the lecture in real time.',
      },
      {
        title: 'End-of-class recap quiz',
        description: '3-question MCQ before students pack up. Instant formative feedback on what actually landed.',
      },
      {
        title: 'Backchannel Q&A',
        description: 'Students submit anonymous questions throughout the lecture. Vote-up surfaces the shared confusion.',
      },
      {
        title: 'Research-methods discussion',
        description: 'Word clouds and ranking questions turn abstract debates into visual, discussable data.',
      },
      {
        title: 'Flipped-classroom check',
        description: 'Start class with a pre-reading quiz. Live results reveal who actually did the reading.',
      },
      {
        title: 'Section-to-section standardisation',
        description: 'Share the same question bank across 4 sections of Data Structures; reports compare sectional mastery.',
      },
    ],
    keyFeatures: [
      'Support for 200+ participants per session (Pro / Team)',
      'Mentimeter-style polls, word clouds, rankings, and Q&A',
      'Kahoot-style quiz mechanics with leaderboard and speed bonus',
      'Anonymous backchannel Q&A with upvoting',
      'Attendance-grade participation data',
      'Section-level reporting for multi-section courses',
      'Works on campus Wi-Fi (<100KB participant page)',
    ],
    faqs: [
      {
        question: 'Can it handle a 300-student lecture hall?',
        answer: 'Yes. Pro and Team plans handle large-session participation. The participant page is <100KB and every real-time event is <1KB, so it performs on campus Wi-Fi.',
      },
      {
        question: 'Can students ask questions anonymously?',
        answer: 'Yes. The Q&A slide lets participants submit questions without logging in; upvoting surfaces the shared confusion for the professor to address.',
      },
      {
        question: 'Can we take attendance through Quizotic?',
        answer: 'Yes, indirectly. Every session report lists participants with accuracy and response time — functional attendance with engagement data.',
      },
      {
        question: 'Does it integrate with Moodle / Google Classroom?',
        answer: 'XLSX export works with any LMS that imports spreadsheets. Direct Moodle / Google Classroom sync is on the roadmap.',
      },
      {
        question: 'Is there a faculty-only training resource?',
        answer: 'Yes. We run free onboarding webinars for departments and colleges rolling out Quizotic to multiple faculty.',
      },
    ],
    related: COMMON_RELATED,
    keywords: [
      'interactive lecture tool',
      'college classroom polling',
      'quiz platform for colleges',
      'live polling for lectures',
      'audience response system india',
    ],
  },

  'corporate-trainers': {
    persona: 'Corporate Trainers',
    metaTitle: 'Corporate Training Quiz Platform — Quizotic (L&D, Onboarding, Compliance)',
    metaDescription:
      'Interactive training platform for L&D teams. Gamified onboarding, compliance quizzes, and live workshops with reports. INR billing, GST invoices.',
    h1: 'Quizotic for Corporate Trainers — Gamified Onboarding, Compliance Quizzes, Live Workshops',
    tagline:
      'Turn mandatory training into the session people talk about. Live leaderboards, compliance reports, L&D-grade analytics.',
    intro:
      'L&D teams use Quizotic to replace PowerPoint monologues with interactive workshops. Gamify onboarding with team-mode quizzes, run compliance assessments with downloadable audit-trail reports, and drive retention with spaced-retrieval queues. INR billing, GST invoices, and multi-trainer accounts are built-in. Works for in-person workshops, hybrid sessions, and fully remote team events.',
    scenarios: [
      {
        title: 'New-hire onboarding',
        description: 'Week-1 policy training with a live team-mode quiz. The leaderboard ends the week on a high note.',
      },
      {
        title: 'Compliance & POSH certification',
        description: 'Assessment with audit-trail XLSX showing every employee\'s response and timestamp — exportable for legal records.',
      },
      {
        title: 'Sales kickoff energiser',
        description: 'Live product-knowledge quiz at the start of the quarterly kickoff. Leaderboard drives energy all day.',
      },
      {
        title: 'Leadership workshop',
        description: 'Live polls on "Which behaviour matters most?" — discussion prompts emerge from real audience input.',
      },
      {
        title: 'Remote all-hands',
        description: 'Word clouds and live polls break up the CEO monologue. Remote employees feel seen.',
      },
      {
        title: 'Post-training reinforcement',
        description: 'Spaced-retrieval queue auto-delivers training questions weeks later — actual retention, not just attendance.',
      },
    ],
    keyFeatures: [
      'Team plan: multi-trainer accounts with admin dashboard',
      'Live team mode (participants group into teams, compete by points)',
      'Audit-trail XLSX reports for compliance (every response + timestamp)',
      'Spaced-retrieval reinforcement after training',
      'Custom branding (Team plan)',
      'GST invoices in INR via Razorpay',
      'Works for in-person, hybrid, and fully remote sessions',
    ],
    faqs: [
      {
        question: 'Is it suitable for 500-person all-hands?',
        answer: 'Yes. The Team plan handles large-session participation. For 1000+ participants or enterprise SSO, contact us for a custom plan.',
      },
      {
        question: 'Can we white-label the participant screen?',
        answer: 'Custom branding (logo, colours) is available on the Team plan. Full white-label is a custom enterprise option.',
      },
      {
        question: 'Can we get audit-ready compliance reports?',
        answer: 'Yes. Every session produces a downloadable XLSX with per-employee responses, timestamps, and scores — suitable for POSH, data-privacy, and other audit requirements.',
      },
      {
        question: 'Does it work for remote teams?',
        answer: 'Yes. Participants join from any browser on any device. Many teams embed the game PIN in their Zoom / Teams meeting chat.',
      },
      {
        question: 'Can training managers get a rollup across sessions?',
        answer: 'Yes. The Team plan admin dashboard shows session counts, average scores, and Bloom-level mastery across all trainers.',
      },
    ],
    related: COMMON_RELATED,
    keywords: [
      'corporate training platform',
      'interactive training tool',
      'l&d platform india',
      'compliance quiz tool',
      'corporate onboarding platform',
    ],
  },

  'event-hosts': {
    persona: 'Event Hosts',
    metaTitle: 'Slido Alternative for Conferences & Trivia Nights — Quizotic',
    metaDescription:
      'Slido alternative for conferences, town halls, and trivia nights — live polls, audience Q&A, multi-round trivia. INR billing, ~80KB participant page, no app install.',
    h1: 'Quizotic for Event Hosts — Live Trivia, Audience Polls, Interactive Conferences',
    tagline:
      'A Slido alternative for conferences, town halls, and trivia nights. Live polls, audience Q&A, multi-round team leaderboards — 6-digit PIN, no app.',
    intro:
      'Event hosts use Quizotic to energise conferences, town halls, community meetups, and trivia nights — often as a Slido alternative when Cisco Webex isn\'t the host platform. Every audience member joins from their phone with a 6-digit PIN — under 100KB on first load, no app install, no signup. Run a live poll on stage, launch a multi-round trivia with a team leaderboard, or open audience Q&A with upvoting so the top questions float to the top. Session reports make great follow-up artefacts for sponsors and organisers. Compared to Slido on a non-Webex stack, Quizotic adds full quiz mechanics on top of the same Q&A + polls surface, and bills in INR with GST invoicing.',
    scenarios: [
      {
        title: 'Conference opening poll',
        description: '"Where are you joining from?" on a live map. Audience feels present from the first slide.',
      },
      {
        title: 'Multi-round trivia night',
        description: 'Pub-style trivia across 5 rounds with a team leaderboard. Host from a tablet, project scores.',
      },
      {
        title: 'Speaker Q&A with upvoting',
        description: 'Audience submits questions throughout the talk; upvoting surfaces the ones everyone wants answered.',
      },
      {
        title: 'Town hall audience pulse',
        description: 'Word cloud from "What\'s on your mind?" — captures the mood faster than any survey tool.',
      },
      {
        title: 'Sponsor activation',
        description: 'Branded trivia round for a sponsor. Leaderboard winner gets their product as a prize. Sponsors get engagement data.',
      },
      {
        title: 'Community meetup icebreaker',
        description: 'Live poll on "What are you working on?" creates instant conversation starters for the networking break.',
      },
    ],
    keyFeatures: [
      'Large-audience support on Pro / Team plans',
      'Team mode with team leaderboards',
      'Live polls, word clouds, rankings, rating scales',
      'Q&A slide with anonymous submit + upvote',
      'Session XLSX report (good for sponsors and post-event analysis)',
      'No app — audience joins in <100KB from any phone',
      'Projector-friendly host screen with large live charts',
    ],
    faqs: [
      {
        question: 'Is Quizotic good for trivia nights?',
        answer: 'Yes. Team mode with multi-round scoring and a team leaderboard is purpose-built for pub-style trivia. The host screen projects large and readable.',
      },
      {
        question: 'Can sponsors get their own branded round?',
        answer: 'Yes. Create a separate round tagged to the sponsor. Share the session XLSX report with sponsors as post-event engagement proof.',
      },
      {
        question: 'How do audiences join?',
        answer: 'They open quizotic.live/join on any phone and enter a 6-digit game PIN. No app, no signup, no account.',
      },
      {
        question: 'Does it work in a 1000-person conference hall?',
        answer: 'The participant page is <100KB on first load, so it works on crowded conference Wi-Fi. For very large crowds, use the Team plan.',
      },
      {
        question: 'Can we use it for hybrid events?',
        answer: 'Yes. In-person and remote audiences join the same session. Everyone gets the same live leaderboard experience.',
      },
    ],
    related: [
      { title: 'Quizotic vs Slido', href: '/vs/slido', description: 'Slido head-to-head — Q&A, polls, quiz depth.' },
      { title: 'Slido alternatives 2026', href: '/learn/slido-alternatives-india-2026', description: '5 Slido alternatives compared for Indian conferences.' },
      { title: 'Live Polling', href: '/live-polling', description: 'Real-time audience polls.' },
      { title: 'Pricing', href: '/pricing', description: 'Plans for event hosts in INR.' },
    ],
    keywords: [
      'event engagement platform',
      'conference audience polling',
      'trivia night platform',
      'live polling for events',
      'audience response tool india',
      'slido alternative conference',
      'slido alternative india',
    ],
  },
}

export const USE_CASE_SLUGS = Object.keys(USE_CASES)
