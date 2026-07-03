'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Avatar } from './Avatar'
import {
  playBassBoom,
  playCelebration,
  playCheer,
  playCheerLoop,
  playCorrect,
  playDrumroll,
  preloadCelebrationSounds,
  stopCheer,
  stopDrumroll,
} from '@/lib/sounds'
import { startConfettiLoop, useConfetti } from '@/hooks/useConfetti'

interface PodiumEntry {
  name: string
  archetype?: string
  score: number
}

interface PodiumProps {
  leaderboard: PodiumEntry[]
  sessionMode: string
  highlightName?: string
  // When true, start in the final 'rest' state with no reveal animation or
  // sound. Used for the inline copy on the post-quiz report, once the
  // CelebrationOverlay has already played the dramatic reveal.
  skipIntro?: boolean
  // When true, fire gentle confetti sprinkles on a loop while the podium is
  // mounted — stops when the host dismisses or leaves the screen. Respects
  // prefers-reduced-motion.
  loopConfetti?: boolean
  showRest?: boolean
  variant?: 'standard' | 'finale'
}

type Phase = 'idle' | 'third' | 'second' | 'drumroll' | 'winner' | 'rest'

const PHASE_TIMINGS: Array<{ at: number; next: Phase }> = [
  { at: 400, next: 'third' },
  { at: 1500, next: 'second' },
  { at: 2800, next: 'drumroll' },
  { at: 4300, next: 'winner' },
  { at: 6300, next: 'rest' },
]

// Olympic-style podium: proper tier heights + rich metallic gradients.
// Gold (1st) > Silver (2nd) > Bronze (3rd) with contrast-checked labels.
const PODIUM_CONFIG = [
  {
    place: 2,
    height: 150,
    gradient: 'linear-gradient(180deg, #E8EAF0 0%, #C0C5CE 55%, #8D95A3 100%)',
    labelColor: '#1F2937',
    topHighlight: '#FFFFFF',
    label: '2nd',
  },
  {
    place: 1,
    height: 210,
    gradient: 'linear-gradient(180deg, #FFE082 0%, #FFB300 55%, #E69500 100%)',
    labelColor: '#5C2D00',
    topHighlight: '#FFF3C4',
    label: '1st',
  },
  {
    place: 3,
    height: 100,
    gradient: 'linear-gradient(180deg, #E6A97B 0%, #C17A3A 55%, #8B5222 100%)',
    labelColor: '#FFFFFF',
    topHighlight: '#F4C896',
    label: '3rd',
  },
]

// Medal colors — Olympic-style gradient endpoints.
const MEDAL_STYLES: Record<1 | 2 | 3, { rim: string; rimDark: string; ribbon: string }> = {
  1: { rim: '#FFE066', rimDark: '#B8860B', ribbon: '#DC2626' },       // gold / red ribbon
  2: { rim: '#E5E7EB', rimDark: '#9CA3AF', ribbon: '#2563EB' },       // silver / blue ribbon
  3: { rim: '#E0A97B', rimDark: '#8B4513', ribbon: '#16A34A' },       // bronze / green ribbon
}

// Small participation ribbon for ranks 4+. Warm soft-gold palette so the
// consolation list feels like a reward, not an afterthought.
function ParticipationRibbon({ rank, size = 26 }: { rank: number; size?: number }) {
  // Rank-graded tones: 4 → richest gold, fading to neutral after rank 10
  const palette = rank <= 4
    ? { body: '#FDE68A', stroke: '#D97706', text: '#92400E' }
    : rank <= 6
      ? { body: '#E5E7EB', stroke: '#9CA3AF', text: '#374151' }
      : { body: '#F5F3FF', stroke: '#C4B5FD', text: '#5B21B6' }
  return (
    <svg width={size} height={size * 1.35} viewBox="0 0 28 38" aria-hidden>
      <path d="M4 0 L24 0 L24 22 L14 30 L4 22 Z" fill={palette.body} stroke={palette.stroke} strokeWidth="1.3" />
      <text x="14" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill={palette.text} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {rank}
      </text>
    </svg>
  )
}

