'use client'

const SHAPES = [
  // circles
  { type: 'circle', size: 120, top: '8%', left: '5%', delay: 0, duration: 18, opacity: 0.04, color: '#4361EE' },
  { type: 'circle', size: 80, top: '22%', left: '85%', delay: 3, duration: 22, opacity: 0.03, color: '#FF6B6B' },
  { type: 'circle', size: 60, top: '45%', left: '10%', delay: 6, duration: 16, opacity: 0.04, color: '#F59E0B' },
  { type: 'circle', size: 100, top: '65%', left: '90%', delay: 2, duration: 20, opacity: 0.035, color: '#4361EE' },
  { type: 'circle', size: 50, top: '80%', left: '30%', delay: 8, duration: 24, opacity: 0.03, color: '#FF6B6B' },
  // dots
  { type: 'dot', size: 8, top: '15%', left: '45%', delay: 1, duration: 12, opacity: 0.08, color: '#4361EE' },
  { type: 'dot', size: 6, top: '35%', left: '72%', delay: 4, duration: 14, opacity: 0.07, color: '#FF6B6B' },
  { type: 'dot', size: 10, top: '55%', left: '20%', delay: 7, duration: 10, opacity: 0.06, color: '#F59E0B' },
  { type: 'dot', size: 7, top: '75%', left: '60%', delay: 2, duration: 16, opacity: 0.08, color: '#4361EE' },
  { type: 'dot', size: 5, top: '90%', left: '80%', delay: 5, duration: 13, opacity: 0.07, color: '#FF6B6B' },
  // triangles
  { type: 'triangle', size: 18, top: '12%', left: '65%', delay: 3, duration: 20, opacity: 0.05, color: '#4361EE' },
  { type: 'triangle', size: 14, top: '50%', left: '50%', delay: 9, duration: 18, opacity: 0.04, color: '#FF6B6B' },
  { type: 'triangle', size: 16, top: '85%', left: '15%', delay: 6, duration: 22, opacity: 0.05, color: '#F59E0B' },
  // stars
  { type: 'star', size: 12, top: '28%', left: '35%', delay: 2, duration: 15, opacity: 0.06, color: '#F59E0B' },
  { type: 'star', size: 10, top: '60%', left: '75%', delay: 5, duration: 17, opacity: 0.06, color: '#4361EE' },
  { type: 'star', size: 14, top: '40%', left: '92%', delay: 8, duration: 19, opacity: 0.05, color: '#FF6B6B' },
]

function ShapeElement({ type, size, color }: { type: string; size: number; color: string }) {
  if (type === 'circle') {
    return (
      <div
        className="rounded-full"
        style={{ width: size, height: size, background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
      />
    )
  }
  if (type === 'dot') {
    return <div className="rounded-full" style={{ width: size, height: size, background: color }} />
  }
  if (type === 'triangle') {
    return (
      <div style={{
        width: 0, height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
      }} />
    )
  }
  // star
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

export function FloatingElements() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {SHAPES.map((shape, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: shape.top,
            left: shape.left,
            opacity: shape.opacity,
            animation: `drift ${shape.duration}s ease-in-out ${shape.delay}s infinite`,
          }}
        >
          <ShapeElement type={shape.type} size={shape.size} color={shape.color} />
        </div>
      ))}
    </div>
  )
}
