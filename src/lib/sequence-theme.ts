// Sequence identity — the cohesive colour family that wraps a whole live
// experience so the two products read as distinct:
//
//   quiz         → brand navy + yellow (energetic, competitive)
//   presentation → teal + deep cyan (calm, professional, host-led)
//
// This themes the CHROME only — backgrounds, surfaces, accents, timer ring,
// progress, lobby, reveal frames. The A/B/C/D answer tiles stay canonical
// (see answer-colors.ts) so participants can always colour-match their phone
// to the host screen regardless of sequence.
//
// Quiz hosts can still pick a per-quiz visual theme (quiz-themes.ts); this is
// the default identity and the source of truth for presentation chrome, which
// previously had no theme awareness.

export type SequenceKind = 'quiz' | 'presentation'

export interface SequenceTheme {
  kind: SequenceKind
  /** App background behind the whole stage. */
  bg: string
  /** Card / panel surface on top of bg. */
  surface: string
  /** Border for surfaces. */
  surfaceBorder: string
  /** Primary accent for CTAs, timer ring, progress fill, active states. */
  accent: string
  /** Darker accent for gradients / pressed states. */
  accentDark: string
  /** Text colour that sits legibly on the accent. */
  accentText: string
  /** Soft tint of the accent for badges / highlights. */
  accentTint: string
  /** Bright accent variant legible as TEXT on dark backgrounds. */
  accentOnDark: string
  /** Primary ink for text on light surfaces. */
  ink: string
  /** Muted text. */
  muted: string
  /** Lobby / hero gradient (CSS background shorthand). */
  heroGradient: string
}

export const QUIZ_SEQUENCE: SequenceTheme = {
  kind: 'quiz',
  bg: '#0F1B3D',
  surface: '#FFFFFF',
  surfaceBorder: 'rgba(255,255,255,0.12)',
  accent: '#F5E642',
  accentDark: '#E5D400',
  accentText: '#0D0D0D',
  accentTint: 'rgba(245,230,66,0.18)',
  accentOnDark: '#F5E642',
  ink: '#0F1B3D',
  muted: '#64748B',
  heroGradient: 'linear-gradient(135deg, #0F1B3D 0%, #182659 50%, #1F2E6C 100%)',
}

export const PRESENTATION_SEQUENCE: SequenceTheme = {
  kind: 'presentation',
  bg: '#062B33',
  surface: '#FFFFFF',
  surfaceBorder: 'rgba(255,255,255,0.12)',
  accent: '#0891B2',
  accentDark: '#0E7490',
  accentText: '#FFFFFF',
  accentTint: 'rgba(8,145,178,0.16)',
  accentOnDark: '#22D3EE',
  ink: '#083344',
  muted: '#64748B',
  heroGradient: 'linear-gradient(135deg, #062B33 0%, #0B4453 50%, #0E7490 100%)',
}

export function getSequenceTheme(kind: SequenceKind): SequenceTheme {
  return kind === 'presentation' ? PRESENTATION_SEQUENCE : QUIZ_SEQUENCE
}
