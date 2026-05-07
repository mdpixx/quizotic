export type SlideType =
  // Interactive — audience votes
  | 'multiple_choice'
  | 'open_text'
  | 'word_cloud'
  | 'rating_scale'
  | 'ranking'
  | 'image_choice'
  | 'scale_100'
  // Spatial / Visual
  | 'pinpoint'
  | 'grid_2x2'
  | 'wheel'
  // Energy Moments
  | 'word_duel'
  | 'live_race'
  | 'emoji_pulse'
  | 'quick_fire'
  // Content — no audience input
  | 'title'
  | 'bullets'
  | 'quote'
  | 'video'
  | 'image'

export const SLIDE_TYPE_META: Record<SlideType, {
  label: string
  category: 'interactive' | 'spatial' | 'energy' | 'content'
  color: string
  bg: string
  hasAudienceInput: boolean
  status?: 'beta' | 'coming_soon'
}> = {
  multiple_choice: { label: 'Multiple Choice',  category: 'interactive', color: '#2563EB', bg: '#EFF6FF', hasAudienceInput: true },
  open_text:       { label: 'Open Text',         category: 'interactive', color: '#2D3A8C', bg: '#F0F4FF', hasAudienceInput: true },
  word_cloud:      { label: 'Word Cloud',        category: 'interactive', color: '#FF8A47', bg: '#FFF7ED', hasAudienceInput: true },
  rating_scale:    { label: 'Rating Scale',      category: 'interactive', color: '#EA580C', bg: '#FFF7ED', hasAudienceInput: true },
  ranking:         { label: 'Ranking',           category: 'interactive', color: '#4F46E5', bg: '#EEF2FF', hasAudienceInput: true },
  image_choice:    { label: 'Image Choice',      category: 'interactive', color: '#0891B2', bg: '#ECFEFF', hasAudienceInput: true },
  scale_100:       { label: '100-Point Scale',   category: 'interactive', color: '#16A34A', bg: '#F0FDF4', hasAudienceInput: true },
  pinpoint:        { label: 'Pinpoint',          category: 'spatial',     color: '#9333EA', bg: '#FAF5FF', hasAudienceInput: true },
  grid_2x2:        { label: '2×2 Grid',          category: 'spatial',     color: '#0D9488', bg: '#F0FDFA', hasAudienceInput: true },
  wheel:           { label: 'Wheel of Names',    category: 'spatial',     color: '#F59E0B', bg: '#FFFBEB', hasAudienceInput: false, status: 'coming_soon' },
  word_duel:       { label: 'Word Duel',         category: 'energy',      color: '#DC2626', bg: '#FEF2F2', hasAudienceInput: true },
  live_race:       { label: 'Live Race',         category: 'energy',      color: '#B45309', bg: '#FFFBEB', hasAudienceInput: true },
  emoji_pulse:     { label: 'Emoji Pulse',       category: 'energy',      color: '#0F1B3D', bg: '#F8F9FA', hasAudienceInput: true },
  quick_fire:      { label: 'Quick Fire',        category: 'energy',      color: '#EF4444', bg: '#FFF1F2', hasAudienceInput: true },
  title:           { label: 'Title Slide',       category: 'content',     color: '#1E1B4B', bg: '#F8F7FF', hasAudienceInput: false },
  bullets:         { label: 'Bullet Points',     category: 'content',     color: '#374151', bg: '#F9FAFB', hasAudienceInput: false },
  quote:           { label: 'Quote',             category: 'content',     color: '#6B7280', bg: '#F3F4F6', hasAudienceInput: false },
  video:           { label: 'Video',             category: 'content',     color: '#1D4ED8', bg: '#EFF6FF', hasAudienceInput: false },
  image:           { label: 'Image',             category: 'content',     color: '#6D28D9', bg: '#F5F3FF', hasAudienceInput: false },
}

export const SLIDE_CATEGORIES = [
  { id: 'interactive' as const, label: 'Interactive', color: '#0F1B3D' },
  { id: 'spatial'     as const, label: 'Spatial',     color: '#0891B2' },
  { id: 'energy'      as const, label: 'Energy',      color: '#DC2626' },
  { id: 'content'     as const, label: 'Content',     color: '#374151' },
]

