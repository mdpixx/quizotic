// Canonical answer-option palette (Kahoot-style saturated) — used EVERYWHERE
// we render A / B / C / D / E tiles: host quiz builder, host live view,
// presentation builder, presentation live view, participant phone.
//
// Single source of truth. Never inline hex strings for answer tiles again.

export interface AnswerColor {
  /** Letter label for the option (A, B, C, D, E). */
  letter: string
  /** Hex hue used for backgrounds, left-stripes, bars. */
  hex: string
  /** A slightly darker variant for 2D shadows / pressed states. */
  hexDark: string
  /** Tailwind class for flat background fills (`bg-…-500` etc.). */
  tw: string
  /** Soft tinted surface behind the tile when a light background is needed. */
  tint: string
}

export const ANSWER_COLORS: AnswerColor[] = [
  { letter: 'A', hex: '#E21B3C', hexDark: '#A30E28', tw: 'bg-[#E21B3C]', tint: '#FFE4E8' },
  { letter: 'B', hex: '#1368CE', hexDark: '#0B479E', tw: 'bg-[#1368CE]', tint: '#E0ECFB' },
  { letter: 'C', hex: '#D89E00', hexDark: '#9A7200', tw: 'bg-[#D89E00]', tint: '#FBEFC7' },
  { letter: 'D', hex: '#26890C', hexDark: '#1A5F08', tw: 'bg-[#26890C]', tint: '#D7F0CC' },
  { letter: 'E', hex: '#7C3AED', hexDark: '#5B21B6', tw: 'bg-[#7C3AED]', tint: '#EDE4FD' },
]

export const ANSWER_LETTERS = ANSWER_COLORS.map(c => c.letter)

export function colorForIndex(i: number): AnswerColor {
  return ANSWER_COLORS[i % ANSWER_COLORS.length]
}
