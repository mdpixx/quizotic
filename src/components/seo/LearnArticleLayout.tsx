import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { RelatedLinks } from './RelatedLinks'
import { NextSteps } from './NextSteps'
import type { LearnArticle } from '@/content/learn'
import { LEARN_CATEGORIES } from '@/content/learn'

const SITE = 'https://www.quizotic.live'

const CATEGORY_NEXT_STEPS: Record<string, {
  read: { title: string; description: string; href: string }
  compare: { title: string; description: string; href: string }
  template: { title: string; description: string; href: string }
}> = {
  'how-to': {
    read: { title: 'Interactive Presentation Guide', href: '/learn/how-to-make-interactive-presentation', description: 'Make any deck interactive with live polls and quizzes.' },
    compare: { title: 'vs Kahoot', href: '/vs/kahoot', description: 'Quizotic vs Kahoot — feature comparison.' },
    template: { title: 'All Templates', href: '/templates', description: 'Browse 50+ free quiz templates.' },
  },
  comparison: {
    read: { title: 'Slido Alternatives India 2026', href: '/learn/slido-alternatives-india-2026', description: 'Ranked comparison of Slido alternatives for Indian teams.' },
    compare: { title: 'vs Kahoot', href: '/vs/kahoot', description: 'Quizotic vs Kahoot — feature comparison.' },
    template: { title: 'All Templates', href: '/templates', description: 'Browse 50+ free quiz templates.' },
  },
  'cbse-ncert': {
    read: { title: 'CBSE Class 10 Quiz Questions', href: '/learn/cbse-class-10-free-quiz-questions', description: 'Free CBSE Class 10 quiz questions for teachers.' },
    compare: { title: 'vs Quizizz', href: '/vs/quizizz', description: 'Quizotic vs Quizizz — which fits Indian schools?' },
    template: { title: 'School Teacher Templates', href: '/templates#audience-school-teachers', description: 'Free CBSE/NCERT quiz templates for school teachers.' },
  },
  'corporate-training': {
    read: { title: 'Compliance Training Quiz Guide', href: '/learn/compliance-training-quiz-tool-india', description: 'Running effective compliance quizzes in India.' },
    compare: { title: 'vs Slido', href: '/vs/slido', description: 'Quizotic vs Slido — which is better for corporate training?' },
    template: { title: 'Corporate Training Templates', href: '/templates#audience-corporate-trainers', description: 'POSH, onboarding, cybersecurity quiz templates.' },
  },
  'hindi-regional': {
    read: { title: 'CBSE Live Quiz Guide', href: '/learn/how-to-run-a-live-quiz-cbse-classroom', description: 'Running live quizzes in Indian classrooms.' },
    compare: { title: 'vs Quizizz', href: '/vs/quizizz', description: 'Quizotic vs Quizizz — which fits Indian schools?' },
    template: { title: 'School Teacher Templates', href: '/templates#audience-school-teachers', description: 'Free CBSE/NCERT quiz templates for school teachers.' },
  },
}

interface LearnArticleLayoutProps {
  article: LearnArticle
}

export function LearnArticleLayout({ article }: LearnArticleLayoutProps) {
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    { name: 'Learn', href: '/learn' },
    { name: LEARN_CATEGORIES[article.category].label, href: `/learn#category-${article.category}` },
    { name: article.h1, href: `/learn/${article.slug}` },
  ]

  // FAQPage JSON-LD
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  // Article JSON-LD
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.h1,
    description: article.metaDescription,
    image: `${SITE}/og-image.png`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: 'Quizotic',
      url: SITE,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Quizotic',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE}/icon.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE}/learn/${article.slug}`,
    },
    keywords: article.keywords.join(', '),
    timeRequired: `PT${article.readingMinutes}M`,
  }

  // HowTo JSON-LD (only if howToSteps present)
  const howToLd = article.howToSteps
    ? {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: article.h1,
        description: article.metaDescription,
        step: article.howToSteps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      }
    : null

  const jsonLdBlocks: Record<string, unknown>[] = [faqLd, articleLd]
  if (howToLd) jsonLdBlocks.push(howToLd)

  return (
    <>
      <JsonLd data={jsonLdBlocks} />
      <article className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-6">
            <Breadcrumbs items={breadcrumbs} />
          </div>

          <header className="mb-10">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#6B7280' }}>
              {LEARN_CATEGORIES[article.category].label} · {article.readingMinutes} min read
            </div>
            <h1
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D', lineHeight: 1.15 }}
            >
              {article.h1}
            </h1>
            <p className="text-base md:text-lg" style={{ color: '#6B7280' }}>
              {article.tagline}
            </p>
          </header>

          {/* TL;DR — LLM-friendly extraction surface */}
          <section
            className="mb-10 rounded-xl p-5"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#92400E' }}>
              TL;DR
            </h2>
            <ul className="space-y-2">
              {article.tldr.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                  <span style={{ color: '#F5E642', flexShrink: 0, fontWeight: 700 }}>•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Intro */}
          <p className="text-base leading-relaxed mb-10" style={{ color: '#374151' }}>
            {article.intro}
          </p>

          {/* Sections */}
          {article.sections.map(section => (
            <section key={section.heading} className="mb-10">
              <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: '#0F1B3D' }}>
                {section.heading}
              </h2>
              <p className="text-base leading-relaxed" style={{ color: '#374151' }}>
                {section.body}
              </p>
            </section>
          ))}

          {/* HowTo Steps (if present, render as ordered list for visual + duplicate of structured data) */}
          {article.howToSteps && (
            <section className="mb-10">
              <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: '#0F1B3D' }}>
                Step-by-step
              </h2>
              <ol className="space-y-4">
                {article.howToSteps.map((step, i) => (
                  <li
                    key={step.name}
                    className="rounded-xl p-5"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{ background: '#F5E642', color: '#0D0D0D' }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm mb-1" style={{ color: '#0F1B3D' }}>
                          {step.name}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                          {step.text}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* FAQ */}
          <section className="mb-14">
            <h2 className="text-xl md:text-2xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              Frequently asked
            </h2>
            <div className="space-y-3">
              {article.faqs.map(f => (
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

          {/* Next steps rail */}
          {CATEGORY_NEXT_STEPS[article.category] && (
            <NextSteps steps={[
              { label: 'Next read', ...CATEGORY_NEXT_STEPS[article.category].read },
              { label: 'Compare', ...CATEGORY_NEXT_STEPS[article.category].compare },
              { label: 'Try a template', ...CATEGORY_NEXT_STEPS[article.category].template },
            ]} />
          )}

          {/* CTA */}
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
              Try Quizotic free →
            </Link>
            <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
              Free up to 50 participants per session. INR billing, UPI, GST invoices.
            </p>
          </div>

          <RelatedLinks links={article.related} heading="Related" />
        </div>
      </article>
    </>
  )
}
