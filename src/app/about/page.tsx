import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'

export const metadata: Metadata = {
  title: 'About Quizotic',
  description:
    'Quizotic is an India-first live quiz and interactive presentation platform built on learning science. Free to use, no app install required. Made for teachers, trainers, and educators.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
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
          India-first · Learning science · No app install
        </p>

        <div className="space-y-10 text-base leading-relaxed" style={{ color: '#374151' }}>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>The problem we&apos;re solving</h2>
            <p className="mb-3">
              The global tools that dominate live quizzing — Kahoot, Mentimeter, Quizizz — were built
              for Western markets. They bill in USD. They don&apos;t support UPI. Their free tiers are
              increasingly restrictive. And none of them are built around how learning actually works.
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
              <li><strong>Coaching institutes</strong> — JEE, NEET, UPSC, competitive exam prep</li>
              <li><strong>College faculty</strong> — lectures, seminars, end-of-term reviews</li>
              <li><strong>Corporate trainers</strong> — onboarding, compliance, skill assessments</li>
              <li><strong>HR teams</strong> — town halls, icebreakers, pulse surveys</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>India-first by design</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pricing in Indian Rupees (INR) — UPI and card support via Razorpay (coming soon)</li>
              <li>Designed for 1–2 Mbps connections — works in real Indian classrooms</li>
              <li>No app install — participants join via any browser on their phone</li>
              <li>Hindi language support in the participant interface</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#0F1B3D' }}>Our story</h2>
            <p className="mb-3">
              Quizotic is built by a small, independent team. We&apos;re not a startup with VC
              funding or a growth target. We&apos;re educators and builders who got frustrated
              with the tools available in India and decided to make something better.
            </p>
            <p className="mb-3">
              The platform is free right now — not as a lead magnet, but as a genuine commitment
              to making learning tools accessible. We believe the best way to build a product
              people love is to put it in their hands first.
            </p>
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
  )
}
