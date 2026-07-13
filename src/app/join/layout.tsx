import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join a Live Quiz',
  description: 'Enter a session code to join a live quiz or interactive presentation on Quizotic.',
  alternates: { canonical: '/join' },
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children
}
