import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { StickyNav } from '@/components/landing/StickyNav'
import { VS } from '@/content/vs'

export const metadata: Metadata = {
  title: 'Quizotic vs Kahoot, Quizizz, Slido & More — Honest Comparisons (2026)',
  description:
    'Side-by-side feature comparisons between Quizotic and the leading quiz and polling platforms — Kahoot, Quizizz, Slido, Mentimeter, AhaSlides. INR pricing, learning science, and low-bandwidth performance.',
  keywords: [
    'quizotic vs kahoot',
    'quizotic vs quizizz',
    'quizotic vs slido',
    'quizotic vs mentimeter',
    'kahoot alternative india',
    'quiz platform comparison india 2026',
  ],
  alternates: { canonical: '/vs' },
  openGraph: {
    title: 'Quizotic vs Kahoot, Quizizz, Slido & More',
    description:
      'Honest head-to-head comparisons. INR pricing, question types, AI generation, and low-bandwidth performance — so you can choose the right platform for your classroom.',
    url: '/vs',
  },
}

const SITE = 'https://www.quizotic.live'

const VS_LIST = Object.entries(VS).map(([slug, c]) => ({
  slug,
  competitor: c.competitor,
  h1: c.h1,
  tagline: c.tagline,
}))

export default function VsIndexPage() {
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Quizotic Comparisons',
    description:
      'Side-by-side comparisons between Quizotic and leading quiz / polling platforms for Indian classrooms.',
    url: `${SITE}/vs`,
    isPartOf: { '@type': 'WebSite', name: 'Quizotic', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: VS_LIST.length,
      itemListElement: VS_LIST.map((v, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/vs/${v.slug}`,
        name: v.h1,
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
              { name: 'Comparisons', href: '/vs' },
            ]} />
          </div>

          <h1
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Quizotic vs the Competition
          </h1>
          <p className="text-base mb-2" style={{ color: '#374151' }}>
            Honest feature-by-feature comparisons between Quizotic and the most popular quiz and polling platforms.
            No hand-waving — just the data you need to choose.
          </p>
          <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
            Every comparison covers pricing (INR vs USD), question types, AI generation, Bloom&apos;s Taxonomy,
            low-bandwidth performance, and honest notes on where each platform leads.
          </p>

          {/* Quick-jump pills */}
          <div className="flex flex-wrap gap-2 mb-12">
            {VS_LIST.map(v => (
              <Link
                key={v.slug}
                href={`/vs/${v.slug}`}
                className="text-sm px-3 py-1 rounded-full"
                style={{ background: '#F3F4F6', color: '#374151', textDecoration: 'none', border: '1px solid #E5E7EB' }}
              >
                vs {v.competitor}
              </Link>
            ))}
            <Link
              href="/alternatives"
              className="text-sm px-3 py-1 rounded-full"
              style={{ background: '#EFF6FF', color: '#1D4ED8', textDecoration: 'none', border: '1px solid #BFDBFE' }}
            >
              Browse alternatives →
            </Link>
          </div>

          <ul className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {VS_LIST.map(v => (
              <li key={v.slug}>
                <Link
                  href={`/vs/${v.slug}`}
                  className="block rounded-xl p-5 transition hover:shadow-md h-full"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', textDecoration: 'none' }}
                >
                  <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                    vs {v.competitor}
                  </div>
                  <h2
                    className="font-bold text-sm mb-2 leading-snug"
                    style={{ color: '#0F1B3D' }}
                  >
                    {v.h1}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    {v.tagline}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-14 rounded-xl p-6" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <h2 className="font-bold text-base mb-2" style={{ color: '#166534' }}>
              Not sure which to pick?
            </h2>
            <p className="text-sm mb-4" style={{ color: '#166534' }}>
              Every comparison has an &quot;Honest Note&quot; section that tells you when the competing platform
              is actually the better choice. We&apos;d rather you choose right than switch twice.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/for/teachers"
                className="text-sm font-medium"
                style={{ color: '#16A34A', textDecoration: 'underline' }}
              >
                For teachers →
              </Link>
              <Link
                href="/for/coaching-institutes"
                className="text-sm font-medium"
                style={{ color: '#16A34A', textDecoration: 'underline' }}
              >
                For coaching institutes →
              </Link>
              <Link
                href="/for/corporate-trainers"
                className="text-sm font-medium"
                style={{ color: '#16A34A', textDecoration: 'underline' }}
              >
                For corporate trainers →
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