export const CONTENT_SLIDE_TYPES = ['title', 'bullets', 'quote', 'video', 'image'] as const
export type ContentSlideType = typeof CONTENT_SLIDE_TYPES[number]

export function isContentSlideType(type: SlideType | string | undefined): boolean {
  return !!type && (CONTENT_SLIDE_TYPES as readonly string[]).includes(type)
}

export function isInteractiveSlideType(type: SlideType | string | undefined): boolean {
  if (!type) return false
  const meta = SLIDE_TYPE_META[type as SlideType]
  return !!meta && meta.hasAudienceInput === true
}

// Slides where results should always be visible to the host the moment
// aggregation starts — there is no "hold the reveal" moment because there
// is no correct answer. Multiple-choice / image-choice slides still follow
// the responseMode gate so the host can pause for discussion before reveal.
const AUTO_SHOW_RESULT_TYPES: readonly SlideType[] = [
  'open_text',
  'word_cloud',
  'rating_scale',
  'ranking',
  'scale_100',
  'emoji_pulse',
  'pinpoint',
  'grid_2x2',
  'live_race',
  'word_duel',
]

export function shouldAutoShowResults(type: SlideType | string | undefined): boolean {
  if (!type) return false
  return (AUTO_SHOW_RESULT_TYPES as readonly string[]).includes(type)
}

// Resolves the slide's background color: explicit `bgColor` wins, otherwise a
// per-type default. Used by both the editor preview and the live presentation
// renderer so colors stay consistent — without this shared helper the editor
// shows the chosen color but the live stage paints over it with the theme.
export function getSlideBg(slide: { type: SlideType; bgColor?: string }): string {
  if (slide.bgColor) return slide.bgColor
  switch (slide.type) {
    case 'title': return '#FAFAF8'
    case 'multiple_choice':
    case 'open_text':
    case 'word_cloud':
    case 'rating_scale':
    case 'ranking': return '#FFFFFF'
    case 'image_choice': return '#E0F2FE'
    case 'scale_100': return '#DCFCE7'
    case 'pinpoint': return '#F3E8FF'
    case 'grid_2x2': return '#CCFBF1'
    case 'wheel': return '#FEF3C7'
    case 'word_duel': return '#FEE2E2'
    case 'live_race': return '#FFEDD5'
    case 'emoji_pulse': return '#0F1B3D'
    case 'quick_fire': return '#FFE4E6'
    case 'bullets': return '#F8FAFC'
    case 'quote': return '#1E293B'
    case 'video': return '#0F172A'
    case 'image': return '#F3F4F6'
  }
}

// ─── Slide data shapes ────────────────────────────────────────────────────────

interface SlideBase {
  id: string
  type: SlideType
  bgColor?: string
  responseMode?: 'instant' | 'on_click' | 'private'
  contentImageUrl?: string
  backgroundImageUrl?: string
  vizTextColor?: string
  showQrCode?: boolean
}

export interface MultipleChoiceSlide extends SlideBase {
  type: 'multiple_choice'
  question: string
  options: string[]
  showCorrect: boolean
  correctIndex?: number
}

export interface OpenTextSlide extends SlideBase {
  type: 'open_text'
  question: string
  maxChars: number
}

export interface WordCloudSlide extends SlideBase {
  type: 'word_cloud'
  question: string
  maxWords: number
}

export interface RatingScaleSlide extends SlideBase {
  type: 'rating_scale'
  question: string
  minLabel: string
  maxLabel: string
  maxRating: 5 | 7 | 10
}

export interface RankingSlide extends SlideBase {
  type: 'ranking'
  question: string
  items: string[]
}

export interface ImageChoiceSlide extends SlideBase {
  type: 'image_choice'
  question: string
  options: string[]      // text labels
  imageUrls: string[]    // parallel array — imageUrls[i] is the image for options[i]
}

export interface Scale100Slide extends SlideBase {
  type: 'scale_100'
  question: string
  minLabel: string
  maxLabel: string
}

export interface PinpointSlide extends SlideBase {
  type: 'pinpoint'
  question: string
  imageUrl?: string
}

