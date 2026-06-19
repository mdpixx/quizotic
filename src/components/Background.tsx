// Subtle geometric hex pattern + navy/yellow glow orbs.
// Placed in root layout — do NOT add to individual pages.
export function Background() {
  return (
    <>
      {/* Hex dot grid — subtle navy */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: '#FFFFFF',
          backgroundImage: 'radial-gradient(circle, rgba(15,27,61,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Animated orbs — navy/yellow palette */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        {/* Top-right — navy glow */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 460, height: 460,
          background: 'radial-gradient(circle, rgba(15,27,61,0.08) 0%, transparent 65%)',
          filter: 'blur(50px)',
          animation: 'orb-drift 14s ease-in-out infinite',
        }} />
        {/* Bottom-left — yellow glow */}
        <div style={{
          position: 'absolute', bottom: -120, left: -120,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(251,209,59,0.06) 0%, transparent 65%)',
          filter: 'blur(50px)',
          animation: 'orb-drift 14s ease-in-out infinite reverse',
        }} />
        {/* Center — faint navy depth orb */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(15,27,61,0.04) 0%, transparent 65%)',
          filter: 'blur(60px)',
          animation: 'orb-drift 20s ease-in-out infinite 3s',
        }} />
      </div>
    </>
  )
}
