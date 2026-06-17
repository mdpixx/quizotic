import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import SignInForm from './SignInForm'

interface SignInPageProps {
  searchParams: Promise<{ intent?: string; callbackUrl?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Persistent login: an already-authenticated visitor never needs to re-auth.
  // Send them straight to the host dashboard instead of showing the form again.
  const session = await auth()
  if (session?.user) redirect('/host')

  const { intent, callbackUrl } = await searchParams
  // Only allow same-origin callback URLs to prevent open redirect attacks.
  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/host'
  return (
    <SignInForm
      intent={intent === 'signup' ? 'signup' : 'signin'}
      callbackUrl={safeCallbackUrl}
    />
  )
}
