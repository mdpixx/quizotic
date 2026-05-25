import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-3">You&apos;re offline</h1>
      <p className="max-w-md text-base opacity-80">
        Quizotic needs a connection for live quizzes and presentations.
        Reconnect to the internet and try again.
      </p>
    </main>
  )
}
