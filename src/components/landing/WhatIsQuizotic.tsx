import Link from 'next/link'

// Feature-recall strip folded in from the old BrandRecall section — the
// big wordmark there duplicated the nav/footer branding, but the marquee
// reinforces feature names right after the "what is it" explanation.
const MARQUEE_ITEMS = [
  'Live Quizzes',
  'Interactive Presentations',
  "Bloom's Taxonomy",
  'Confidence Grid',
  'Spaced Retrieval',
  '19 Slide Types',
  'Real-time Leaderboard',
  'Host Dashboard',
  'No App Required',
]

export function WhatIsQuizotic() {
  return (
    <section style={{ background: '#FFFFFF', padding: '64px 24px 0', borderBottom: '1px solid #E5E7EB' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 28,
            fontWeight: 800,
            color: '#0F1B3D',
            marginBottom: 16,
          }}
        >
          What is Quizotic?
        </h2>
        <p className="prose-justify" style={{ fontSize: 16, lineHeight: 1.75, color: '#374151', marginBottom: 16 }}>
          Quizotic is a free <strong>AI quiz generator</strong> and <strong>live quiz platform</strong>.
          It combines Kahoot&apos;s real-time quiz engine with Mentimeter&apos;s interactive presentation features —
          giving teachers, coaching institutes, colleges, and corporate trainers a single browser-based tool
          for live quizzes, polls, word clouds, and presentations. No app install for participants.
        </p>
        <p className="prose-justify" style={{ fontSize: 16, lineHeight: 1.75, color: '#374151', marginBottom: 24 }}>
          Quizotic is built on peer-reviewed learning science: Bloom&apos;s Taxonomy tagging, Confidence Grid,
          and Spaced Retrieval. Every quiz generates a per-student report so teachers can see which Bloom
          levels need work before the next class. It&apos;s the{' '}
          <Link href="/vs/kahoot" style={{ color: '#2563EB' }}>Kahoot alternative</Link>,{' '}
          <Link href="/vs/quizizz" style={{ color: '#2563EB' }}>Quizizz alternative</Link>, and{' '}
          <Link href="/vs/slido" style={{ color: '#2563EB' }}>Slido alternative</Link>{' '}
          purpose-built for classrooms and corporate L&amp;D teams.
        </p>

        {/* At a glance */}
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          {[
            { label: 'Free plan', value: 'Up to 50 participants' },
            { label: 'Pricing', value: 'Free · Paid coming soon' },
            { label: 'Curricula', value: 'NCERT · CBSE · ICSE · IB' },
            { label: 'Use cases', value: 'Schools · Coaching · Corporate' },
            { label: 'Question types', value: '11 types incl. AI-generated' },
            { label: 'Access', value: 'Browser · No app install' },
          ].map(item => (
            <div key={item.label}>
              <dt style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280', marginBottom: 2 }}>
                {item.label}
              </dt>
              <dd style={{ fontSize: 14, fontWeight: 600, color: '#0F1B3D', margin: 0 }}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Marquee strip — full bleed */}
      <div style={{ background: '#0F1B3D', padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap', margin: '48px -24px 0' }}>
        <div style={{ display: 'inline-flex', animation: 'marquee 25s linear infinite' }}>
          {[0, 1].map(n => (
            <span key={n} style={{ display: 'inline-block', paddingRight: 48 }}>
              {MARQUEE_ITEMS.map(item => (
                <span key={item} style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 600, fontSize: 15, color: '#F5E642', padding: '0 20px', whiteSpace: 'nowrap' }}>
                  {item} ·
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
