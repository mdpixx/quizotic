'use client'

import { motion } from 'framer-motion'

function Leaf({ className, style, duration = 6, delay = 0 }: {
  className?: string; style?: React.CSSProperties; duration?: number; delay?: number
}) {
  return (
    <motion.svg
      animate={{ y: [-8, 8, -8], rotate: [-3, 3, -3] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' as const, delay }}
      className={className} style={style}
      viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" fill="none">
      <ellipse cx="40" cy="20" rx="38" ry="16" fill="var(--color-sage-light)" opacity="0.5" />
      <ellipse cx="36" cy="18" rx="26" ry="10" fill="var(--color-sage)" opacity="0.35" />
    </motion.svg>
  )
}

function GoldenLeaf({ className, style, duration = 7, delay = 0 }: {
  className?: string; style?: React.CSSProperties; duration?: number; delay?: number
}) {
  return (
    <motion.svg
      animate={{ x: [-6, 6, -6], y: [-10, 4, -10] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' as const, delay }}
      className={className} style={style}
      viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" fill="none">
      <ellipse cx="30" cy="15" rx="28" ry="12" fill="var(--color-amber-glow)" opacity="0.5" />
      <ellipse cx="27" cy="13" rx="18" ry="8" fill="var(--color-amber-light)" opacity="0.4" />
    </motion.svg>
  )
}

function Dot({ className, style, color = 'var(--color-amber-glow)', size = 10 }: {
  className?: string; style?: React.CSSProperties; color?: string; size?: number
}) {
  return (
    <motion.div
      animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.9, 1.1, 0.9] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
      className={className}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color, ...style,
      }}
    />
  )
}

export function HeroBotanicals() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Top-right large leaf */}
      <Leaf className="absolute" style={{ top: '8%', right: '4%', width: 140 }} duration={8} delay={0} />
      {/* Top-right small golden */}
      <GoldenLeaf className="absolute" style={{ top: '5%', right: '22%', width: 90 }} duration={6} delay={0.5} />
      {/* Right side mid */}
      <Leaf className="absolute" style={{ top: '45%', right: '2%', width: 100 }} duration={7} delay={1} />
      {/* Bottom-left */}
      <Leaf className="absolute" style={{ bottom: '12%', left: '3%', width: 120 }} duration={9} delay={2} />
      <GoldenLeaf className="absolute" style={{ bottom: '22%', left: '8%', width: 70 }} duration={6.5} delay={1.5} />
      {/* Dots scattered */}
      <Dot className="absolute" style={{ top: '15%', right: '35%' }} size={8} />
      <Dot className="absolute" style={{ top: '60%', right: '8%' }} size={6} color="var(--color-sage-light)" />
      <Dot className="absolute" style={{ bottom: '30%', left: '15%' }} size={10} />
    </div>
  )
}
