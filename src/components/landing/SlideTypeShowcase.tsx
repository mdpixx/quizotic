const SLIDE_TYPES = [
  {
    title: 'Multiple Choice',
    desc: 'Classic A/B/C/D with timer',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="4" y="4" width="32" height="32" rx="6" stroke="#0F1B3D" strokeWidth="2"/>
        <circle cx="14" cy="15" r="3" fill="#2D3A8C"/>
        <circle cx="14" cy="25" r="3" stroke="#2D3A8C" strokeWidth="2"/>
        <line x1="22" y1="15" x2="33" y2="15" stroke="#2D3A8C" strokeWidth="2" strokeLinecap="round"/>
        <line x1="22" y1="25" x2="33" y2="25" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Open Text',
    desc: 'Free-form written responses',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="4" y="8" width="32" height="24" rx="4" stroke="#0F1B3D" strokeWidth="2"/>
        <line x1="10" y1="16" x2="30" y2="16" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
        <line x1="10" y1="22" x2="24" y2="22" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
        <path d="M28 26 L32 22" stroke="#2D3A8C" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Word Cloud',
    desc: 'Visualize popular answers',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <text x="4" y="16" fontFamily="Space Grotesk" fontWeight="800" fontSize="12" fill="#2D3A8C">AI</text>
        <text x="18" y="24" fontFamily="Space Grotesk" fontWeight="700" fontSize="9" fill="#FF8A47">learn</text>
        <text x="4" y="32" fontFamily="Space Grotesk" fontWeight="600" fontSize="7" fill="#5BC0EB">quiz</text>
        <text x="22" y="14" fontFamily="Space Grotesk" fontWeight="700" fontSize="10" fill="#E07A5F">data</text>
        <text x="26" y="34" fontFamily="Space Grotesk" fontWeight="600" fontSize="8" fill="#16A34A">fun</text>
      </svg>
    ),
  },
  {
    title: 'Rating Scale',
    desc: '1–5 or 1–10 scales',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <line x1="6" y1="30" x2="34" y2="30" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="10" cy="30" r="3" fill="#E2E8F0"/>
        <circle cx="20" cy="30" r="3" fill="#E2E8F0"/>
        <circle cx="30" cy="30" r="4" fill="#F5E642" stroke="#0F1B3D" strokeWidth="2"/>
        <text x="8" y="20" fontFamily="Space Grotesk" fontWeight="700" fontSize="10" fill="#0F1B3D">1–10</text>
      </svg>
    ),
  },
  {
    title: 'Ranking',
    desc: 'Drag to order preferences',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="6" y="6" width="28" height="8" rx="3" fill="#2D3A8C"/>
        <rect x="6" y="16" width="28" height="8" rx="3" fill="#FF8A47"/>
        <rect x="6" y="26" width="28" height="8" rx="3" fill="#5BC0EB"/>
      </svg>
    ),
  },
  {
    title: 'Image Choice',
    desc: 'Pick from visual options',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="4" y="6" width="14" height="12" rx="3" stroke="#0F1B3D" strokeWidth="2"/>
        <rect x="22" y="6" width="14" height="12" rx="3" stroke="#0F1B3D" strokeWidth="2"/>
        <rect x="4" y="22" width="14" height="12" rx="3" stroke="#E2E8F0" strokeWidth="2"/>
        <rect x="22" y="22" width="14" height="12" rx="3" fill="#F5E642" stroke="#0F1B3D" strokeWidth="2"/>
        <polyline points="7,14 11,10 14,13" stroke="#5BC0EB" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
  },
  {
    title: 'Live Race',
    desc: 'Speed-based quiz competition',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <path d="M6 34 L16 20 L22 26 L34 8" stroke="#2D3A8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="34" cy="8" r="3" fill="#F5E642" stroke="#0F1B3D" strokeWidth="1.5"/>
        <path d="M6 34 L16 26 L22 30 L34 16" stroke="#FF8A47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
      </svg>
    ),
  },
  {
    title: 'Quick Fire',
    desc: 'Rapid-fire question rounds',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <path d="M20 4 L22 16 L30 14 L18 36 L16 24 L8 26 Z" fill="#F5E642" stroke="#0D0D0D" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Emoji Pulse',
    desc: 'React with emojis in real time',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <circle cx="20" cy="20" r="16" stroke="#0F1B3D" strokeWidth="2"/>
        <circle cx="14" cy="17" r="2" fill="#0F1B3D"/>
        <circle cx="26" cy="17" r="2" fill="#0F1B3D"/>
        <path d="M13 25 Q20 32 27 25" stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    title: 'Grid 2×2',
    desc: 'Plot ideas on a matrix',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <line x1="20" y1="4" x2="20" y2="36" stroke="#E2E8F0" strokeWidth="2"/>
        <line x1="4" y1="20" x2="36" y2="20" stroke="#E2E8F0" strokeWidth="2"/>
        <circle cx="12" cy="12" r="3" fill="#16A34A"/>
        <circle cx="28" cy="10" r="3" fill="#DC2626"/>
        <circle cx="10" cy="28" r="3" fill="#CA8A04"/>
        <circle cx="30" cy="30" r="3" fill="#2563EB"/>
      </svg>
    ),
  },
  {
    title: 'Pinpoint',
    desc: 'Mark locations on an image',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="4" y="4" width="32" height="32" rx="4" stroke="#E2E8F0" strokeWidth="2"/>
        <circle cx="24" cy="16" r="4" fill="#DC2626" opacity="0.8"/>
        <circle cx="24" cy="16" r="7" stroke="#DC2626" strokeWidth="1" opacity="0.3"/>
        <circle cx="14" cy="26" r="3" fill="#2563EB" opacity="0.6"/>
      </svg>
    ),
  },
  {
    title: 'Word Duel',
    desc: 'Head-to-head vocabulary battles',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="2" y="10" width="16" height="20" rx="4" fill="#2D3A8C"/>
        <rect x="22" y="10" width="16" height="20" rx="4" fill="#E07A5F"/>
        <text x="6" y="24" fontFamily="Space Grotesk" fontWeight="800" fontSize="10" fill="#fff">VS</text>
        <path d="M18 20 L22 20" stroke="#F5E642" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function SlideTypeShowcase() {
  return (
    <section id="slide-types" style={{ padding: '120px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          19 interactive slide types.{' '}
          <span style={{ background: '#F5E642', padding: '2px 8px', borderRadius: 6 }}>And counting.</span>
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 640, margin: '0 auto 56px', lineHeight: 1.6 }}>
          From quick polls to collaborative word clouds — every slide type is designed to keep learners actively thinking, not passively watching.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }} className="slide-grid">
          {SLIDE_TYPES.map((s) => (
            <div key={s.title} style={{ border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '24px 20px', background: '#fff', transition: 'border-color 0.2s, box-shadow 0.2s', cursor: 'default' }}
              className="slide-card">
              <div style={{ marginBottom: 14 }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 15, color: '#0F1B3D', marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: '#777' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: '#888', textAlign: 'center', marginTop: 24 }}>
          + 7 more display &amp; utility slide types (title, bullets, quote, video, image, scale, wheel)
        </p>
      </div>

      <style>{`
        .slide-card:hover { border-color: #0F1B3D !important; box-shadow: 0 4px 16px rgba(15,27,61,0.1); }
        @media (max-width: 900px) { .slide-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 600px) { .slide-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </section>
  )
}
