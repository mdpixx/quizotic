import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { LEARN_ARTICLES, LEARN_CATEGORIES, type LearnArticle, type LearnCategory } from '@/content/learn'

export const metadata: Metadata = {
  title: 'Learn — Live Quiz, Interactive Presentation & Engagement Guides',
  description:
    'Practical guides on running live quizzes, interactive presentations, audience polling, gamification, CBSE/NCERT/JEE/NEET prep, and corporate training. India-first.',
  keywords: [
    'live quiz guide',
    'interactive presentation tutorial',
    'classroom engagement',
    'cbse quiz tips',
    'jee neet prep',
    'corporate training quiz',
  ],
  alternates: { canonical: '/learn' },
  openGraph: {
    title: 'Quizotic Learn — Guides for Teachers, Trainers, and Hosts',
    description:
      'Practical playbooks on live quizzes, interactive presentations, gamification, and India-specific classroom + corporate training.',
    url: '/learn',
  },
}

const SITE = 'https://www.quizotic.live'

function articleListByCategory(): Record<LearnCategory, LearnArticle[]> {
  const grouped: Record<LearnCategory, LearnArticle[]> = {
    'how-to': [],
    comparison: [],
    'cbse-ncert': [],
    'corporate-training': [],
    'hindi-regional': [],
  }
  for (const article of Object.values(LEARN_ARTICLES)) {
    grouped[article.category].push(article)
  }
  return grouped
}

export default function LearnIndexPage() {
  const grouped = articleListByCategory()
  const allArticles = Object.values(LEARN_ARTICLES)

  // CollectionPage JSON-LD
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Quizotic Learn',
    description:
      'Practical guides on running live quizzes, interactive presentations, gamification, CBSE/NCERT/JEE/NEET prep, and corporate training.',
    url: `${SITE}/learn`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Quizotic',
      url: SITE,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: allArticles.length,
      itemListElement: allArticles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/learn/${a.slug}`,
        name: a.h1,
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
              { name: 'Learn', href: '/learn' },
            ]} />
          </div>

          <h1
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Learn
          </h1>
          <p className="text-base mb-6" style={{ color: '#6B7280' }}>
            Practical guides on running live quizzes, interactive presentations, classroom engagement, and India-specific training playbooks.
          </p>

          {/* Popular topics pill bar */}
          <div className="flex flex-wrap gap-2 mb-12">
            {[
              { label: 'Slido alternatives India', href: '/learn/slido-alternatives-india-2026' },
              { label: 'Live quiz in CBSE class', href: '/learn/how-to-run-a-live-quiz-cbse-classroom' },
              { label: 'PDF to quiz guide', href: '/learn/how-to-create-quiz-from-pdf' },
              { label: 'JEE/NEET quiz apps', href: '/learn/best-quiz-app-jee-neet-coaching-institutes' },
              { label: 'Corporate training quizzes', href: '/learn/compliance-training-quiz-tool-india' },
              { label: 'Kahoot pricing vs alternatives', href: '/learn/kahoot-pricing-india-vs-alternatives' },
              { label: 'Interactive presentations', href: '/learn/how-to-make-interactive-presentation' },
              { label: 'CBSE Class 10 quiz bank', href: '/learn/cbse-class-10-free-quiz-questions' },
              { label: 'vs Quizizz', href: '/vs/quizizz' },
              { label: 'vs Slido', href: '/vs/slido' },
              { label: 'vs Kahoot', href: '/vs/kahoot' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm px-3 py-1 rounded-full"
                style={{ background: '#F3F4F6', color: '#374151', textDecoration: 'none', border: '1px solid #E5E7EB' }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {(Object.keys(LEARN_CATEGORIES) as LearnCategory[]).map(cat => {
            const articles = grouped[cat]
            if (articles.length === 0) return null
            const meta = LEARN_CATEGORIES[cat]
            return (
              <section key={cat} id={`category-${cat}`} className="mb-14">
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
                  {articles.map(article => (
                    <li key={article.slug}>
                      <Link
                        href={`/learn/${article.slug}`}
                        className="block rounded-xl p-5 transition hover:shadow-md"
                        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                      >
                        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                          {article.readingMinutes} min read
                        </div>
                        <h3
                          className="font-bold text-sm mb-2 leading-snug"
                          style={{ color: '#0F1B3D' }}
                        >
                          {article.h1}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                          {article.tagline}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
