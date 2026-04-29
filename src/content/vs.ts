import type { ComparisonRow, FaqItem } from '@/components/seo/ComparisonPageLayout'
import type { RelatedLink } from '@/components/seo/RelatedLinks'

export interface VsContent {
  competitor: string
  metaTitle: string
  metaDescription: string
  h1: string
  tagline: string
  intro: string
  rows: ComparisonRow[]
  honestNote: string
  faqs: FaqItem[]
  related: RelatedLink[]
  keywords: string[]
}

const COMMON_RELATED: RelatedLink[] = [
  { title: 'Live Quiz', href: '/live-quiz', description: 'Live multiplayer quiz with leaderboard.' },
  { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Polls, word clouds, Q&A in one deck.' },
  { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate quizzes from a PDF or topic.' },
  { title: 'All features', href: '/features', description: '11 question types, 4 session modes, reports.' },
]

export const VS: Record<string, VsContent> = {
  kahoot: {
    competitor: 'Kahoot',
    metaTitle: 'Quizotic vs Kahoot — Side-by-Side Comparison (2026)',
    metaDescription: 'Quizotic vs Kahoot — feature-by-feature comparison. Pricing (INR vs USD), question types (11 vs 4), AI generation, Bloom\'s Taxonomy, and low-bandwidth performance.',
    h1: 'Quizotic vs Kahoot — Feature-by-Feature Comparison',
    tagline: 'An honest head-to-head. Where Quizotic wins, where Kahoot still leads, and which one fits your use case.',
    intro: 'Kahoot is the default name in classroom quizzes worldwide. Quizotic is the India-first challenger with more question types, built-in AI, Bloom tagging, Confidence Grid, and INR pricing. This comparison lays out each feature side-by-side with no hand-waving — so you can pick based on what actually matters for your classroom.',
    rows: [
      { feature: 'Pricing currency', quizotic: 'INR (UPI, cards)', competitor: 'USD (cards only)', winner: 'quizotic' },
      { feature: 'Free plan participants', quizotic: '10 per session', competitor: '10-40 (varies)', winner: 'tie' },
      { feature: 'Question types', quizotic: '11', competitor: '4', winner: 'quizotic' },
      { feature: 'AI quiz generation', quizotic: 'Free tier (30/month)', competitor: 'Paid add-on', winner: 'quizotic' },
      { feature: 'PDF/DOCX import', quizotic: 'Yes', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy', quizotic: 'Built-in tagging', competitor: 'Not supported', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Built-in', competitor: 'Not supported', winner: 'quizotic' },
      { feature: 'Spaced-retrieval review', quizotic: 'Built-in', competitor: 'Not supported', winner: 'quizotic' },
      { feature: 'Interactive presentation mode', quizotic: 'Yes (polls, word cloud, Q&A)', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'Team mode', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Self-paced mode', quizotic: 'Yes', competitor: 'Yes (challenges)', winner: 'tie' },
      { feature: 'Mobile participant payload', quizotic: '<100KB', competitor: 'Heavier', winner: 'quizotic' },
      { feature: 'Public question library', quizotic: 'Growing', competitor: 'Massive', winner: 'competitor' },
      { feature: 'Brand recognition', quizotic: 'Growing', competitor: 'Industry-standard', winner: 'competitor' },
      { feature: 'Enterprise SSO & integrations', quizotic: 'On Team plan', competitor: 'Extensive', winner: 'competitor' },
    ],
    honestNote: 'Kahoot has 15+ years of brand recognition, a massive global question library, and deep integrations with Google Classroom, Microsoft Teams, and dozens of LMSes. Those matter at enterprise scale. For Indian classrooms, coaching institutes, and trainers paying out of pocket, Quizotic\'s feature-per-rupee is hard to beat.',
    faqs: [
      {
        question: 'Which is more affordable in India?',
        answer: 'Quizotic — significantly. INR pricing, UPI payments, no currency conversion, no international card fees. Kahoot\'s cheapest paid tier in USD often costs 3-5× more than Quizotic Pro when converted.',
      },
      {
        question: 'Which has more question types?',
        answer: 'Quizotic (11: MCQ, multi-select, T/F, poll, open-ended, word cloud, Q&A, rating, ranking, case study, drawing). Kahoot has 4 main types: Quiz, True/False, Puzzle, and Poll.',
      },
      {
        question: 'Which has better AI?',
        answer: 'Quizotic\'s AI generator is included on the free plan (30 questions/month) and produces Bloom-tagged questions. Kahoot\'s AI generator is a paid upgrade and doesn\'t tag cognitive depth.',
      },
      {
        question: 'Which works better on classroom Wi-Fi?',
        answer: 'Quizotic — designed for 1-2 Mbps Indian classroom connections. Participant page is <100KB on first load, all real-time events <1KB.',
      },
      {
        question: 'Can I migrate my Kahoot content?',
        answer: 'Yes. Export Kahoot to Excel, then import into Quizotic. MCQ and True/False transfer cleanly; image-heavy questions need re-upload.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['quizotic vs kahoot', 'kahoot vs quizotic', 'kahoot comparison', 'kahoot alternative'],
  },

  mentimeter: {
    competitor: 'Mentimeter',
    metaTitle: 'Quizotic vs Mentimeter — Feature Comparison for India (2026)',
    metaDescription: 'Quizotic vs Mentimeter — feature comparison. Polls, word clouds, Q&A, quiz mechanics, AI generation, Bloom tagging, INR vs EUR pricing.',
    h1: 'Quizotic vs Mentimeter — Side-by-Side',
    tagline: 'Mentimeter is the polling standard. Quizotic matches the polls and adds a full quiz engine — at Indian prices.',
    intro: 'Mentimeter is the established name for interactive presentations and audience polling. Quizotic covers the same polling surface and layers on competitive quiz mechanics, AI quiz generation, and Bloom tagging. This comparison goes feature by feature so you can see which wins for your specific use case.',
    rows: [
      { feature: 'Pricing currency', quizotic: 'INR', competitor: 'EUR/USD', winner: 'quizotic' },
      { feature: 'UPI payments', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Live polls (all formats)', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Q&A with upvotes', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Quiz leaderboard & speed bonus', quizotic: 'Yes', competitor: 'Yes (Quiz Competition)', winner: 'tie' },
      { feature: 'AI quiz from PDF', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy tagging', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced retrieval', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Template library', quizotic: 'Growing', competitor: 'Very large', winner: 'competitor' },
      { feature: 'Microsoft/Zoom integrations', quizotic: 'Screen-share based', competitor: 'Native add-ins', winner: 'competitor' },
      { feature: 'Low-bandwidth participant', quizotic: '<100KB', competitor: 'Heavier', winner: 'quizotic' },
    ],
    honestNote: 'Mentimeter has a polished enterprise UI, Microsoft PowerPoint add-in, SSO across plans, and a template library built up over years. If your organisation standardises on Microsoft and you need plug-and-play, Mentimeter is a safe pick. If you want the same core features plus quiz depth and INR pricing, Quizotic wins.',
    faqs: [
      {
        question: 'Is Quizotic a true replacement for Mentimeter?',
        answer: 'For the core use cases (polls, word clouds, Q&A, interactive slides) — yes. Quizotic covers all of it plus competitive quiz mode, which Mentimeter handles more narrowly.',
      },
      {
        question: 'Can I mix quiz questions and polls in one deck?',
        answer: 'Yes. This is a core Quizotic capability. Mentimeter keeps quiz and poll flows somewhat separate.',
      },
      {
        question: 'Does Quizotic have a PowerPoint add-in?',
        answer: 'Not yet. Quizotic imports PPTX/PDF decks but doesn\'t yet have a native PowerPoint add-in. Roadmap item.',
      },
      {
        question: 'How do the free plans compare?',
        answer: 'Quizotic free: 10 participants, unlimited decks, all interaction types. Mentimeter free: ~50 participants but only 2 quiz questions and 5 interactive slides per deck. For teachers running full sessions, Quizotic free is more usable.',
      },
      {
        question: 'Which is better for corporate training?',
        answer: 'Depends on stack. Microsoft-heavy enterprise → Mentimeter\'s add-in is convenient. Indian SMB, coaching institute, or school → Quizotic\'s feature density + pricing wins.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['quizotic vs mentimeter', 'mentimeter vs quizotic', 'mentimeter comparison', 'mentimeter alternative'],
  },

  quizizz: {
    competitor: 'Quizizz',
    metaTitle: 'Quizotic vs Quizizz — Comparison for Indian Teachers (2026)',
    metaDescription: 'Quizotic vs Quizizz — honest feature comparison. Self-paced vs live, AI generation, Bloom tagging, Confidence Grid, INR pricing, classroom Wi-Fi performance.',
    h1: 'Quizotic vs Quizizz — Which Fits Your Classroom?',
    tagline: 'Both support live and self-paced quiz modes. Where they diverge is learning science and pricing.',
    intro: 'Quizizz is strong on self-paced game-style quizzes and has a huge teacher-contributed question library. Quizotic covers self-paced + live + interactive presentation modes, adds Bloom tagging, Confidence Grid, spaced retrieval, and AI quiz generation, and prices in INR. Here\'s the honest feature-by-feature view.',
    rows: [
      { feature: 'Self-paced quizzes', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Live multiplayer', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Interactive presentation mode', quizotic: 'Yes', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'Question types', quizotic: '11', competitor: '7', winner: 'quizotic' },
      { feature: 'AI quiz from PDF', quizotic: 'Yes (free tier)', competitor: 'Yes (paid)', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced retrieval', quizotic: 'Built-in', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'Public question library', quizotic: 'Growing', competitor: 'Millions of questions', winner: 'competitor' },
      { feature: 'Memes & animations', quizotic: 'Minimal', competitor: 'Built-in', winner: 'competitor' },
      { feature: 'INR pricing + UPI', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'LMS integrations', quizotic: 'Growing', competitor: 'Extensive', winner: 'competitor' },
    ],
    honestNote: 'Quizizz\'s library is massive — millions of teacher-contributed questions. If your workflow is "search existing questions, launch fast," Quizizz still wins on that axis. Quizotic\'s AI generator offsets this by producing Bloom-balanced questions from any PDF or topic on demand, which many teachers prefer over searching through generic library content.',
    faqs: [
      {
        question: 'Is Quizizz\'s question library really better?',
        answer: 'In raw size, yes. In relevance to Indian curriculum, often no — most library content is US-K12. Quizotic\'s AI generator produces questions specifically aligned to your source material (NCERT chapter, coaching handout, etc).',
      },
      {
        question: 'Can I run quizzes as homework on Quizotic?',
        answer: 'Yes. Self-paced mode with a shareable link + deadline works exactly like Quizizz homework mode.',
      },
      {
        question: 'Do kids find Quizotic as fun as Quizizz?',
        answer: 'Competitive mode with speed bonus and streaks brings similar energy. Quizizz has more built-in memes/animations which younger kids enjoy; Quizotic is roadmap-adding these.',
      },
      {
        question: 'Which has better reports?',
        answer: 'Quizotic — Bloom distribution, Confidence Grid, and spaced-retrieval queues give teachers actionable diagnostics beyond raw scores.',
      },
      {
        question: 'Can I import Quizizz quizzes?',
        answer: 'Export from Quizizz to Excel, import to Quizotic. MCQs and True/False transfer cleanly.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['quizotic vs quizizz', 'quizizz vs quizotic', 'quizizz comparison', 'quizizz alternative'],
  },

  slido: {
    competitor: 'Slido',
    metaTitle: 'Quizotic vs Slido — Feature Comparison for India (2026)',
    metaDescription: 'Quizotic vs Slido — head-to-head comparison. Live Q&A, polls, word clouds, quiz mechanics, AI generation, INR pricing with UPI vs Cisco/Webex bundling.',
    h1: 'Quizotic vs Slido — Side-by-Side',
    tagline: 'Slido leads on Webex integration. Quizotic leads on quiz depth, AI generation, and Indian pricing — and the participant page is 4× lighter.',
    intro: 'Slido (acquired by Cisco in 2021) is the standard for Q&A and audience polling in Webex-heavy enterprises. Quizotic covers the same Q&A + polls surface and adds full quiz mechanics — leaderboard, speed bonus, AI generation from PDFs, Bloom-tagged reports — plus INR billing with UPI. Here\'s the head-to-head, no hand-waving.',
    rows: [
      { feature: 'Pricing currency', quizotic: 'INR (UPI, cards, GST invoice)', competitor: 'USD (cards only, international invoice)', winner: 'quizotic' },
      { feature: 'Free plan participants', quizotic: '50 per session', competitor: '100 per event (Q&A only)', winner: 'tie' },
      { feature: 'Live Q&A with upvotes', quizotic: 'Yes', competitor: 'Yes (industry-leading)', winner: 'tie' },
      { feature: 'Live polls (all formats)', quizotic: 'Yes — 11 question types', competitor: 'Yes — 6 poll types', winner: 'quizotic' },
      { feature: 'Word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Competitive quiz with leaderboard + speed bonus', quizotic: 'Yes — full Kahoot-style quiz engine', competitor: 'Limited — Slido Quiz tier only', winner: 'quizotic' },
      { feature: 'AI quiz generation from PDF / topic', quizotic: 'Free (30/month) — Bloom-tagged', competitor: 'No', winner: 'quizotic' },
      { feature: 'Self-paced assessments', quizotic: 'Yes', competitor: 'No (live-only)', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy tagging', quizotic: 'Built-in on every question', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid (hubris/imposter cohorts)', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced-retrieval review queue', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'NCERT / India-curriculum library', quizotic: 'Yes — Classes 6–12', competitor: 'No', winner: 'quizotic' },
      { feature: 'Participant page weight (mobile, first load)', quizotic: '~80KB', competitor: '~350KB', winner: 'quizotic' },
      { feature: 'Cisco Webex native integration', quizotic: 'Screen-share / link in chat', competitor: 'Native (owned by Cisco)', winner: 'competitor' },
      { feature: 'Zoom / Teams / Google Meet native', quizotic: 'Screen-share + chat link', competitor: 'Native add-ins', winner: 'competitor' },
      { feature: 'Conference-scale Q&A track record', quizotic: 'Growing (events + classrooms)', competitor: 'Industry-standard for keynotes', winner: 'competitor' },
      { feature: 'Hindi / Indian regional language support', quizotic: 'Hindi shipping (v2 — Tamil/Telugu/Marathi roadmap)', competitor: 'No', winner: 'quizotic' },
      { feature: 'Brand recognition globally', quizotic: 'Growing (India-first)', competitor: 'Established in Cisco shops', winner: 'competitor' },
    ],
    honestNote: 'Slido\'s Cisco Webex integration is genuinely deep — login through Webex, polls embedded inside the meeting frame, attendee data merged. If your organisation runs all-hands, town-halls, and webinars on Webex, Slido is the path of least friction. Outside that stack — Indian schools, coaching institutes, corporate trainers using Zoom/Teams/Meet, conference organisers without Cisco partnerships — Quizotic\'s feature surface (quiz + polls + Q&A in one tool) and INR pricing are usually the better fit.',
    faqs: [
      {
        question: 'Is Quizotic a true replacement for Slido?',
        answer: 'For Q&A, polls, word clouds, and audience response — yes. Quizotic covers the full Slido feature surface and adds competitive quiz mode, AI generation, and Bloom tagging that Slido doesn\'t offer. Where Slido genuinely wins is Cisco Webex native integration; for Zoom/Teams/Meet/in-person, Quizotic is a stronger 1:1 fit.',
      },
      {
        question: 'How does pricing compare in India?',
        answer: 'Slido Engage starts at $12.50/host/month — about ₹1,050 plus 3% FX markup plus international card fees. Quizotic Pro is ₹499/month flat with UPI billing and a domestic GST invoice. For an institute with 10 hosts, the gap is ~₹6,000/month or ~₹72,000/year.',
      },
      {
        question: 'Does Quizotic handle conference-scale Q&A?',
        answer: 'Yes. Pro and Team plans support large audiences with the same upvote-sorted Q&A as Slido. The participant page is ~80KB on first load (vs Slido\'s ~350KB), so it joins faster on crowded conference Wi-Fi. For 1000+ attendee events, contact us for a Team plan quote.',
      },
      {
        question: 'Can I add quiz competition to my conference like Slido Quiz?',
        answer: 'Yes — and Quizotic\'s quiz engine is more developed than Slido Quiz. Speed bonus, streak multipliers, team mode, leaderboard with sectional rankings, and 11 question types (vs Slido\'s simpler MCQ-only quiz tier).',
      },
      {
        question: 'Does Quizotic integrate with Cisco Webex?',
        answer: 'Not natively (yet). Hosts share the Quizotic screen on Webex; attendees join via a 6-digit PIN at quizotic.live/join in their phone browser. Native Webex integration is on the roadmap for late 2026.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['quizotic vs slido', 'slido vs quizotic', 'slido comparison', 'slido alternative', 'slido alternative india'],
  },

  ahaslides: {
    competitor: 'AhaSlides',
    metaTitle: 'Quizotic vs AhaSlides — Feature Comparison (2026)',
    metaDescription: 'Quizotic vs AhaSlides — head-to-head comparison. Interactive slides, quiz mode, AI generation, Bloom\'s Taxonomy, INR vs USD pricing.',
    h1: 'Quizotic vs AhaSlides — Side-by-Side',
    tagline: 'Two interactive-presentation tools. The differentiator is learning science and Indian pricing.',
    intro: 'AhaSlides and Quizotic sit in the same category — interactive presentations mixing slides, polls, and quizzes. This comparison isolates where each wins so you can pick based on your actual priorities.',
    rows: [
      { feature: 'Interactive slides', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Polls (all formats)', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Q&A', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Quiz leaderboard', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'AI quiz generation', quizotic: 'Free tier', competitor: 'Paid', winner: 'quizotic' },
      { feature: 'Bloom tagging', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced retrieval', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'INR pricing + UPI', quizotic: 'Yes', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'Template library', quizotic: 'Growing', competitor: 'Large', winner: 'competitor' },
      { feature: 'Free plan participants', quizotic: '10/session', competitor: 'Unlimited (limited features)', winner: 'tie' },
    ],
    honestNote: 'AhaSlides has a larger template library and a more generous participant count on the free tier (though feature-limited). If you need ready-made templates and expect occasional large audiences on the free plan, AhaSlides is attractive. Quizotic wins on learning science depth, AI inclusion, and INR pricing clarity.',
    faqs: [
      {
        question: 'How many participants on the free plan?',
        answer: 'Quizotic free: 10 per session, all features unlocked. AhaSlides free: technically unlimited participants but individual features (quiz, word cloud) have per-event limits.',
      },
      {
        question: 'Which is better for Indian users?',
        answer: 'Quizotic — INR pricing, UPI payments, Hindi/regional script support, mobile-first participant UX tuned for Indian classroom bandwidth.',
      },
      {
        question: 'Can I import AhaSlides decks?',
        answer: 'Export to PDF/PPT, then import into Quizotic; interactive moments get re-added in Quizotic. No direct API import yet.',
      },
      {
        question: 'Which is easier to learn?',
        answer: 'Both have modern drag-and-drop editors. Quizotic\'s has slightly fewer abstractions because quiz and presentation modes share one deck model.',
      },
      {
        question: 'Which has better reports?',
        answer: 'Quizotic — Bloom distribution, Confidence Grid, and spaced-retrieval queues are diagnostics AhaSlides doesn\'t offer.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['quizotic vs ahaslides', 'ahaslides vs quizotic', 'ahaslides comparison'],
  },
}

export const VS_SLUGS = Object.keys(VS)
