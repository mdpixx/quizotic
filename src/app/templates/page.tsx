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
          <p className="text-base mb-2" style={{ color: '#374151' }}>
            {all.length} free quiz templates — ready to import and launch as a live session in one click.
            Browse by audience below, or jump straight to the type you need.
          </p>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            CBSE, NCERT, JEE/NEET, UPSC, corporate training, compliance, trivia, and more.
            Built for India — free plan covers up to 50 participants.
          </p>

          {/* Popular-by-audience pill links */}
          <div className="flex flex-wrap gap-2 mb-12">
            {[
              { label: 'School teacher templates', href: '#audience-school-teachers' },
              { label: 'Coaching institute templates', href: '#audience-coaching-institutes' },
              { label: 'Corporate training templates', href: '#audience-corporate-trainers' },
              { label: 'College templates', href: '#audience-colleges' },
              { label: 'Event host templates', href: '#audience-event-hosts' },
              { label: 'NCERT quiz generator', href: '/ncert-quiz-generator' },
              { label: 'PDF to quiz', href: '/pdf-to-quiz' },
              { label: 'For teachers', href: '/for/teachers' },
              { label: 'For coaching institutes', href: '/for/coaching-institutes' },
              { label: 'vs Quizizz', href: '/vs/quizizz' },
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

          {(Object.keys(TEMPLATE_AUDIENCES) as TemplateAudience[]).map(audience => {
            const list = grouped[audience]
            if (list.length === 0) return null
            const meta = TEMPLATE_AUDIENCES[audience]
            return (
              <section key={audience} id={`audience-${audience}`} className="mb-14">
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

          {/* Templates FAQ */}
          <JsonLd data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: 'Are the quiz templates really free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. All 50+ templates are free to import and launch. The free plan supports up to 10 live participants per session — enough for most classroom uses. Pro (₹499/month) scales to 200 participants.' } },
              { '@type': 'Question', name: 'Can I edit a template before using it?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Every template is fully editable — add, remove, or reorder questions; change answer options; add images; adjust Bloom tags. The template is a starting point, not a locked format.' } },
              { '@type': 'Question', name: 'Which templates work for CBSE Class 10?', acceptedAnswer: { '@type': 'Answer', text: 'See the School Teachers section — several Class 10 Science and Math packs are included. You can also use the NCERT Quiz Generator to create a chapter-specific quiz on demand.' } },
              { '@type': 'Question', name: 'Are there corporate training templates?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The Corporate Trainers section includes POSH compliance, onboarding, cybersecurity awareness, and sales training templates. Each is importable with one click.' } },
              { '@type': 'Question', name: 'Can I upload my own template?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — build a quiz in the editor and save it as a reusable template. On Team plans, templates can be shared across all trainers in the organisation.' } },
              { '@type': 'Question', name: 'How do I use a template for JEE or NEET prep?', acceptedAnswer: { '@type': 'Answer', text: 'Browse the Coaching Institutes section. Templates cover JEE Physics, JEE Math, NEET Biology, and more. Import, run as a speed-based live mock, and download the Bloom breakdown report.' } },
              { '@type': 'Question', name: 'Which templates are best for event trivia nights?', acceptedAnswer: { '@type': 'Answer', text: 'The Event Hosts section has office trivia, general knowledge, Bollywood, cricket, and IPL quiz packs. Import, add your logo, and run with up to 200 participants on Pro.' } },
              { '@type': 'Question', name: 'Can teachers contribute new templates?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Build a quiz in Quizotic, email us at hello@quizotic.live, and we\'ll review and add it to the public gallery with attribution.' } },
            ],
          }} />
          <section className="mb-14">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#0F1B3D' }}>Frequently asked</h2>
            <div className="space-y-3">
              {[
                { q: 'Are the quiz templates really free?', a: 'Yes. All 50+ templates are free to import and launch. The free plan supports up to 10 live participants per session — enough for most classroom uses. Pro (₹499/month) scales to 200 participants.' },
                { q: 'Can I edit a template before using it?', a: 'Yes. Every template is fully editable — add, remove, or reorder questions; change answer options; add images; adjust Bloom tags. The template is a starting point, not a locked format.' },
                { q: 'Which templates work for CBSE Class 10?', a: 'See the School Teachers section — several Class 10 Science and Math packs are included. You can also use the NCERT Quiz Generator to create a chapter-specific quiz on demand.' },
                { q: 'Are there corporate training templates?', a: 'Yes. The Corporate Trainers section includes POSH compliance, onboarding, cybersecurity awareness, and sales training templates. Each is importable with one click.' },
                { q: 'Can I upload my own template?', a: 'Yes — build a quiz in the editor and save it as a reusable template. On Team plans, templates can be shared across all trainers in the organisation.' },
                { q: 'How do I use a template for JEE or NEET prep?', a: 'Browse the Coaching Institutes section. Templates cover JEE Physics, JEE Math, NEET Biology, and more. Import, run as a speed-based live mock, and download the Bloom breakdown report.' },
                { q: 'Which templates are best for event trivia nights?', a: 'The Event Hosts section has office trivia, general knowledge, Bollywood, cricket, and IPL quiz packs. Import, add your logo, and run with up to 200 participants on Pro.' },
                { q: 'Can teachers contribute new templates?', a: 'Yes. Build a quiz in Quizotic, email us at hello@quizotic.live, and we\'ll review and add it to the public gallery with attribution.' },
              ].map(item => (
                <details key={item.q} className="rounded-xl p-4" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <summary className="font-bold text-sm cursor-pointer" style={{ color: '#0F1B3D' }}>{item.q}</summary>
                  <p className="text-sm leading-relaxed mt-3" style={{ color: '#4B5563' }}>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

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
