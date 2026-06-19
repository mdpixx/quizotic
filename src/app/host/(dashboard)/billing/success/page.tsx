'use client'

import Link from 'next/link'

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F8F9FA' }}>
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
          Welcome to Pro!
        </h1>
        <p className="text-base mb-6" style={{ color: '#374151' }}>
          You now have access to all Pro features. Unlimited participants, 30 AI generations per month, CSV export, and more.
        </p>
        <Link
          href="/host"
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: '#FBD13B', color: '#0D0D0D' }}
        >
          Start Creating
        </Link>
      </div>
    </div>
  )
}
