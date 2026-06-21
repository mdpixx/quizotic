import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { RelatedLinks } from './RelatedLinks'
import { StickyNav } from '@/components/landing/StickyNav'
import {
  type QuizTemplate,
  TEMPLATE_AUDIENCES,
  TEMPLATE_GRADES,
} from '@/content/templates'

const SITE = 'https://www.quizotic.live'

interface TemplatePageLayoutProps {
  template: QuizTemplate
}

export function TemplatePageLayout({ template }: TemplatePageLayoutProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Templates', href: '/templates' },
    { name: TEMPLATE_AUDIENCES[template.audience].label, href: `/templates#audience-${template.audience}` },
    { name: template.title, href: `/templates/${template.slug}` },
  ]

  // Quiz JSON-LD (schema.org/Quiz is supported by Google Rich Results)
  const quizLd = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: template.title,
    description: template.metaDescription,
    educationalAlignment: {
      '@type': 'AlignmentObject',
      alignmentType: 'educationalSubject',
      targetName: template.subject,
    },
    educationalLevel: TEMPLATE_GRADES[template.grade],
    numberOfQuestions: template.totalQuestions,
    timeRequired: `PT${template.durationMinutes}M`,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      name: 'Quizotic',
      url: SITE,
    },
    isPartOf: {
      '@type': 'CreativeWorkSeries',
      name: 'Quizotic Templates',
      url: `${SITE}/templates`,
    },
    url: `${SITE}/templates/${template.slug}`,
    datePublished: template.publishedAt,
  }

  // CreativeWork JSON-LD as backup (broader compatibility)
  const creativeWorkLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: template.title,
    description: template.longDescription,
    keywords: template.tags.join(', '),
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: TEMPLATE_AUDIENCES[template.audience].label,
    },
    learningResourceType: 'Quiz',
    educationalLevel: TEMPLATE_GRADES[template.grade],
    url: `${SITE}/templates/${template.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'Quizotic',
      url: SITE,
    },
  }

  // LearningResource — what AI engines extract for "quiz on X for grade Y"
  const learningResourceLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: template.title,
    description: template.shortDescription,
    educationalLevel: TEMPLATE_GRADES[template.grade],
    learningResourceType: 'Quiz',
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: TEMPLATE_AUDIENCES[template.audience].label,
    },
    teaches: template.subject,
    numberOfQuestions: template.totalQuestions,
    timeRequired: `PT${template.durationMinutes}M`,
    inLanguage: 'en-IN',
    url: `${SITE}/templates/${template.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'Quizotic',
      url: SITE,
    },
  }

  const importHref = `/auth/signin?next=${encodeURIComponent(`/host/build?template=${template.slug}`)}`

  return (
    <>
      <JsonLd data={[quizLd, creativeWorkLd, learningResourceLd]} />
      <StickyNav />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div
          className="max-w-4xl mx-auto px-6 pb-12"
          style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px) + 32px)' }}
        >
          <div className="mb-6">
            <Breadcrumbs items={breadcrumbs} />
          </div>

          {/* Header */}
          <header className="mb-8">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#6B7280' }}>
              {TEMPLATE_AUDIENCES[template.audience].label} ·{' '}
              {TEMPLATE_GRADES[template.grade]} · {template.subject}
            </div>
            <h1
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D', lineHeight: 1.15 }}
            >
              {template.title}
            </h1>
            <p className="text-base md:text-lg" style={{ color: '#6B7280' }}>
              {template.shortDescription}
            </p>
          </header>

          {/* Stats strip */}
          <section
            className="mb-10 rounded-xl p-5"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <dl
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            >
              <div>
                <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
                  Questions
                </dt>
                <dd className="text-xl font-bold" style={{ color: '#0F1B3D' }}>
                  {template.totalQuestions}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
                  Duration
                </dt>
                <dd className="text-xl font-bold" style={{ color: '#0F1B3D' }}>
                  {template.durationMinutes} min
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
                  Difficulty
                </dt>
                <dd className="text-xl font-bold capitalize" style={{ color: '#0F1B3D' }}>
                  {template.difficulty}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>
                  Bloom mix
                </dt>
                <dd className="text-sm font-medium" style={{ color: '#374151' }}>
                  {template.bloomMix}
                </dd>
              </div>
            </dl>
          </section>

          {/* Primary CTA */}
          <div className="mb-10 text-center">
            <Link
              href={importHref}
              className="inline-block font-bold px-10 py-4 rounded-lg text-base"
              style={{
                background: '#FBD13B',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #0D0D0D',
                boxShadow: '4px 4px 0 #0D0D0D',
              }}
            >
              {template.cta} →
            </Link>
            <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
              Free to import. Edit, then launch as a live quiz with a 6-digit PIN.
            </p>
          </div>

          {/* Long description */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#0F1B3D' }}>
              About this template
            </h2>
            <p className="text-base leading-relaxed" style={{ color: '#374151' }}>
              {template.longDescription}
            </p>
          </section>

          {/* Sample questions */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              Sample questions ({template.sampleQuestions.length} of {template.totalQuestions})
            </h2>
            <ol className="space-y-4">
              {template.sampleQuestions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-xl p-5"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ background: '#0F1B3D', color: '#FBD13B' }}
                    >
                      {i + 1}
                    </div>
                    <h3 className="font-medium text-sm leading-relaxed" style={{ color: '#0F1B3D' }}>
                      {q.question}
                    </h3>
                  </div>
                  <ul className="space-y-1 mb-3 ml-10">
                    {q.options.map((opt, j) => {
                      const isAnswer = j === q.answerIndex
                      return (
                        <li
                          key={j}
                          className="text-sm"
                          style={{
                            color: isAnswer ? '#15803D' : '#4B5563',
                            fontWeight: isAnswer ? 600 : 400,
                          }}
                        >
                          {String.fromCharCode(65 + j)}. {opt}
                          {isAnswer && (
                            <span className="ml-2 text-xs uppercase tracking-wider" style={{ color: '#15803D' }}>
                              ✓ Correct
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {q.explanation && (
                    <p className="text-xs ml-10 leading-relaxed" style={{ color: '#6B7280' }}>
                      <strong>Explanation:</strong> {q.explanation}
                    </p>
                  )}
                  {q.bloom && (
                    <div className="ml-10 mt-2">
                      <span
                        className="inline-block text-xs uppercase tracking-wider px-2 py-1 rounded"
                        style={{ background: '#FEF3C7', color: '#92400E' }}
                      >
                        Bloom: {q.bloom}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* Tags */}
          {template.tags.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#6B7280' }}>
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {template.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ background: '#F3F4F6', color: '#4B5563' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Secondary CTA */}
          <div className="text-center pt-4 mb-14">
            <Link
              href={importHref}
              className="inline-block font-bold px-8 py-3 rounded-lg text-sm"
              style={{
                background: '#0F1B3D',
                color: '#FFFFFF',
                textDecoration: 'none',
                border: '2px solid #0D0D0D',
              }}
            >
              {template.cta} →
            </Link>
            <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
              Free up to 50 participants. INR billing on Pro.
            </p>
          </div>

          <RelatedLinks links={template.related} heading="Related" />
        </div>
      </div>
    </>
  )
}
