import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'Live Quiz Platform — Free Kahoot Alternative',
  description:
    'Host live quizzes with up to thousands of players. 11 question types, real-time leaderboard, AI question generation. Free to start — no app install.',
  alternates: { canonical: '/live-quiz' },
  keywords: [
    'live quiz',
    'live quiz platform',
    'kahoot alternative',
    'free kahoot alternative',
    'online quiz tool',
    'classroom quiz',
    'real-time quiz',
  ],
}

export default function LiveQuizPage() {
  return (
    <SolutionPageLayout
      slug="live-quiz"
      h1="Live Quiz Platform"
      tagline="Host live quizzes your class will actually remember. Free to start, no app install."
      intro="Quizotic is a live quiz platform built on learning science. Create a quiz in minutes, share a 6-digit game PIN, and watch every participant answer in real time on their phone. Competitive mode brings Kahoot-style energy; reflection mode removes scoring pressure for thoughtful classrooms. Every quiz is grounded in learning science — Bloom's Taxonomy tagging, Confidence Grid after each answer, and spaced-retrieval review queues so missed questions come back later."
      features={[
        { title: '11 question types', description: 'MCQ, multi-select, T/F, poll, open-ended, word cloud, Q&A, rating, ranking, case study, drawing canvas.' },
        { title: 'Real-time leaderboard', description: 'Live score updates with speed bonus and streak multipliers. Keeps the room energised.' },
        { title: 'AI quiz generation', description: 'Paste notes or upload a PDF; Quizotic generates a full quiz with Bloom tags and explanations in seconds.' },
        { title: 'Ultra-lightweight join', description: 'Participants join from any browser in under 100KB. Works on 1–2 Mbps classroom Wi-Fi.' },
        { title: 'Session reports', description: 'Downloadable XLSX with per-participant scores, question-level accuracy, and Bloom distribution.' },
        { title: 'Generous free tier', description: 'Start free — no credit card required. The free tier covers up to 50 participants per session.' },
      ]}
      steps={[
        { title: 'Create a quiz', description: 'Start from scratch, import a PDF, or let Quizotic AI generate from your topic or notes.' },
        { title: 'Launch a live session', description: 'A 6-digit game PIN appears. Project your screen; participants enter the PIN on their phones.' },
        { title: 'Review the report', description: 'See every participant\'s accuracy, confidence, Bloom coverage, and who needs follow-up.' },
      ]}
      faqs={[
        {
          question: 'Is Quizotic free for live quizzes?',
          answer: 'Yes. The free plan lets you host unlimited live quizzes with up to 50 participants per session. Pro unlocks larger sessions and advanced reports.',
        },
        {
          question: 'How is Quizotic different from Kahoot?',
          answer: 'Quizotic is built on learning science — Bloom\'s Taxonomy tagging, Confidence Grid, spaced-retrieval review queues, and a lightweight participant experience for low-bandwidth connections.',
        },
        {
          question: 'Do participants need to download an app?',
          answer: 'No. Participants join in any browser by visiting quizotic.live/join and entering the 6-digit game PIN.',
        },
        {
          question: 'Can I import my existing quiz questions?',
          answer: 'Yes. You can paste questions manually, upload a PDF or DOCX, or let the AI generator build a quiz from a topic or your study notes.',
        },
        {
          question: 'Does it work on slow Wi-Fi?',
          answer: 'Yes. The participant page is under 100KB on first load, and all real-time events stay below 1KB. Designed specifically for 1–2 Mbps classroom connections.',
        },
      ]}
      related={[
        { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Mentimeter-style polls, word clouds, and Q&A in the same deck as your quiz.' },
        { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Paste a topic or PDF; get a ready-to-launch quiz with Bloom tags.' },
        { title: 'Gamified Learning', href: '/gamified-learning', description: 'Speed bonus, streaks, power-ups — the full gamification layer.' },
        { title: 'All features', href: '/features', description: '11 question types, 4 session modes, reports, and more.' },
        { title: 'Pricing', href: '/pricing', description: 'Free to start — simple plans as we grow.' },
      ]}
      ctaLabel="Launch your first live quiz free →"
    />
  )
}
