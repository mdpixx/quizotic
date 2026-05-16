import type { Metadata } from 'next'
import Link from 'next/link'
import { PLAN_LIMITS } from '@/lib/limits'
import { ShareQuizotic } from '@/components/ShareQuizotic'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Pricing — Free While We Grow',
  description:
    'Quizotic is completely free to use. No payment required. India-first learning platform making interactive quizzes accessible to every classroom and training room.',
  alternates: { canonical: '/pricing' },
}

const pricingLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Quizotic',
  url: 'https://www.quizotic.live',
  description:
    'Free live quiz and interactive presentation platform for Indian schools, colleges, and corporate trainers.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
    availability: 'https://schema.org/InStock',
    description: 'Free to use — no payment required',
  },
}

export default function PricingPage() {
  const f = PLAN_LIMITS.free

  const limits = [
    { label: 'Participants per session', value: `Up to ${f.maxParticipants}` },
    { label: 'Saved quizzes', value: `${f.maxSavedQuizzes} quizzes` },
    { label: 'Saved presentations', value: `${f.maxSavedPresentations} presentations` },
    { label: 'AI-generated questions / month', value: `${f.maxAiQuestions} questions` },
    { label: 'Session history', value: `Last ${f.maxSessionHistory} sessions` },
    { label: 'Image uploads / month', value: `${f.maxImageUploads} images` },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingLd) }}
      />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'Pricing', href: '/pricing' },
            ]} />
          </div>

          {/* Seedling hero */}
          <div className="flex flex-col items-center text-center mb-12 pt-4">
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
            <p className="text-lg" style={{ color: '#6B7280' }}>
              We&apos;re a small team making learning scientific and fun.
            </p>
          </div>

          {/* Honest story */}
          <div className="space-y-5 text-base leading-relaxed mb-12" style={{ color: '#374151' }}>
            <p>
              Quizotic started with a simple belief: every teacher, trainer, and educator deserves
              tools that make learning stick — not just tools that make slides pretty.
            </p>
            <p>
              Right now, we&apos;re not charging anything. This is a deliberate choice. We want
              Quizotic in as many classrooms and training halls as possible before we figure out
              the business side. Consider it our small gesture of learning enablement.
            </p>
            <p>
              There are limits — because servers, AI APIs, and bandwidth cost real money. But
              within those limits, everything works fully: live quizzes, interactive presentations,
              AI generation, real-time leaderboards, word clouds, polls, drawing, and more.
            </p>
            <p>
              As our user base grows and we hear what you need, we&apos;ll expand. Your feedback
              directly shapes what gets unlocked next.
            </p>
          </div>

          {/* What you get today */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              What you get today — completely free
            </h2>
            <div className="grid gap-3">
              {limits.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-3 px-4 rounded-lg"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <span className="text-sm font-medium" style={{ color: '#374151' }}>
                    {label}
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                    {value}
                  </span>
                </div>
              ))}
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
            <h2 className="text-xl font-bold mb-3" style={{ color: '#F5E642' }}>
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
                background: '#F5E642',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #F5E642',
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
                background: '#F5E642',
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
