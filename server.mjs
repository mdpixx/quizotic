import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { assignArchetype } from './src/lib/archetypes.mjs'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// In-memory session store (replace with DB in a future phase)
const sessions = new Map()

function generateGameCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.HOST_DOMAIN, process.env.JOIN_DOMAIN].filter(Boolean)
        : '*',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`)

    // ─── HOST EVENTS ───────────────────────────────────────────────

    socket.on('create_session', ({ quizData, practiceMode }, callback) => {
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      sessions.set(gameCode, {
        hostSocketId: socket.id,
        quizData,
        currentQuestionIndex: -1,
        participants: new Map(), // socketId → { name, archetype, score, answers }
        status: 'lobby',
        practiceMode: practiceMode ?? false,
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      console.log(`[session] created: ${gameCode}`)
      callback({ success: true, gameCode })
    })

    socket.on('start_quiz', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.status = 'active'
      session.currentQuestionIndex = 0
      const question = sanitizeQuestion(session.quizData.questions[0])

      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: 0,
        total: session.quizData.questions.length,
      })

      console.log(`[session] started: ${gameCode}`)
    })

    socket.on('next_question', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.currentQuestionIndex++
      const { currentQuestionIndex, quizData } = session

      if (currentQuestionIndex >= quizData.questions.length) {
        // Quiz over — this path is dead code: the host client emits end_session
        // on the last question instead of next_question. Kept for safety.
        emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)
        const leaderboard = buildLeaderboard(session.participants)
        const questionStats = buildQuestionStats(session)
        session.status = 'ended'
        socket.emit('session_ended', { leaderboard, practiceMode: session.practiceMode, questionStats })
        socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, practiceMode: session.practiceMode })
        console.log(`[session] ended: ${gameCode}`)
        return
      }

      emitQuestionEnded(io, gameCode, session, currentQuestionIndex - 1)

      const question = sanitizeQuestion(quizData.questions[currentQuestionIndex])
      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: currentQuestionIndex,
        total: quizData.questions.length,
      })
    })

    socket.on('end_session', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      emitQuestionEnded(io, gameCode, session, session.currentQuestionIndex)

      const leaderboard = buildLeaderboard(session.participants)
      const questionStats = buildQuestionStats(session)
      session.status = 'ended'
      // Host gets full data including questionStats
      socket.emit('session_ended', { leaderboard, practiceMode: session.practiceMode, questionStats })
      // Participants only get leaderboard + practiceMode flag
      socket.to(`session:${gameCode}`).emit('session_ended', { leaderboard, practiceMode: session.practiceMode })
      console.log(`[session] force-ended: ${gameCode}`)
    })

    // ─── PARTICIPANT EVENTS ─────────────────────────────────────────

    socket.on('join_session', ({ gameCode, displayName }, callback) => {
      const session = sessions.get(gameCode)

      if (!session) {
        callback({ success: false, error: 'Game not found. Check the code and try again.' })
        return
      }
      if (session.status === 'ended') {
        callback({ success: false, error: 'This game has already ended.' })
        return
      }

      const archetype = assignArchetype()
      const participant = { name: displayName, archetype, score: 0, answers: [] }
      session.participants.set(socket.id, participant)
      socket.join(`session:${gameCode}`)

      callback({
        success: true,
        status: session.status,
        quizTitle: session.quizData.title,
        archetype,
        practiceMode: session.practiceMode,
      })

      io.to(`host:${gameCode}`).emit('participant_joined', {
        name: displayName,
        archetype,
        count: session.participants.size,
      })

      console.log(`[session] ${displayName} (${archetype}) joined ${gameCode}`)
    })

    socket.on('submit_answer', ({ gameCode, answer, timeMs, confidence }) => {
      const session = sessions.get(gameCode)
      if (!session || session.status !== 'active') return

      const participant = session.participants.get(socket.id)
      if (!participant) return

      const qi = session.currentQuestionIndex
      const question = session.quizData.questions[qi]

      if (participant.answers[qi] !== undefined) return

      const isCorrect = checkAnswer(question, answer)
      const points = isCorrect ? calcPoints(question.points || 1000, timeMs, question.timerSeconds || 20) : 0

      participant.answers[qi] = { answer, isCorrect, points, timeMs, confidence: confidence ?? 'unsure' }
      participant.score += points

      socket.emit('answer_confirmed', { isCorrect, points, totalScore: participant.score })

      const numOptions = question.options?.length ?? 4
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: session.participants.size,
        optionCounts: countAnswersByOption(session, qi, numOptions),
      })
    })

    // ─── DISCONNECT ─────────────────────────────────────────────────

    socket.on('disconnect', () => {
      for (const [code, session] of sessions.entries()) {
        if (session.hostSocketId === socket.id) {
          io.to(`session:${code}`).emit('host_disconnected')
          sessions.delete(code)
          console.log(`[session] deleted (host left): ${code}`)
        }
        if (session.participants.has(socket.id)) {
          const name = session.participants.get(socket.id).name
          session.participants.delete(socket.id)
          io.to(`host:${code}`).emit('participant_left', {
            name,
            count: session.participants.size,
          })
        }
      }
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Quizotic running at http://localhost:${port} [${dev ? 'dev' : 'production'}]`)
  })
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sanitizeQuestion(q) {
  const { correctAnswer, ...safe } = q
  return safe
}

