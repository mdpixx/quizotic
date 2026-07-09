'use client'

import { useRef } from 'react'
import { useFitText } from '@/hooks/use-fit-text'

export interface HostOptionTileProps {
  /** Letter chip label, e.g. "A". */
  letter: string
  /** Tailwind background class for the letter chip (OPTION_COLORS[i]). */
  colorClass: string
  /** Answer text. */
  text: string
  /** Optional option image rendered above the text. */
  imageUrl?: string
  /** Vote count for this option. */
  votes: number
  /** Vote share (0–100) for the bottom fill bar. */
  votePct: number
  /** True once the host has revealed — shows the vote badge + fills the bar. */
  showVotes: boolean
  /** True only for the correct option of a scored question after reveal. */
  highlightCorrect: boolean
}

// One answer tile on the host stage.
//
// Each tile runs its OWN closed-loop font fit (useFitText) instead of sharing
// one size across the grid. A short answer therefore grows to fill its card
// while a long one shrinks — previously every tile adopted the worst (longest)
// tile's size and short answers sat adrift in whitespace.
//
// Text is left-aligned and never hyphenated (no "-" word breaks). The vote count +
// correct check are a small corner badge, positioned absolutely, so while the
// question is LIVE the text owns the tile's full width — no dead right strip
// reserving space for reveal chrome that hasn't appeared yet. The badge fades
// in on reveal; being out-of-flow, it never re-wraps the text.
export function HostOptionTile({
  letter,
  colorClass,
  text,
  imageUrl,
  votes,
  votePct,
  showVotes,
  highlightCorrect,
}: HostOptionTileProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)

  useFitText(contentRef, textRef, {
    min: 14,
    max: 38,
    cssVar: '--opt-fit-size',
    // Geometric containment, not scroll metrics: centered text paints upward
    // out of its min-h-0 parent when over-tall, and that upward overflow is
    // invisible to scrollHeight. The text rect must sit inside the content rect.
    fits: () => {
      const c = contentRef.current
      const t = textRef.current
      if (!c || !t) return true
      const s = t.getBoundingClientRect()
      const b = c.getBoundingClientRect()
      return s.top >= b.top - 1 && s.bottom <= b.bottom + 1 && s.right <= b.right + 1
    },
    deps: [text, imageUrl],
  })

  return (
    <div
      className={`host-option-tile rounded-2xl overflow-hidden border-2 transition-all ${highlightCorrect ? 'ring-4 ring-green-300 border-green-200' : 'border-white/20'}`}
      style={{
        // Dark glass surface on the projector gradient: the question card stays
        // solid white (the "spotlight"), so making the answer tiles translucent
        // glass gives the two zones distinct materials at a glance. Correct tile
        // turns green glass on reveal — geometry is identical, only tint shifts,
        // so nothing jumps on the projector.
        background: highlightCorrect ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.06)',
        boxShadow: highlightCorrect
          ? '0 18px 50px rgba(34,197,94,0.30), inset 0 1px 0 rgba(255,255,255,0.14)'
          : '0 12px 34px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)',
      }}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-full object-cover" style={{ height: 'min(14vh, 128px)' }} loading="lazy" />
      )}
      <div ref={contentRef} className="relative flex-1 min-h-0 p-3 md:p-5 flex items-center gap-3 md:gap-4">
        <span
          className={`w-11 h-11 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-xl md:text-2xl font-black text-white flex-shrink-0 ${colorClass}`}
          style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.16)' }}
        >
          {letter}
        </span>
        <span ref={textRef} className="host-opt-text flex-1 min-w-0 break-words font-medium">{text}</span>
        {/* Corner badge — absolute so it reserves no width while live; fades in on reveal. */}
        <div
          className={`host-opt-badge absolute top-2 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] md:text-xs font-black tabular-nums transition-opacity duration-300 ${showVotes ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ background: highlightCorrect ? '#16A34A' : 'rgba(15,27,61,0.9)', color: '#fff' }}
          aria-hidden={!showVotes}
        >
          {highlightCorrect && <span aria-hidden>✓</span>}
          {votes}
        </div>
      </div>
      {/* Vote-share bar — fill animates on reveal. Green is reserved EXCLUSIVELY
          for the correct answer: wrong options use a neutral white fill instead
          of their chip hue, because option D's chip is green and a green bar on
          a wrong answer misread as "this is correct". Track is tinted for glass. */}
      <div className={`h-3 ${highlightCorrect ? 'bg-[#BBF7D0]/40' : 'bg-white/10'}`}>
        <div
          className={`h-full transition-all duration-500 ${highlightCorrect ? 'bg-green-500' : 'bg-white/70'}`}
          style={{ width: showVotes ? `${votePct}%` : '0%' }}
        />
      </div>
    </div>
  )
}
