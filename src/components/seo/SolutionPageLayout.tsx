import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { RelatedLinks, type RelatedLink } from './RelatedLinks'
import { NextSteps } from './NextSteps'

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
  tldr?: string[]
  comparisonSection?: {
    heading: string
    rows: Array<{ feature: string; quizotic: string; competitor: string; winner?: 'quizotic' | 'competitor' | 'tie' }>
  }
  audienceCards?: Array<{ title: string; description: string; href: string }>
}

const SITE = 'https://www.quizotic.live'

const SOLUTION_NEXT_STEPS: Record<string, {
  read: { title: string; description: string; href: string }
  compare: { title: string; description: string; href: string }
  template: { title: string; description: string; href: string }
}> = {
  'ai-quiz-generator': {
    read: { title: 'How to Create a Quiz from PDF', href: '/learn/how-to-create-quiz-from-pdf', description: 'Step-by-step guide to converting any PDF into a live quiz.' },
    compare: { title: 'vs Kahoot', href: '/vs/kahoot', description: 'See how Quizotic compares to Kahoot for AI-powered quizzing.' },
    template: { title: 'Coaching Institute Templates', href: '/templates#audience-coaching-institutes', description: 'JEE/NEET/UPSC quiz templates to launch in one click.' },
  },
  'quiz-maker': {
    read: { title: 'How to Run a CBSE Classroom Quiz', href: '/learn/how-to-run-a-live-quiz-cbse-classroom', description: 'Step-by-step guide for Indian teachers running live quizzes.' },
    compare: { title: 'vs Quizizz', href: '/vs/quizizz', description: 'Quizotic vs Quizizz — which quiz maker fits your classroom?' },
    template: { title: 'School Teacher Templates', href: '/templates#audience-school-teachers', description: 'Free CBSE/NCERT quiz templates for school teachers.' },
  },
  'pdf-to-quiz': {
    read: { title: 'How to Create a Quiz from PDF', href: '/learn/how-to-create-quiz-from-pdf', description: 'Detailed guide to converting PDFs into quizzes with AI.' },
    compare: { title: 'vs Kahoot', href: '/vs/kahoot', description: 'See how Quizotic compares to Kahoot on AI features.' },
    template: { title: 'Coaching Institute Templates', href: '/templates#audience-coaching-institutes', description: 'JEE/NEET/UPSC quiz templates ready to import.' },
  },
  'ncert-quiz-generator': {
    read: { title: 'CBSE Class 10 Quiz Questions', href: '/learn/cbse-class-10-free-quiz-questions', description: 'Free CBSE Class 10 quiz questions for teachers.' },
    compare: { title: 'vs Quizizz', href: '/vs/quizizz', description: 'How Quizotic compares to Quizizz for NCERT content.' },
    template: { title: 'School Teacher Templates', href: '/templates#audience-school-teachers', description: 'Free CBSE/NCERT quiz templates for school teachers.' },
  },
  'live-quiz': {
    read: { title: 'How to Run a CBSE Classroom Quiz', href: '/learn/how-to-run-a-live-quiz-cbse-classroom', description: 'Step-by-step guide to running a live quiz in any classroom.' },
    compare: { title: 'vs Kahoot', href: '/vs/kahoot', description: 'Quizotic vs Kahoot — live quiz engines compared.' },
    template: { title: 'School Teacher Templates', href: '/templates#audience-school-teachers', description: 'Free quiz templates ready to import and launch.' },
  },
  'interactive-presentation': {
    read: { title: 'Interactive Presentation Guide', href: '/learn/how-to-make-interactive-presentation', description: 'How to make any presentation interactive with live polls.' },
    compare: { title: 'vs Mentimeter', href: '/vs/mentimeter', description: 'Quizotic vs Mentimeter — interactive presentation tools compared.' },
    template: { title: 'Corporate Training Templates', href: '/templates#audience-corporate-trainers', description: 'POSH, onboarding, cybersecurity quiz templates.' },
  },
  'live-polling': {
    read: { title: 'Slido Alternatives India 2026', href: '/learn/slido-alternatives-india-2026', description: 'Best live polling tools for Indian teams.' },
    compare: { title: 'vs Slido', href: '/vs/slido', description: 'Quizotic vs Slido — live polling tools compared.' },
    template: { title: 'Event Host Templates', href: '/templates#audience-event-hosts', description: 'Trivia, office fun, Bollywood quiz templates.' },
  },
  'gamified-learning': {
    read: { title: 'Best Quiz App for JEE/NEET', href: '/learn/best-quiz-app-jee-neet-coaching-institutes', description: 'Gamified learning for competitive exam preparation.' },
    compare: { title: 'vs Kahoot', href: '/vs/kahoot', description: 'Quizotic vs Kahoot — gamification compared.' },
    template: { title: 'Coaching Institute Templates', href: '/templates#audience-coaching-institutes', description: 'JEE/NEET/UPSC quiz templates for coaching institutes.' },
  },
}

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
  tldr,
  comparisonSection,
  audienceCards,
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
      availability: 'https://schema.org/InStock',
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
          {tldr && tldr.length > 0 && (
            <div className="mb-8 rounded-xl p-5" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: '#92400E' }}>TL;DR</p>
              <ul className="space-y-1">
                {tldr.map((item, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: '#374151' }}>
                    <span style={{ color: '#D97706', flexShrink: 0 }}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
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

          {audienceCards && audienceCards.length > 0 && (
            <section className="mb-14">
              <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>Best for</h2>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {audienceCards.map(card => (
                  <a key={card.href} href={card.href} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', textDecoration: 'none', display: 'block' }}>
                    <h3 className="font-bold text-sm mb-2" style={{ color: '#0F1B3D' }}>{card.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{card.description}</p>
                  </a>
                ))}
              </div>
            </section>
          )}

          {comparisonSection && (
            <section className="mb-14">
              <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>{comparisonSection.heading}</h2>
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#E5E7EB' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th className="px-4 py-3 text-left font-bold" style={{ color: '#0F1B3D' }}>Feature</th>
                      <th className="px-4 py-3 text-left font-bold" style={{ color: '#0F1B3D' }}>Quizotic</th>
                      <th className="px-4 py-3 text-left font-bold" style={{ color: '#0F1B3D' }}>Alternatives</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonSection.rows.map((row, i) => (
                      <tr key={row.feature} style={{ borderTop: '1px solid #E5E7EB', background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                        <td className="px-4 py-3 font-semibold align-top" style={{ color: '#374151' }}>{row.feature}</td>
                        <td className="px-4 py-3 align-top" style={{ color: '#065F46', fontWeight: row.winner === 'quizotic' ? 700 : 400 }}>{row.quizotic}</td>
                        <td className="px-4 py-3 align-top" style={{ color: '#4B5563', fontWeight: row.winner === 'competitor' ? 700 : 400 }}>{row.competitor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

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

          {SOLUTION_NEXT_STEPS[slug] && (
            <NextSteps steps={[
              { label: 'Next read', ...SOLUTION_NEXT_STEPS[slug].read },
              { label: 'Compare', ...SOLUTION_NEXT_STEPS[slug].compare },
              { label: 'Try a template', ...SOLUTION_NEXT_STEPS[slug].template },
            ]} />
          )}

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
