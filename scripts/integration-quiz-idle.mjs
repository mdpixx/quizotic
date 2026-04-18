#!/usr/bin/env node
// Integration test — the test that would have caught the silent-answer-drop bug.
//
// Spawns server.mjs, connects 1 host + 3 participants, simulates a long lobby
// idle followed by participant socket churn, then runs a 3-question quiz and
// asserts every participant's score is non-zero AND matches the Answer audit
// log in Postgres.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/integration-quiz-idle.mjs [--idle-seconds=480]
//
// Defaults to a fast 30-second idle so it's CI-friendly. Pass --idle-seconds=480
// for the full 8-minute scenario that mirrors the original incident.

import { spawn } from 'child_process'
import { setTimeout as sleep } from 'timers/promises'
import { io as ioClient } from 'socket.io-client'
import pg from 'pg'

const PORT = Number(process.env.INTEGRATION_PORT || 4321)
const idleArg = process.argv.find(a => a.startsWith('--idle-seconds='))
const IDLE_MS = (idleArg ? Number(idleArg.split('=')[1]) : 30) * 1000
const PARTICIPANT_COUNT = 3
const QUESTION_COUNT = 3

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required')
  process.exit(2)
}

const QUIZ_DATA = {
  title: 'Integration Quiz',
  questions: Array.from({ length: QUESTION_COUNT }, (_, i) => ({
    id: `q${i}`,
    type: 'mcq',
    text: `Question ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: '1', // index 1 — every participant will answer correctly
    timerSeconds: 10,
    points: 1000,
  })),
}

let serverProc = null
const sockets = []

function fail(msg, err) {
  console.error(`\n❌ FAIL: ${msg}`)
  if (err) console.error(err)
  cleanup().finally(() => process.exit(1))
}

function ok(msg) { console.log(`✓ ${msg}`) }

async function cleanup() {
  for (const s of sockets) { try { s.disconnect() } catch { /* noop */ } }
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM')
    await sleep(500)
    if (!serverProc.killed) serverProc.kill('SIGKILL')
  }
}

async function spawnServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(PORT), NODE_ENV: 'development' }
    serverProc = spawn('node', ['server.mjs'], { env, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
    let booted = false
    const timer = setTimeout(() => {
      if (!booted) reject(new Error(`server failed to boot within 15s on port ${PORT}`))
    }, 15000)
    serverProc.stdout.on('data', chunk => {
      const text = String(chunk)
      if (process.env.DEBUG_SERVER_OUT) process.stdout.write(`[server] ${text}`)
      if (!booted && /Quizotic running at/.test(text)) {
        booted = true
        clearTimeout(timer)
        resolve()
      }
    })
    serverProc.stderr.on('data', chunk => {
      if (process.env.DEBUG_SERVER_OUT) process.stderr.write(`[server:err] ${chunk}`)
    })
    serverProc.on('exit', code => {
      if (!booted) reject(new Error(`server exited early with code ${code}`))
    })
  })
}

function connect() {
  const s = ioClient(`http://127.0.0.1:${PORT}`, {
    reconnection: false,
    transports: ['websocket', 'polling'],
  })
  sockets.push(s)
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 5000)
    s.on('connect', () => { clearTimeout(t); resolve(s) })
    s.on('connect_error', err => { clearTimeout(t); reject(err) })
  })
}

