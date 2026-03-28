// Wavy SVG divider between sections.
// Place it BETWEEN two section components. `above` = bg of upper section, `below` = bg of lower section.
// The wave appears to cut organically between the two.

// viewBox is 0 0 1440 120 — waves have full 120px of vertical amplitude
const WAVES = {
  gentle:   'M0,45 C360,110 1080,5 1440,60 L1440,120 L0,120 Z',
  scallop:  'M0,75 C200,15 430,100 650,45 C870,0 1060,95 1250,40 C1360,10 1420,60 1440,55 L1440,120 L0,120 Z',
  deep:     'M0,15 C280,105 620,5 900,80 C1080,120 1280,20 1440,55 L1440,120 L0,120 Z',
  dramatic: 'M0,8 C120,90 310,5 520,68 C730,118 940,5 1120,72 C1280,118 1390,22 1440,45 L1440,120 L0,120 Z',
  soft:     'M0,60 C480,120 960,5 1440,60 L1440,120 L0,120 Z',
  peak:     'M0,120 C360,30 1080,100 1440,45 L1440,0 L0,0 Z',
}

export function WaveDivider({
  above,
  below,
  shape = 'gentle',
  height = 70,
  flip = false,
}: {
  above: string
  below: string
  shape?: keyof typeof WAVES
  height?: number
  flip?: boolean
}) {
  const path = WAVES[shape]
  return (
    <div style={{ background: above, display: 'block', marginBottom: -1, lineHeight: 0 }}>
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{
          display: 'block',
          width: '100%',
          height,
          transform: flip ? 'scaleX(-1)' : undefined,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={path} fill={below} />
      </svg>
    </div>
  )
}
