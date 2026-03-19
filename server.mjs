import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// In-memory session store (replace with DB in Phase 3)
const sessions = new Map()
// sessions[gameCode] = { hostSocketId, quizData, currentQuestion, participants, status }

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

    // Host creates a session and gets a game code
    socket.on('create_session', ({ quizData }, callback) => {
      let gameCode = generateGameCode()
      while (sessions.has(gameCode)) gameCode = generateGameCode()

      sessions.set(gameCode, {
        hostSocketId: socket.id,
        quizData,
        currentQuestionIndex: -1,
        participants: new Map(), // socketId → { name, score, answers }
        status: 'lobby',
      })

      socket.join(`session:${gameCode}`)
      socket.join(`host:${gameCode}`)
      console.log(`[session] created: ${gameCode}`)
      callback({ success: true, gameCode })
    })

    // Host starts the quiz (first question)
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

    // Host advances to next question
    socket.on('next_question', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      session.currentQuestionIndex++
      const { currentQuestionIndex, quizData } = session

      if (currentQuestionIndex >= quizData.questions.length) {
        // Quiz over
        const leaderboard = buildLeaderboard(session)
        session.status = 'ended'
        io.to(`session:${gameCode}`).emit('session_end', { leaderboard })
        console.log(`[session] ended: ${gameCode}`)
        return
      }

      const question = sanitizeQuestion(quizData.questions[currentQuestionIndex])
      io.to(`session:${gameCode}`).emit('question_show', {
        question,
        index: currentQuestionIndex,
        total: quizData.questions.length,
      })
    })

    // Host ends session early
    socket.on('end_session', ({ gameCode }) => {
      const session = sessions.get(gameCode)
      if (!session || session.hostSocketId !== socket.id) return

      const leaderboard = buildLeaderboard(session)
      session.status = 'ended'
      io.to(`session:${gameCode}`).emit('session_end', { leaderboard })
      console.log(`[session] force-ended: ${gameCode}`)
    })

    // ─── PARTICIPANT EVENTS ─────────────────────────────────────────

    // Participant joins a session
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

      const participant = { name: displayName, score: 0, answers: [] }
      session.participants.set(socket.id, participant)
      socket.join(`session:${gameCode}`)

      // Tell participant join succeeded + send current state
      callback({
        success: true,
        status: session.status,
        quizTitle: session.quizData.title,
      })

      // Tell host a new participant joined
      io.to(`host:${gameCode}`).emit('participant_joined', {
        name: displayName,
        count: session.participants.size,
      })

      console.log(`[session] ${displayName} joined ${gameCode}`)
    })

    // Participant submits an answer
    socket.on('submit_answer', ({ gameCode, answer, timeMs }) => {
      const session = sessions.get(gameCode)
      if (!session || session.status !== 'active') return

      const participant = session.participants.get(socket.id)
      if (!participant) return

      const qi = session.currentQuestionIndex
      const question = session.quizData.questions[qi]

      // Prevent double-submitting same question
      if (participant.answers[qi] !== undefined) return

      const isCorrect = checkAnswer(question, answer)
      const points = isCorrect ? calcPoints(question.points || 1000, timeMs, question.timerSeconds || 20) : 0

      participant.answers[qi] = { answer, isCorrect, points, timeMs }
      participant.score += points

      // Confirm to participant
      socket.emit('answer_confirmed', { isCorrect, points, totalScore: participant.score })

      // Tell host an answer came in
      const numOptions = question.options?.length ?? 4
      io.to(`host:${gameCode}`).emit('answer_received', {
        count: countAnswers(session, qi),
        total: session.participants.size,
        optionCounts: countAnswersByOption(session, qi, numOptions),
      })
    })

    // ─── DISCONNECT ─────────────────────────────────────────────────

    socket.on('disconnect', () => {
      // Clean up any sessions this socket hosted
      for (const [code, session] of sessions.entries()) {
        if (session.hostSocketId === socket.id) {
          io.to(`session:${code}`).emit('host_disconnected')
          sessions.delete(code)
          console.log(`[session] deleted (host left): ${code}`)
        }
        // Remove participant
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

// Strip correct answers before sending to participants
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
  // Polls, word clouds, open-ended, rating, ranking — no correct answer
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

function buildLeaderboard(session) {
  return Array.from(session.participants.values())
    .map(p => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
}
