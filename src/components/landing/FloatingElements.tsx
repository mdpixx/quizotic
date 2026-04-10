'use client'

const SHAPES = [
  // circles — navy
  { type: 'circle', size: 120, top: '8%', left: '5%', delay: 0, duration: 18, opacity: 0.04, color: '#0F1B3D' },
  { type: 'circle', size: 80, top: '22%', left: '85%', delay: 3, duration: 22, opacity: 0.03, color: '#F5E642' },
  { type: 'circle', size: 60, top: '45%', left: '10%', delay: 6, duration: 16, opacity: 0.04, color: '#0F1B3D' },
  { type: 'circle', size: 100, top: '65%', left: '90%', delay: 2, duration: 20, opacity: 0.035, color: '#0F1B3D' },
  { type: 'circle', size: 50, top: '80%', left: '30%', delay: 8, duration: 24, opacity: 0.03, color: '#F5E642' },
  // dots
  { type: 'dot', size: 8, top: '15%', left: '45%', delay: 1, duration: 12, opacity: 0.08, color: '#0F1B3D' },
  { type: 'dot', size: 6, top: '35%', left: '72%', delay: 4, duration: 14, opacity: 0.07, color: '#F5E642' },
  { type: 'dot', size: 10, top: '55%', left: '20%', delay: 7, duration: 10, opacity: 0.06, color: '#0F1B3D' },
  { type: 'dot', size: 7, top: '75%', left: '60%', delay: 2, duration: 16, opacity: 0.08, color: '#0F1B3D' },
  { type: 'dot', size: 5, top: '90%', left: '80%', delay: 5, duration: 13, opacity: 0.07, color: '#F5E642' },
  // hexagons
  { type: 'hex', size: 18, top: '12%', left: '65%', delay: 3, duration: 20, opacity: 0.05, color: '#0F1B3D' },
  { type: 'hex', size: 14, top: '50%', left: '50%', delay: 9, duration: 18, opacity: 0.04, color: '#F5E642' },
  { type: 'hex', size: 16, top: '85%', left: '15%', delay: 6, duration: 22, opacity: 0.05, color: '#0F1B3D' },
  // diamonds
  { type: 'diamond', size: 12, top: '28%', left: '35%', delay: 2, duration: 15, opacity: 0.06, color: '#0F1B3D' },
  { type: 'diamond', size: 10, top: '60%', left: '75%', delay: 5, duration: 17, opacity: 0.06, color: '#F5E642' },
  { type: 'diamond', size: 14, top: '40%', left: '92%', delay: 8, duration: 19, opacity: 0.05, color: '#0F1B3D' },
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
  if (type === 'hex') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2l9 5v10l-9 5-9-5V7z" />
      </svg>
    )
  }
  // diamond
  return (
    <div style={{
      width: size,
      height: size,
      background: color,
      transform: 'rotate(45deg)',
    }} />
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
