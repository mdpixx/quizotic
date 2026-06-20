import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const LANGUAGE_FILE = join(ROOT, 'src/lib/languages.ts')

const EXPECTED_LANGUAGES = [
  'English',
  'Arabic',
  'Bengali',
  'Chinese (Mandarin)',
  'Dutch',
  'Filipino',
  'French',
  'German',
  'Greek',
  'Hebrew',
  'Hindi',
  'Indonesian',
  'Italian',
  'Japanese',
  'Korean',
  'Marathi',
  'Persian',
  'Polish',
  'Portuguese',
  'Russian',
  'Spanish',
  'Swahili',
  'Tamil',
  'Telugu',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Urdu',
  'Vietnamese',
]

describe('quiz builder language options', () => {
  it('keeps one canonical global list with English first and the rest alphabetized', () => {
    expect(existsSync(LANGUAGE_FILE)).toBe(true)
    if (!existsSync(LANGUAGE_FILE)) return

    const source = readFileSync(LANGUAGE_FILE, 'utf8')
    const values = [...source.matchAll(/^\s+'([^']+)',?$/gm)].map(match => match[1])

    expect(source).toContain('export const QUIZ_LANGUAGES')
    expect(values).toEqual(EXPECTED_LANGUAGES)
    expect(new Set(values).size).toBe(values.length)
    expect(values.slice(1)).toEqual([...values.slice(1)].sort((a, b) => a.localeCompare(b)))
  })

  it('uses the canonical list in both quiz creation interfaces', () => {
    const sharedForm = readFileSync(
      join(ROOT, 'src/components/host/builder/AIGenerateForm.tsx'),
      'utf8',
    )
    const creationStudio = readFileSync(
      join(ROOT, 'src/app/host/create/page.tsx'),
      'utf8',
    )

    for (const source of [sharedForm, creationStudio]) {
      expect(source).toContain("import { QUIZ_LANGUAGES } from '@/lib/languages'")
      expect(source).toContain('QUIZ_LANGUAGES.map')
    }

    expect(sharedForm).not.toContain('const LANGUAGES =')
    expect(creationStudio).not.toContain('const GLOBAL_LANGUAGES')
  })
})
