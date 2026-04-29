import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import {
  TEMPLATES,
  TEMPLATE_AUDIENCES,
  TEMPLATE_GRADES,
  type QuizTemplate,
  type TemplateAudience,
} from '@/content/templates'

export const metadata: Metadata = {
  title: 'Quiz Templates Gallery — Free CBSE, NCERT, JEE, NEET, Corporate Quiz Packs',
  description:
    'Browse 50+ free quiz templates — CBSE Class 6–12, JEE/NEET drills, UPSC current affairs, corporate onboarding, POSH compliance, trivia. One-click import to Quizotic.',
  keywords: [
    'free quiz templates',
    'cbse quiz pack',
    'ncert quiz library',
    'jee neet quiz pack',
    'corporate quiz template',
    'free quiz library india',
  ],
  alternates: { canonical: '/templates' },
  openGraph: {
    title: 'Quizotic Templates — Free CBSE, JEE/NEET, Corporate Quiz Packs',
    description:
      '50+ free quiz templates ready to launch. CBSE, NCERT, JEE/NEET, UPSC, corporate training, trivia. INR billing.',
    url: '/templates',
  },
}

const SITE = 'https://www.quizotic.live'

function templatesByAudience(): Record<TemplateAudience, QuizTemplate[]> {
  const grouped: Record<TemplateAudience, QuizTemplate[]> = {
    'school-teachers': [],
    'coaching-institutes': [],
    'corporate-trainers': [],
    'event-hosts': [],
    colleges: [],
  }
  for (const template of Object.values(TEMPLATES)) {
    grouped[template.audience].push(template)
  }
  return grouped
}

export default function TemplatesIndexPage() {
  const grouped = templatesByAudience()
  const all = Object.values(TEMPLATES)

  // CollectionPage JSON-LD
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Quizotic Templates Gallery',
    description: 'Free quiz templates for Indian schools, coaching institutes, corporate training, colleges, and event hosts.',
    url: `${SITE}/templates`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Quizotic',
      url: SITE,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: all.length,
      itemListElement: all.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/templates/${t.slug}`,
        name: t.title,
      })),
    },
  }

  return (
    <>
      <JsonLd data={collectionLd} />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'Templates', href: '/templates' },
            ]} />
          </div>

          <h1
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Templates Gallery
          </h1>
          <p className="text-base mb-12" style={{ color: '#6B7280' }}>
            {all.length} free quiz templates — ready to import and launch as a live session. CBSE, NCERT, JEE/NEET, UPSC, corporate training, trivia, and more.
          </p>

          {(Object.keys(TEMPLATE_AUDIENCES) as TemplateAudience[]).map(audience => {
            const list = grouped[audience]
            if (list.length === 0) return null
            const meta = TEMPLATE_AUDIENCES[audience]
            return (
              <section key={audience} className="mb-14">
                <h2 className="text-xl md:text-2xl font-bold mb-2" style={{ color: '#0F1B3D' }}>
                  {meta.label}
                </h2>
                <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
                  {meta.description}
                </p>
                <ul
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                >
                  {list.map(t => (
                    <li key={t.slug}>
                      <Link
                        href={`/templates/${t.slug}`}
                        className="block rounded-xl p-5 transition hover:shadow-md h-full"
                        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                      >
                        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                          {TEMPLATE_GRADES[t.grade]} · {t.totalQuestions} Qs · {t.durationMinutes} min
                        </div>
                        <h3
                          className="font-bold text-sm mb-2 leading-snug"
                          style={{ color: '#0F1B3D' }}
                        >
                          {t.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                          {t.shortDescription}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          <div className="text-center pt-4 mt-8 mb-14">
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
              Sign in & start using templates →
            </Link>
            <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
              Free account. UPI billing on Pro.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
