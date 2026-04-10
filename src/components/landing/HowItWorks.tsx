export function HowItWorks() {
  const steps = [
    {
      num: '1',
      title: 'Create your quiz',
      desc: 'Add questions, set time limits, choose from 19 slide types. Import from a spreadsheet or build from scratch.',
    },
    {
      num: '2',
      title: 'Share the join link',
      desc: 'Display the room code on screen or share a QR code. Students join instantly from their devices — no login needed.',
    },
    {
      num: '3',
      title: 'Learn together',
      desc: 'Watch responses roll in live. Pause to discuss wrong answers. Celebrate top scorers on the leaderboard.',
    },
  ]

  return (
    <section id="how" style={{ padding: '120px 24px', background: '#F0FDF4' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 44px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          Up and running in under a minute
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 560, margin: '0 auto 72px', lineHeight: 1.6 }}>
          Three steps. That&apos;s all it takes to transform a boring review session into something learners remember.
        </p>

        {/* Steps row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', position: 'relative' }} className="steps-row">
          {steps.map((step, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 24px', position: 'relative' }} className="step-item">
              {/* Circle */}
              <div style={{ width: 72, height: 72, background: '#F5E642', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 28, color: '#0F1B3D', margin: '0 auto 20px', border: '3px solid #0D0D0D', boxShadow: '3px 3px 0 #0D0D0D', position: 'relative', zIndex: 1 }}>
                {step.num}
              </div>

              {/* Dashed connector (not on last step) */}
              {i < steps.length - 1 && (
                <svg style={{ position: 'absolute', top: 36, left: 'calc(50% + 48px)', width: 'calc(100% - 96px)', height: 2, zIndex: 0, overflow: 'visible' }} preserveAspectRatio="none" viewBox="0 0 200 2">
                  <line x1="0" y1="1" x2="200" y2="1" stroke="#0F1B3D" strokeWidth="2" strokeDasharray="8 6" />
                </svg>
              )}

              <h3 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 20, color: '#0F1B3D', marginBottom: 10 }}>
                {step.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: '#555', lineHeight: 1.6 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div style={{ maxWidth: 700, margin: '48px auto 0', background: '#0F1B3D', borderRadius: 16, padding: '20px 32px', display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          {['ℹ No student account needed', '✓ Works on any device', '📋 Free forever plan'].map(item => (
            <span key={item} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 500, fontSize: 14, color: '#fff', whiteSpace: 'nowrap' }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .steps-row { flex-direction: column !important; gap: 40px; }
          .step-item svg { display: none !important; }
        }
      `}</style>
    </section>
  )
}
