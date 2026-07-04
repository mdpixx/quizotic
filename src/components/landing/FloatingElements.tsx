'use client'

// Ambient quiz-flavored shapes drifting inside the navy hero. Purely
// decorative (aria-hidden, pointer-events: none) and intentionally faint —
// the goal is a page that feels alive, not a screensaver. Animations use the
// existing globals.css keyframes (drift / float-slow / orb-drift), which the
// global prefers-reduced-motion rule already freezes.

const ANSWER = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']

interface Shape {
  el: React.ReactNode
  top: string
  left: string
  duration: number
  delay: number
  anim: 'drift' | 'float-slow' | 'orb-drift'
}

function Pill({ color, letter }: { color: string; letter: string }) {
  return (
    <div style={{
      width: 74, height: 30, borderRadius: 8, background: color, opacity: 0.16,
      display: 'flex', alignItems: 'center', paddingLeft: 10,
      fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700,
      fontSize: 13, color: '#fff',
    }}>
      {letter}
    </div>
  )
}

function TimerRing({ size }: { size: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity: 0.14 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.5)" strokeWidth="3" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke="#FBD13B" strokeWidth="3" fill="none"
        strokeDasharray={c} strokeDashoffset={c * 0.35} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ opacity: 0.18 }}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function QMark({ size }: { size: number }) {
  return (
    <div style={{
      fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800,
      fontSize: size, color: '#FBD13B', opacity: 0.10, lineHeight: 1,
    }}>
      ?
    </div>
  )
}

function Dot({ size, color }: { size: number; color: string }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, opacity: 0.22 }} />
}

const SHAPES: Shape[] = [
  { el: <Pill color={ANSWER[0]} letter="A" />, top: '5%', left: '37%', duration: 19, delay: 0, anim: 'drift' },
  { el: <Pill color={ANSWER[2]} letter="C" />, top: '72%', left: '6%', duration: 23, delay: 4, anim: 'orb-drift' },
  { el: <Pill color={ANSWER[1]} letter="B" />, top: '26%', left: '91%', duration: 21, delay: 2, anim: 'float-slow' },
  { el: <TimerRing size={64} />, top: '8%', left: '58%', duration: 26, delay: 1, anim: 'orb-drift' },
  { el: <TimerRing size={40} />, top: '82%', left: '86%', duration: 18, delay: 6, anim: 'drift' },
  { el: <Check size={34} color="#16A34A" />, top: '48%', left: '2%', duration: 17, delay: 3, anim: 'float-slow' },
  { el: <Check size={26} color="#FBD13B" />, top: '62%', left: '95%', duration: 20, delay: 7, anim: 'drift' },
  { el: <QMark size={72} />, top: '38%', left: '46%', duration: 24, delay: 5, anim: 'orb-drift' },
  { el: <QMark size={44} />, top: '86%', left: '40%', duration: 22, delay: 2, anim: 'float-slow' },
  { el: <Dot size={9} color="#FBD13B" />, top: '20%', left: '38%', duration: 14, delay: 1, anim: 'drift' },
  { el: <Dot size={6} color="#5BC0EB" />, top: '55%', left: '73%', duration: 16, delay: 5, anim: 'orb-drift' },
  { el: <Dot size={11} color="#FF8A47" />, top: '90%', left: '64%', duration: 15, delay: 3, anim: 'drift' },
]

export function FloatingElements() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {SHAPES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            animation: `${s.anim} ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          {s.el}
        </div>
      ))}
    </div>
  )
}
