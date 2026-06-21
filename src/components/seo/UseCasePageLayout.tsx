import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { RelatedLinks, type RelatedLink } from './RelatedLinks'
import { StickyNav } from '@/components/landing/StickyNav'

export interface Scenario {
  title: string
  description: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface UseCasePageProps {
  slug: string
  persona: string
  h1: string
  tagline: string
  intro: string
  scenarios: Scenario[]
  keyFeatures: string[]
  faqs: FaqItem[]
  related: RelatedLink[]
  ctaLabel?: string
}

const SITE = 'https://www.quizotic.live'

export function UseCasePageLayout({
  slug,
  persona,
  h1,
  tagline,
  intro,
  scenarios,
  keyFeatures,
  faqs,
  related,
  ctaLabel = 'Try Quizotic free →',
}: UseCasePageProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'For', href: `/for/${slug}` },
    { name: persona, href: `/for/${slug}` },
  ]

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `Quizotic for ${persona}`,
    url: `${SITE}/for/${slug}`,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: intro,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  }

  return (
    <>
      <JsonLd data={[faqLd, softwareLd]} />
      <StickyNav />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div
          className="max-w-4xl mx-auto px-6 pb-12"
          style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px) + 32px)' }}
        >
          <div className="mb-6">
            <Breadcrumbs items={breadcrumbs} />
          </div>

          <h1
            className="text-3xl font-black mb-2"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            {h1}
          </h1>
          <p className="text-base mb-6" style={{ color: '#6B7280' }}>
            {tagline}
          </p>
          <p className="text-base leading-relaxed mb-10" style={{ color: '#374151' }}>
            {intro}
          </p>

          <section className="mb-14">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              Common scenarios
            </h2>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {scenarios.map(s => (
                <div
                  key={s.title}
                  className="rounded-xl p-5"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <h3 className="font-bold text-sm mb-2" style={{ color: '#0F1B3D' }}>
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-14">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              Features {persona} use most
            </h2>
            <ul className="space-y-2">
              {keyFeatures.map(item => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: '#4B5563' }}
                >
                  <span style={{ color: '#FBD13B', flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-14">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              Frequently asked
            </h2>
            <div className="space-y-4">
              {faqs.map(f => (
                <details
                  key={f.question}
                  className="rounded-xl p-4"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <summary
                    className="font-bold text-sm cursor-pointer"
                    style={{ color: '#0F1B3D' }}
                  >
                    {f.question}
                  </summary>
                  <p className="text-sm leading-relaxed mt-3" style={{ color: '#4B5563' }}>
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <div className="text-center pt-2 mb-14">
            <Link
              href="/auth/signin?intent=signup"
              className="inline-block font-bold px-8 py-3 rounded-lg text-sm"
              style={{
                background: '#FBD13B',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #0D0D0D',
                boxShadow: '3px 3px 0 #0D0D0D',
              }}
            >
              {ctaLabel}
            </Link>
          </div>

          <RelatedLinks links={related} heading="Explore more" />
        </div>
      </div>
    </>
  )
}
