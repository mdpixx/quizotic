#!/usr/bin/env node
// Load-test harness — measures how many concurrent participants one live quiz
// session can hold without degrading the experience.
//
// Spawns server.mjs with a controlled env (never inherits REDIS_URL from the
// machine — pass --redis-url explicitly to test the snapshot path against a
// LOCAL redis only), creates a Pro-hosted session, then fans N participant
// clients across worker processes so harness-side event-loop lag doesn't
// pollute the latency numbers.
//
// Usage:
//   node scripts/load-test-session.mjs --players=500 [--join-window=60]
//        [--questions=5] [--answer-min=1] [--answer-max=12] [--shared-ip]
//        [--redis-url=redis://127.0.0.1:6379] [--keep-data] [--port=4600]
//        [--env-file=path/to/env]
//   node scripts/load-test-session.mjs --bench-serialize
//
// Env: DATABASE_URL + NEXTAUTH_SECRET, from --env-file (default <root>/.env)
// or the process environment. Values are used in-process and never logged.
//
// Metrics: join success/rejects, answer-ack p50/p95, question_ended →
// personal_result fan-out gap p50/p95 (same-process clock, no skew),
// server event-loop lag via a ping_time probe, server RSS, end-session burst.
//
// Requires `ulimit -n` ≳ 2×players; the parent aborts with instructions if low.

import { spawn, fork, execFile } from 'child_process'
import { setTimeout as sleep } from 'timers/promises'
import { io as ioClient } from 'socket.io-client'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const SELF = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SELF), '..')
const HOST_USER_ID = 'loadtest-host'

// ─── Shared helpers ─────────────────────────────────────────────────────────

function arg(name, fallback) {
  const hit = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return fallback
  const eq = hit.indexOf('=')
  return eq === -1 ? true : hit.slice(eq + 1)
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b)
  return { n: s.length, p50: percentile(s, 50), p95: percentile(s, 95), max: s[s.length - 1] ?? null }
}

function fmt(ms) { return ms === null || ms === undefined ? '—' : `${Math.round(ms)}ms` }

function clientIp(globalIndex, sharedIp) {
  if (sharedIp) return '203.0.113.77' // one venue NAT IP for everyone
  return `10.${Math.floor(globalIndex / 65536) % 256}.${Math.floor(globalIndex / 256) % 256}.${globalIndex % 256}`
}

// ─── Worker mode: drive a slice of participant clients ──────────────────────

if (process.env.LOADTEST_WORKER === '1') {
  process.on('message', msg => { if (msg?.type === 'config') runWorker(msg).catch(err => { console.error('[worker] fatal:', err); process.exit(1) }) })
} else {
  main().catch(err => { console.error('FATAL:', err); process.exit(1) })
}

