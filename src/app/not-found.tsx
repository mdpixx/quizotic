import Link from 'next/link'
import { QuizoticLogo } from '@/components/QuizoticLogo'

export const metadata = { title: 'Page Not Found' }

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
      <div className="max-w-sm w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <QuizoticLogo variant="onDark" className="text-xl" markSize={36} />
        </div>

        <p className="text-7xl font-black mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#FBD13B' }}>404</p>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
          Page not found
        </h1>
        <p className="text-base mb-8" style={{ color: '#94A3B8' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full px-4 py-3 rounded-full text-sm font-bold text-center transition-all hover:opacity-90"
            style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
          >
            Go to Homepage
          </Link>
          <Link
            href="/join"
            className="w-full px-4 py-3 rounded-full text-sm font-bold text-center transition-all hover:opacity-80"
            style={{ background: 'transparent', color: '#FBD13B', border: '1.5px solid rgba(251,209,59,0.4)' }}
          >
            Join a Quiz
          </Link>
        </div>
      </div>
    </div>
  )
}
