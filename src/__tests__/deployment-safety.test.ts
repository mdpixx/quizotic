import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

describe('Railway deployment safety', () => {
  it('does not expose the retired monorepo rsync deployment command', () => {
    const packageJson = JSON.parse(
      readFileSync(join(ROOT, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> }

    expect(packageJson.scripts).not.toHaveProperty('deploy')
    expect(packageJson.scripts).not.toHaveProperty('deploy:force')
    expect(existsSync(join(ROOT, 'scripts/deploy-to-railway.sh'))).toBe(false)
  })
})