function checkAnswer(question, answer) {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    return String(answer) === String(question.correctAnswer)
  }
  if (question.type === 'multiselect') {
    const correct = [...question.correctAnswer].sort().join(',')
    const given = [...answer].sort().join(',')
    return correct === given
  }
  return false
}

function calcPoints(base, timeMs, timerSeconds) {
  const maxMs = timerSeconds * 1000
  const speedRatio = Math.max(0, 1 - timeMs / maxMs)
  const speedBonus = Math.round(500 * speedRatio)
  return base + speedBonus
}

function countAnswers(session, questionIndex) {
  let count = 0
  for (const p of session.participants.values()) {
    if (p.answers[questionIndex] !== undefined) count++
  }
  return count
}

function countAnswersByOption(session, questionIndex, numOptions) {
  const counts = Array(numOptions).fill(0)
  for (const p of session.participants.values()) {
    const a = p.answers[questionIndex]
    if (a !== undefined) {
      const idx = Number(a.answer)
      if (idx >= 0 && idx < numOptions) counts[idx]++
    }
  }
  return counts
}

// Updated: takes participants Map directly; callers pass session.participants
function buildLeaderboard(participants) {
  return Array.from(participants.values())
    .sort((a, b) => b.score - a.score)
    .map(p => ({ name: p.name, archetype: p.archetype, score: p.score }))
}

// Emit question_ended to the whole room (reveal moment — correctAnswer intentionally exposed)
function emitQuestionEnded(io, gameCode, session, questionIndex) {
  const q = session.quizData.questions[questionIndex]
  if (!q) return
  io.to(`session:${gameCode}`).emit('question_ended', {
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? null,
  })
}

// Compute per-question stats from participant answers for the session report
function buildQuestionStats(session) {
  const ps = Array.from(session.participants.values())
  return session.quizData.questions.map((q, i) => {
    const answered = ps.filter(p => p.answers[i] !== undefined)
    const total = answered.length
    if (total === 0) {
      return {
        index: i, text: q.text, correctPct: 0, confidenceGrid: null,
        bloomsLevel: q.bloomsLevel ?? null, explanation: q.explanation ?? null,
      }
    }

    const correct       = answered.filter(p => p.answers[i].answer === q.correctAnswer).length
    const sureCorrect   = answered.filter(p => p.answers[i].confidence === 'sure'   && p.answers[i].answer === q.correctAnswer).length
    const sureWrong     = answered.filter(p => p.answers[i].confidence === 'sure'   && p.answers[i].answer !== q.correctAnswer).length
    const unsureCorrect = answered.filter(p => p.answers[i].confidence === 'unsure' && p.answers[i].answer === q.correctAnswer).length
    const unsureWrong   = answered.filter(p => p.answers[i].confidence === 'unsure' && p.answers[i].answer !== q.correctAnswer).length

    return {
      index: i,
      text: q.text,
      correctPct: Math.round((correct / total) * 100),
      confidenceGrid: { sureCorrect, sureWrong, unsureCorrect, unsureWrong },
      bloomsLevel: q.bloomsLevel ?? null,
      explanation: q.explanation ?? null,
    }
  })
}
