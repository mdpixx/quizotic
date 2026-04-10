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

export function BrandRecall() {
  return (
    <section style={{ padding: '80px 24px 0', background: '#fff', textAlign: 'center' }}>
      {/* Big wordmark */}
      <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'min(10vw, 96px)', letterSpacing: '-0.04em', lineHeight: 1, display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ color: '#0F1B3D' }}>quizotic</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'blink-live 1.5s ease-in-out infinite', verticalAlign: 'middle', marginBottom: 4 }} />
          <span style={{ color: '#16A34A', animation: 'blink-live 1.5s ease-in-out infinite' }}>.live</span>
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 500, fontSize: 20, color: '#888', marginTop: 12, marginBottom: 48 }}>
        Where learning gets real.
      </div>

      {/* Marquee strip */}
      <div style={{ background: '#0F1B3D', padding: '14px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
        @keyframes blink-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </section>
  )
}
