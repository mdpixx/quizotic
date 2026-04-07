'use client'

interface WaveDividerProps {
  topColor: string
  bottomColor: string
  variant?: 1 | 2 | 3 | 4
  flip?: boolean
}

const PATHS: Record<number, string> = {
  1: 'M0,64 C320,100 640,20 960,64 C1280,108 1440,40 1440,40 L1440,120 L0,120 Z',
  2: 'M0,80 C240,20 480,100 720,60 C960,20 1200,90 1440,50 L1440,120 L0,120 Z',
  3: 'M0,40 C180,100 360,10 540,70 C720,130 900,30 1080,80 C1260,130 1440,60 1440,60 L1440,120 L0,120 Z',
  4: 'M0,60 C360,110 720,10 1080,60 C1260,85 1440,40 1440,40 L1440,120 L0,120 Z',
}

export function WaveDivider({ topColor, bottomColor, variant = 1, flip = false }: WaveDividerProps) {
  return (
    <div
      className="w-full overflow-hidden leading-[0] relative"
      style={{
        marginTop: -1,
        marginBottom: -1,
        transform: flip ? 'scaleY(-1)' : undefined,
      }}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: 'clamp(40px, 6vw, 80px)' }}
      >
        {/* Top background */}
        <rect width="1440" height="120" fill={topColor} />
        {/* Wave shape filled with bottom color */}
        <path d={PATHS[variant]} fill={bottomColor} />
      </svg>
    </div>
  )
}
