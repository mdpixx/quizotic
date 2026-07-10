import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import { StickyNav } from '@/components/landing/StickyNav'
import { BRAND, FOUNDER } from '@/content/brand'

export const metadata: Metadata = {
  title: 'About Quizotic',
  description:
    'Quizotic is a live quiz and interactive presentation platform built on learning science, founded by Mahesh Dhiman — an L&D professional who runs training for 12,000+ employees. Free to use, no app install required.',
  alternates: { canonical: '/about' },
}

const founderLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${BRAND.url}/about#founder`,
  name: FOUNDER.name,
  jobTitle: FOUNDER.title,
  description: FOUNDER.bio,
  image: FOUNDER.image,
  url: `${BRAND.url}/about`,
  sameAs: [FOUNDER.url],
  knowsAbout: [
    'learning and development',
    'corporate training',
    'learning science',
    'live quiz platforms',
    'interactive presentations',
  ],
  worksFor: { '@id': `${BRAND.url}/#organization` },
}

export default function AboutPage() {
  return (
    <>
      <JsonLd data={founderLd} />
      <StickyNav />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div
          className="max-w-3xl mx-auto px-6 pb-12"
          style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px) + 32px)' }}
        >
        <div className="mb-6">
          <Breadcrumbs items={[
            { name: 'Home', href: '/' },
            { name: 'About', href: '/about' },
          ]} />
        </div>

        <h1
          className="text-3xl font-black mb-2"
          style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
        >
          About Quizotic
        </h1>
        <p className="text-sm mb-10" style={{ color: '#6B7280' }}>
          Learning science · Low bandwidth · No app install
        </p>

        <div className="space-y-10 text-base leading-relaxed" style={{ color: '#374151' }}>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>The problem we&apos;re solving</h2>
            <p className="mb-3">
              The tools that dominate live quizzing — Kahoot, Mentimeter, Quizizz — optimise for
              entertainment, not learning. Their free tiers are increasingly restrictive, they get
              heavier every year, and none of them are built around how learning actually works.
            </p>
            <p>
              Most &quot;engagement tools&quot; optimise for entertainment. Quizotic optimises for retention.
              There&apos;s a meaningful difference.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>What makes us different</h2>
            <p className="mb-4">
              Quizotic is built on three pillars of peer-reviewed learning science:
            </p>
            <div className="space-y-4">
              <div
                className="rounded-xl p-5"
                style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}
              >
                <p className="font-bold text-sm mb-1" style={{ color: '#3730A3' }}>Bloom&apos;s Taxonomy</p>
                <p className="text-sm" style={{ color: '#374151' }}>
                  Every question can be tagged to a cognitive level — Remember, Understand, Apply,
                  Analyse, Evaluate, Create. Session reports show whether you&apos;re testing recall
                  or building deeper understanding.
                </p>
              </div>
              <div
                className="rounded-xl p-5"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
              >
                <p className="font-bold text-sm mb-1" style={{ color: '#15803D' }}>Confidence Grid</p>
                <p className="text-sm" style={{ color: '#374151' }}>
                  Participants rate their confidence before answering. This surfaces the most
                  dangerous learning gap: the things people are wrong about but feel sure of.
                </p>
              </div>
              <div
                className="rounded-xl p-5"
                style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
              >
                <p className="font-bold text-sm mb-1" style={{ color: '#C2410C' }}>Spaced Retrieval</p>
                <p className="text-sm" style={{ color: '#374151' }}>
                  The platform identifies which questions participants struggled with and surfaces
                  them again in future sessions — the single most evidence-backed method for
                  long-term retention.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>Who we&apos;re built for</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>School teachers</strong> — classes of 10 to 50, any subject, any grade</li>
              <li><strong>Coaching &amp; test-prep institutes</strong> — competitive and entrance exam prep</li>
              <li><strong>College faculty</strong> — lectures, seminars, end-of-term reviews</li>
              <li><strong>Corporate trainers</strong> — onboarding, compliance, skill assessments</li>
              <li><strong>HR teams</strong> — town halls, icebreakers, pulse surveys</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>Built for every classroom</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Free today — paid plans come later, and the free plan stays genuinely useful</li>
              <li>Designed for 1–2 Mbps connections — works in real, low-bandwidth classrooms</li>
              <li>No app install — participants join via any browser on their phone</li>
              <li>Multi-language support in the participant interface</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>Who&apos;s behind Quizotic</h2>
            <div className="flex flex-col sm:flex-row gap-6 items-start mb-4">
              <img
                src="/founder/mahesh-dhiman.jpg"
                alt="Mahesh Dhiman, founder of Quizotic"
                width={140}
                height={140}
                className="rounded-xl flex-shrink-0"
                style={{ border: '2px solid #0D0D0D', boxShadow: '4px 4px 0 #0D0D0D', objectFit: 'cover' }}
              />
              <div>
                <p className="mb-3">
                  Quizotic is built by <strong>Mahesh Dhiman</strong>, a learning &amp;
                  development professional who designs and runs training for 12,000+ employees
                  at one of India&apos;s largest energy companies. Years of standing in front of
                  real classrooms and training halls — not a growth team, not VC funding.
                </p>
                <p className="mb-3">
                  He built Quizotic because the engagement tools he used in those rooms
                  optimised for entertainment, not retention. A session should leave something
                  behind — Quizotic is built around the learning science that makes that happen.
                </p>
                <p className="text-sm">
                  <a
                    href={FOUNDER.url}
                    rel="me noopener"
                    target="_blank"
                    style={{ color: '#0F1B3D', fontWeight: 600 }}
                  >
                    Connect with Mahesh on LinkedIn →
                  </a>
                </p>
              </div>
            </div>
            <p>
              We read every piece of feedback. Every single one. If you&apos;ve run a session on
              Quizotic and have something to say — good or bad — we want to hear it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>Get in touch</h2>
            <p>
              Email us at{' '}
              <a href="mailto:info@quizotic.live" style={{ color: '#0F1B3D', fontWeight: 600 }}>
                info@quizotic.live
              </a>
              . We personally read and respond to every message.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
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
            Start for free →
          </Link>
        </div>
        </div>
      </div>
    </>
  )
}
