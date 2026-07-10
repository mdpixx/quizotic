'use client'

import { useRef } from 'react'
import { useFitText } from '@/hooks/use-fit-text'
import { colorForIndex } from '@/lib/answer-colors'

export interface HostOptionTileProps {
  /** Letter chip label, e.g. "A". */
  letter: string
  /** Tailwind background class for the letter chip (OPTION_COLORS[i]) — kept for
   *  prop compatibility; the tile now derives its own jewel hue from the index. */
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
  /** True only for the correct option(s) of a scored question after reveal. */
  highlightCorrect: boolean
  /** Zero-based option index — used to look up the canonical jewel hue. */
  index?: number
}

// One answer tile on the host stage.
//
// "The Atrium" redesign: tiles are saturated jewel gradients (Kahoot-style,
// from answer-colors.ts tileStyle()) — they read cleanly from across a room
// and give each option a stable color identity the phone can match. While the
// question is LIVE the tiles are pristine: no badge, no bar, no counts — a
// pure billboard. On reveal the tiles BECOME the chart:
//   • the correct option(s) bloom to emerald with a soft green edge glow and a
//     white-tick-in-green-circle marker (no "Correct" wordmark — the mark is
//     unmistakable and quieter)
//   • wrong options desaturate to recede
//   • a proportional fill bar rises behind each tile and a "% " label fades in
//
// Each tile still runs its OWN closed-loop font fit (useFitText) — a short
// answer grows to fill its card while a long one shrinks, instead of every
// tile adopting the worst (longest) tile's size.
export function HostOptionTile({
  letter,
  text,
  imageUrl,
  votePct,
  showVotes,
  highlightCorrect,
  index = 0,
}: HostOptionTileProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)

  useFitText(contentRef, textRef, {
    min: 14,
    // 30px cap (was 38): short answers no longer balloon far past their
    // siblings, which kept re-shaping the grid question-to-question.
    max: 30,
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

  // Canonical jewel palette for this option index.
  const jewel = colorForIndex(index)

  return (
    <div
      className={`host-option-tile relative overflow-hidden transition-all duration-500`}
      style={{
        // Correct on reveal → emerald bloom + green edge glow + ring.
        // Wrong on reveal → desaturate so it recedes.
        // Live → the option's own jewel gradient. Radius 18px to match the
        // atrium mockup's tile geometry.
        borderRadius: 18,
        background: highlightCorrect
          ? 'linear-gradient(158deg, #1fc765 0%, #16A34A 56%, #0A6E3D 100%)'
          : `linear-gradient(158deg, ${jewel.hexLight} 0%, ${jewel.hex} 56%, ${jewel.hexDark} 100%)`,
        boxShadow: highlightCorrect
          ? '0 16px 42px -8px rgba(34,197,94,0.55), inset 0 1px 0 rgba(255,255,255,0.34), 0 0 0 2px rgba(187,247,208,0.5)'
          : `0 12px 30px -10px ${jewel.glow}, inset 0 1px 0 rgba(255,255,255,0.26)`,
        border: `1.5px solid ${highlightCorrect ? 'rgba(187,247,208,0.5)' : 'rgba(255,255,255,0.14)'}`,
        filter: showVotes && !highlightCorrect ? 'saturate(0.32) brightness(0.6)' : undefined,
        transform: highlightCorrect ? 'translateY(-2px)' : undefined,
      }}
    >
      {/* Vote-share fill — rises on reveal, proportional to votePct. Sits
          behind content (z-0) so the text never re-wraps. Live → width 0. */}
      <div
        className="absolute inset-y-0 left-0 z-0 transition-all duration-700"
        style={{
          width: showVotes ? `${votePct}%` : '0%',
          background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.16))',
        }}
      />

      {imageUrl && (
        <img src={imageUrl} alt="" className="w-full object-cover" style={{ height: 'min(14vh, 128px)' }} loading="lazy" />
      )}
      <div
        ref={contentRef}
        className="relative z-10 flex flex-1 min-h-0 items-center"
        style={{
          // Atrium mockup .tile padding (line 118): generous horizontal padding
          // is what makes tiles read as cards rather than strips, and a wide
          // glyph↔label gap keeps the letter badge cleanly anchored.
          gap: 'clamp(12px, 1.6vw, 18px)',
          padding: 'clamp(16px, 2.4vh, 26px) clamp(18px, 2.6vw, 32px)',
        }}
      >
        <span
          className="host-option-glyph flex flex-shrink-0 items-center justify-center font-black text-white"
          style={{
            // Atrium mockup .tile .glyph (lines 120-122): viewport-scaled square
            // with a 13px radius and a dark translucent fill + top sheen.
            width: 'clamp(40px, 4.6vw, 54px)',
            height: 'clamp(40px, 4.6vw, 54px)',
            borderRadius: 13,
            fontSize: 'clamp(21px, 2.4vw, 28px)',
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.24)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          {letter}
        </span>
        <span ref={textRef} className="host-opt-text min-w-0 flex-1 break-words font-medium text-white">
          {text}
        </span>

        {/* Reveal slot — IN FLOW after the text and always reserving width, so
            revealing never reflows the answer text and a full-width line can
            never paint under the badges (the old absolute-positioned pair did
            exactly that). Width is reserved on wrong tiles too so every
            tile's % sits on the same column. Must stay flex-none/fixed-width
            and inside contentRef so useFitText measures the reduced text box. */}
        <span className="flex flex-none items-center justify-end gap-1.5 w-[76px] md:w-[86px]">
          {/* Vote % — fades in on reveal. Live → invisible but space kept. */}
          <span
            className={`font-black tabular-nums text-white transition-opacity duration-300 ${
              showVotes ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}
            aria-hidden={!showVotes}
          >
            {Math.round(votePct)}<span className="text-[0.6em] font-bold opacity-80">%</span>
          </span>
          {/* Correct marker: a small green circle with a white tick. Fades in
              on reveal for the correct option(s) only. No "Correct" wordmark. */}
          <span
            className={`flex h-7 w-7 flex-none items-center justify-center rounded-full transition-all duration-300 md:h-8 md:w-8 ${
              highlightCorrect
                ? 'scale-100 opacity-100'
                : 'pointer-events-none scale-50 opacity-0'
            }`}
            style={{
              background: '#FFFFFF',
              boxShadow: '0 4px 12px -2px rgba(0,0,0,0.35), 0 0 0 3px rgba(34,197,94,0.35)',
            }}
            aria-hidden={!highlightCorrect}
            aria-label={highlightCorrect ? 'Correct answer' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 md:h-5 md:w-5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </span>
      </div>
    </div>
  )
}
