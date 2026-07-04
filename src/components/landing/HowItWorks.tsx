'use client'

import Link from 'next/link'
import { Reveal, Stagger, StaggerItem } from './motion'

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
    <section id="how" style={{ padding: 'clamp(56px, 11vw, 120px) 24px', background: '#F0FDF4' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Reveal>
          <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 44px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
            Up and running in under a minute
          </h2>
          <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 560, margin: '0 auto clamp(36px, 9vw, 72px)', lineHeight: 1.6 }}>
            Three steps. That&apos;s all it takes to transform a boring review session into something learners remember.
          </p>
        </Reveal>

        {/* Steps row */}
        <Stagger gap={0.16} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', position: 'relative' }} className="steps-row">
          {steps.map((step, i) => (
            <StaggerItem key={i} index={i} style={{ flex: 1, textAlign: 'center', padding: '0 24px', position: 'relative' }} className="step-item">
              {/* Circle */}
              <div style={{ width: 72, height: 72, background: '#FBD13B', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 28, color: '#0F1B3D', margin: '0 auto 20px', border: '3px solid #0D0D0D', boxShadow: '3px 3px 0 #0D0D0D', position: 'relative', zIndex: 1 }}>
                {step.num}
              </div>

              {/* Dashed connector (not on last step) — dashes march forward to
                  suggest flow; the global reduced-motion rule freezes it. */}
              {i < steps.length - 1 && (
                <svg style={{ position: 'absolute', top: 36, left: 'calc(50% + 48px)', width: 'calc(100% - 96px)', height: 2, zIndex: 0, overflow: 'visible' }} preserveAspectRatio="none" viewBox="0 0 200 2">
                  <line x1="0" y1="1" x2="200" y2="1" stroke="#0F1B3D" strokeWidth="2" strokeDasharray="8 6" style={{ animation: 'dash-march 1.4s linear infinite' }} />
                </svg>
              )}

              <h3 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 20, color: '#0F1B3D', marginBottom: 10 }}>
                {step.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: '#555', lineHeight: 1.6 }}>
                {step.desc}
              </p>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Trust strip */}
        <Reveal delay={0.1}>
          <div style={{ maxWidth: 700, margin: '48px auto 0', background: '#0F1B3D', borderRadius: 16, padding: '20px 32px', display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
            {['ℹ No student account needed', '✓ Works on any device', '📋 Free forever plan'].map(item => (
              <span key={item} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 500, fontSize: 14, color: '#fff', whiteSpace: 'nowrap' }}>
                {item}
              </span>
            ))}
          </div>

          {/* Mid-page CTA — first re-ask after the visitor has seen how easy it is. */}
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <Link href="/auth/signin?intent=signup" className="how-cta"
              style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 16, color: '#0D0D0D', textDecoration: 'none', padding: '14px 28px', borderRadius: 12, background: '#FBD13B', border: '3px solid #0D0D0D', boxShadow: '4px 4px 0 #0D0D0D' }}>
              Create your first quiz →
            </Link>
            <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: '#777', marginTop: 10 }}>
              Free plan · no credit card
            </p>
          </div>
        </Reveal>
      </div>

      <style>{`
        .how-cta { transition: transform 0.15s, box-shadow 0.15s; }
        .how-cta:hover { transform: translate(2px,2px); box-shadow: 2px 2px 0 #0D0D0D !important; }
        @keyframes dash-march {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -14; }
        }
        @media (max-width: 768px) {
          .steps-row { flex-direction: column !important; gap: 40px; }
          .step-item svg { display: none !important; }
        }
      `}</style>
    </section>
  )
}
