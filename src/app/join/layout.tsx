import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join a Live Quiz',
  description: 'Enter a game code to join a live quiz or interactive presentation on Quizotic.',
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children
}