async function runWorker(cfg) {
  const { url, gameCode, startIndex, count, total, t0, joinWindowMs, sharedIp, answerMinMs, answerMaxMs, questions } = cfg
  const report = {
    joinAckMs: [], joinFails: {}, connectErrors: 0,
    answerAckMs: Array.from({ length: questions }, () => []),
    revealGapMs: Array.from({ length: questions }, () => []),
    rejections: {},
  }
  const clients = []
  for (let i = 0; i < count; i++) clients.push(runClient(startIndex + i))
  await Promise.all(clients)
  process.send({ type: 'final', report })
  // Parent kills us after collecting; keep sockets open so room emits drain.

  async function runClient(gi) {
    const connectAt = t0 + Math.round(((gi + 0.5) / total) * joinWindowMs)
    await sleep(Math.max(0, connectAt - Date.now()))
    const socket = ioClient(url, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { 'x-forwarded-for': clientIp(gi, sharedIp) },
    })
    const done = new Promise(res => socket.once('session_ended', res))
    try {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('connect timeout')), 15000)
        socket.once('connect', () => { clearTimeout(t); res() })
        socket.once('connect_error', err => { clearTimeout(t); rej(err) })
      })
    } catch {
      report.connectErrors++
      return
    }

    const sentAt = Date.now()
    const join = await new Promise(res => {
      socket.emit('join_session', { gameCode, displayName: `P${gi}` }, res)
      setTimeout(() => res({ success: false, error: 'ack timeout' }), 20000)
    })
    if (!join?.success) {
      const key = String(join?.error || 'unknown').slice(0, 60)
      report.joinFails[key] = (report.joinFails[key] || 0) + 1
      socket.close()
      return
    }
    report.joinAckMs.push(Date.now() - sentAt)
    const participantId = join.participantId

    let lastQEndAt = null
    socket.on('question_ended', () => { lastQEndAt = Date.now() })
    socket.on('personal_result', () => {
      const qi = currentQi
      if (lastQEndAt !== null && qi >= 0 && qi < questions) {
        report.revealGapMs[qi].push(Date.now() - lastQEndAt)
      }
    })
    socket.on('answer_rejected', ({ reason }) => {
      report.rejections[reason] = (report.rejections[reason] || 0) + 1
    })

    let currentQi = -1
    socket.on('question_show', ({ index, startAt }) => {
      currentQi = index
      lastQEndAt = null
      const answerDelay = answerMinMs + Math.random() * (answerMaxMs - answerMinMs)
      const fireIn = Math.max(0, startAt - Date.now()) + answerDelay
      setTimeout(() => {
        const submitAt = Date.now()
        socket.emit('submit_answer', {
          gameCode, participantId,
          answer: '1',
          timeMs: Math.round(answerDelay),
          serverSubmittedAt: submitAt,
        }, ack => {
          if (ack?.accepted) report.answerAckMs[index].push(Date.now() - submitAt)
        })
      }, fireIn)
    })

    // Resolve on session_ended; safety timeout so a wedged run still reports.
    await Promise.race([done, sleep(cfg.runTimeoutMs)])
  }
}

// ─── Serialize benchmark: the Redis-snapshot event-loop cost ────────────────

async function benchSerialize() {
  const { serializeSession } = await import(resolve(ROOT, 'src/lib/session-state.mjs'))
  const questions = Number(arg('questions', 20))
  console.log(`serializeSession + JSON.stringify cost (the 5s Redis snapshot), ${questions} answered questions:\n`)
  console.log('players | bytes    | ms/op (avg of 20)')
  for (const n of [100, 300, 500, 750]) {
    const session = syntheticSession(n, questions)
    JSON.stringify(serializeSession(session)) // warmup
    const runs = 20
    let bytes = 0
    const start = process.hrtime.bigint()
    for (let i = 0; i < runs; i++) bytes = JSON.stringify(serializeSession(session)).length
    const ms = Number(process.hrtime.bigint() - start) / 1e6 / runs
    console.log(`${String(n).padEnd(7)} | ${String(bytes).padEnd(8)} | ${ms.toFixed(2)}`)
  }
}

function syntheticSession(players, questions) {
  const participants = new Map()
  const participantsById = new Map()
  for (let i = 0; i < players; i++) {
    const p = {
      participantId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      socketId: `sock_${i}`,
      name: `Player ${i}`, realName: `Player ${i}`,
      archetype: 'Curious Cat', score: 4200, streakCount: 2, team: null,
      joinedAt: new Date(), attendeeId: `att_${i}`,
      answers: Array.from({ length: questions }, () => ({
        answer: '1', isCorrect: true, points: 850, basePoints: 800, streakBonus: 50,
        timeMs: 4200, clientReportedTimeMs: 4100, confidence: 'sure',
      })),
    }
    participants.set(p.socketId, p)
    participantsById.set(p.participantId, p)
  }
  return {
    quizData: { title: 'Bench', questions: Array.from({ length: questions }, (_, i) => ({ id: `q${i}`, type: 'mcq', text: `Question ${i} text that is reasonably long for realism`, options: ['A', 'B', 'C', 'D'], correctAnswer: '1', timerSeconds: 20, points: 1000 })) },
    participants, participantsById,
    disconnectedParticipants: new Map(), hostSocketIds: new Set(['h']),
    previousRanks: new Map([...participantsById.keys()].map((k, i) => [k, i + 1])),
    playedQuestionIndexes: new Set(Array.from({ length: questions }, (_, i) => i)),
    currentQuestionIndex: questions - 1, status: 'active', sessionMode: 'competitive',
    startedAt: Date.now(), userId: HOST_USER_ID, hostPlan: 'pro',
  }
}

