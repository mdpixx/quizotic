// Live-session protocol check — run against a local dev server:
//   node scripts/live-session-check.mjs
//
// Verifies, end-to-end over real sockets: authenticated session creation,
// participant join + server-side name sanitization, question_show timing
// fields (shared startAt for host/participant timer sync), answer accept +
// duplicate rejection, auto-end on all-answered, leaderboard delta fields,
// and the single-emit personal_result path.
//
// Auth: mints a NextAuth session JWT with the local NEXTAUTH_SECRET. The
// secret is loaded into process memory only and never logged.
import { io } from 'socket.io-client'
import { encode } from '@auth/core/jwt'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadSecret() {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  const raw = readFileSync(resolve(projectRoot, '.env'), 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('NEXTAUTH_SECRET=')) {
      return trimmed.slice('NEXTAUTH_SECRET='.length).replace(/^"|"$/g, '')
    }
  }
  return null
}

const secret = loadSecret()
if (!secret) { console.error('NEXTAUTH_SECRET not found'); process.exit(1) }

const cookieName = 'authjs.session-token'
const token = await encode({
  token: { sub: 'test-host-user', userId: 'test-host-user' },
  secret,
  salt: cookieName,
  maxAge: 3600,
})

const URL = process.env.QUIZOTIC_URL || 'http://localhost:4000'
const results = []
const log = (name, pass, detail = '') => {
  results.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`)
}

const host = io(URL, { transports: ['websocket'], extraHeaders: { Cookie: `${cookieName}=${token}` } })
await new Promise((res, rej) => { host.on('connect', res); setTimeout(() => rej(new Error('host connect timeout')), 5000) })

const create = await new Promise(res => {
  host.emit('create_session', {
    quizData: {
      title: 'Sync test',
      questions: [
        { id: 'q1', type: 'mcq', text: '2+2?', options: ['3', '4'], correctAnswer: '1', timerSeconds: 5, points: 100 },
        { id: 'q2', type: 'mcq', text: '3+3?', options: ['5', '6'], correctAnswer: '1', timerSeconds: 5, points: 100 },
      ],
    },
  }, res)
  setTimeout(() => res({ timeout: true }), 5000)
})
log('authenticated create_session succeeds', create?.success === true, JSON.stringify({ ok: create?.success, code: !!create?.gameCode }))
if (!create?.success) process.exit(1)
const gameCode = create.gameCode
log('game code is 6 digits', /^\d{6}$/.test(gameCode))

const nameSeen = new Promise(res => host.on('participant_joined', p => res(p?.name)))
const participant = io(URL, { transports: ['websocket'] })
await new Promise((res, rej) => { participant.on('connect', res); setTimeout(() => rej(new Error('participant connect timeout')), 5000) })
const join = await new Promise(res => {
  participant.emit('join_session', { gameCode, displayName: '<img src=x>Evil Eve' }, res)
  setTimeout(() => res({ timeout: true }), 5000)
})
log('participant join succeeds', join?.success === true)
const seenName = await Promise.race([nameSeen, new Promise(r => setTimeout(() => r('TIMEOUT'), 4000))])
log('participant name sanitized server-side', seenName === 'img src=xEvil Eve', JSON.stringify(seenName))

const hostQS = new Promise(res => host.on('question_show', d => res({ at: Date.now(), d })))
const partQS = new Promise(res => participant.on('question_show', d => res({ at: Date.now(), d })))
host.emit('start_quiz', { gameCode })
const [hq, pq] = await Promise.all([
  Promise.race([hostQS, new Promise(r => setTimeout(() => r(null), 5000))]),
  Promise.race([partQS, new Promise(r => setTimeout(() => r(null), 5000))]),
])
log('question_show reaches host and participant', !!hq && !!pq)
log('identical server startAt on both screens', hq?.d?.startAt === pq?.d?.startAt && typeof hq?.d?.startAt === 'number', `startAt delta=${hq?.d?.startAt - pq?.d?.startAt}`)
const lead = hq?.d?.startAt - hq.at
log('startAt ~3.5s in the future (countdown window)', lead > 2500 && lead < 4500, `lead=${lead}ms`)

// Register end-of-question listeners BEFORE answering: with a single
// participant the all-answered rule ends the question synchronously on the
// first accepted answer.
const qEnd = new Promise(res => participant.on('question_ended', () => res(Date.now())))
const lb = new Promise(res => participant.on('leaderboard_update', d => res(d)))
const pr = new Promise(res => participant.on('personal_result', d => res(d)))

await new Promise(r => setTimeout(r, Math.max(0, lead + 300)))
const ans1 = await new Promise(res => {
  participant.emit('submit_answer', { gameCode, answer: '1', timeMs: 300, serverSubmittedAt: Date.now() }, res)
  setTimeout(() => res({ timeout: true }), 4000)
})
log('answer accepted', ans1?.accepted === true, JSON.stringify(ans1))
const ans2 = await new Promise(res => {
  participant.emit('submit_answer', { gameCode, answer: '0', timeMs: 400, serverSubmittedAt: Date.now() }, res)
  setTimeout(() => res({ timeout: true }), 4000)
})
log('duplicate answer rejected', ans2?.accepted === false && ans2?.reason === 'duplicate', JSON.stringify(ans2))

const [endAt, lbData, prData] = await Promise.all([
  Promise.race([qEnd, new Promise(r => setTimeout(() => r(null), 12000))]),
  Promise.race([lb, new Promise(r => setTimeout(() => r(null), 12000))]),
  Promise.race([pr, new Promise(r => setTimeout(() => r(null), 12000))]),
])
log('question auto-ends after all answered', !!endAt)
log('leaderboard snapshot carries delta fields', !!lbData?.top?.[0] && 'rankDelta' in (lbData.top[0] ?? {}) && 'scoreDelta' in (lbData.top[0] ?? {}), JSON.stringify(lbData?.top?.[0] ?? null))
log('personal_result carries rank (single-emit path)', typeof prData?.rank === 'number' && prData?.isCorrect === true, JSON.stringify({ rank: prData?.rank, ok: prData?.isCorrect, pts: prData?.pointsEarned }))

host.close(); participant.close()
console.log(results.every(Boolean) ? '\nALL LIVE-SESSION CHECKS PASSED' : '\nSOME CHECKS FAILED')
process.exit(results.every(Boolean) ? 0 : 1)
