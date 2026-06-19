import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'Gamified Learning Platform — Built on Learning Science',
  description:
    'Turn lectures and trainings into gamified learning experiences. Speed bonus, streaks, leaderboards, and spaced-retrieval review — grounded in Bloom\'s Taxonomy and the Confidence Grid.',
  alternates: { canonical: '/gamified-learning' },
  keywords: [
    'gamified learning',
    'gamification education',
    'game based learning',
    'gamified training',
    'gamification platform india',
  ],
}

export default function GamifiedLearningPage() {
  return (
    <SolutionPageLayout
      slug="gamified-learning"
      h1="Gamified Learning Platform"
      tagline="Bring the game layer to your classroom or training floor — without losing the learning science underneath."
      intro="Gamification works when it supports learning, not when it distracts from it. Quizotic adds speed bonus, streak multipliers, leaderboards, and power-ups on top of a learning-science foundation — Bloom's Taxonomy for depth, Confidence Grid for metacognition, and spaced-retrieval for long-term recall. Your sessions feel like a game; your reports show the cognitive work that actually happened."
      features={[
        { title: 'Speed bonus & streaks', description: 'Correct-and-fast earns bonus points. Three in a row triggers a streak multiplier.' },
        { title: 'Live leaderboard', description: 'Real-time ranking keeps the room engaged. Hide the leaderboard for reflection sessions.' },
        { title: 'Confidence Grid', description: 'After each answer, participants rate their confidence. Reports surface Hubris and Imposter cohorts.' },
        { title: 'Spaced-retrieval review', description: 'Missed questions queue for review at 1, 3, 7, 14-day intervals — evidence-based spacing.' },
        { title: 'Bloom-tagged questions', description: 'Every question is tagged to a Bloom level; reports show depth coverage per session.' },
        { title: 'Team mode', description: 'Split the room into teams for collaborative gameplay. Points aggregate in real time.' },
      ]}
      steps={[
        { title: 'Design a gamified session', description: 'Pick competitive mode, set timers, enable streaks and power-ups.' },
        { title: 'Launch and host', description: 'Start the game; participants join on phones. Hosts control pacing and reveal answers.' },
        { title: 'Review learning outcomes', description: 'See the Bloom distribution, Confidence Grid, and who needs spaced-review follow-up.' },
      ]}
      faqs={[
        {
          question: 'Is gamified learning actually effective?',
          answer: 'Evidence-based gamification — speed, feedback, and spaced retrieval — consistently improves retention over passive review. Quizotic implements the mechanisms that research backs, not just surface-level game elements.',
        },
        {
          question: 'What is the Confidence Grid?',
          answer: 'After each answer, participants report confidence (High / Low). The report plots Correct-vs-Confident on a 2×2 grid, flagging "Hubris" (confident but wrong) and "Imposter" (correct but unsure) cohorts for targeted follow-up.',
        },
        {
          question: 'Can I turn off gamification for serious assessments?',
          answer: 'Yes. Assessment mode hides the leaderboard, removes timer pressure, and produces a formal PDF report. Switch modes without recreating the quiz.',
        },
        {
          question: 'Does it work for corporate training?',
          answer: 'Yes. Corporate trainers use Quizotic for onboarding quizzes, compliance refreshers, and sales enablement — gamified when engagement is the goal, formal when assessment is.',
        },
        {
          question: 'What is spaced-retrieval review?',
          answer: 'Missed questions automatically queue for a short review session at expanding intervals — 1 day, 3 days, 7 days, 14 days. This leverages the spacing effect to move knowledge into long-term memory.',
        },
      ]}
      related={[
        { title: 'Live Quiz', href: '/live-quiz', description: 'Competitive live multiplayer quiz mode.' },
        { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Add gamified moments to your slide deck.' },
        { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate Bloom-tagged questions from your content.' },
        { title: 'All features', href: '/features', description: 'Full list of question types, modes, and reports.' },
        { title: 'Pricing', href: '/pricing', description: 'Free to start — simple plans as we grow.' },
      ]}
      ctaLabel="Try gamified learning free →"
    />
  )
}
