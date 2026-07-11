import type { Metadata } from 'next'
import Link from 'next/link'
import { PLAN_LIMITS } from '@/lib/limits'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { StickyNav } from '@/components/landing/StickyNav'

export const metadata: Metadata = {
  title: 'Pricing — Free While We Grow',
  description:
    'Quizotic is free today: up to 100 participants per session, AI question generation, live leaderboards, and session reports. A paid plan for heavy users is coming — the free plan stays useful.',
  alternates: { canonical: '/pricing' },
}

const pricingLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Quizotic',
  url: 'https://www.quizotic.live',
  description:
    'Live quiz and interactive presentation platform for schools, colleges, and corporate trainers. Free plan available today; paid plan coming soon.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    description: 'Free plan — no payment required. Paid plan coming soon.',
  },
}

const fmt = (v: number) => (v === Infinity ? 'Unlimited' : String(v))

export default function PricingPage() {
  const f = PLAN_LIMITS.free
  const p = PLAN_LIMITS.pro

  // One list of rows, rendered into both cards so the comparison stays honest
  // and stays in sync with PLAN_LIMITS.
  const rows: { label: string; free: string; paid: string }[] = [
    { label: 'Participants per session', free: `Up to ${f.maxParticipants}`, paid: fmt(p.maxParticipants) },
    { label: 'Saved quizzes', free: fmt(f.maxSavedQuizzes), paid: fmt(p.maxSavedQuizzes) },
    { label: 'Saved presentations', free: fmt(f.maxSavedPresentations), paid: fmt(p.maxSavedPresentations) },
    { label: 'AI-generated questions / month', free: fmt(f.maxAiQuestions), paid: fmt(p.maxAiQuestions) },
    { label: 'Session reports you can revisit', free: `Last ${f.maxSessionHistory}`, paid: `Last ${p.maxSessionHistory}` },
    { label: 'Image uploads / month', free: fmt(f.maxImageUploads), paid: fmt(p.maxImageUploads) },
    { label: 'PDF & CSV report export', free: '—', paid: '✓' },
    { label: 'Spaced retrieval of missed questions', free: '—', paid: '✓' },
    { label: 'Remove Quizotic branding', free: '—', paid: '✓' },
  ]

  const rowStyle = {
    borderBottom: '1px solid #E5E7EB',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingLd) }}
      />
      <StickyNav />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div
          className="max-w-4xl mx-auto px-6 pb-12"
          style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px) + 32px)' }}
        >
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'Pricing', href: '/pricing' },
            ]} />
          </div>

          {/* Seedling hero */}
          <div className="flex flex-col items-center text-center mb-10 pt-4">
            <svg
              width="96"
              height="96"
              viewBox="0 0 96 96"
              fill="none"
              aria-hidden="true"
              className="mb-6"
            >
              {/* Soil */}
              <ellipse cx="48" cy="82" rx="30" ry="7" fill="#8B6340" opacity="0.25" />
              {/* Stem */}
              <path
                d="M48 78 Q48 64 48 50"
                stroke="#3A7D44"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Left leaf */}
              <path
                d="M48 64 Q34 54 28 38 Q42 42 48 56"
                fill="#82C26A"
              />
              {/* Right leaf */}
              <path
                d="M48 54 Q62 44 68 28 Q54 32 48 46"
                fill="#3A7D44"
              />
              {/* Tiny new sprouts at top */}
              <path
                d="M48 50 Q45 42 43 36"
                stroke="#82C26A"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M48 50 Q51 42 53 36"
                stroke="#82C26A"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Tiny leaf buds */}
              <circle cx="43" cy="36" r="3" fill="#82C26A" opacity="0.7" />
              <circle cx="53" cy="36" r="3" fill="#3A7D44" opacity="0.7" />
            </svg>

            <h1
              className="text-4xl font-black mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
            >
              No pricing. Just growing.
            </h1>
            <p className="text-lg" style={{ color: '#6B7280', maxWidth: 560 }}>
              Everything you need to run a real session is free today. A paid plan will come
              later — for the heavy users, not at your expense.
            </p>
          </div>

          {/* Honest story */}
          <div className="space-y-5 text-base leading-relaxed mb-10 mx-auto" style={{ color: '#374151', maxWidth: 680 }}>
            <p>
              If you run sessions for a living — a classroom, an induction batch, a Friday
              training hour — you know the difference between a session that entertains and one
              that sticks. Quizotic is built for the second kind. Live quizzes, AI-generated
              questions, leaderboards, polls, word clouds, and reports that actually tell you
              who understood what: all of it is free right now.
            </p>
            <p>
              One day we&apos;ll add a paid plan for people who need more — longer history,
              report exports, bigger AI allowances. That will pay for the servers. It will not
              shrink the free plan. The limits below only ever move up for you, never down.
            </p>
            <p style={{ color: '#6B7280', fontSize: 15 }}>
              Most tools cap free sessions at 10–50 people, or a single quiz per event. We
              don&apos;t think that&apos;s a real free plan.
            </p>
          </div>

          {/* Free vs Paid comparison */}
          <div className="grid gap-6 sm:grid-cols-2 items-start mb-8">
            {/* Free card */}
            <div
              className="rounded-xl p-6"
              style={{ background: '#FFFFFF', border: '2px solid #0D0D0D', boxShadow: '4px 4px 0 #0D0D0D' }}
            >
              <div className="flex items-center justify-between mb-1">
                <h2
                  className="text-2xl font-black"
                  style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
                >
                  Free
                </h2>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: '#FBD13B', color: '#0D0D0D', border: '1px solid #0D0D0D' }}
                >
                  Available today
                </span>
              </div>
              <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
                Everything to run real sessions, week after week.
              </p>

              <div className="mb-5">
                {rows.map(({ label, free }) => (
                  <div key={label} className="flex justify-between items-baseline gap-3 py-2.5" style={rowStyle}>
                    <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
                    <span
                      className="text-sm font-bold whitespace-nowrap"
                      style={{ color: free === '—' ? '#9CA3AF' : '#0F1B3D' }}
                    >
                      {free}
                    </span>
                  </div>
                ))}
              </div>

              {/* Early Supporter boost */}
              <div
                className="rounded-lg p-4 mb-5"
                style={{ background: '#FFFBEB', border: '1px solid #F59E0B' }}
              >
                <p className="text-xs font-bold mb-1" style={{ color: '#92400E' }}>
                  ⚡ Early Supporter boost
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                  The standard free plan is 50 participants per session. While we grow, every
                  account gets 100 — and accounts created before paid plans launch keep 100
                  for life.
                </p>
              </div>

              <Link
                href="/auth/signin"
                className="block text-center font-bold px-8 py-3 rounded-lg text-sm"
                style={{
                  background: '#FBD13B',
                  color: '#0D0D0D',
                  textDecoration: 'none',
                  border: '2px solid #0D0D0D',
                  boxShadow: '3px 3px 0 #0D0D0D',
                }}
              >
                Start free →
              </Link>
            </div>

            {/* Paid card */}
            <div
              className="rounded-xl p-6"
              style={{ background: '#F9FAFB', border: '2px dashed #9CA3AF' }}
            >
              <div className="flex items-center justify-between mb-1">
                <h2
                  className="text-2xl font-black"
                  style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
                >
                  Paid
                </h2>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: '#0F1B3D', color: '#FBD13B' }}
                >
                  Coming soon
                </span>
              </div>
              <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
                For heavy users and institutions. No price yet — we&apos;ll announce it honestly.
              </p>

              <div className="mb-5">
                {rows.map(({ label, paid }) => (
                  <div key={label} className="flex justify-between items-baseline gap-3 py-2.5" style={rowStyle}>
                    <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
                    <span
                      className="text-sm font-bold whitespace-nowrap"
                      style={{ color: paid === '✓' ? '#16A34A' : '#0F1B3D' }}
                    >
                      {paid}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                Running large classes or team training and missing something? Tell us what your
                team needs —{' '}
                <a
                  href="mailto:info@quizotic.live"
                  style={{ color: '#0F1B3D', fontWeight: 600 }}
                >
                  info@quizotic.live
                </a>
                . It directly shapes what the paid plan becomes.
              </p>
            </div>
          </div>

          {/* Always free strip */}
          <div className="grid gap-3 sm:grid-cols-2 mb-10">
            <div
              className="flex justify-between items-center py-3 px-4 rounded-lg"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="text-sm font-medium" style={{ color: '#374151' }}>
                AI quiz generation
              </span>
              <span className="text-sm font-bold" style={{ color: '#16A34A' }}>
                Included
              </span>
            </div>
            <div
              className="flex justify-between items-center py-3 px-4 rounded-lg"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="text-sm font-medium" style={{ color: '#374151' }}>
                No app install for participants
              </span>
              <span className="text-sm font-bold" style={{ color: '#16A34A' }}>
                Always free
              </span>
            </div>
          </div>

          {/* Our promise */}
          <div
            className="rounded-xl p-6 mb-10 mx-auto"
            style={{ background: '#FFFFFF', border: '2px solid #0F1B3D', maxWidth: 680 }}
          >
            <h2
              className="text-lg font-black mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
            >
              Our promise
            </h2>
            <ul className="space-y-2 text-sm leading-relaxed" style={{ color: '#374151' }}>
              <li>
                <strong>The free plan never shrinks for existing accounts.</strong> What works
                for you today keeps working.
              </li>
              <li>
                <strong>Paid plans add capability — they never take it away.</strong> We fund
                servers by selling more, not by clawing back.
              </li>
              <li>
                <strong>Early accounts keep their boost for life.</strong> Sign up before paid
                plans launch and 100 participants per session stays yours.
              </li>
            </ul>
          </div>

          {/* Help us grow — share */}
          <div className="mb-8">
            <ShareQuizotic context="pricing" />
          </div>

          {/* Feedback CTA */}
          <div
            className="rounded-xl p-8 mb-8 text-center"
            style={{ background: '#0F1B3D' }}
          >
            <h2 className="text-xl font-bold mb-3" style={{ color: '#FBD13B' }}>
              Need more? Tell us.
            </h2>
            <p
              className="text-sm mb-6 leading-relaxed mx-auto"
              style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 480 }}
            >
              We personally read every message. If you&apos;re running large classes, corporate
              training, or hitting a limit that&apos;s blocking you — reach out. We&apos;re
              always listening and working on every suggestion.
            </p>
            <a
              href="mailto:info@quizotic.live"
              className="inline-block text-sm font-bold px-6 py-3 rounded-lg"
              style={{
                background: '#FBD13B',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #FBD13B',
              }}
            >
              info@quizotic.live
            </a>
          </div>

          {/* Start CTA */}
          <div className="text-center">
            <Link
              href="/auth/signin"
              className="inline-block font-bold px-8 py-3 rounded-lg text-sm"
              style={{
                background: '#FBD13B',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #0D0D0D',
                boxShadow: '3px 3px 0 #0D0D0D',
              }}
            >
              Start a free quiz →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
