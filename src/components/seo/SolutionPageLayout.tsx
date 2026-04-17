import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { RelatedLinks, type RelatedLink } from './RelatedLinks'

export interface FaqItem {
  question: string
  answer: string
}

export interface SolutionFeature {
  title: string
  description: string
}

export interface SolutionStep {
  title: string
  description: string
}

export interface SolutionPageProps {
  slug: string
  h1: string
  tagline: string
  intro: string
  features: SolutionFeature[]
  steps: SolutionStep[]
  faqs: FaqItem[]
  related: RelatedLink[]
  ctaLabel?: string
}

const SITE = 'https://www.quizotic.live'

export function SolutionPageLayout({
  slug,
  h1,
  tagline,
  intro,
  features,
  steps,
  faqs,
  related,
  ctaLabel = 'Get started free →',
}: SolutionPageProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: h1, href: `/${slug}` },
  ]

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  }

  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `Quizotic — ${h1}`,
    url: `${SITE}/${slug}`,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: intro,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '120',
    },
  }

  return (
    <>
      <JsonLd data={[faqLd, softwareLd]} />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div className="max-w-4xl mx-auto px-6 py-12">
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
              Why Quizotic
            </h2>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {features.map(f => (
                <div
                  key={f.title}
                  className="rounded-xl p-5"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <h3 className="font-bold text-sm mb-2" style={{ color: '#0F1B3D' }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-14">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              How it works
            </h2>
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: '#F5E642', color: '#0D0D0D' }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm mb-1" style={{ color: '#0F1B3D' }}>
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                      {s.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
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
                  <p
                    className="text-sm leading-relaxed mt-3"
                    style={{ color: '#4B5563' }}
                  >
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <div className="text-center pt-2 mb-14">
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
              {ctaLabel}
            </Link>
          </div>

          <RelatedLinks links={related} heading="Explore more" />
        </div>
      </div>
    </>
  )
}
