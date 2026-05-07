import { Metadata } from 'next'

// onboard/page.tsx is 'use client', so client-side metadata exports don't
// work — wrapping in a server-component layout is the App Router pattern
// for declaring metadata on a client page.
export const metadata: Metadata = {
  title: 'Welcome',
  robots: { index: false, follow: false },
}

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
