// Participant-page JS budget gate.
//
// The participant page serves phones on 1–2 Mbps classroom connections — a
// core design principle (CLAUDE.md: "< 100KB initial load"). This gate keeps
// the initial-JS weight from silently regressing: it reads the prerendered
// .next/server/app/join.html (exactly the script tags a phone will fetch),
// sums their gzipped sizes, and fails the build when the total exceeds the
// budget. Parsing the built HTML is deliberately toolchain-proof — no
// dependence on bundler-specific manifest formats.
//
// Run after `next build`:  node scripts/check-bundle-budget.mjs

import { readFileSync, statSync } from 'fs'
import { gzipSync } from 'zlib'

// Wire-bytes (gzip) budget for /join's initial JS. Baseline at introduction
// (July 2026, after the socket.io/leaderboard/posthog splits): 248 KB gz.
// Tighten as further code-splitting lands (dnd-kit extraction is the next
// candidate) — never raise it without a deliberate decision.
const BUDGET_KB = Number(process.env.JOIN_JS_BUDGET_KB || 250)

const html = readFileSync('.next/server/app/join.html', 'utf8')
const srcs = [...new Set(
  [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(m => m[1])
)]

if (srcs.length === 0) {
  console.error('bundle-budget: no script tags found in join.html — did the build change shape?')
  process.exit(1)
}

let totalRaw = 0
let totalGz = 0
const rows = []
for (const src of srcs) {
  const file = '.next' + src.replace(/^\/_next/, '')
  const raw = statSync(file).size
  const gz = gzipSync(readFileSync(file)).length
  totalRaw += raw
  totalGz += gz
  rows.push({ file: src.split('/').pop(), rawKB: Math.round(raw / 1024), gzKB: Math.round(gz / 1024) })
}

rows.sort((a, b) => b.gzKB - a.gzKB)
console.log(`\n/join initial JS (${srcs.length} chunks):`)
for (const r of rows) console.log(`  ${String(r.gzKB).padStart(5)} KB gz  ${String(r.rawKB).padStart(5)} KB raw  ${r.file}`)
console.log(`  ────`)
console.log(`  ${String(Math.round(totalGz / 1024)).padStart(5)} KB gz  ${String(Math.round(totalRaw / 1024)).padStart(5)} KB raw  TOTAL  (budget ${BUDGET_KB} KB gz)`)

if (totalGz / 1024 > BUDGET_KB) {
  console.error(`\nbundle-budget: /join initial JS is ${Math.round(totalGz / 1024)} KB gz — over the ${BUDGET_KB} KB budget.`)
  console.error('Split or lazy-load the new weight (see src/app/join/page.tsx dynamic imports) instead of raising the budget.')
  process.exit(1)
}
console.log('\nbundle-budget: OK\n')
