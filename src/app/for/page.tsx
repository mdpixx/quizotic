import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { StickyNav } from '@/components/landing/StickyNav'
import { USE_CASES } from '@/content/for'

export const metadata: Metadata = {
  title: 'Quizotic for Teachers, Schools, Coaching Institutes & More',
  description:
    'Quizotic for every audience: school teachers, coaching institutes, colleges, corporate trainers, and event hosts. NCERT-aligned, INR billing, free tier with 10 participants.',
  keywords: [
    'quiz app for teachers india',
    'quiz platform for coaching institutes',
    'quiz tool for corporate trainers',
    'live quiz for colleges india',
    'free quiz tool for teachers',
    'interactive quiz for schools india',
  ],
  alternates: { canonical: '/for' },
  openGraph: {
    title: 'Quizotic — For Every Audience',
    description:
      'Use-case guides for teachers, schools, coaching institutes, colleges, corporate trainers, and event hosts. Free tier, INR billing, no app required.',
    url: '/for',
  },
}

const SITE = 'https://www.quizotic.live'

const USE_CASE_LIST = Object.entries(USE_CASES).map(([slug, c]) => ({
  slug,
  persona: c.persona,
  h1: c.h1,
  tagline: c.tagline,
}))

export default function ForIndexPage() {
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Quizotic — For Every Audience',
    description:
      'Use-case guides for teachers, schools, coaching institutes, colleges, corporate trainers, and event hosts.',
    url: `${SITE}/for`,
    isPartOf: { '@type': 'WebSite', name: 'Quizotic', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: USE_CASE_LIST.length,
      itemListElement: USE_CASE_LIST.map((u, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/for/${u.slug}`,
        name: u.h1,
      })),
    },
  }

  return (
    <>
      <JsonLd data={collectionLd} />
      <StickyNav />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div
          className="max-w-5xl mx-auto px-6 pb-12"
          style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px) + 32px)' }}
        >
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'For', href: '/for' },
            ]} />
          </div>

          <h1
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Quizotic for Every Audience
          </h1>
          <p className="text-base mb-2" style={{ color: '#374151' }}>
            Whether you&apos;re a school teacher running chapter recaps, a coaching institute doing daily mocks,
            a corporate trainer running compliance sessions, or an event host running a trivia night — Quizotic
            is built for your workflow.
          </p>
          <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
            Free plan · INR billing on Pro (₹499/month) · No app install for participants · Works on classroom Wi-Fi
          </p>

          {/* Quick-jump pills */}
          <div className="flex flex-wrap gap-2 mb-12">
            {USE_CASE_LIST.map(u => (
              <Link
                key={u.slug}
                href={`/for/${u.slug}`}
                className="text-sm px-3 py-1 rounded-full"
                style={{ background: '#F3F4F6', color: '#374151', textDecoration: 'none', border: '1px solid #E5E7EB' }}
              >
                {u.persona}
              </Link>
            ))}
            <Link
              href="/templates"
              className="text-sm px-3 py-1 rounded-full"
              style={{ background: '#EFF6FF', color: '#1D4ED8', textDecoration: 'none', border: '1px solid #BFDBFE' }}
            >
              Browse templates →
            </Link>
          </div>

          <ul className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {USE_CASE_LIST.map(u => (
              <li key={u.slug}>
                <Link
                  href={`/for/${u.slug}`}
                  className="block rounded-xl p-5 transition hover:shadow-md h-full"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', textDecoration: 'none' }}
                >
                  <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                    For {u.persona}
                  </div>
                  <h2
                    className="font-bold text-sm mb-2 leading-snug"
                    style={{ color: '#0F1B3D' }}
                  >
                    {u.h1}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    {u.tagline}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-14 rounded-xl p-6" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <h2 className="font-bold text-base mb-2" style={{ color: '#92400E' }}>
              Not sure where to start?
            </h2>
            <p className="text-sm mb-4" style={{ color: '#92400E' }}>
              The free plan covers unlimited quizzes with up to 10 participants — no credit card needed.
              Most teachers start with the NCERT Quiz Generator.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/ncert-quiz-generator"
                className="text-sm font-medium"
                style={{ color: '#B45309', textDecoration: 'underline' }}
              >
                NCERT Quiz Generator →
              </Link>
              <Link
                href="/ai-quiz-generator"
                className="text-sm font-medium"
                style={{ color: '#B45309', textDecoration: 'underline' }}
              >
                AI Quiz Generator →
              </Link>
              <Link
                href="/templates"
                className="text-sm font-medium"
                style={{ color: '#B45309', textDecoration: 'underline' }}
              >
                Browse 50+ templates →
              </Link>
            </div>
          </div>

          <div className="text-center pt-4 mt-12 mb-14">
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
              Get started free →
            </Link>
            <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
              Free plan. No credit card. UPI billing on Pro.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