function emitAck(socket, event, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} ack timeout`)), timeoutMs)
    socket.emit(event, payload, (res) => { clearTimeout(t); resolve(res) })
  })
}

async function run() {
  console.log(`Quizotic integration test — port=${PORT}, idle=${IDLE_MS / 1000}s`)
  await spawnServer()
  ok('server booted')

  const host = await connect()
  const createRes = await emitAck(host, 'create_session', { quizData: QUIZ_DATA, sessionMode: 'competitive' })
  if (!createRes?.success) fail(`create_session failed: ${JSON.stringify(createRes)}`)
  const gameCode = createRes.gameCode
  ok(`session created: ${gameCode}`)

  const participants = []
  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const sock = await connect()
    const joinRes = await emitAck(sock, 'join_session', {
      gameCode,
      displayName: `Tester${i + 1}`,
    })
    if (!joinRes?.success) fail(`participant ${i + 1} join failed: ${JSON.stringify(joinRes)}`)
    if (!joinRes.participantId) fail(`participant ${i + 1} did not receive a participantId`)
    participants.push({ socket: sock, name: `Tester${i + 1}`, participantId: joinRes.participantId })
  }
  ok(`${PARTICIPANT_COUNT} participants joined`)

  ok(`idling lobby for ${IDLE_MS / 1000}s ...`)
  await sleep(IDLE_MS)

  // Simulate the original incident: participant sockets die and reconnect with
  // brand-new socket.ids. With participantId, identity must survive.
  for (const p of participants) {
    p.socket.disconnect()
    sockets.splice(sockets.indexOf(p.socket), 1)
  }
  await sleep(200)
  for (const p of participants) {
    const sock = await connect()
    const joinRes = await emitAck(sock, 'join_session', {
      gameCode,
      displayName: p.name,
      participantId: p.participantId,
    })
    if (!joinRes?.success) fail(`${p.name} reconnect failed: ${JSON.stringify(joinRes)}`)
    if (!joinRes.reconnected) fail(`${p.name} reconnect was not flagged as reconnected (server lost identity)`)
    p.socket = sock
  }
  ok('all participants reconnected with fresh socket.ids — identity preserved via participantId')

  // Listen for the host's question_show events to know when to submit.
  let currentQuestionIndex = -1
  host.on('question_show', ({ index }) => { currentQuestionIndex = index })

  const startRes = await emitAck(host, 'start_quiz', { gameCode })
  if (!startRes?.success) fail(`start_quiz failed: ${JSON.stringify(startRes)}`)
  ok('quiz started')

  for (let qi = 0; qi < QUESTION_COUNT; qi++) {
    // Wait for question_show to broadcast
    const deadline = Date.now() + 5000
    while (currentQuestionIndex !== qi && Date.now() < deadline) await sleep(50)
    if (currentQuestionIndex !== qi) fail(`question ${qi} never broadcast`)

    // Each participant submits the correct answer
    for (const p of participants) {
      const ackPromise = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${p.name} q${qi} answer not confirmed`)), 4000)
        p.socket.once('answer_confirmed', () => { clearTimeout(t); resolve() })
        p.socket.once('answer_rejected', ({ reason }) => { clearTimeout(t); reject(new Error(`${p.name} q${qi} rejected: ${reason}`)) })
      })
      p.socket.emit('submit_answer', {
        gameCode,
        participantId: p.participantId,
        answer: '1',
        timeMs: 1000,
        confidence: 'sure',
      })
      await ackPromise
    }

    if (qi < QUESTION_COUNT - 1) {
      await emitAck(host, 'next_question', { gameCode })
    }
  }
  ok('all participants answered all questions')

  // Capture final leaderboard from session_ended
  const endedPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('session_ended not received by host')), 5000)
    host.once('session_ended', payload => { clearTimeout(t); resolve(payload) })
  })
  await emitAck(host, 'end_session', { gameCode })
  const ended = await endedPromise
  ok(`session ended — leaderboard has ${ended.leaderboard?.length ?? 0} entries`)

  // ─── ASSERTIONS ──────────────────────────────────────────────────────────
  if (!ended.leaderboard || ended.leaderboard.length !== PARTICIPANT_COUNT) {
    fail(`leaderboard has ${ended.leaderboard?.length} entries, expected ${PARTICIPANT_COUNT}`)
  }
  for (const entry of ended.leaderboard) {
    if (!entry.score || entry.score <= 0) {
      fail(`participant "${entry.name}" has score ${entry.score} — the original bug returned`)
    }
  }
  ok('every participant has a non-zero score in the leaderboard')

  // Cross-check against the Answer audit log
  const pgClient = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await pgClient.connect()
  try {
    const sessionRow = await pgClient.query(`SELECT id FROM "GameSession" WHERE code = $1 ORDER BY "createdAt" DESC LIMIT 1`, [gameCode])
    if (sessionRow.rows.length === 0) fail('no GameSession row found in DB')
    const sessionId = sessionRow.rows[0].id
    const totals = await pgClient.query(
      `SELECT "participantId", COUNT(*)::int AS answered, SUM(points)::int AS total
         FROM "Answer" WHERE "sessionId" = $1 GROUP BY "participantId"`,
      [sessionId]
    )
    if (totals.rows.length !== PARTICIPANT_COUNT) {
      fail(`Answer table has ${totals.rows.length} participantIds, expected ${PARTICIPANT_COUNT}`)
    }
    for (const row of totals.rows) {
      if (Number(row.answered) !== QUESTION_COUNT) {
        fail(`participant ${row.participantId} answered ${row.answered}, expected ${QUESTION_COUNT}`)
      }
      if (Number(row.total) <= 0) {
        fail(`participant ${row.participantId} has DB total ${row.total}`)
      }
    }
    ok(`Answer audit log: ${totals.rows.length} participants × ${QUESTION_COUNT} questions persisted`)
  } finally {
    await pgClient.end()
  }

  console.log('\n🎉 ALL ASSERTIONS PASSED — silent-answer-drop bug is dead.')
  await cleanup()
  process.exit(0)
}

process.on('SIGINT', () => cleanup().finally(() => process.exit(130)))
process.on('SIGTERM', () => cleanup().finally(() => process.exit(143)))
process.on('unhandledRejection', err => fail('unhandled rejection', err))

run().catch(err => fail('test threw', err))
