import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'Interactive Presentation Tool — Mentimeter Alternative',
  description:
    'Turn any presentation into a two-way conversation. Word clouds, live polls, Q&A, open text, scales, and rankings — mixed freely with quiz questions. Free to start.',
  alternates: { canonical: '/interactive-presentation' },
  keywords: [
    'interactive presentation',
    'mentimeter alternative',
    'free mentimeter alternative',
    'interactive slides',
    'audience polling',
    'live word cloud',
  ],
}

export default function InteractivePresentationPage() {
  return (
    <SolutionPageLayout
      slug="interactive-presentation"
      h1="Interactive Presentation Tool"
      tagline="Polls, word clouds, Q&A, and quizzes — all in the same deck. A Mentimeter-style experience, free to start, built for classrooms and corporate trainings."
      intro="Quizotic interactive presentations let you mix traditional slides with live audience interactions — word clouds, polls, open-text responses, rating scales, ranking, and Q&A. Every interaction appears on the audience's phone and the host's main screen at the same time. Unlike Mentimeter, you can weave competitive quiz questions and reflection questions into the same deck, so a training session can alternate between engagement, assessment, and reflection without switching tools."
      features={[
        { title: 'Word clouds & polls', description: 'Collect live words and votes; visual results appear on the host screen instantly.' },
        { title: 'Live Q&A with upvotes', description: 'Audience asks questions anonymously; the room upvotes the ones they want answered.' },
        { title: 'Quiz + presentation in one', description: 'Mix quiz questions, polls, and content slides in any order. One deck, multiple session modes.' },
        { title: 'PPT / PDF import', description: 'Drag in your existing slides and turn any slide into an interactive moment.' },
        { title: 'No install for audience', description: 'Audience scans a PIN at quizotic.live/join — runs in any browser, any device.' },
        { title: 'Free to start', description: 'Generous free tier — no credit card required. Paid plans (coming soon) are priced in USD.' },
      ]}
      steps={[
        { title: 'Build your deck', description: 'Add content slides, polls, word clouds, quiz questions, and Q&A — in any order.' },
        { title: 'Start the session', description: 'Audience joins with a 6-digit PIN. Host controls the pace from the main screen.' },
        { title: 'See responses live', description: 'Answers aggregate on the host screen in real time. Audience sees their own view on phones.' },
      ]}
      faqs={[
        {
          question: 'How is this different from Mentimeter?',
          answer: 'Quizotic combines Mentimeter-style interactions (polls, word clouds, Q&A) with Kahoot-style quiz mechanics (leaderboard, speed bonus, streaks). You get both in one tool, free to start.',
        },
        {
          question: 'Can I import my PowerPoint deck?',
          answer: 'Yes. Upload a PPTX or PDF; Quizotic imports each slide as an image. You can then add interactive moments between slides.',
        },
        {
          question: 'Do I need a projector?',
          answer: 'Any main screen works — projector, TV, shared Zoom screen, or your laptop. Audience joins on their own devices.',
        },
        {
          question: 'Is there a free plan?',
          answer: 'Yes. The free plan supports unlimited decks with up to 50 audience members per session.',
        },
        {
          question: 'Can I export the responses?',
          answer: 'Yes. Every session report downloads as XLSX with timestamps, participant-level answers, and aggregate visualisations.',
        },
      ]}
      related={[
        { title: 'Live Quiz', href: '/live-quiz', description: 'Competitive quiz mode with leaderboard and speed bonus.' },
        { title: 'Live Polling', href: '/live-polling', description: 'Instant audience polls with shareable results.' },
        { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate questions from a topic, PDF, or notes.' },
        { title: 'Gamified Learning', href: '/gamified-learning', description: 'Apply gamification to lectures and training.' },
        { title: 'All features', href: '/features', description: 'Full feature list, question types, and session modes.' },
      ]}
      ctaLabel="Build your first interactive deck free →"
    />
  )
}
