// Dot-grid pattern + soft corner glow orbs.
// Placed in root layout — do NOT add to individual pages.
export function Background() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: '#fafaf8',
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      {/* Corner glow orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: -120, left: -120,
          width: 360, height: 360,
          background: 'radial-gradient(circle, rgba(163,230,53,0.09) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
      </div>
    </>
  )
}
