// Shared answer-tile chrome for the self-paced player (/q/[slug]).
//
// OptionGrid, MultiSelectGrid and CaseCard all render the same A/B/C/D tile.
// They used to each carry their own copy of the class string, which is how
// multi-select ended up flat-filled while single-choice was gradient-filled on
// the same screen. Everything visual about a tile lives here now.
//
// Scope note: this is deliberately NOT shared with the live participant page
// (/join). Live runs on a light background and has its own tuned treatment;
// only the palette (src/lib/answer-colors.ts) is common to both.

import { tileStyle, type AnswerColor } from '@/lib/answer-colors'

/**
 * Container classes for a list of answer tiles.
 *
 * Mirrors the live rule — vertical stack on phones, 2x2 quadrant on wide
 * screens for 3-4 options — with one adjustment. Live stacks its question and
 * options in one full-width column, so it can go two-up at `lg`. This page puts
 * the question on the left and the options in a right-hand column, so the
 * quadrant only earns its place at `xl`, where that column is ~650px and each
 * tile still gets ~310px. Below that, two columns would squeeze longer answers
 * into three-line blocks. Lists of five or more stay vertical either way.
 */
export function tileGridClass(optionCount: number, longText = false): string {
  // A long answer never goes two-up: half a column would wrap it into a
  // ten-line block. Full width is the same reflow the host stage makes.
  if (longText) return 'flex flex-col gap-2.5 lg:gap-3'
  const quadrant = optionCount > 2 && optionCount <= 4
  return quadrant
    ? 'grid grid-cols-1 gap-2.5 xl:grid-cols-2 xl:gap-3'
    : 'flex flex-col gap-2.5 lg:gap-3'
}

interface TileClassOptions {
  /** Tile is the participant's current choice. */
  selected: boolean
  /** Input is locked (submitted, feedback showing, deadline passed). */
  disabled: boolean
  /** Long-text slide — bound the tile and scroll inside it. */
  longText?: boolean
}

/** Classes for one answer tile. Pair with `tileStyle(color)` for the fill. */
export function tileClass({ selected, disabled, longText = false }: TileClassOptions): string {
  return [
    'relative flex gap-3 w-full text-left rounded-xl',
    'px-4 py-3.5 lg:px-5 lg:py-4 min-h-[60px] lg:min-h-[68px]',
    // Top-aligned when scrollable: centered content overflows upward too, and
    // that half is unreachable.
    longText ? 'items-start max-h-[30svh] overflow-y-auto overscroll-contain' : 'items-center',
    'transition-all duration-150 disabled:cursor-default',
    'focus-visible:outline focus-visible:outline-4 focus-visible:outline-white',
    selected
      ? 'ring-4 ring-white/60 scale-[0.98]'
      : 'motion-safe:hover:brightness-110 motion-safe:active:scale-[0.97]',
    disabled && !selected ? 'opacity-50' : '',
  ].join(' ')
}

/** The circular A/B/C/D badge. */
export const TILE_BADGE_CLASS =
  'shrink-0 w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-white/20 flex items-center justify-center text-base lg:text-lg font-black text-white'

/**
 * Answer text. Lighter than the old `font-black text-xl` — at tile size that
 * weight fought the question heading instead of sitting under it.
 */
export const TILE_TEXT_CLASS =
  'flex-1 min-w-0 break-words text-white font-semibold text-[15px] sm:text-base lg:text-lg leading-snug'

/**
 * Answer text on a long-text slide. Holds the 15px floor at every breakpoint
 * instead of scaling up — the tile is already bounded, and a larger font there
 * only means more scrolling.
 */
export const TILE_TEXT_CLASS_LONG =
  'flex-1 min-w-0 break-words text-white font-semibold text-[15px] sm:text-base leading-relaxed'

/** Optional per-option image thumbnail. */
export const TILE_IMAGE_CLASS =
  'h-12 w-12 lg:h-14 lg:w-14 shrink-0 object-cover rounded-lg'

export { tileStyle }
export type { AnswerColor }
