import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Quizotic to create and host live quizzes and interactive presentations.',
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
