import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Quizotic — Free Live Quiz & Presentation Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1B2559 0%, #0F1629 40%, #1a1040 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative gradient orbs */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(67,97,238,0.3) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,107,107,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Logo + brand name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #FF6B6B, #4361EE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            Q
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1px' }}>
              Quizo
            </span>
            <span style={{ fontSize: 56, fontWeight: 900, color: '#6B8AFF', letterSpacing: '-1px' }}>
              tic
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#22C55E', marginLeft: 4, marginTop: -20 }}>
              .live
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: 40,
            textAlign: 'center',
            letterSpacing: '0.5px',
          }}
        >
          Free Live Quiz & Presentation Platform
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
          {[
            { text: '9 Quiz Types', color: '#4361EE' },
            { text: 'AI-Powered', color: '#7C3AED' },
            { text: '18 Slide Types', color: '#0891B2' },
            { text: 'Real-Time', color: '#FF6B6B' },
            { text: '50 Free Participants', color: '#16A34A' },
            { text: 'INR Billing', color: '#EA580C' },
          ].map((pill) => (
            <div
              key={pill.text}
              style={{
                padding: '10px 24px',
                borderRadius: 50,
                background: `${pill.color}22`,
                border: `1.5px solid ${pill.color}44`,
                color: pill.color,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {pill.text}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            background: 'linear-gradient(135deg, #FF6B6B, #4361EE)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>
            Start Free at quizotic.live
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>
            — No app install needed
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