export interface Grid2x2Slide extends SlideBase {
  type: 'grid_2x2'
  question: string
  xLabel: string
  yLabel: string
  xMin: string
  xMax: string
  yMin: string
  yMax: string
}

export interface WheelSlide extends SlideBase {
  type: 'wheel'
  title: string
  names: string[]
}

export interface WordDuelSlide extends SlideBase {
  type: 'word_duel'
  question: string
  optionA: string
  optionB: string
}

export interface LiveRaceSlide extends SlideBase {
  type: 'live_race'
  question: string
  options: string[]
}

export interface EmojiPulseSlide extends SlideBase {
  type: 'emoji_pulse'
  question: string
  emojis: string[]
}

export interface QuickFireSlide extends SlideBase {
  type: 'quick_fire'
  question: string
  options: string[]
  durationSeconds: number
}

export interface TitleSlide extends SlideBase {
  type: 'title'
  heading: string
  subheading: string
  bgColor: string
}

export interface BulletsSlide extends SlideBase {
  type: 'bullets'
  heading: string
  bullets: string[]
}

export interface QuoteSlide extends SlideBase {
  type: 'quote'
  quote: string
  attribution: string
}

export interface VideoSlide extends SlideBase {
  type: 'video'
  url: string
  caption: string
}

export interface ImageSlide extends SlideBase {
  type: 'image'
  imageUrl: string
  caption: string
}

export type Slide =
  | MultipleChoiceSlide | OpenTextSlide | WordCloudSlide | RatingScaleSlide
  | RankingSlide | ImageChoiceSlide | Scale100Slide | PinpointSlide
  | Grid2x2Slide | WheelSlide | WordDuelSlide | LiveRaceSlide
  | EmojiPulseSlide | QuickFireSlide | TitleSlide | BulletsSlide
  | QuoteSlide | VideoSlide | ImageSlide

export interface Presentation {
  id: string
  title: string
  theme?: string            // theme id from src/lib/quiz-themes.ts; undefined = default
  slides: Slide[]
  createdAt: string
  updatedAt: string
}

// ─── Default slide factories ──────────────────────────────────────────────────

export function makeSlide(type: SlideType): Slide {
  const id = crypto.randomUUID()
  switch (type) {
    case 'multiple_choice': return { id, type, question: '', options: ['', '', '', ''], showCorrect: false }
    case 'open_text':       return { id, type, question: '', maxChars: 200 }
    case 'word_cloud':      return { id, type, question: '', maxWords: 1 }
    case 'rating_scale':    return { id, type, question: '', minLabel: 'Not at all', maxLabel: 'Extremely', maxRating: 5 }
    case 'ranking':         return { id, type, question: '', items: ['', '', ''] }
    case 'image_choice':    return { id, type, question: '', options: ['', '', '', ''], imageUrls: ['', '', '', ''] }
    case 'scale_100':       return { id, type, question: '', minLabel: 'Disagree', maxLabel: 'Agree' }
    case 'pinpoint':        return { id, type, question: '' }
    case 'grid_2x2':        return { id, type, question: '', xLabel: 'X Axis', yLabel: 'Y Axis', xMin: 'Low', xMax: 'High', yMin: 'Low', yMax: 'High' }
    case 'wheel':           return { id, type, title: 'Pick a winner', names: ['', '', ''] }
    case 'word_duel':       return { id, type, question: '', optionA: '', optionB: '' }
    case 'live_race':       return { id, type, question: '', options: ['', '', ''] }
    case 'emoji_pulse':     return { id, type, question: '', emojis: ['❤️', '😂', '🔥', '😮'] }
    case 'quick_fire':      return { id, type, question: '', options: ['', '', '', ''], durationSeconds: 5 }
    case 'title':           return { id, type, heading: '', subheading: '', bgColor: '#FAFAF8' }
    case 'bullets':         return { id, type, heading: '', bullets: ['', '', ''] }
    case 'quote':           return { id, type, quote: '', attribution: '' }
    case 'video':           return { id, type, url: '', caption: '' }
    case 'image':           return { id, type, imageUrl: '', caption: '' }
  }
}
