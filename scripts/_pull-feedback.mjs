// Throwaway diagnostic — pulls all feedback signals from the DB.
// Usage: node --env-file=.env scripts/_pull-feedback.mjs
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter, log: ['error'] })

function section(title) {
  console.log('\n' + '='.repeat(60))
  console.log('  ' + title)
  console.log('='.repeat(60))
}

function fmtDate(d) {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—'
}

async function main() {
  // ─── 1. EmailLog feedback rows ──────────────────────────────────
  const feedbackLogs = await prisma.emailLog.findMany({
    where: { category: 'feedback' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      status: true,
      errorMessage: true,
      subject: true,
      toEmail: true,
      metadata: true,
    },
  })

  section(`FEEDBACK SUBMISSIONS (EmailLog, category='feedback')  count=${feedbackLogs.length}`)

  if (feedbackLogs.length === 0) {
    console.log('  No feedback submissions found.')
  } else {
    const byStatus = {}
    for (const r of feedbackLogs) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
    }
    console.log(`  Status breakdown: ${JSON.stringify(byStatus)}`)
    console.log(`  Date range: ${fmtDate(feedbackLogs[0].createdAt)} → ${fmtDate(feedbackLogs.at(-1).createdAt)}`)
    console.log()

    // Per-page breakdown
    const byPage = {}
    for (const r of feedbackLogs) {
      const url = r.metadata?.url || '(unknown page)'
      const key = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] || '/'
      byPage[key] = (byPage[key] || 0) + 1
    }
    console.log('  Submissions per page:')
    for (const [page, count] of Object.entries(byPage).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${count.toString().padStart(3)}  ${page}`)
    }

    console.log()
    console.log('  ─── Individual submissions ───')
    for (const r of feedbackLogs) {
      const submitter = r.metadata?.submitter || r.toEmail || 'anonymous'
      const url = r.metadata?.url || '—'
      const preview = r.subject.replace('[Quizotic feedback] ', '').slice(0, 120)
      console.log(`\n  [${fmtDate(r.createdAt)}]  ${r.status.toUpperCase()}  from=${submitter}`)
      console.log(`  Page : ${url}`)
      console.log(`  Msg  : ${preview}${preview.length >= 120 ? '…' : ''}`)
      if (r.errorMessage) console.log(`  Error: ${r.errorMessage}`)
    }
  }

  // ─── 2. ModerationFlag (user-reported content abuse) ───────────
  const flags = await prisma.moderationFlag.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      targetType: true,
      targetId: true,
      category: true,
      details: true,
      status: true,
      disposition: true,
      reporterId: true,
    },
  })

  section(`MODERATION FLAGS (user content-abuse reports)  count=${flags.length}`)

  if (flags.length === 0) {
    console.log('  No moderation flags found.')
  } else {
    const byCat = {}
    for (const f of flags) { byCat[f.category] = (byCat[f.category] || 0) + 1 }
    const byStatus = {}
    for (const f of flags) { byStatus[f.status] = (byStatus[f.status] || 0) + 1 }
    console.log(`  Category breakdown: ${JSON.stringify(byCat)}`)
    console.log(`  Status breakdown:   ${JSON.stringify(byStatus)}`)
    console.log()
    for (const f of flags) {
      console.log(`  [${fmtDate(f.createdAt)}]  ${f.category.toUpperCase()}  target=${f.targetType}:${f.targetId}  status=${f.status}  disposition=${f.disposition || '—'}`)
      if (f.details) console.log(`  Details: ${f.details}`)
    }
  }

  // ─── 3. DataDeletionRequest reasons (churn signal) ─────────────
  const deletions = await prisma.dataDeletionRequest.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, status: true, reason: true },
  })

  section(`DATA DELETION REQUESTS (churn signal)  count=${deletions.length}`)

  if (deletions.length === 0) {
    console.log('  No deletion requests found.')
  } else {
    for (const d of deletions) {
      console.log(`  [${fmtDate(d.createdAt)}]  status=${d.status}  reason=${d.reason || '(no reason given)'}`)
    }
  }

  section('DONE')
  console.log(`  Feedback submissions : ${feedbackLogs.length}`)
  console.log(`  Moderation flags     : ${flags.length}`)
  console.log(`  Deletion requests    : ${deletions.length}`)
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
