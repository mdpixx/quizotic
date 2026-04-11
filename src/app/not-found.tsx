import Link from 'next/link'

export const metadata = { title: 'Page Not Found' }

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
      <div className="max-w-sm w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>Q</div>
          <span className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
            Quizo<span style={{ color: '#F5E642' }}>tic</span>
          </span>
        </div>

        <p className="text-7xl font-black mb-4" style={{ fontFamily: 'var(--font-heading)', color: '#F5E642' }}>404</p>
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
            style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
          >
            Go to Homepage
          </Link>
          <Link
            href="/join"
            className="w-full px-4 py-3 rounded-full text-sm font-bold text-center transition-all hover:opacity-80"
            style={{ background: 'transparent', color: '#F5E642', border: '1.5px solid rgba(245,230,66,0.4)' }}
          >
            Join a Quiz
          </Link>
        </div>
      </div>
    </div>
  )
}
