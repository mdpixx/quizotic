import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { ALTERNATIVES } from '@/content/alternatives'

export const metadata: Metadata = {
  title: 'Kahoot, Quizizz, Slido, Mentimeter Alternatives for India — Quizotic',
  description:
    'Looking for a Kahoot, Quizizz, Slido, Mentimeter, AhaSlides, or Poll Everywhere alternative with INR pricing and UPI? Quizotic is the India-first live quiz and presentation platform — free tier, AI generation, Bloom\'s Taxonomy.',
  keywords: [
    'kahoot alternative india',
    'quizizz alternative india',
    'slido alternative india',
    'mentimeter alternative india',
    'ahaslides alternative india',
    'poll everywhere alternative india',
    'free quiz platform india',
    'quiz tool inr upi',
  ],
  alternates: { canonical: '/alternatives' },
  openGraph: {
    title: 'Alternatives to Kahoot, Quizizz, Slido & More — Quizotic',
    description:
      'India-first alternative to the leading quiz and polling platforms. INR billing, UPI payments, AI quiz generation, Bloom tagging — free tier included.',
    url: '/alternatives',
  },
}

const SITE = 'https://www.quizotic.live'

const ALT_LIST = Object.entries(ALTERNATIVES).map(([slug, c]) => ({
  slug,
  competitor: c.competitor,
  h1: c.h1,
  tagline: c.tagline,
}))

export default function AlternativesIndexPage() {
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Quizotic — Alternatives to Popular Quiz & Polling Platforms',
    description:
      'India-first alternatives to Kahoot, Quizizz, Slido, Mentimeter, AhaSlides, and Poll Everywhere. INR pricing, UPI payments, AI quiz generation.',
    url: `${SITE}/alternatives`,
    isPartOf: { '@type': 'WebSite', name: 'Quizotic', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: ALT_LIST.length,
      itemListElement: ALT_LIST.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/alternatives/${a.slug}`,
        name: a.h1,
      })),
    },
  }

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the best Kahoot alternative for India?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Quizotic is the top Kahoot alternative for India — INR billing, UPI payments (via Razorpay), 11 question types vs Kahoot\'s 4, AI quiz generation included free, and Bloom\'s Taxonomy tagging. The participant page is <100KB, built for 1–2 Mbps classroom connections.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a free Kahoot or Quizizz alternative?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Quizotic\'s free plan includes unlimited live quizzes with up to 10 participants per session, AI quiz generation (30 questions/month), all 11 question types, and full session reports — no credit card required.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the best Slido alternative for Indian trainers?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Quizotic is the leading Slido alternative for India — INR pricing at ₹499/month (vs Slido\'s ~₹1,050+/month in USD), UPI payments, domestic GST invoice, and a participant page 4× lighter than Slido\'s. Includes Q&A, polls, word clouds, and a full competitive quiz engine.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I migrate my quizzes from Kahoot or Quizizz to Quizotic?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Export your Kahoot or Quizizz quiz as Excel/XLSX, then import it into Quizotic. MCQ and True/False questions transfer cleanly. Our guided onboarding helps with the migration.',
        },
      },
    ],
  }

  return (
    <>
      <JsonLd data={collectionLd} />
      <JsonLd data={faqLd} />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'Alternatives', href: '/alternatives' },
            ]} />
          </div>

          <h1
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Alternatives for India
          </h1>
          <p className="text-base mb-2" style={{ color: '#374151' }}>
            The popular quiz and polling platforms were built for Western markets — dollar pricing, no UPI, and no
            Indian curriculum. Quizotic is the India-first alternative to each one.
          </p>
          <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
            Free plan · INR billing on Pro (₹499/month) · UPI &amp; cards via Razorpay · GST invoice · No app install
          </p>

          {/* Quick-jump pills */}
          <div className="flex flex-wrap gap-2 mb-12">
            {ALT_LIST.map(a => (
              <Link
                key={a.slug}
                href={`/alternatives/${a.slug}`}
                className="text-sm px-3 py-1 rounded-full"
                style={{ background: '#F3F4F6', color: '#374151', textDecoration: 'none', border: '1px solid #E5E7EB' }}
              >
                {a.competitor} alternative
              </Link>
            ))}
            <Link
              href="/vs"
              className="text-sm px-3 py-1 rounded-full"
              style={{ background: '#EFF6FF', color: '#1D4ED8', textDecoration: 'none', border: '1px solid #BFDBFE' }}
            >
              Side-by-side comparisons →
            </Link>
          </div>

          <ul className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {ALT_LIST.map(a => (
              <li key={a.slug}>
                <Link
                  href={`/alternatives/${a.slug}`}
                  className="block rounded-xl p-5 transition hover:shadow-md h-full"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', textDecoration: 'none' }}
                >
                  <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                    {a.competitor} alternative
                  </div>
                  <h2
                    className="font-bold text-sm mb-2 leading-snug"
                    style={{ color: '#0F1B3D' }}
                  >
                    {a.h1}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    {a.tagline}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* FAQ */}
          <section className="mt-14 mb-8">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#0F1B3D' }}>
              Frequently asked
            </h2>
            <div className="space-y-3">
              {[
                {
                  q: 'What is the best Kahoot alternative for India?',
                  a: "Quizotic — INR billing, UPI payments, 11 question types (vs Kahoot's 4), AI quiz generation included free, and Bloom's Taxonomy tagging. The participant page is <100KB, built for 1–2 Mbps classroom connections.",
                },
                {
                  q: 'Is there a free Kahoot or Quizizz alternative?',
                  a: "Yes. Quizotic's free plan includes unlimited live quizzes with up to 10 participants per session, AI quiz generation (30 questions/month), all 11 question types, and full session reports — no credit card required.",
                },
                {
                  q: 'What is the best Slido alternative for Indian trainers?',
                  a: 'Quizotic — INR pricing at ₹499/month (vs Slido\'s ~₹1,050+/month in USD), UPI payments, domestic GST invoice, and a participant page 4× lighter than Slido\'s. Includes Q&A, polls, word clouds, and a full competitive quiz engine.',
                },
                {
                  q: 'Can I migrate my quizzes from Kahoot or Quizizz to Quizotic?',
                  a: 'Yes. Export your Kahoot or Quizizz quiz as Excel/XLSX, then import into Quizotic. MCQ and True/False questions transfer cleanly. Our guided onboarding helps with the rest.',
                },
              ].map(item => (
                <details
                  key={item.q}
                  className="rounded-xl p-4"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <summary className="font-bold text-sm cursor-pointer" style={{ color: '#0F1B3D' }}>
                    {item.q}
                  </summary>
                  <p className="text-sm leading-relaxed mt-3" style={{ color: '#4B5563' }}>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <div className="text-center pt-4 mt-8 mb-14">
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
              Try Quizotic free →
            </Link>
            <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
              Free plan. No credit card. INR billing on Pro.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
