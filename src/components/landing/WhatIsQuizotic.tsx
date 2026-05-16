import Link from 'next/link'

export function WhatIsQuizotic() {
  return (
    <section style={{ background: '#FFFFFF', padding: '64px 24px', borderBottom: '1px solid #E5E7EB' }}>
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
        <p style={{ fontSize: 16, lineHeight: 1.75, color: '#374151', marginBottom: 16 }}>
          Quizotic is a free <strong>AI quiz generator</strong> and <strong>live quiz platform</strong> built for India.
          It combines Kahoot&apos;s real-time quiz engine with Mentimeter&apos;s interactive presentation features —
          giving teachers, coaching institutes, colleges, and corporate trainers a single browser-based tool
          for live quizzes, polls, word clouds, and presentations. No app install for participants. INR billing with UPI.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: '#374151', marginBottom: 24 }}>
          Quizotic is built on peer-reviewed learning science: Bloom&apos;s Taxonomy tagging, Confidence Grid,
          and Spaced Retrieval. Every quiz generates a per-student report so teachers can see which Bloom
          levels need work before the next class. It&apos;s the{' '}
          <Link href="/vs/kahoot" style={{ color: '#2563EB' }}>Kahoot alternative</Link>,{' '}
          <Link href="/vs/quizizz" style={{ color: '#2563EB' }}>Quizizz alternative</Link>, and{' '}
          <Link href="/vs/slido" style={{ color: '#2563EB' }}>Slido alternative</Link>{' '}
          purpose-built for Indian classrooms and corporate L&amp;D teams.
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
            { label: 'Billing', value: 'INR · UPI · Cards' },
            { label: 'Curricula', value: 'NCERT · CBSE · ICSE · IB' },
            { label: 'Use cases', value: 'Schools · Coaching · Corporate' },
            { label: 'Question types', value: '11 types incl. AI-generated' },
            { label: 'Location', value: 'Built in India' },
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
    </section>
  )
}
