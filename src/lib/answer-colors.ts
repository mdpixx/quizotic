// Canonical answer-option palette (Kahoot-style saturated) — used EVERYWHERE
// we render A / B / C / D / E / F tiles: host quiz builder, host live view,
// presentation builder, presentation live view, participant phone.
//
// Single source of truth. Never inline hex strings for answer tiles again.

export interface AnswerColor {
  /** Letter label for the option (A, B, C, D, E, F). */
  letter: string
  /** Hex hue used for backgrounds, left-stripes, bars (gradient mid-stop). */
  hex: string
  /** Lighter variant used as the top stop of the tile gradient (the "glow" sheen). */
  hexLight: string
  /** A slightly darker variant for 2D shadows / pressed states / gradient bottom-stop. */
  hexDark: string
  /** Colored shadow rgba used for the soft outer glow under each tile. */
  glow: string
  /** Tailwind class for flat background fills (`bg-…-500` etc.). */
  tw: string
  /** Soft tinted surface behind the tile when a light background is needed. */
  tint: string
}

// Modern "glowy" jewel palette — keeps each option's hue identity (red / blue /
// gold / green / purple / fuchsia) but lighter and more vibrant than the old
// sharp Kahoot clones. All keep white text legible (>=3:1 for large bold). The
// luminous look comes from rendering: a gradient (hexLight -> hex -> hexDark)
// plus a colored `glow` shadow — never by simply lightening the flat fill.
//
// F is fuchsia (not teal/cyan): the presentation sequence chrome is cyan
// (sequence-theme.ts accent #0891B2), so a cyan tile would blend into it.
export const ANSWER_COLORS: AnswerColor[] = [
  { letter: 'A', hex: '#F23A5C', hexLight: '#FF5E7A', hexDark: '#B01539', glow: 'rgba(242,58,92,.45)', tw: 'bg-[#F23A5C]', tint: '#FFE4EA' },
  { letter: 'B', hex: '#2D7FF9', hexLight: '#5C9DFF', hexDark: '#1854B8', glow: 'rgba(45,127,249,.45)', tw: 'bg-[#2D7FF9]', tint: '#E4EEFE' },
  { letter: 'C', hex: '#D9760F', hexLight: '#E88318', hexDark: '#9A4F06', glow: 'rgba(217,118,15,.45)', tw: 'bg-[#D9760F]', tint: '#FBEAD2' },
  { letter: 'D', hex: '#119B57', hexLight: '#16B062', hexDark: '#0A6E3D', glow: 'rgba(17,155,87,.45)', tw: 'bg-[#119B57]', tint: '#D6F2E2' },
  { letter: 'E', hex: '#8B5CF6', hexLight: '#A685FF', hexDark: '#5B21B6', glow: 'rgba(139,92,246,.45)', tw: 'bg-[#8B5CF6]', tint: '#ECE6FE' },
  { letter: 'F', hex: '#C026D3', hexLight: '#D946EF', hexDark: '#86198F', glow: 'rgba(192,38,211,.45)', tw: 'bg-[#C026D3]', tint: '#FAE8FF' },
]

export const ANSWER_LETTERS = ANSWER_COLORS.map(c => c.letter)

export function colorForIndex(i: number): AnswerColor {
  return ANSWER_COLORS[i % ANSWER_COLORS.length]
}

/**
 * Inline style for a "glowy" answer tile: a vibrant gradient fill plus a soft
 * colored outer glow and a faint top sheen. Use everywhere we render A/B/C/D/E
 * tiles so host, builder and participant stay in sync.
 */
export function tileStyle(c: AnswerColor): { background: string; boxShadow: string } {
  return {
    background: `linear-gradient(160deg, ${c.hexLight} 0%, ${c.hex} 55%, ${c.hexDark} 100%)`,
    boxShadow: `0 8px 24px -6px ${c.glow}, inset 0 1px 0 rgba(255,255,255,.25)`,
  }
}
