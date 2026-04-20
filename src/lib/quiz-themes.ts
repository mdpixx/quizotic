// Quiz-level theme catalog — background, accent, and text treatment applied
// across the builder preview, host live screen, and participant view.
//
// Each theme returns a self-contained style object consumed by ThemedSurface
// and the host/participant pages. Adding a theme means adding an entry here
// plus (optionally) an SVG pattern / gradient definition in public/ or CSS.

export type QuizThemeId =
  | 'default'
  | 'classroom'
  | 'night-sky'
  | 'sunrise'
  | 'forest'
  | 'neon'
  | 'paper'
  | 'ocean'
  | 'festive'
  | 'minimal-dark'

export interface QuizTheme {
  id: QuizThemeId
  name: string
  tagline: string
  // Background applied behind the whole host/participant screen. Can be a
  // gradient, solid color, or CSS background shorthand. Kept as a string so
  // both inline style and Tailwind className consumers work.
  background: string
  // Color for primary text on top of the background.
  textColor: string
  // Secondary text color (muted, used for labels).
  mutedText: string
  // Surface color for cards (question card, option card) on top of the bg.
  surface: string
  // Border color for surfaces.
  surfaceBorder: string
  // Accent color for CTAs (Start Quiz, Next Question).
  accent: string
  accentText: string
  // Small preview swatch shown in the theme picker — 4 colors in a 2x2 grid.
  swatch: [string, string, string, string]
  // Whether this theme is considered dark (used by participant page for
  // contrast adjustments).
  dark: boolean
}

export const QUIZ_THEMES: Record<QuizThemeId, QuizTheme> = {
  default: {
    id: 'default',
    name: 'Default',
    tagline: 'Classic Quizotic navy',
    background: '#F8F9FA',
    textColor: '#0F1B3D',
    mutedText: '#64748B',
    surface: '#FFFFFF',
    surfaceBorder: '#E5E7EB',
    accent: '#F5E642',
    accentText: '#0D0D0D',
    swatch: ['#F8F9FA', '#0F1B3D', '#F5E642', '#FFFFFF'],
    dark: false,
  },
  classroom: {
    id: 'classroom',
    name: 'Classroom',
    tagline: 'Blackboard vibes',
    background: 'linear-gradient(160deg, #0B3D2E 0%, #0F4D3A 100%)',
    textColor: '#FFFFFF',
    mutedText: '#B8D8C7',
    surface: 'rgba(255,255,255,0.96)',
    surfaceBorder: 'rgba(255,255,255,0.2)',
    accent: '#F5E642',
    accentText: '#0B3D2E',
    swatch: ['#0B3D2E', '#F5E642', '#FFFFFF', '#B8D8C7'],
    dark: true,
  },
  'night-sky': {
    id: 'night-sky',
    name: 'Night Sky',
    tagline: 'Constellation across a deep indigo',
    background: 'radial-gradient(ellipse at 30% 20%, #1E2B6B 0%, #0F1B3D 60%, #050A1F 100%)',
    textColor: '#F5E642',
    mutedText: '#9CA3C6',
    surface: 'rgba(255,255,255,0.97)',
    surfaceBorder: 'rgba(255,255,255,0.15)',
    accent: '#F5E642',
    accentText: '#050A1F',
    swatch: ['#0F1B3D', '#F5E642', '#1E2B6B', '#FFFFFF'],
    dark: true,
  },
  sunrise: {
    id: 'sunrise',
    name: 'Sunrise',
    tagline: 'Warm coral and amber',
    background: 'linear-gradient(135deg, #FFE9C7 0%, #FFB88A 55%, #FF8A47 100%)',
    textColor: '#78350F',
    mutedText: '#92400E',
    surface: '#FFFFFF',
    surfaceBorder: '#FDBA74',
    accent: '#DC2626',
    accentText: '#FFFFFF',
    swatch: ['#FFE9C7', '#FF8A47', '#DC2626', '#78350F'],
    dark: false,
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    tagline: 'Fresh green canopy',
    background: 'linear-gradient(160deg, #ECFCCB 0%, #BBF7D0 50%, #86EFAC 100%)',
    textColor: '#14532D',
    mutedText: '#15803D',
    surface: '#FFFFFF',
    surfaceBorder: '#86EFAC',
    accent: '#16A34A',
    accentText: '#FFFFFF',
    swatch: ['#ECFCCB', '#86EFAC', '#16A34A', '#14532D'],
    dark: false,
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    tagline: 'Arcade hype lights',
    background: 'radial-gradient(ellipse at center, #1E1B4B 0%, #0D0D2E 70%, #050518 100%)',
    textColor: '#F0ABFC',
    mutedText: '#C4B5FD',
    surface: 'rgba(255,255,255,0.97)',
    surfaceBorder: '#7C3AED',
    accent: '#EC4899',
    accentText: '#FFFFFF',
    swatch: ['#1E1B4B', '#EC4899', '#F0ABFC', '#7C3AED'],
    dark: true,
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    tagline: 'Handwritten exam book',
    background: '#FEFCF3',
    textColor: '#3F3F46',
    mutedText: '#71717A',
    surface: '#FFFFFF',
    surfaceBorder: '#D4D4D8',
    accent: '#0F1B3D',
    accentText: '#F5E642',
    swatch: ['#FEFCF3', '#3F3F46', '#F5E642', '#D4D4D8'],
    dark: false,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    tagline: 'Calm tropical blues',
    background: 'linear-gradient(160deg, #CFFAFE 0%, #67E8F9 50%, #0891B2 100%)',
    textColor: '#083344',
    mutedText: '#155E75',
    surface: '#FFFFFF',
    surfaceBorder: '#67E8F9',
    accent: '#0F1B3D',
    accentText: '#67E8F9',
    swatch: ['#CFFAFE', '#67E8F9', '#0891B2', '#083344'],
    dark: false,
  },
  festive: {
    id: 'festive',
    name: 'Festive',
    tagline: 'Celebration colors — great for events',
    background: 'linear-gradient(135deg, #FEF3C7 0%, #FCA5A5 50%, #C084FC 100%)',
    textColor: '#4C1D95',
    mutedText: '#6B21A8',
    surface: '#FFFFFF',
    surfaceBorder: '#C084FC',
    accent: '#DC2626',
    accentText: '#FFFFFF',
    swatch: ['#FEF3C7', '#FCA5A5', '#C084FC', '#4C1D95'],
    dark: false,
  },
  'minimal-dark': {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    tagline: 'Understated charcoal',
    background: '#0F172A',
    textColor: '#F8FAFC',
    mutedText: '#94A3B8',
    surface: '#1E293B',
    surfaceBorder: '#334155',
    accent: '#F5E642',
    accentText: '#0F172A',
    swatch: ['#0F172A', '#1E293B', '#F5E642', '#F8FAFC'],
    dark: true,
  },
}

// Ordered list for display in the picker.
export const QUIZ_THEME_ORDER: QuizThemeId[] = [
  'default',
  'classroom',
  'night-sky',
  'sunrise',
  'forest',
  'neon',
  'paper',
  'ocean',
  'festive',
  'minimal-dark',
]

export function getQuizTheme(id: string | null | undefined): QuizTheme {
  if (!id) return QUIZ_THEMES.default
  return QUIZ_THEMES[id as QuizThemeId] ?? QUIZ_THEMES.default
}
