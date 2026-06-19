import type { Metadata } from 'next'
import { SolutionPageLayout } from '@/components/seo/SolutionPageLayout'

export const metadata: Metadata = {
  title: 'Live Polling Tool — Real-Time Audience Polls in Seconds',
  description:
    'Run live polls in lectures, meetings, and events. Single-choice, multi-select, rating scale, word cloud, and ranking. Audience joins with a PIN — no app install, no signup.',
  alternates: { canonical: '/live-polling' },
  keywords: [
    'live polling',
    'live poll tool',
    'online poll tool',
    'audience poll',
    'meeting poll',
    'real time poll',
  ],
}

export default function LivePollingPage() {
  return (
    <SolutionPageLayout
      slug="live-polling"
      h1="Live Polling Tool"
      tagline="Single-choice, multi-select, rating, word cloud, ranking — every polling format in one tool. Audience joins in seconds."
      intro="Quizotic live polling turns any room or virtual meeting into a two-way conversation. Ask a question, display a PIN, and watch answers roll in from every device in the room. Results aggregate live on the host screen. Pick the right format per question — a quick single-choice for a temperature check, a word cloud for brainstorming, a rating scale for feedback, a ranking for prioritisation."
      features={[
        { title: 'Every polling format', description: 'Single-choice, multi-select, rating scale, word cloud, ranking, open text — one tool covers it all.' },
        { title: 'Live aggregation', description: 'Answers update on the host screen as participants submit. Audience sees their own confirmation.' },
        { title: 'No signup for audience', description: 'Audience just enters a 6-digit PIN at quizotic.live/join — works in any browser.' },
        { title: 'Anonymous or named', description: 'Choose per poll: anonymous for sensitive feedback, named for tracking responses.' },
        { title: 'Mix with quiz questions', description: 'Poll for opinions, then quiz for knowledge — in the same session without switching tools.' },
        { title: 'Export to XLSX', description: 'Every poll session exports full participant responses and aggregate results.' },
      ]}
      steps={[
        { title: 'Add poll questions', description: 'Pick the format, write the question, add options if needed.' },
        { title: 'Start the session', description: 'Share the game PIN; audience joins from their phones or laptops.' },
        { title: 'See answers live', description: 'Results visualise on the host screen as they arrive. Export full report after.' },
      ]}
      faqs={[
        {
          question: 'How many people can join a live poll?',
          answer: 'Free plan supports 10 participants per session. Pro extends this to 200, and Team plans scale beyond that for institutes and enterprises.',
        },
        {
          question: 'Can participants stay anonymous?',
          answer: 'Yes. You can run polls in anonymous mode — names are not collected and results aggregate without attribution. Good for feedback and sensitive topics.',
        },
        {
          question: 'Does it work in Zoom / Google Meet / Teams?',
          answer: 'Yes. Share your host screen in the video call; participants join on their phones in a separate tab. No integration needed.',
        },
        {
          question: 'Can I use it for event keynotes?',
          answer: 'Yes. Word clouds and Q&A are popular for keynotes — audience contributes live, speaker highlights the best responses on stage.',
        },
        {
          question: 'Is there a free tier?',
          answer: 'Yes. Free plan covers unlimited sessions with up to 10 participants and all polling formats.',
        },
      ]}
      related={[
        { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Polls mixed with slides and Q&A in one deck.' },
        { title: 'Live Quiz', href: '/live-quiz', description: 'Competitive quiz mode with leaderboard.' },
        { title: 'Gamified Learning', href: '/gamified-learning', description: 'Add game mechanics to polls and quizzes.' },
        { title: 'All features', href: '/features', description: 'Full feature list and question types.' },
        { title: 'Pricing', href: '/pricing', description: 'Plans and participant limits in INR.' },
      ]}
      ctaLabel="Run your first live poll free →"
    />
  )
}
