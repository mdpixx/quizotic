'use client'

import Link from 'next/link'

const QUIZ_FEATURES = [
  'MCQ, True/False, Word Cloud, Open-ended & more',
  'Live leaderboard with real-time scoring',
  'Timer-based engagement for active recall',
  'Instant response heatmaps',
  'Confidence tracking per question',
]

const PRESENT_FEATURES = [
  '19 interactive slide types',
  'Embed live polls inside presentations',
  'Audience reactions in real time',
  'Branching slides based on responses',
  'Export & share session recordings',
]

const PILL_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']

export function QuizVsPresentation() {
  return (
    <section id="features" style={{ padding: '120px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Heading */}
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 48px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          Two superpowers.{' '}
          <span style={{ background: '#F5E642', padding: '2px 8px', borderRadius: 6 }}>One platform.</span>
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 600, margin: '0 auto 56px', lineHeight: 1.6 }}>
          Quizotic gives you live quiz engagement AND interactive presentation power — use them together or independently.
        </p>

        {/* Cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }} className="two-powers-grid">
          {/* Quiz Mode card */}
          <div style={{ border: '2px solid #E5E7EB', borderRadius: 20, padding: '36px 32px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#2D3A8C', letterSpacing: '0.1em', border: '2px solid #2D3A8C', borderRadius: 20, padding: '5px 14px', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
              Quiz Mode
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {QUIZ_FEATURES.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: '#374151', lineHeight: 1.5 }}>
                  <span style={{ color: '#2D3A8C', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {/* Mini quiz preview */}
            <div style={{ background: '#F8F9FA', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#0F1B3D', marginBottom: 10 }}>
                Which element has symbol &apos;Fe&apos;?
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['A · Iron', 'B · Gold', 'C · Silver', 'D · Zinc'].map((opt, i) => (
                  <span key={i} style={{ background: PILL_COLORS[i], color: '#fff', fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, padding: '6px 14px', borderRadius: 20 }}>
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Present Mode card */}
          <div style={{ border: '2px solid #0F1B3D', borderRadius: 20, padding: '36px 32px', background: '#0F1B3D', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#F5E642', letterSpacing: '0.1em', border: '2px solid rgba(245,230,66,0.6)', borderRadius: 20, padding: '5px 14px', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
              Present Mode
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PRESENT_FEATURES.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                  <span style={{ color: '#F5E642', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {/* Mini bar chart preview */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 12 }}>
                Q3 Student Performance
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 72 }}>
                {[[80, '#2D3A8C'], [55, '#FF8A47'], [90, '#5BC0EB'], [45, '#E07A5F'], [70, '#16A34A']].map(([h, c], i) => (
                  <div key={i} style={{ flex: 1, background: c as string, height: `${h}%`, borderRadius: '4px 4px 0 0', opacity: 0.9 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .two-powers-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
