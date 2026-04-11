import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Quizotic privacy policy — how we collect, use, and protect your data.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm font-semibold mb-6 inline-block" style={{ color: '#0F1B3D' }}>
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
          Privacy Policy
        </h1>
        <p className="text-sm mb-8" style={{ color: '#6B7280' }}>Last updated: April 2026</p>

        <div className="space-y-8 text-base leading-relaxed" style={{ color: '#374151' }}>
          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>1. Information We Collect</h2>
            <p className="mb-3"><strong>Account Information:</strong> When you sign in via Google OAuth or email magic link, we store your name, email address, and profile picture (if provided by Google). We do not store passwords.</p>
            <p className="mb-3"><strong>Quiz & Presentation Data:</strong> Quizzes and presentations you create are stored in our database (PostgreSQL on Railway) and locally in your browser. Session data (scores, responses) is stored for analytics purposes.</p>
            <p><strong>Participant Data:</strong> Participants who join sessions provide only a display name. No account creation is required. We do not collect personal data from participants beyond what they voluntarily enter.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and improve the Quizotic platform</li>
              <li>To generate session reports and analytics for hosts</li>
              <li>To manage your subscription and billing (when applicable)</li>
              <li>To send transactional emails (magic link sign-in, subscription updates)</li>
              <li>To understand usage patterns via PostHog analytics (anonymised)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>3. Data Storage & Security</h2>
            <p className="mb-3">Your data is stored in encrypted databases hosted on Railway (cloud infrastructure). Authentication is handled via NextAuth.js with industry-standard OAuth 2.0 protocols.</p>
            <p>We do not store payment card details. All payment processing is handled by Razorpay, which is PCI-DSS compliant.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>4. Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Google OAuth</strong> — for authentication</li>
              <li><strong>Gmail API</strong> — for sending magic link emails</li>
              <li><strong>PostHog (EU)</strong> — for privacy-friendly product analytics</li>
              <li><strong>Razorpay</strong> — for payment processing (INR)</li>
              <li><strong>Cloudflare</strong> — for CDN and image delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>5. Data Retention</h2>
            <p>Account data is retained as long as your account is active. Session data is retained for up to 12 months. You can request deletion of your account and all associated data by emailing <a href="mailto:info@quizotic.live" style={{ color: '#0F1B3D' }}>info@quizotic.live</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:info@quizotic.live" style={{ color: '#0F1B3D' }}>info@quizotic.live</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>7. Contact</h2>
            <p>For privacy-related questions, email us at <a href="mailto:info@quizotic.live" style={{ color: '#0F1B3D' }}>info@quizotic.live</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
