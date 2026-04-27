// Lint-style guard: every API route that calls a paid AI provider must
// also call logAiUsage(). This is what would have caught the leak the
// user worried about — a future contributor wiring an enhance / generate
// endpoint without metering it would silently burn OpenRouter spend
// without it counting against the user's plan.
//
// The test scans every `route.ts` under src/app/api/ for substrings that
// suggest a paid AI call and asserts the same file also calls logAiUsage.
// Add `// ai-usage-coverage: skip` near the top of a route to opt out
// (e.g. an internal admin tool that intentionally bypasses metering).

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const API_DIR = join(__dirname, '..', 'app', 'api')

// Substrings that indicate an outbound call to a paid AI provider. Matching
// any of these means the route is generating tokens billable to us.
const AI_CALL_SIGNATURES = [
  'openrouter.ai',
  'client.chat.completions',
  '.chat.completions.create',
  'new OpenAI(',
  'from \'openai\'',
  'from "openai"',
  'anthropic.messages.create',
  'generativelanguage.googleapis.com',
]

// If a file matches these substrings, it's an AI utility / vision-pdf / OCR
// helper rather than the user-facing AI endpoint. The endpoint that USES
// these utilities is already separately required to call logAiUsage.
const SKIP_PATH_HINTS = [
  '/_lib/',
  '/lib/',
]

const SKIP_MARKER = 'ai-usage-coverage: skip'

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...findRouteFiles(full))
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      out.push(full)
    }
  }
  return out
}

interface Finding {
  file: string
  callsAi: boolean
  callsLogAiUsage: boolean
  hasSkipMarker: boolean
}

function audit(file: string): Finding {
  const content = readFileSync(file, 'utf8')
  const callsAi = AI_CALL_SIGNATURES.some(sig => content.includes(sig))
  const callsLogAiUsage = content.includes('logAiUsage(')
  const hasSkipMarker = content.includes(SKIP_MARKER)
  return { file, callsAi, callsLogAiUsage, hasSkipMarker }
}

describe('AI-usage coverage — every paid-provider route must meter via logAiUsage', () => {
  const routeFiles = findRouteFiles(API_DIR)
    .filter(f => !SKIP_PATH_HINTS.some(hint => f.includes(hint)))

  it('found at least one route file (sanity)', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it('every AI-calling route also calls logAiUsage (or has explicit skip marker)', () => {
    const findings = routeFiles.map(audit)
    const aiCallers = findings.filter(f => f.callsAi)
    const leaks = aiCallers.filter(f => !f.callsLogAiUsage && !f.hasSkipMarker)

    if (leaks.length > 0) {
      const list = leaks.map(l => `  - ${l.file.split('/src/app/api/')[1] ?? l.file}`).join('\n')
      throw new Error(
        `${leaks.length} API route(s) call a paid AI provider but do NOT call logAiUsage().\n` +
        `Either wire logAiUsage at the right place, or add "// ai-usage-coverage: skip" to opt out:\n${list}\n` +
        `If this is intentional (e.g. admin-only test endpoint), add the skip marker.`,
      )
    }
    expect(leaks.length).toBe(0)
  })

  it('every AI-calling route also calls checkAiQuota for plan enforcement', () => {
    const findings = routeFiles.map(audit)
    const aiCallers = findings.filter(f => f.callsAi)
    const noQuotaCheck = aiCallers.filter(f => !f.hasSkipMarker && !readFileSync(f.file, 'utf8').includes('checkAiQuota('))

    if (noQuotaCheck.length > 0) {
      const list = noQuotaCheck.map(l => `  - ${l.file.split('/src/app/api/')[1] ?? l.file}`).join('\n')
      throw new Error(
        `${noQuotaCheck.length} AI-calling route(s) skip the quota check. Plan limits are unenforced for these:\n${list}`,
      )
    }
    expect(noQuotaCheck.length).toBe(0)
  })

  it('logs at least 3 AI-calling routes (canary that the audit is finding things)', () => {
    // If a refactor accidentally extracts the OpenAI client into a helper
    // module, the regex above might miss everything. The canary asserts we
    // still see at least the three known routes (generate-quiz,
    // translate-quiz, enhance-presentation).
    const findings = routeFiles.map(audit)
    const aiCount = findings.filter(f => f.callsAi).length
    expect(aiCount).toBeGreaterThanOrEqual(3)
  })
})
