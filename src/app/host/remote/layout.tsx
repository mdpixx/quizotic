import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

// The phone remote is account-gated: only the signed-in host can take control
// of a live session (the socket authorises host_join_remote by userId, no PIN).
// Enforce sign-in server-side so the route is never a client-only gate — an
// unauthenticated visitor is bounced to sign-in and returned here afterwards.
export default async function RemoteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/host/remote')
  }
  return <>{children}</>
}
