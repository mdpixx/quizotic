'use client'

/**
 * ModeExplainerCard — the two front-door cards on the host dashboard that
 * teach the quiz-vs-presentation difference through a looping, lightweight
 * SVG/CSS animation (no video, transform/opacity only, reduced-motion aware).
 *
 *   quiz         → a scored question whose answers resolve into a rising
 *                  leaderboard — "scored competition, with a winner."
 *   presentation → a live poll whose bars fill as the room votes —
 *                  "host-led interactive slides, no scores."
 */

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'

interface ModeExplainerCardProps {
  mode: 'quiz' | 'presentation'
  href: string
}

// Canonical answer-tile colours (kept consistent with the live answer tiles).
const ANSWER = ['#E21B3C', '#1368CE', '#D89E00', '#26890C']

function QuizAnimation({ animate }: { animate: boolean }) {
  // Loop: 4 option chips flash a "correct" highlight, then three leaderboard
  // bars grow to different heights — the scored→ranked story in ~3.5s.
  const loop = animate
    ? { repeat: Infinity, repeatType: 'loop' as const, duration: 3.6, ease: 'easeInOut' as const }
    : undefined
  const barHeights = [38, 26, 18]
  return (
    <svg viewBox="0 0 200 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block" aria-hidden>
      {/* question chip row */}
      {ANSWER.map((c, i) => (
        <motion.rect
          key={c}
          x={12 + i * 46} y={10} width={38} height={22} rx={6} fill={c}
          initial={false}
          animate={animate ? { opacity: i === 3 ? [0.55, 1, 1, 0.55] : [0.55, 0.55, 0.35, 0.55] } : { opacity: 0.85 }}
          transition={loop}
        />
      ))}
      {/* "correct" tick on the green chip */}
      <motion.path
        d="M156 18l4 4 8-9"
        fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        initial={false}
        animate={animate ? { opacity: [0, 0, 1, 0], pathLength: [0, 0, 1, 1] } : { opacity: 0 }}
        transition={loop}
      />
      {/* rising leaderboard bars */}
      {barHeights.map((h, i) => (
        <motion.rect
          key={i}
          x={28 + i * 52} width={36} rx={4}
          fill={i === 0 ? '#F5E642' : '#0F1B3D'}
          initial={false}
          animate={animate ? { height: [4, 4, h, h], y: [84, 84, 84 - h, 84 - h] } : { height: h, y: 84 - h }}
          transition={loop}
        />
      ))}
    </svg>
  )
}

function PresentationAnimation({ animate }: { animate: boolean }) {
  // Loop: three poll bars fill to live-vote widths, then reset — the
  // "everyone responds, no score" story.
  const loop = animate
    ? { repeat: Infinity, repeatType: 'loop' as const, duration: 3.2, ease: 'easeInOut' as const }
    : undefined
  const widths = [150, 96, 124]
  return (
    <svg viewBox="0 0 200 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block" aria-hidden>
      {widths.map((w, i) => (
        <g key={i}>
          <rect x={16} y={14 + i * 26} width={168} height={16} rx={8} fill="#0891B2" opacity={0.12} />
          <motion.rect
            x={16} y={14 + i * 26} height={16} rx={8} fill="#0891B2"
            initial={false}
            animate={animate ? { width: [8, w, w, 8] } : { width: w }}
            transition={loop ? { ...loop, delay: i * 0.18 } : undefined}
          />
        </g>
      ))}
    </svg>
  )
}

export function ModeExplainerCard({ mode, href }: ModeExplainerCardProps) {
  const reduce = useReducedMotion()
  const animate = !reduce
  const isQuiz = mode === 'quiz'

  const cfg = isQuiz
    ? {
        bg: '#FFFDE6', border: '#0F1B3D', vizBg: '#FFFFFF', vizBorder: '#0F1B3D22',
        badge: 'Scored', badgeBg: '#F5E642', badgeText: '#0D0D0D',
        title: 'Create quiz',
        line: 'Scored competition with a live leaderboard and a winner.',
        sub: 'Generate with AI or build manually · host live or share self-paced.',
        cta: 'Open quiz builder',
        ctaClass: 'btn-primary',
      }
    : {
        bg: '#FFFFFF', border: '#BFDBFE', vizBg: '#F0F9FF', vizBorder: '#BFDBFE',
        badge: 'No scores', badgeBg: '#EFF6FF', badgeText: '#1368CE',
        title: 'Create presentation',
        line: 'Host-led interactive slides — polls, word clouds, Q&A.',
        sub: 'Run the room slide by slide · import from PPTX.',
        cta: 'Open slide builder',
        ctaClass: '',
      }

  return (
    <Link
      href={href}
      className="group block rounded-2xl border p-5 transition-all hover:scale-[1.01] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ background: cfg.bg, borderColor: cfg.border, textDecoration: 'none' }}
    >
      {/* Animated explainer visual */}
      <div
        className="relative rounded-xl mb-4 overflow-hidden"
        style={{ background: cfg.vizBg, border: `1px solid ${cfg.vizBorder}`, aspectRatio: '200 / 96' }}
      >
        <span
          className="absolute top-2 right-2 z-10 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: cfg.badgeBg, color: cfg.badgeText }}
        >
          {cfg.badge}
        </span>
        <div className="absolute inset-0 p-2">
          {isQuiz ? <QuizAnimation animate={animate} /> : <PresentationAnimation animate={animate} />}
        </div>
      </div>

      <h2 className="text-xl font-black mb-1" style={{ color: '#0F1B3D' }}>{cfg.title}</h2>
      <p className="text-sm font-semibold leading-snug mb-1" style={{ color: '#1E293B' }}>{cfg.line}</p>
      <p className="text-xs leading-relaxed mb-4" style={{ color: '#64748B' }}>{cfg.sub}</p>

      {isQuiz ? (
        <span className={cfg.ctaClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          {cfg.cta}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors group-hover:bg-blue-50" style={{ color: '#1368CE', border: '1px solid #BFDBFE' }}>
          {cfg.cta}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      )}
    </Link>
  )
}
