import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HostNav } from '@/components/HostNav'

export const metadata: Metadata = {
  title: 'Dashboard',
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

  return (
    <>
      <HostNav />
      {children}
    </>
  )
}