// ─── Parent mode ────────────────────────────────────────────────────────────

function loadEnv() {
  const out = { DATABASE_URL: process.env.DATABASE_URL, NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET }
  const file = arg('env-file', resolve(ROOT, '.env'))
  if ((!out.DATABASE_URL || !out.NEXTAUTH_SECRET) && existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.trim().match(/^(DATABASE_URL|NEXTAUTH_SECRET)=(.*)$/)
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  }
  if (!out.DATABASE_URL || !out.NEXTAUTH_SECRET) {
    throw new Error('DATABASE_URL and NEXTAUTH_SECRET required (env or --env-file)')
  }
  return out
}

async function checkFdLimit(players) {
  const limit = await new Promise(res => execFile('sh', ['-c', 'ulimit -n'], (e, stdout) => res(Number(stdout) || 0)))
  const needed = players * 2 + 128
  if (limit < needed && !arg('skip-fd-check', false)) {
    throw new Error(`ulimit -n is ${limit}, need ≥ ${needed}. Run: ulimit -n ${Math.max(needed, 8192)} && node scripts/load-test-session.mjs ...`)
  }
}

async function ensureHost(databaseUrl, hostPlan) {
  const status = hostPlan === 'pro' ? 'active' : 'cancelled'
  const db = new pg.Client({ connectionString: databaseUrl })
  await db.connect()
  try {
    await db.query(
      `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
       VALUES ($1, 'loadtest-host@quizotic.internal', 'Load Test Host', now(), now())
       ON CONFLICT (id) DO NOTHING`, [HOST_USER_ID])
    await db.query(
      `INSERT INTO "Subscription" (id, "userId", plan, status, "currentPeriodEnd", "createdAt", "updatedAt")
       VALUES ('loadtest-sub', $1, 'pro_monthly', $2, now() + interval '1 day', now(), now())
       ON CONFLICT ("userId") DO UPDATE SET status = $2, "currentPeriodEnd" = now() + interval '1 day'`,
      [HOST_USER_ID, status])
  } finally { await db.end() }
}

async function cleanupSessionRows(databaseUrl, gameCode) {
  const db = new pg.Client({ connectionString: databaseUrl })
  await db.connect()
  try {
    const { rows } = await db.query(
      `SELECT id, "quizVersionId" FROM "GameSession" WHERE code = $1 AND "userId" = $2`, [gameCode, HOST_USER_ID])
    for (const row of rows) {
      const a = await db.query(`DELETE FROM "Answer" WHERE "sessionId" = $1`, [row.id])
      const b = await db.query(`DELETE FROM "Attendee" WHERE "sessionId" = $1`, [row.id])
      await db.query(`DELETE FROM "GameSession" WHERE id = $1`, [row.id])
      if (row.quizVersionId) await db.query(`DELETE FROM "QuizVersion" WHERE id = $1`, [row.quizVersionId])
      console.log(`[cleanup] removed session ${row.id} (${a.rowCount} answers, ${b.rowCount} attendees)`)
    }
  } finally { await db.end() }
}

