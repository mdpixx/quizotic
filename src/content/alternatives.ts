import type { ComparisonRow, FaqItem } from '@/components/seo/ComparisonPageLayout'
import type { RelatedLink } from '@/components/seo/RelatedLinks'

export interface AlternativeContent {
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
  { title: 'Pricing', href: '/pricing', description: 'Free, Pro, Team — in INR with UPI.' },
]

export const ALTERNATIVES: Record<string, AlternativeContent> = {
  kahoot: {
    competitor: 'Kahoot',
    metaTitle: 'Kahoot Alternative for India — Quizotic (INR, UPI, AI-Generated)',
    metaDescription: 'Looking for a Kahoot alternative with INR pricing and UPI payments? Quizotic offers 11 question types, AI quiz generation, and Bloom\'s Taxonomy — free tier included.',
    h1: 'Kahoot Alternatives — Why Quizotic Fits Indian Classrooms Better',
    tagline: 'Kahoot is great — but it bills in dollars, has no UPI, and treats Indian schools like every other market. Quizotic is built for the way Indian classrooms actually work.',
    intro: 'If you love Kahoot\'s energy but hate paying in USD, dealing with international card charges, or adjusting to a tool that ignores Bloom\'s Taxonomy, Quizotic is a closer fit. You get the same live-leaderboard excitement plus AI quiz generation, 11 question types (vs Kahoot\'s 4), Confidence Grid analytics, and spaced-retrieval review queues — all priced in INR with UPI payments.',
    rows: [
      { feature: 'Pricing currency', quizotic: 'INR', competitor: 'USD', winner: 'quizotic' },
      { feature: 'UPI payments', quizotic: 'Yes (Razorpay)', competitor: 'No', winner: 'quizotic' },
      { feature: 'Free tier participants', quizotic: '10 per session', competitor: '10–40 per session (varies)', winner: 'tie' },
      { feature: 'Question types', quizotic: '11', competitor: '4', winner: 'quizotic' },
      { feature: 'AI quiz generation', quizotic: 'Included (30/month free)', competitor: 'Paid add-on', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy tagging', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced-retrieval review', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Global brand recognition', quizotic: 'Growing (India-first)', competitor: 'Industry-standard', winner: 'competitor' },
      { feature: 'Low-bandwidth participant page', quizotic: '<100KB', competitor: 'Heavier', winner: 'quizotic' },
    ],
    honestNote: 'Kahoot has 15+ years of brand recognition and a massive question library. If your school already has enterprise Kahoot licenses and your team is trained on it, switching has a real cost. Quizotic\'s advantage kicks in for new programs, Indian pricing sensitivity, and teachers who want deeper learning-science features than Kahoot offers.',
    faqs: [
      {
        question: 'Can I import my existing Kahoot quizzes?',
        answer: 'Yes. Export your Kahoot as an Excel/XLSX file, then paste into Quizotic\'s import dialog. MCQ and True/False questions transfer cleanly; richer types may need light editing.',
      },
      {
        question: 'Is Quizotic really free?',
        answer: 'Yes. The free plan covers unlimited quizzes with up to 10 participants per session — enough for most classroom use. Pro (200 participants, advanced reports, AI) and Team plans are priced in INR.',
      },
      {
        question: 'How is Quizotic\'s AI better than Kahoot\'s?',
        answer: 'Quizotic\'s AI generation is included on the free plan (30 questions/month) and produces Bloom-tagged questions with explanations. Kahoot\'s AI generator is a paid add-on and doesn\'t tag Bloom levels.',
      },
      {
        question: 'Does Quizotic work on classroom Wi-Fi?',
        answer: 'Yes. The participant page is <100KB on first load and every real-time event is <1KB — built specifically for 1–2 Mbps Indian classroom connections.',
      },
      {
        question: 'What is the Confidence Grid?',
        answer: 'After each answer, participants rate their confidence. The report plots Correct-vs-Confident on a 2×2 grid — surfacing "Hubris" (confident but wrong) and "Imposter" (correct but unsure) cohorts for targeted follow-up. No other major quiz platform offers this.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['kahoot alternative', 'kahoot alternative india', 'kahoot vs quizotic', 'kahoot free alternative', 'kahoot inr'],
  },

  mentimeter: {
    competitor: 'Mentimeter',
    metaTitle: 'Mentimeter Alternative — Quizotic (INR Pricing, Quiz + Polls in One)',
    metaDescription: 'Looking for a Mentimeter alternative with INR pricing? Quizotic combines word clouds, polls, and Q&A with full quiz mechanics — leaderboard, AI generation, free tier.',
    h1: 'Mentimeter Alternatives — Polls + Quizzes in One Tool, Priced for India',
    tagline: 'Mentimeter is excellent for polls. Quizotic adds full quiz mechanics on top — and doesn\'t charge in Euros.',
    intro: 'Teachers and trainers using Mentimeter for word clouds and polls often want competitive quiz mechanics too — leaderboard, speed bonus, streaks. Quizotic combines both without switching tools. Every Mentimeter interaction (word cloud, poll, scale, ranking, open-ended, Q&A) is here, plus quiz-specific features (MCQ scoring, team mode, Bloom tagging, AI generation). INR pricing, UPI payments, generous free tier.',
    rows: [
      { feature: 'Pricing currency', quizotic: 'INR', competitor: 'EUR / USD', winner: 'quizotic' },
      { feature: 'UPI payments', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Live polls', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Quiz leaderboard + speed bonus', quizotic: 'Yes', competitor: 'Yes (Quiz Competition)', winner: 'tie' },
      { feature: 'AI quiz generation from PDF', quizotic: 'Included', competitor: 'No', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy tagging', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Free plan participants', quizotic: '10/session', competitor: '~50 but limited question count', winner: 'tie' },
      { feature: 'Enterprise polish & integrations', quizotic: 'Growing', competitor: 'Industry-standard', winner: 'competitor' },
      { feature: 'Low-bandwidth participant page', quizotic: '<100KB', competitor: 'Heavier', winner: 'quizotic' },
    ],
    honestNote: 'Mentimeter has a polished enterprise workflow, SSO-at-scale, and deep integrations with Microsoft and Zoom. If you\'re in a large Fortune-500 stack, those integrations matter. For Indian schools, colleges, coaching institutes, and SMB corporate trainers, Quizotic\'s feature set + INR pricing usually wins.',
    faqs: [
      {
        question: 'Can I do word clouds and polls in Quizotic?',
        answer: 'Yes. Word clouds, single-choice polls, multi-select polls, rating scales, ranking, and open-text — the full Mentimeter-style polling set is included.',
      },
      {
        question: 'Can I mix polls with competitive quiz questions?',
        answer: 'Yes. One deck can contain polls, word clouds, Q&A, and scored quiz questions in any order. Switch to competitive mode to show a leaderboard; switch to reflection mode to hide scores.',
      },
      {
        question: 'Does Quizotic integrate with PowerPoint or Zoom?',
        answer: 'Quizotic imports PPTX and PDF decks. For Zoom/Meet/Teams, you share your host screen in the video call; participants join on a separate tab. No plugin needed.',
      },
      {
        question: 'What about pricing?',
        answer: 'Free tier: unlimited decks, 10 audience members/session, all interaction types. Pro: ₹ (check /pricing) for 200 members and advanced reports. Team: seat-based for institutes with SSO and admin dashboard.',
      },
      {
        question: 'Can I export the data?',
        answer: 'Yes. Every session report exports as XLSX with per-participant answers, word-cloud submissions, and aggregate visualisations.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['mentimeter alternative', 'mentimeter alternative india', 'mentimeter vs quizotic', 'mentimeter free alternative', 'menti alternative'],
  },

  quizizz: {
    competitor: 'Quizizz',
    metaTitle: 'Quizizz Alternative — Quizotic (Bloom Tags, Confidence Grid, INR)',
    metaDescription: 'Looking for a Quizizz alternative? Quizotic adds Bloom\'s Taxonomy, Confidence Grid, and spaced-retrieval review — with INR pricing and UPI. Free tier included.',
    h1: 'Quizizz Alternatives — Deeper Learning Science, Indian Pricing',
    tagline: 'Quizizz is solid for self-paced homework quizzes. Quizotic goes further on learning science and costs less in India.',
    intro: 'Quizizz focuses on self-paced game-style quizzes. Quizotic covers the same self-paced mode plus live multiplayer, interactive presentations, and AI quiz generation — all grounded in learning science that Quizizz doesn\'t offer. Bloom\'s Taxonomy tagging, Confidence Grid reports, and spaced-retrieval review queues turn a quick quiz into an actual learning loop.',
    rows: [
      { feature: 'Self-paced quiz mode', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Live multiplayer mode', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Question types', quizotic: '11', competitor: '7', winner: 'quizotic' },
      { feature: 'Bloom\'s Taxonomy', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced-retrieval review', quizotic: 'Built-in', competitor: 'No', winner: 'quizotic' },
      { feature: 'AI quiz generation', quizotic: 'Free (30/month)', competitor: 'Paid add-on', winner: 'quizotic' },
      { feature: 'INR pricing + UPI', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Public question library', quizotic: 'Growing', competitor: 'Very large', winner: 'competitor' },
      { feature: 'Participant experience (phone)', quizotic: '<100KB, India-tuned', competitor: 'Heavier', winner: 'quizotic' },
    ],
    honestNote: 'Quizizz\'s public question library is massive — millions of teacher-contributed questions across K-12 subjects. If your workflow depends on grabbing pre-made questions, Quizizz wins there. Quizotic\'s AI generator partially offsets this by producing Bloom-balanced questions from any PDF or topic on demand.',
    faqs: [
      {
        question: 'Does Quizotic have a self-paced mode?',
        answer: 'Yes. Self-paced mode lets participants work through a quiz at their own speed — perfect for homework and async assignments.',
      },
      {
        question: 'Can I assign Quizotic quizzes as homework?',
        answer: 'Yes. Generate a shareable link or PIN, set a deadline, and students complete at their own pace. Report aggregates individual scores.',
      },
      {
        question: 'What\'s the Confidence Grid and why does it matter?',
        answer: 'Students rate their confidence after each answer. The Confidence Grid plots Correct-vs-Confident on a 2×2. "Hubris" students (confident but wrong) need re-teaching; "Imposter" students (correct but unsure) need encouragement. This one diagnostic outperforms raw scores for targeting follow-up.',
      },
      {
        question: 'How does spaced retrieval work?',
        answer: 'Missed questions auto-queue for short review at 1, 3, 7, and 14 days. Students see a micro-quiz of just their weak spots — leveraging the spacing effect to move knowledge to long-term memory.',
      },
      {
        question: 'Can I import my Quizizz quizzes?',
        answer: 'Export from Quizizz to Excel, then import into Quizotic. MCQs and True/False transfer cleanly; image-based questions need a re-upload.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['quizizz alternative', 'quizizz alternative india', 'quizizz vs quizotic', 'quizizz free alternative'],
  },

  slido: {
    competitor: 'Slido',
    metaTitle: 'Slido Alternative — Quizotic (Quiz + Polls + Q&A, INR Pricing)',
    metaDescription: 'Slido alternative with full quiz mechanics. Live Q&A, polls, word clouds, plus competitive quiz mode with leaderboard. INR pricing with UPI. Free tier.',
    h1: 'Slido Alternatives — Add Quiz Mechanics to Your Q&A and Polls',
    tagline: 'Slido excels at Q&A. Quizotic gives you Q&A, polls, word clouds, AND a full quiz engine with leaderboard — in one tool.',
    intro: 'Slido is popular for conference Q&A and quick audience polls. Quizotic covers the same use case and adds everything else — competitive quiz mode, self-paced assessments, AI quiz generation, Bloom tagging, and spaced-retrieval review. If you run trainings, workshops, or classes where Q&A is only one piece of the puzzle, Quizotic handles the whole session.',
    rows: [
      { feature: 'Live Q&A with upvotes', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Live polls', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Competitive quiz leaderboard', quizotic: 'Yes', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'AI quiz generation', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Self-paced assessments', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Bloom tags + Confidence Grid', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'INR pricing + UPI', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Cisco/Webex deep integration', quizotic: 'No', competitor: 'Yes (owned by Cisco)', winner: 'competitor' },
      { feature: 'Conference-scale Q&A', quizotic: 'Growing', competitor: 'Enterprise-standard', winner: 'competitor' },
    ],
    honestNote: 'Slido is owned by Cisco and has native Webex integration plus strong enterprise conference positioning. For large conferences with Webex as the primary platform, Slido\'s integration depth is real. For classrooms, workshops, trainings, and events outside the Cisco stack, Quizotic\'s broader feature set usually wins.',
    faqs: [
      {
        question: 'Does Quizotic do live Q&A at scale?',
        answer: 'Yes. Unlimited questions per session on paid plans, with upvote sorting so the room surfaces the best questions for the host to address.',
      },
      {
        question: 'Can I run a conference-style event?',
        answer: 'Yes. Attendees join with a PIN, submit Q&A and vote in polls from their phones. Export full session data afterward.',
      },
      {
        question: 'Can I add quiz mechanics to my conference?',
        answer: 'Yes — and this is where Quizotic differentiates. Mix audience polls with competitive quiz moments ("Test your knowledge from the last talk") in the same session.',
      },
      {
        question: 'Is there a free plan?',
        answer: 'Yes, with 10 participants per session. Pro extends to 200, Team plans cover larger events.',
      },
      {
        question: 'Does Quizotic work in Zoom?',
        answer: 'Yes. Share your screen in Zoom; participants open quizotic.live/join in another tab. No Zoom plugin needed.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['slido alternative', 'slido alternative india', 'slido vs quizotic', 'cisco slido alternative'],
  },

  ahaslides: {
    competitor: 'AhaSlides',
    metaTitle: 'AhaSlides Alternative — Quizotic (Deeper Learning Science, INR Pricing)',
    metaDescription: 'AhaSlides alternative with Bloom\'s Taxonomy tagging, Confidence Grid, spaced-retrieval review, and AI quiz generation. INR pricing with UPI. Free to start.',
    h1: 'AhaSlides Alternatives — Interactive Presentations with Learning Science Built In',
    tagline: 'AhaSlides is a solid interactive-presentation tool. Quizotic adds real learning science and Indian pricing on top of everything AhaSlides offers.',
    intro: 'AhaSlides gives you interactive slides, polls, word clouds, and quizzes in one deck. Quizotic covers the same ground and goes further — Bloom\'s Taxonomy tagging, Confidence Grid analytics, spaced-retrieval review queues, and AI quiz generation from PDFs. For teachers and trainers who care about long-term learning outcomes, not just session engagement, the learning-science layer is the difference.',
    rows: [
      { feature: 'Interactive slides', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Polls & word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Quiz mode with leaderboard', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Bloom\'s Taxonomy tagging', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Confidence Grid', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Spaced-retrieval review', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'AI quiz generation', quizotic: 'Yes (free tier)', competitor: 'Yes (paid)', winner: 'quizotic' },
      { feature: 'INR pricing + UPI', quizotic: 'Yes', competitor: 'USD, limited local options', winner: 'quizotic' },
      { feature: 'Template library size', quizotic: 'Growing', competitor: 'Large', winner: 'competitor' },
      { feature: 'Brand recognition', quizotic: 'Growing', competitor: 'Established', winner: 'competitor' },
    ],
    honestNote: 'AhaSlides has a larger template library and more established brand recognition in the global SMB market. If you want to grab a pre-made gameshow template fast, AhaSlides is ready. Quizotic catches up on templates over time; the learning-science layer and INR pricing are the structural advantages.',
    faqs: [
      {
        question: 'Can I import AhaSlides decks?',
        answer: 'Direct import isn\'t available yet. Export your deck to PDF or PPT, then import into Quizotic — the content transfers and you re-add interactive moments.',
      },
      {
        question: 'What\'s the free plan limit?',
        answer: '10 participants per session, unlimited decks, all interaction types.',
      },
      {
        question: 'What does Bloom tagging actually do for me?',
        answer: 'After each session, Quizotic shows the depth of cognitive engagement — was your quiz all recall, or did it push learners to apply and analyse? This one report often changes how teachers design the next session.',
      },
      {
        question: 'Does Quizotic work on classroom Wi-Fi?',
        answer: 'Yes — the participant page is under 100KB and all real-time events stay under 1KB. Designed for Indian classroom bandwidth.',
      },
      {
        question: 'Can I use Quizotic in a corporate training?',
        answer: 'Yes. Corporate trainers use Quizotic for onboarding, compliance, and sales enablement — Bloom tagging helps justify ROI to L&D leadership.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['ahaslides alternative', 'ahaslides alternative india', 'ahaslides vs quizotic', 'ahaslides free alternative'],
  },

  'poll-everywhere': {
    competitor: 'Poll Everywhere',
    metaTitle: 'Poll Everywhere Alternative — Quizotic (Quiz + Polls in INR)',
    metaDescription: 'Poll Everywhere alternative that adds full quiz mechanics, AI generation, Bloom\'s Taxonomy, and INR pricing with UPI. Free tier, mobile-first participants.',
    h1: 'Poll Everywhere Alternatives — More Than Polls, Priced for India',
    tagline: 'Poll Everywhere is great at polls. Quizotic covers polls, quizzes, Q&A, and interactive presentations — one tool, INR pricing.',
    intro: 'Poll Everywhere focuses on audience polls for conferences and corporate meetings. Quizotic covers the full polling surface (single-choice, multi-select, rating, word cloud, ranking, open-ended) plus everything Poll Everywhere doesn\'t — competitive quiz mode, self-paced assessments, AI quiz generation, and learning-science analytics. INR pricing and a generous free tier make it more accessible for Indian educators and trainers.',
    rows: [
      { feature: 'Live polls (all formats)', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Word clouds', quizotic: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Competitive quiz with leaderboard', quizotic: 'Yes', competitor: 'Limited', winner: 'quizotic' },
      { feature: 'Self-paced assessments', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'AI quiz generation', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'Bloom + Confidence Grid', quizotic: 'Yes', competitor: 'No', winner: 'quizotic' },
      { feature: 'PPT/Keynote add-in', quizotic: 'Import only', competitor: 'Native add-in', winner: 'competitor' },
      { feature: 'INR pricing + UPI', quizotic: 'Yes', competitor: 'USD', winner: 'quizotic' },
      { feature: 'Enterprise conference focus', quizotic: 'Classroom + training', competitor: 'Conference + enterprise', winner: 'competitor' },
      { feature: 'Free plan participants', quizotic: '10/session', competitor: '25/session', winner: 'competitor' },
    ],
    honestNote: 'Poll Everywhere\'s native PowerPoint / Keynote add-in is genuinely convenient if your entire workflow lives in Microsoft or Apple presentation apps. Its enterprise conference positioning is strong too. Quizotic\'s advantage is breadth (quiz + polls + Q&A), learning science, and India-specific pricing.',
    faqs: [
      {
        question: 'Can I do everything Poll Everywhere does?',
        answer: 'The core polling surface — yes. Single-choice, multi-select, rating, ranking, word clouds, open text — all included.',
      },
      {
        question: 'Does Quizotic have a PowerPoint add-in?',
        answer: 'Not yet. Quizotic imports PPTX/PDF decks; you add interactions inside Quizotic rather than inside PowerPoint. Most teachers prefer the web editor anyway.',
      },
      {
        question: 'Can I use it in a conference?',
        answer: 'Yes. Paid plans scale to larger audiences; Team plans handle conference-scale events with admin dashboards and SSO.',
      },
      {
        question: 'What\'s the free tier?',
        answer: '10 participants per session, unlimited decks, all polling + quiz formats.',
      },
      {
        question: 'Can I combine polls with a quiz in the same session?',
        answer: 'Yes. That\'s actually the core Quizotic use case — one deck mixing polls, word clouds, Q&A, and scored quiz questions.',
      },
    ],
    related: COMMON_RELATED,
    keywords: ['poll everywhere alternative', 'poll everywhere alternative india', 'pollev alternative', 'poll everywhere vs quizotic'],
  },
}

export const ALTERNATIVE_SLUGS = Object.keys(ALTERNATIVES)
