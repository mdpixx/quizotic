import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Dashboard',
  // Auth-gated app pages must never appear in search results. robots.txt
  // already disallows /host/, but this is defence-in-depth: if a logged-in
  // user shares a /host/* URL externally, the meta tag still tells crawlers
  // not to index it.
  robots: { index: false, follow: false },
}

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  // Redirect to onboarding if user hasn't completed it
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboarded: true },
    })
    if (user && !user.onboarded) {
      redirect('/auth/onboard')
    }
  }

  return <>{children}</>
}
