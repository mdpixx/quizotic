export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FFFBF5' }}>
      <div className="max-w-sm w-full text-center">
        <div className="text-4xl mb-4">📧</div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
          Check your email
        </h1>
        <p className="text-base mb-6" style={{ color: '#4A5568' }}>
          We sent you a magic link. Click it to sign in to Quizotic.
        </p>
        <a href="/auth/signin" className="text-sm font-semibold" style={{ color: '#4361EE' }}>
          Back to sign in
        </a>
      </div>
    </div>
  )
}
