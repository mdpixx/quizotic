import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Host Screen Preview — Quizotic',
  description:
    'A short, interactive preview of the gamified moments hosts see during a live Quizotic session — avatars, podium, countdown, reactions, teams and the audience wave.',
  robots: { index: false, follow: false },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
