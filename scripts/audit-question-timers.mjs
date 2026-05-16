#!/usr/bin/env node
// Audit every Quiz row's questions[].timerSeconds for values outside [5,120].
// Reports offenders so they can be cleaned up. Pass --fix to clamp in place.
//
// Usage:
//   node scripts/audit-question-timers.mjs           # report only
//   node scripts/audit-question-timers.mjs --fix     # report + write clamped values back

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const FIX = process.argv.includes('--fix')
const MIN = 5
const MAX = 120
const DEFAULT = 20

function clamp(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT
  return Math.max(MIN, Math.min(MAX, n))
}

async function main() {
  const quizzes = await prisma.quiz.findMany({
    select: { id: true, title: true, questions: true, updatedAt: true },
  })
  let scanned = 0
  let offendingQuizzes = 0
  let offendingQuestions = 0
  const offenders = []

  for (const quiz of quizzes) {
    scanned++
    const questions = Array.isArray(quiz.questions) ? quiz.questions : []
    const bad = []
    const cleaned = questions.map((q, idx) => {
      const raw = q?.timerSeconds
      const n = Number(raw)
      const out = !Number.isFinite(n) || n < MIN || n > MAX
      if (out) {
        bad.push({ idx, id: q?.id ?? '(no-id)', raw, clamped: clamp(raw) })
        return { ...q, timerSeconds: clamp(raw) }
      }
      return q
    })
    if (bad.length > 0) {
      offendingQuizzes++
      offendingQuestions += bad.length
      offenders.push({ quizId: quiz.id, title: quiz.title, updatedAt: quiz.updatedAt, bad })
      if (FIX) {
        await prisma.quiz.update({
          where: { id: quiz.id },
          data: { questions: cleaned },
        })
      }
    }
  }

  console.log(`\n=== Quizotic timerSeconds audit ===`)
  console.log(`Quizzes scanned:        ${scanned}`)
  console.log(`Quizzes with offenders: ${offendingQuizzes}`)
  console.log(`Total bad questions:    ${offendingQuestions}`)
  console.log(`Mode:                   ${FIX ? 'FIX (clamped values written back)' : 'REPORT only'}`)
  if (offenders.length === 0) {
    console.log(`\nNo out-of-range timerSeconds found. DB is clean.`)
  } else {
    console.log(`\n--- Offenders ---`)
    for (const o of offenders) {
      console.log(`\nQuiz: ${o.quizId} — "${o.title}" (updated ${o.updatedAt.toISOString()})`)
      for (const b of o.bad) {
        console.log(`  Q[${b.idx}] id=${b.id}: timerSeconds=${b.raw} → clamped=${b.clamped}`)
      }
    }
    if (!FIX) {
      console.log(`\nRe-run with --fix to write clamped values back to the DB.`)
    }
  }
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
