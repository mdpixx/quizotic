import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { RelatedLinks, type RelatedLink } from './RelatedLinks'

export interface ComparisonRow {
  feature: string
  quizotic: string
  competitor: string
  winner?: 'quizotic' | 'competitor' | 'tie'
}

export interface FaqItem {
  question: string
  answer: string
}

export interface ComparisonPageProps {
  kind: 'alternatives' | 'vs'
  slug: string
  competitor: string
  h1: string
  tagline: string
  intro: string
  rows: ComparisonRow[]
  honestNote: string
  faqs: FaqItem[]
  related: RelatedLink[]
  ctaLabel?: string
}

const SITE = 'https://www.quizotic.live'

export function ComparisonPageLayout({
  kind,
  slug,
  competitor,
  h1,
  tagline,
  intro,
  rows,
  honestNote,
  faqs,
  related,
  ctaLabel = 'Try Quizotic free →',
}: ComparisonPageProps) {
  const crumbSection = kind === 'alternatives' ? 'Alternatives' : 'Compare'
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: crumbSection, href: kind === 'alternatives' ? '/alternatives/kahoot' : '/vs/kahoot' },
    { name: h1, href: `/${kind}/${slug}` },
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
    name: `Quizotic — ${competitor} alternative`,
    url: `${SITE}/${kind}/${slug}`,
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
              Quizotic vs {competitor}
            </h2>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#E5E7EB' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th className="px-4 py-3 text-left font-bold" style={{ color: '#0F1B3D' }}>
                      Feature
                    </th>
                    <th className="px-4 py-3 text-left font-bold" style={{ color: '#0F1B3D' }}>
                      Quizotic
                    </th>
                    <th className="px-4 py-3 text-left font-bold" style={{ color: '#0F1B3D' }}>
                      {competitor}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.feature}
                      style={{
                        borderTop: '1px solid #E5E7EB',
                        background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                      }}
                    >
                      <td className="px-4 py-3 font-semibold align-top" style={{ color: '#374151' }}>
                        {row.feature}
                      </td>
                      <td
                        className="px-4 py-3 align-top"
                        style={{
                          color: '#065F46',
                          fontWeight: row.winner === 'quizotic' ? 700 : 400,
                        }}
                      >
                        {row.quizotic}
                      </td>
                      <td
                        className="px-4 py-3 align-top"
                        style={{
                          color: '#4B5563',
                          fontWeight: row.winner === 'competitor' ? 700 : 400,
                        }}
                      >
                        {row.competitor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-14">
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>
              Where {competitor} wins
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
              {honestNote}
            </p>
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
