// Dot-grid pattern + soft corner glow orbs.
// Placed in root layout — do NOT add to individual pages.
export function Background() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: '#FAFAFE',
          backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.12) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      {/* Corner glow orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: -120, left: -120,
          width: 360, height: 360,
          background: 'radial-gradient(circle, rgba(236,72,153,0.10) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
      </div>
    </>
  )
}