function spawnServer({ port, env, redisUrl }) {
  const childEnv = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    PORT: String(port), NODE_ENV: 'development',
    DATABASE_URL: env.DATABASE_URL, NEXTAUTH_SECRET: env.NEXTAUTH_SECRET,
    ...(redisUrl ? { REDIS_URL: redisUrl } : {}),
  }
  const proc = spawn('node', ['server.mjs'], { cwd: ROOT, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  const logMarks = {} // regex label → first-seen timestamp
  const marks = [
    ['forceEnded', /\[session\] force-ended/],
    ['persisted', /\[db\] persisted quiz session/],
  ]
  const boot = new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server boot timeout (30s)')), 30000)
    proc.stdout.on('data', chunk => {
      const text = String(chunk)
      if (process.env.DEBUG_SERVER_OUT) process.stdout.write(`[server] ${text}`)
      if (/Quizotic running at/.test(text)) { clearTimeout(t); res() }
      for (const [label, re] of marks) {
        if (logMarks[label] === undefined && re.test(text)) logMarks[label] = Date.now()
      }
    })
    proc.stderr.on('data', chunk => { if (process.env.DEBUG_SERVER_OUT) process.stderr.write(`[server:err] ${chunk}`) })
    proc.on('exit', code => rej(new Error(`server exited early (code ${code})`)))
  })
  return { proc, boot, logMarks }
}

function sampleRss(pid, sink) {
  return setInterval(() => {
    execFile('ps', ['-o', 'rss=', '-p', String(pid)], (err, stdout) => {
      const kb = Number(String(stdout).trim())
      if (!err && kb > 0) sink.push(kb)
    })
  }, 2000)
}

function startProbe(url, sink) {
  const socket = ioClient(url, { transports: ['websocket'], reconnection: false })
  const timer = setInterval(() => {
    const sent = Date.now()
    socket.emit('ping_time', { clientTime: sent }, () => sink.push(Date.now() - sent))
  }, 1500) // ping_time allows 60/min per socket; 40/min keeps headroom
  return { socket, timer }
}

function emitAck(socket, event, payload, timeoutMs = 15000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${event} ack timeout`)), timeoutMs)
    socket.emit(event, payload, r => { clearTimeout(t); res(r) })
  })
}

function waitEvent(socket, event, timeoutMs, label) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting for ${label || event}`)), timeoutMs)
    socket.once(event, d => { clearTimeout(t); res({ at: Date.now(), data: d }) })
  })
}

// Verifies the code-enumeration guard: many sockets from ONE IP probing
// unknown game codes must get throttled after the miss budget, even though
// joins into a real session are now scoped per game code.
async function enumCheck() {
  const env = loadEnv()
  const port = Number(arg('port', 4600))
  const url = `http://127.0.0.1:${port}`
  const attempts = 130
  const { proc: server, boot } = spawnServer({ port, env, redisUrl: null })
  try {
    await boot
    const tallies = { notFound: 0, limited: 0, other: 0 }
    for (let batch = 0; batch < attempts; batch += 20) {
      await Promise.all(Array.from({ length: Math.min(20, attempts - batch) }, async (_, i) => {
        const socket = ioClient(url, { transports: ['websocket'], reconnection: false, extraHeaders: { 'x-forwarded-for': '203.0.113.99' } })
        try {
          await waitEvent(socket, 'connect', 10000)
          const code = String(100000 + ((batch + i) * 7919) % 900000)
          const res = await new Promise(r => {
            socket.emit('join_session', { gameCode: code, displayName: 'Probe' }, r)
            setTimeout(() => r({ error: 'ack timeout' }), 10000)
          })
          if (/not found/i.test(res?.error || '')) tallies.notFound++
          else if (/too many join/i.test(res?.error || '')) tallies.limited++
          else tallies.other++
        } catch { tallies.other++ } finally { socket.close() }
      }))
    }
    const pass = tallies.notFound <= 100 && tallies.limited >= attempts - 105 && tallies.other === 0
    console.log(`enum-check: ${attempts} unknown-code joins from one IP → notFound=${tallies.notFound} limited=${tallies.limited} other=${tallies.other}`)
    console.log(pass ? 'VERDICT: PASS — enumeration guard intact' : 'VERDICT: FAIL — enumeration guard broken')
    process.exitCode = pass ? 0 : 2
  } finally {
    server.kill('SIGTERM')
  }
}

