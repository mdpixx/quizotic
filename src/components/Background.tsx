// Dot-grid pattern + animated corner glow orbs.
// Placed in root layout — do NOT add to individual pages.
export function Background() {
  return (
    <>
      {/* Dot grid — subtle, warm */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: 'var(--color-bg)',
          backgroundImage: 'radial-gradient(circle, rgba(67,97,238,0.06) 0.8px, transparent 0.8px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Animated orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        {/* Top-right — blue, drifts forward */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 460, height: 460,
          background: 'radial-gradient(circle, rgba(67,97,238,0.12) 0%, transparent 65%)',
          filter: 'blur(50px)',
          animation: 'orb-drift 14s ease-in-out infinite',
        }} />
        {/* Bottom-left — coral, drifts in reverse */}
        <div style={{
          position: 'absolute', bottom: -120, left: -120,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(255,107,107,0.10) 0%, transparent 65%)',
          filter: 'blur(50px)',
          animation: 'orb-drift 14s ease-in-out infinite reverse',
        }} />
        {/* Center — faint gold depth orb */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(255,209,102,0.05) 0%, transparent 65%)',
          filter: 'blur(60px)',
          animation: 'orb-drift 20s ease-in-out infinite 3s',
        }} />
      </div>
    </>
  )
}
