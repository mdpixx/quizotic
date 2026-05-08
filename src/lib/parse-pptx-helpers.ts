// Pure helpers extracted from /api/parse-pptx so they're unit-testable
// without spinning up the Python/LibreOffice/R2 pipeline.

export interface PythonSlideOutput {
  index: number
  title: string | null
  subtitle: string | null
  bodyText: string
  speakerNotes: string | null
  fullText: string
  layoutName: string
  imagePath: string | null
}

export type MappedSlide =
  | {
      suggestedType: 'image'
      imageUrl: string
      caption: string
      aiContext?: string
      originalIndex: number
    }
  | {
      suggestedType: 'bullets'
      heading: string
      bullets: string[]
      aiContext?: string
      originalIndex: number
    }

const ALLOWED_EXT = /\.(pptx|pdf)$/i

export function isAllowedDeckFilename(name: string): boolean {
  return ALLOWED_EXT.test(name)
}

export function stripDeckExtension(name: string): string {
  return name.replace(ALLOWED_EXT, '')
}

// Picks a safe presentation title from python-pptx output.
// Falls back to the filename (extension stripped, capped at 80 chars) if the
// extracted title is missing or looks like a concatenated mash.
export function pickPresentationTitle(
  slides: Pick<PythonSlideOutput, 'title'>[],
  fileName: string,
): string | undefined {
  for (const s of slides) {
    if (s.title && s.title.length > 0) {
      let t = s.title
      if (t.length > 100) {
        const breakAt = t.search(/[.\n]/)
        t = (breakAt > 10 ? t.slice(0, breakAt) : t.slice(0, 100)).trim()
      }
      if (t.length > 100) {
        t = stripDeckExtension(fileName).slice(0, 80)
      }
      return t
    }
  }
  return undefined
}

export function toBulletsFallback(
  slide: PythonSlideOutput,
): Extract<MappedSlide, { suggestedType: 'bullets' }> {
  const bullets = (slide.bodyText || '')
    .split('\n')
    .map(b => b.trim())
    .filter(Boolean)
    .slice(0, 6)
  return {
    suggestedType: 'bullets',
    heading: slide.title ?? `Slide ${slide.index + 1}`,
    bullets: bullets.length > 0 ? bullets : ['(image could not be rendered)'],
    aiContext: slide.fullText || undefined,
    originalIndex: slide.index,
  }
}
