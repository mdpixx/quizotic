import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Quizotic terms of service — rules and conditions for using the platform.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen" style={{ background: '#FFFBF5' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm font-semibold mb-6 inline-block" style={{ color: '#4361EE' }}>
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
          Terms of Service
        </h1>
        <p className="text-sm mb-8" style={{ color: '#6B7280' }}>Last updated: April 2026</p>

        <div className="space-y-8 text-base leading-relaxed" style={{ color: '#374151' }}>
          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>1. Acceptance of Terms</h2>
            <p>By accessing or using Quizotic (quizotic.live), you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>2. Description of Service</h2>
            <p>Quizotic is a web-based platform for creating and hosting live interactive quizzes and presentations. The service includes a free tier and paid Pro plans with additional features.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>3. User Accounts</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must provide accurate information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account.</li>
              <li>Hosts must be 18 years or older (or have parental consent).</li>
              <li>Participants do not need accounts — they join via game codes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the platform for any unlawful purpose</li>
              <li>Upload offensive, harmful, or misleading content</li>
              <li>Attempt to access other users&apos; accounts or data</li>
              <li>Interfere with or disrupt the platform&apos;s infrastructure</li>
              <li>Scrape or extract data from the platform programmatically</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>5. Content Ownership</h2>
            <p>You retain ownership of quizzes, presentations, and content you create on Quizotic. By using the platform, you grant us a limited licence to store, display, and process your content solely for the purpose of providing the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>6. AI-Generated Content</h2>
            <p>Quizotic offers AI-powered quiz generation. AI-generated content is provided &ldquo;as-is&rdquo; and may contain errors. Hosts are responsible for reviewing and editing AI-generated questions before using them in sessions.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>7. Billing & Subscriptions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pro subscriptions are billed in Indian Rupees (INR) via Razorpay.</li>
              <li>GST (18%) is applicable for Indian customers as per government regulations.</li>
              <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
              <li>Refunds are handled on a case-by-case basis within 7 days of purchase.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>8. Limitation of Liability</h2>
            <p>Quizotic is provided &ldquo;as-is&rdquo; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform, including data loss or service interruptions.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>9. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting <a href="mailto:info@quizotic.live" style={{ color: '#4361EE' }}>info@quizotic.live</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>10. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#1B2559' }}>11. Contact</h2>
            <p>For questions about these terms, email <a href="mailto:info@quizotic.live" style={{ color: '#4361EE' }}>info@quizotic.live</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