// Small inline medal. place ∈ {1,2,3}; drawn as a ribbon + coin with embossed number.
function Medal({ place, size = 40 }: { place: 1 | 2 | 3; size?: number }) {
  const s = MEDAL_STYLES[place]
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 40 56" aria-hidden>
      {/* Ribbon */}
      <path d="M11 0 L20 22 L29 0 L24 0 L20 12 L16 0 Z" fill={s.ribbon} />
      {/* Coin */}
      <circle cx="20" cy="38" r="15" fill={s.rim} stroke={s.rimDark} strokeWidth="1.5" />
      <circle cx="20" cy="38" r="11" fill="none" stroke={s.rimDark} strokeWidth="0.8" strokeOpacity="0.5" />
      <text
        x="20"
        y="43"
        textAnchor="middle"
        fontSize="13"
        fontWeight="900"
        fill={s.rimDark}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {place}
      </text>
    </svg>
  )
}

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const m = window.matchMedia('(prefers-reduced-motion: reduce)')
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
function getReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
}

export function Podium({
  leaderboard,
  sessionMode,
  highlightName,
  skipIntro = false,
  loopConfetti = false,
  showRest = true,
  variant = 'standard',
}: PodiumProps) {
  const reduced = usePrefersReducedMotion()
  const [rawPhase, setPhase] = useState<Phase>(skipIntro ? 'rest' : 'idle')
  const phase: Phase = reduced || skipIntro ? 'rest' : rawPhase
  const isCompetitive = sessionMode === 'competitive'
  const isFinale = variant === 'finale'
  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  const firedWinnerEffects = useRef(false)
  const fireConfetti = useConfetti()

  // Preload MP3s as soon as the podium mounts so there's no delay on reveal.
  useEffect(() => {
    preloadCelebrationSounds()
  }, [])

  // Looping celebration confetti — starts immediately when the podium is
  // shown statically (skipIntro), or waits for the dramatic reveal to
  // complete (phase === 'rest') so the welcome burst doesn't step on the
  // drumroll/winnerSlam moment. Cleanup stops all timers on unmount.
  const shouldLoop = loopConfetti && (skipIntro || phase === 'rest')
  useEffect(() => {
    if (!shouldLoop) return
    // Force the loop through prefers-reduced-motion. `loopConfetti` is only set
    // on the finale podium — a deliberate celebration the host opted into by
    // ending the quiz — so it should always paint, even under macOS Reduce Motion.
    const stop = startConfettiLoop(true)
    return () => stop()
  }, [shouldLoop])

  // Schedule the reveal sequence. Reduced motion skips straight to rest and
  // plays a single fanfare — no drumroll, cheer, or shake. When skipIntro is
  // set we render directly in rest state with no sounds (already played
  // upstream, e.g. in CelebrationOverlay).
  useEffect(() => {
    if (skipIntro) return
    if (reduced) {
      playCelebration()
      // The finale still celebrates under reduced motion (host opted in): fire
      // the winner burst + looping applause. The forced confetti loop above
      // handles the ongoing sprinkle; cleanup stops the applause on unmount.
      if (isFinale) {
        playBassBoom()
        playCheerLoop()
        fireConfetti('winner')
        return () => stopCheer()
      }
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    PHASE_TIMINGS.forEach(({ at, next }) => {
      timers.push(setTimeout(() => setPhase(next), at))
    })

    // Phase-aligned sound cues
    timers.push(setTimeout(() => playCorrect(), PHASE_TIMINGS[0].at)) // 3rd reveal chime
    timers.push(setTimeout(() => playCorrect(), PHASE_TIMINGS[1].at)) // 2nd reveal chime
    timers.push(setTimeout(() => playDrumroll(), PHASE_TIMINGS[2].at)) // drumroll starts
    timers.push(setTimeout(() => {
      if (firedWinnerEffects.current) return
      firedWinnerEffects.current = true
      stopDrumroll()
      playBassBoom()
      // Finale loops applause through the whole podium moment; other podiums
      // (between-question standings) keep the single celebratory cheer.
      if (isFinale) playCheerLoop()
      else playCheer()
      playCelebration()
      // Fire the dramatic multi-phase confetti fireworks at the winner reveal.
      // This was previously disabled (relying only on the floating-gold DOM
      // layer), which read as "confetti doesn't work." The 'winner' preset
      // runs a 3.6s side-cannon + fountain + gold-crown sequence that lands
      // exactly on this moment. useConfetti respects prefers-reduced-motion.
      fireConfetti('winner')
    }, PHASE_TIMINGS[3].at))

    return () => {
      timers.forEach(clearTimeout)
      stopDrumroll()
      stopCheer()
    }
  }, [reduced, skipIntro, isFinale, fireConfetti])

  const skip = () => {
    stopDrumroll()
    stopCheer()
    if (!firedWinnerEffects.current && !reduced) {
      firedWinnerEffects.current = true
      playCelebration()
    }
    setPhase('rest')
  }

  // Reorder for display: [2nd, 1st, 3rd]
  const ordered = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
      ? [top3[1], top3[0]]
      : [top3[0]]

  const baseConfigForCount = top3.length >= 3
    ? PODIUM_CONFIG
    : top3.length === 2
      ? [PODIUM_CONFIG[0], PODIUM_CONFIG[1]]
      : [PODIUM_CONFIG[1]]
  const configForCount = isFinale
    ? baseConfigForCount.map(cfg => ({ ...cfg, height: Math.round(cfg.height * 1.08) }))
    : baseConfigForCount

  // Which places have been revealed yet?
  const placeIsVisible = (place: number): boolean => {
    if (phase === 'rest' || phase === 'winner') return true
    if (phase === 'drumroll' || phase === 'second') return place === 2 || place === 3
    if (phase === 'third') return place === 3
    return false
  }

  return (
    <div
      className="relative max-w-full"
      style={{
        // Clip the halo, confetti, and shake inside the podium bounds so
        // yellow glow doesn't bleed onto the rest of the page. max-w-full
        // + overflow:hidden also prevents the wide medal SVGs from causing
        // horizontal scroll on the participant mobile view.
        overflow: 'hidden',
        borderRadius: 18,
        padding: isFinale ? '28px 12px 14px' : '24px 12px 8px',
      }}
    >
      {/* Skip intro animation — visible during every phase except rest */}
      {phase !== 'rest' && (
        <button
          type="button"
          onClick={skip}
          className="absolute top-2 right-2 z-10 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#1E1B4B', border: '1px solid #E5E7EB' }}
          aria-label="Skip podium animation"
        >
          Skip →
        </button>
      )}

      {/* Podium — wider spacing and clipped internally so shake never pushes glow past the edge */}
      <div
        className="flex items-end justify-center gap-2 sm:gap-6 relative"
        style={{
          minHeight: isFinale ? 380 : 280,
          // Shake removed — read as "jittery" on a projector. The spotlight
          // halo + crown bounce + winnerSlam already sell the winner moment
          // without the whole podium twitching sideways.
          animation: undefined,
        }}
      >
        {ordered.map((entry, i) => {
          if (!entry) return null
          const cfg = configForCount[i]
          const isWinner = cfg.place === 1
          const isHighlighted = highlightName && entry.name === highlightName
          const visible = placeIsVisible(cfg.place)
          const winnerRevealed = isWinner && (phase === 'winner' || phase === 'rest')
          const winnerPending = isWinner && phase === 'drumroll'

          return (
            <div
              key={entry.name}
              className={`flex flex-col items-center gap-2 relative ${top3.length === 1 ? (isFinale ? 'w-60' : 'w-44') : isFinale ? 'flex-1 min-w-0 max-w-[190px]' : 'flex-1 min-w-0 max-w-[140px]'}`}
            >
              {/* Spotlight halo behind winner — compact + softer so it doesn't spill outward */}
              {isWinner && !reduced && (phase === 'drumroll' || phase === 'winner' || phase === 'rest') && (
                <div
                  aria-hidden
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none rounded-full"
                  style={{
                    bottom: 0,
                    width: isFinale ? 240 : 170,
                    height: isFinale ? 240 : 170,
                    background: 'radial-gradient(circle, rgba(251,209,59,0.32) 0%, rgba(251,209,59,0) 72%)',
                    animation: winnerPending
                      ? 'spotlightPulse 0.9s ease-in-out infinite'
                      : winnerRevealed
                        ? 'spotlightFlare 0.7s ease-out forwards'
                        : undefined,
                    zIndex: 0,
                  }}
                />
              )}

              {/* Badge slot — FIXED-HEIGHT so the winner column never grows when
                  the crown / mystery-? mount during the reveal chain. Previously
                  these were conditional {cond && <el/>} siblings that pushed the
                  avatar/name column downward the instant they appeared — the main
                  source of the podium "stutter." Now the slot always reserves its
                  space; only its contents swap (crown ↔ mystery ↔ empty). */}
              {isWinner ? (
                <div className="flex items-end justify-center" style={{ height: 30, zIndex: 2 }} aria-hidden={!winnerRevealed && !winnerPending}>
                  {winnerRevealed ? (
                    <div
                      className="rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
                      style={{
                        animation: 'crownBounce 0.6s ease-out forwards',
                        color: '#5C2D00',
                        background: 'linear-gradient(180deg, #FFF3C4, #FBD13B)',
                        boxShadow: '0 8px 24px rgba(251,209,59,0.32)',
                      }}
                    >
                      Winner
                    </div>
                  ) : winnerPending ? (
                    <div style={{ fontSize: '2rem', lineHeight: 1, color: 'rgba(30,27,75,0.35)', animation: 'mysteryBlink 0.7s ease-in-out infinite' }}>
                      ?
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Avatar + name */}
              <div
                className="flex flex-col items-center gap-1 relative"
                style={{
                  zIndex: 1,
                  opacity: visible ? 1 : 0,
                  animation: visible
                    ? isWinner && winnerRevealed && !reduced
                      ? 'winnerSlam 0.85s cubic-bezier(0.34, 1.32, 0.64, 1) both'
                      : !reduced
                        ? 'fadeSlideUp 0.5s ease-out both'
                        : undefined
                    : undefined,
                }}
              >
                {/* Medal slot — FIXED-HEIGHT so the avatar never jumps down when
                    the medal drops in. The slot reserves the medal's height even
                    before the place is revealed; the medal animates into it. */}
                <div style={{ height: isWinner ? (isFinale ? 50 : 38) : (isFinale ? 36 : 28), marginBottom: -6 }}>
                  {visible && (cfg.place === 1 || cfg.place === 2 || cfg.place === 3) && (!isWinner || winnerRevealed) && (
                    <div
                      style={{
                        animation: !reduced ? 'medalDrop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both' : undefined,
                      }}
                    >
                      <Medal place={cfg.place as 1 | 2 | 3} size={isWinner ? (isFinale ? 58 : 44) : (isFinale ? 42 : 34)} />
                    </div>
                  )}
                </div>
                <div
                  className={`rounded-full overflow-hidden ${isHighlighted ? 'ring-3' : ''}`}
                  style={isHighlighted ? ({ '--tw-ring-color': '#FBD13B' } as React.CSSProperties) : undefined}
                >
                  <Avatar archetype={entry.archetype ?? entry.name} size={isWinner ? (isFinale ? 104 : 72) : (isFinale ? 72 : 52)} />
                </div>
                <div className="flex flex-col items-center w-full px-1">
                  <span
                    className={`${isFinale ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'} font-bold text-center w-full leading-tight break-words hyphens-auto`}
                    style={{
                      color: '#1E1B4B',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                    }}
                  >
                    {entry.name || entry.archetype}
                  </span>
                  {entry.name && entry.archetype && (
                    <span
                      className={`${isFinale ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'} text-gray-500 mt-0.5 w-full text-center leading-tight`}
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {entry.archetype}
                    </span>
                  )}
                </div>
                {isCompetitive && (
                  <p
                    className={`${isFinale ? 'text-base' : 'text-xs'} font-black tabular-nums`}
                    style={{ color: isWinner ? '#92400E' : '#6B7280' }}
                  >
                    {entry.score.toLocaleString()} pts
                  </p>
                )}
              </div>

              {/* Olympic-style step — metallic gradient bar with a brighter
                  top edge so it reads as a 3D tier. Label is white/dark
                  chosen per tier for WCAG-AA contrast against the gradient.
                  Layout reserves the full height upfront and animates the
                  visual via scaleY from the bottom, so the page does not
                  reflow as bars grow (otherwise content below shifts down
                  every frame). */}
              <div
                className="w-full rounded-t-xl flex items-end justify-center relative overflow-hidden"
                style={{
                  height: cfg.height,
                  transformOrigin: 'bottom center',
                  transform: visible
                    ? reduced ? 'scaleY(1)' : undefined
                    : 'scaleY(0)',
                  background: cfg.gradient,
                  animation: visible && !reduced ? 'growBarScale 1.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards' : undefined,
                  boxShadow: isWinner
                    ? '0 -3px 12px rgba(255,179,0,0.22), inset 0 -6px 12px rgba(0,0,0,0.18)'
                    : 'inset 0 -4px 10px rgba(0,0,0,0.15)',
                  zIndex: 1,
                  paddingBottom: 14,
                }}
              >
                {/* Top highlight strip — sells the "shiny metallic step" look */}
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0"
                  style={{ height: 6, background: cfg.topHighlight, opacity: 0.85 }}
                />
                <span
                  className="font-black tracking-wide"
                  style={{
                    color: cfg.labelColor,
                    fontSize: isWinner ? '1.75rem' : '1.5rem',
                    textShadow: isWinner ? '0 1px 0 rgba(255,255,255,0.55)' : '0 1px 2px rgba(0,0,0,0.25)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Honorable Mentions — glass-panel list of ranks 4+ */}
      {showRest && rest.length > 0 && (
        <div
          className="rounded-3xl p-4 md:p-5"
          style={{
            opacity: phase === 'rest' ? 1 : 0,
            transform: phase === 'rest' ? 'translateY(0)' : 'translateY(16px)',
            transition: 'all 0.5s ease-out',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.55)',
            boxShadow: '0 8px 32px rgba(15,27,61,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-sm md:text-base font-black"
              style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D', letterSpacing: '0.02em' }}
            >
              Honorable Mentions
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6B7280' }}>
              {rest.length} more
            </span>
          </div>
          <div className="space-y-2">
            {rest.map((entry, i) => {
              const rank = i + 4
              const isHighlighted = highlightName && entry.name === highlightName
              return (
                <div
                  key={entry.name}
                  className={`flex items-center gap-3 rounded-2xl p-2.5 ${isHighlighted ? 'ring-2' : ''}`}
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(255,255,255,0.7)',
                    animation: !reduced && phase === 'rest' ? `fadeSlideUp 0.45s ease-out ${i * 60}ms both` : undefined,
                    ...(isHighlighted ? { '--tw-ring-color': '#FBD13B' } : {}),
                  } as React.CSSProperties}
                >
                  <div className="flex-shrink-0"><ParticipationRibbon rank={rank} size={24} /></div>
                  <Avatar archetype={entry.archetype ?? entry.name} size={36} />
                  <span
                    className="flex-1 font-semibold text-sm min-w-0 leading-tight"
                    style={{
                      color: '#1E1B4B',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                    }}
                  >
                    {entry.name}
                  </span>
                  {isCompetitive && (
                    <span className="text-sm font-bold tabular-nums" style={{ color: '#4B5563' }}>
                      {entry.score.toLocaleString()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes growBarScale {
          0% { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes crownBounce {
          0% { transform: scale(0) rotate(-20deg); }
          60% { transform: scale(1.3) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes winnerSlam {
          0% { opacity: 0; transform: scale(0.2) translateY(-40px); }
          60% { opacity: 1; transform: scale(1.25) translateY(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spotlightPulse {
          0%, 100% { opacity: 0.35; transform: translateX(-50%) scale(0.92); }
          50% { opacity: 0.75; transform: translateX(-50%) scale(1.08); }
        }
        @keyframes spotlightFlare {
          0% { opacity: 0.9; transform: translateX(-50%) scale(1.2); }
          100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
        }
        @keyframes mysteryBlink {
          0%, 100% { opacity: 0.3; transform: scale(0.95); }
          50% { opacity: 0.85; transform: scale(1.1); }
        }
        @keyframes podiumShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes medalDrop {
          0%   { opacity: 0; transform: translateY(-32px) rotate(-25deg) scale(0.6); }
          55%  { opacity: 1; transform: translateY(4px)   rotate(8deg)   scale(1.1); }
          100% { opacity: 1; transform: translateY(0)     rotate(0)      scale(1); }
        }
      `}</style>
    </div>
  )
}
