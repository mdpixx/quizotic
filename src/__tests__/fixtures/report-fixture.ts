// Shared session fixture for the report workbook tests.
//
// Covers every branch the builder switches on: a name-capture slide, scored
// single/multi answers, a leaderboard slide that must be dropped, poll,
// word cloud and rating slides, partial confidence data, a duplicate display
// name, and a participant who left without finishing.

import { assemble } from '@/lib/report-data'
import type { Question } from '@/lib/quiz-types'
import type { SessionWorkbookData } from '@/lib/report-workbook'

export const START = new Date('2026-08-01T12:11:00.000Z')
export const END = new Date('2026-08-01T12:34:00.000Z')

export function question(
  overrides: Partial<Question> & Pick<Question, 'id' | 'type' | 'text'>,
): Question {
  return { timerSeconds: 30, points: 1000, ...overrides } as Question
}

export const QUESTIONS: Question[] = [
  question({
    id: 'q0', type: 'openended', text: 'Enter your eight digit employee code',
    isNameCapture: true,
  }),
  question({
    id: 'q1', type: 'mcq', text: 'Viscosity Index is calculated per which standard?',
    options: ['ASTM D2270', 'ASTM D445', 'ASTM D874', 'ASTM D1298'],
    correctAnswer: '0', bloomsLevel: 'remember', explanation: 'D2270 defines VI.',
  }),
  question({
    id: 'q2', type: 'mcq', text: 'A declining TBN indicates what?',
    options: ['Improved oxidation resistance', 'Reduced sulfur', 'Depletion of alkaline reserve', 'Higher flash point'],
    correctAnswer: '2', bloomsLevel: 'analyse',
  }),
  question({ id: 'q3', type: 'leaderboard', text: '' }),
  question({
    id: 'q4', type: 'poll', text: 'Which shift do you work?',
    options: ['Morning', 'Evening', 'Night'],
  }),
  question({ id: 'q5', type: 'wordcloud', text: 'One word for this session' }),
  question({
    id: 'q6', type: 'rating', text: 'Rate this session',
    options: ['1', '2', '3', '4', '5'],
  }),
]

export interface RawAnswer {
  attendeeId: string | null
  participantId: string
  questionIndex: number
  answer: unknown
  isCorrect: boolean | null
  points: number
  timeMs: number
  confidence: string | null
}

export interface RawAttendee {
  id: string
  nickname: string
  realName: string | null
  email: string | null
  team: string | null
  joinedAt: Date
  leftAt: Date | null
  durationSec: number | null
  finalScore: number
}

export const ATTENDEES: RawAttendee[] = [
  { id: 'a1', nickname: 'Ved', realName: null, email: 'ved@example.com', team: 'Red', joinedAt: START, leftAt: END, durationSec: 1380, finalScore: 2000 },
  { id: 'a2', nickname: 'Kuldeep', realName: null, email: null, team: 'Red', joinedAt: START, leftAt: END, durationSec: 1300, finalScore: 1000 },
  { id: 'a3', nickname: 'Ved', realName: null, email: null, team: 'Blue', joinedAt: START, leftAt: null, durationSec: null, finalScore: 0 },
]

export const ANSWERS: RawAnswer[] = [
  // Ved (a1) — identity slide, both scored right, sure on both
  { attendeeId: 'a1', participantId: 'p1', questionIndex: 0, answer: '00508845', isCorrect: null, points: 0, timeMs: 13000, confidence: null },
  { attendeeId: 'a1', participantId: 'p1', questionIndex: 1, answer: '0', isCorrect: true, points: 1000, timeMs: 12000, confidence: 'sure' },
  { attendeeId: 'a1', participantId: 'p1', questionIndex: 2, answer: '2', isCorrect: true, points: 1000, timeMs: 14000, confidence: 'sure' },
  { attendeeId: 'a1', participantId: 'p1', questionIndex: 4, answer: '1', isCorrect: null, points: 0, timeMs: 5000, confidence: null },
  { attendeeId: 'a1', participantId: 'p1', questionIndex: 5, answer: 'useful practical', isCorrect: null, points: 0, timeMs: 8000, confidence: null },
  { attendeeId: 'a1', participantId: 'p1', questionIndex: 6, answer: 4, isCorrect: null, points: 0, timeMs: 3000, confidence: null },
  // Kuldeep (a2) — confidently wrong on Q2. This is the misconception signal.
  { attendeeId: 'a2', participantId: 'p2', questionIndex: 1, answer: '0', isCorrect: true, points: 1000, timeMs: 16000, confidence: 'unsure' },
  { attendeeId: 'a2', participantId: 'p2', questionIndex: 2, answer: '0', isCorrect: false, points: 0, timeMs: 20000, confidence: 'sure' },
  { attendeeId: 'a2', participantId: 'p2', questionIndex: 4, answer: '0', isCorrect: null, points: 0, timeMs: 4000, confidence: null },
  { attendeeId: 'a2', participantId: 'p2', questionIndex: 5, answer: 'useful', isCorrect: null, points: 0, timeMs: 9000, confidence: null },
  { attendeeId: 'a2', participantId: 'p2', questionIndex: 6, answer: 3, isCorrect: null, points: 0, timeMs: 3000, confidence: null },
  // Ved #2 (a3) — duplicate display name, answered one question wrong
  { attendeeId: 'a3', participantId: 'p3', questionIndex: 1, answer: '2', isCorrect: false, points: 0, timeMs: 25000, confidence: 'unsure' },
]

export function fixture(overrides?: {
  questions?: Question[]
  answers?: RawAnswer[]
  attendees?: RawAttendee[]
}): SessionWorkbookData {
  return assemble({
    session: {
      id: 's1',
      code: '482913',
      hostName: 'Mahesh',
      mode: 'live',
      createdAt: START,
      endedAt: END,
      participantCount: 3,
      title: 'Lubes Knowledge League',
      subject: 'Lubricants',
      durationSec: 1380,
    },
    questions: overrides?.questions ?? QUESTIONS,
    cachedStats: [],
    attendees: overrides?.attendees ?? ATTENDEES,
    answers: (overrides?.answers ?? ANSWERS) as never,
  })
}

/** Every optional sheet populated — used by the file-integrity checks. */
export function fullFixture(): SessionWorkbookData {
  return fixture()
}
