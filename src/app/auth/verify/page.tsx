export const metadata = { title: 'Check Your Email' }

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#F5E642', border: '2px solid #0D0D0D' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><path d="M3 8l9 6 9-6" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="#0F1B3D" strokeWidth="2"/></svg>
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
          Check your email
        </h1>
        <p className="text-base mb-6" style={{ color: '#94A3B8' }}>
          We sent you a magic link. Click it to sign in to Quizotic.
        </p>
        <a href="/auth/signin" className="text-sm font-semibold" style={{ color: '#F5E642' }}>
          Back to sign in
        </a>
      </div>
    </div>
  )
}