async function main() {
  if (arg('bench-serialize', false)) return benchSerialize()
  if (arg('enum-check', false)) return enumCheck()

  const players = Number(arg('players', 100))
  const joinWindowMs = Number(arg('join-window', 60)) * 1000
  const questions = Number(arg('questions', 5))
  const answerMinMs = Number(arg('answer-min', 1)) * 1000
  const answerMaxMs = Number(arg('answer-max', 12)) * 1000
  const sharedIp = !!arg('shared-ip', false)
  const redisUrl = arg('redis-url', null)
  const hostPlan = arg('host-plan', 'pro') === 'free' ? 'free' : 'pro'
  const port = Number(arg('port', 4600))
  const timerSeconds = Math.max(25, Math.ceil(answerMaxMs / 1000) + 10)
  const url = `http://127.0.0.1:${port}`

  await checkFdLimit(players)
  const env = loadEnv()
  console.log(`Quizotic load test — players=${players} joinWindow=${joinWindowMs / 1000}s questions=${questions} sharedIp=${sharedIp} hostPlan=${hostPlan} redis=${redisUrl ? 'yes' : 'no'}`)

  await ensureHost(env.DATABASE_URL, hostPlan)
  console.log(`[setup] ${hostPlan} host ready`)

  const { proc: server, boot, logMarks } = spawnServer({ port, env, redisUrl })
  const workers = []
  let gameCode = null
  let cleaned = false
  const teardown = async () => {
    for (const w of workers) { try { w.kill() } catch { /* noop */ } }
    if (!server.killed) {
      server.kill('SIGTERM')
      await sleep(1500)
      if (!server.killed) server.kill('SIGKILL')
    }
  }
  // Rows land in the REAL database — cleanup must run on every exit path
  // (success, thrown error, Ctrl-C), not just the happy one.
  const cleanupData = async () => {
    if (cleaned || !gameCode) return
    cleaned = true
    if (arg('keep-data', false)) { console.log(`[cleanup] skipped (--keep-data); session code ${gameCode}`); return }
    try { await cleanupSessionRows(env.DATABASE_URL, gameCode) } catch (err) { console.error(`[cleanup] FAILED for session code ${gameCode} — remove rows manually:`, err.message) }
  }
  process.on('SIGINT', () => teardown().then(cleanupData).finally(() => process.exit(130)))

  try {
    await boot
    console.log('[setup] server booted')
    const rssKb = []
    const rssTimer = sampleRss(server.pid, rssKb)

    // Host socket — minted NextAuth cookie, same recipe as live-session-check.mjs.
    const { encode } = await import('@auth/core/jwt')
    const cookieName = 'authjs.session-token'
    const token = await encode({ token: { sub: HOST_USER_ID, userId: HOST_USER_ID }, secret: env.NEXTAUTH_SECRET, salt: cookieName, maxAge: 7200 })
    const host = ioClient(url, { transports: ['websocket'], reconnection: false, extraHeaders: { Cookie: `${cookieName}=${token}` } })
    await waitEvent(host, 'connect', 10000)

    const create = await emitAck(host, 'create_session', {
      quizData: {
        title: `Load test ${players}p`,
        questions: Array.from({ length: questions }, (_, i) => ({
          id: `q${i}`, type: 'mcq', text: `Load question ${i + 1}?`,
          options: ['A', 'B', 'C', 'D'], correctAnswer: '1', timerSeconds, points: 1000,
        })),
      },
    })
    if (!create?.success) throw new Error(`create_session failed: ${JSON.stringify(create)}`)
    gameCode = create.gameCode
    console.log(`[setup] session ${gameCode} created (${hostPlan} host)`)

    // Probe: baseline RTT before load, then keeps running through the quiz.
    const probeBaseline = []
    const probeLoad = []
    let probeSink = probeBaseline
    const probe = startProbe(url, { push: v => probeSink.push(v) })
    await sleep(5000)
    probeSink = probeLoad

    // Fan participants out across workers.
    const workerCount = Math.min(8, Math.max(1, Math.ceil(players / 100)))
    const per = Math.ceil(players / workerCount)
    const t0 = Date.now() + 1000
    const runTimeoutMs = joinWindowMs + questions * (timerSeconds + 10) * 1000 + 60000
    const finals = []
    for (let w = 0; w < workerCount; w++) {
      const startIndex = w * per
      const count = Math.min(per, players - startIndex)
      if (count <= 0) break
      const child = fork(SELF, [], { env: { PATH: process.env.PATH, HOME: process.env.HOME, LOADTEST_WORKER: '1' } })
      workers.push(child)
      finals.push(new Promise((res, rej) => {
        child.on('message', m => { if (m?.type === 'final') res(m.report) })
        child.on('exit', code => { if (code) rej(new Error(`worker ${w} exited ${code}`)) })
      }))
      child.send({ type: 'config', url, gameCode, startIndex, count, total: players, t0, joinWindowMs, sharedIp, answerMinMs, answerMaxMs, questions, runTimeoutMs })
    }

    // Host-side progress: joined count via participant_joined, answered via answer_received.
    let joined = 0
    host.on('participant_joined', () => { joined++ })
    let lastAnswerCount = 0
    host.on('answer_received', d => { lastAnswerCount = d?.count ?? lastAnswerCount })

    console.log(`[join] stampede: ${players} clients over ${joinWindowMs / 1000}s across ${workers.length} workers...`)
    await sleep(t0 + joinWindowMs + 5000 - Date.now())
    console.log(`[join] window closed — host sees ${joined} joined`)

    // Drive the quiz. Questions auto-end on all-answered; the timer is the backstop.
    const questionMetrics = []
    let endedInfo = null
    for (let qi = 0; qi < questions; qi++) {
      const qShow = waitEvent(host, 'question_show', 15000, `question_show q${qi}`)
      const qEnd = waitEvent(host, 'question_ended', (timerSeconds + 20) * 1000, `question_ended q${qi}`)
      // start_quiz / next_question have no ack callback server-side — fire and
      // confirm via the question_show broadcast we're already awaiting.
      host.emit(qi === 0 ? 'start_quiz' : 'next_question', { gameCode })
      const { data: shown, at: shownAt } = await qShow
      const { at: endAt } = await qEnd
      const startAt = shown?.startAt ?? shownAt
      questionMetrics.push({ qi, answered: lastAnswerCount, questionMs: endAt - startAt })
      console.log(`[quiz] q${qi + 1}/${questions}: ${lastAnswerCount} answered, ended ${Math.round((endAt - startAt) / 1000)}s after start`)
      lastAnswerCount = 0
      await sleep(2000)
    }

    const endEmitAt = Date.now()
    const sessionEnded = waitEvent(host, 'session_ended', 60000)
    host.emit('end_session', { gameCode })
    const { at: endedAt, data: endedData } = await sessionEnded
    endedInfo = { recomputeMs: endedAt - endEmitAt, leaderboardSize: endedData?.leaderboard?.length ?? 0 }
    console.log(`[end] session_ended after ${endedInfo.recomputeMs}ms, leaderboard=${endedInfo.leaderboardSize}`)

    // Give the finalize burst + workers time to drain, then collect.
    const reports = await Promise.all(finals)
    await sleep(4000) // let '[db] persisted' land in the server log
    clearInterval(probe.timer); probe.socket.close()
    clearInterval(rssTimer)
    host.close()
    const finalizeBurstMs = (logMarks.persisted && logMarks.forceEnded) ? logMarks.persisted - logMarks.forceEnded : null

    await teardown()

    // ─── Aggregate + report ────────────────────────────────────────────────
    const agg = {
      joinAckMs: [], joinFails: {}, connectErrors: 0,
      answerAckMs: [], revealGapMs: [], rejections: {},
      perQ: Array.from({ length: questions }, () => ({ ack: [], reveal: [] })),
    }
    for (const r of reports) {
      agg.joinAckMs.push(...r.joinAckMs)
      agg.connectErrors += r.connectErrors
      for (const [k, v] of Object.entries(r.joinFails)) agg.joinFails[k] = (agg.joinFails[k] || 0) + v
      for (const [k, v] of Object.entries(r.rejections)) agg.rejections[k] = (agg.rejections[k] || 0) + v
      for (let qi = 0; qi < questions; qi++) {
        agg.perQ[qi].ack.push(...r.answerAckMs[qi])
        agg.perQ[qi].reveal.push(...r.revealGapMs[qi])
        agg.answerAckMs.push(...r.answerAckMs[qi])
        agg.revealGapMs.push(...r.revealGapMs[qi])
      }
    }
    const joinFailTotal = Object.values(agg.joinFails).reduce((a, b) => a + b, 0)
    const join = stats(agg.joinAckMs)
    const ack = stats(agg.answerAckMs)
    const reveal = stats(agg.revealGapMs)
    const probeB = stats(probeBaseline)
    const probeL = stats(probeLoad)
    const rss = { start: rssKb[0] ?? null, peak: rssKb.length ? Math.max(...rssKb) : null }

    console.log('\n════════ RESULTS ════════')
    console.log(`players attempted:      ${players}  (workers: ${workers.length}, sharedIp: ${sharedIp}, redis: ${redisUrl ? 'yes' : 'no'})`)
    console.log(`joins ok / failed:      ${join.n} / ${joinFailTotal}${agg.connectErrors ? `  (+${agg.connectErrors} connect errors)` : ''}`)
    if (joinFailTotal) console.log(`  fail reasons:         ${JSON.stringify(agg.joinFails)}`)
    console.log(`join ack:               p50=${fmt(join.p50)} p95=${fmt(join.p95)} max=${fmt(join.max)}`)
    console.log(`answer ack:             n=${ack.n} p50=${fmt(ack.p50)} p95=${fmt(ack.p95)} max=${fmt(ack.max)}`)
    console.log(`reveal fan-out gap:     n=${reveal.n} p50=${fmt(reveal.p50)} p95=${fmt(reveal.p95)} max=${fmt(reveal.max)}`)
    for (const [qi, q] of agg.perQ.entries()) {
      const qa = stats(q.ack); const qr = stats(q.reveal)
      console.log(`  q${qi + 1}: acks=${qa.n} ack-p95=${fmt(qa.p95)} reveal-p95=${fmt(qr.p95)} allAnswered=${Math.round((questionMetrics[qi]?.questionMs ?? 0) / 100) / 10}s`)
    }
    if (Object.keys(agg.rejections).length) console.log(`answer rejections:      ${JSON.stringify(agg.rejections)}`)
    console.log(`probe RTT baseline:     p50=${fmt(probeB.p50)} p95=${fmt(probeB.p95)}`)
    console.log(`probe RTT under load:   p50=${fmt(probeL.p50)} p95=${fmt(probeL.p95)} max=${fmt(probeL.max)}`)
    console.log(`server RSS:             start=${rss.start ? Math.round(rss.start / 1024) + 'MB' : '—'} peak=${rss.peak ? Math.round(rss.peak / 1024) + 'MB' : '—'}`)
    console.log(`end_session recompute:  ${fmt(endedInfo?.recomputeMs)}  (leaderboard: ${endedInfo?.leaderboardSize})`)
    console.log(`finalize+persist burst: ${fmt(finalizeBurstMs)}`)

    await cleanupData()

    const healthy = joinFailTotal === 0 && agg.connectErrors === 0
      && (reveal.p95 ?? Infinity) < 1000 && (probeL.p95 ?? Infinity) < 200
    console.log(healthy ? '\nVERDICT: PASS — experience held up' : '\nVERDICT: DEGRADED — see numbers above')
    process.exit(healthy ? 0 : 2)
  } catch (err) {
    await teardown()
    await cleanupData()
    throw err
  }
}
