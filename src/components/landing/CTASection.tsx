import Link from 'next/link'

export function CTASection() {
  return (
    <section style={{ padding: 'clamp(48px, 9vw, 100px) 24px', background: '#FBD13B', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative "!" watermark */}
      <div style={{ position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 200, color: '#0F1B3D', opacity: 0.08, pointerEvents: 'none', lineHeight: 1, userSelect: 'none' }}>
        !
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', color: '#0D0D0D', letterSpacing: '-0.03em', marginBottom: 16 }}>
          Ready to teach with purpose?
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 500, fontSize: 20, color: '#0D0D0D', marginBottom: 40, opacity: 0.8 }}>
          Built on evidence. Designed for engagement. Free to start.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Link href="/auth/signin?intent=signup" className="cta-navy-btn"
            style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 18, color: '#fff', textDecoration: 'none', padding: '18px 40px', borderRadius: 12, background: '#0F1B3D', border: '3px solid #0D0D0D', boxShadow: '5px 5px 0 #0D0D0D' }}>
            Start Teaching Free →
          </Link>
          <Link href="/demo"
            style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 16, color: '#0D0D0D', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            or preview the host screen first
          </Link>
        </div>
      </div>

      <style>{`
        .cta-navy-btn { transition: transform 0.15s, box-shadow 0.15s; }
        .cta-navy-btn:hover { transform: translate(2px,2px); box-shadow: 3px 3px 0 #0D0D0D !important; }
      `}</style>
    </section>
  )
}
