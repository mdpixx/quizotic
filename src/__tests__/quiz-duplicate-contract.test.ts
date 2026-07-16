import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

// POST /api/quizzes requires a client-supplied id. The dashboard Duplicate
// action once built its payload as `{ ...quiz, id: undefined, ... }` —
// JSON.stringify drops undefined keys, the API answered 400, and the response
// was never checked, so Duplicate silently did nothing. These source checks
// fail the build if that payload shape or the unchecked save ever comes back.
describe('dashboard Duplicate keeps its API contract', () => {
  const source = readFileSync(join(ROOT, 'src/app/host/(dashboard)/quizzes/page.tsx'), 'utf8')

  it('never strips the id with `id: undefined` (JSON.stringify drops it)', () => {
    expect(source).not.toContain('id: undefined')
  })

  it('generates a fresh quiz id for the duplicate', () => {
    expect(source).toContain('id: crypto.randomUUID()')
  })

  it('surfaces a failed duplicate save instead of ignoring the response', () => {
    expect(source).toMatch(/if \(!saveRes\.ok\)/)
  })
})
