import type { LearningPulse, SupportLearner } from '@/lib/dashboard-insights'

export interface DashboardSummary {
  totalSessions: number
  totalParticipants: number
  avgScore: number | null
  completionRate: number | null
  presentationCount: number
  presentationSessionCount: number
}

export interface DashboardTrendPoint {
  date: string
  sessions: number
  participants: number
  avgScore: number | null
  completionRate: number | null
}

export interface DashboardRecentSession {
  id: string
  contentId: string | null
  type: string
  title: string
  date: string
  participants: number
  avgScore: number | null
  completionPct: number | null
  duration: number | null
  status: string
}

export interface DashboardTeachingBrief {
  sessionId: string
  sessionTitle: string
  topic: string
  tone: 'attention' | 'positive'
  hardQuestionCount: number
  confidentlyWrongPct: number | null
  confidentlyWrongCount: number
  misconceptionQuestionCount: number
  supportLearnerCount: number
  weakestQuestion: {
    index: number
    text: string
    correctPct: number
    bloomsLevel: string | null
  }
}

export interface DashboardRecentContent {
  id: string
  type: 'quiz' | 'presentation'
  title: string
  updatedAt: string
}

export interface DashboardScheduledSession {
  sessionId: string
  quizId: string | null
  title: string
  questionCount: number
  shareSlug: string | null
  phase: 'upcoming' | 'open'
  opensAt: string | null
  closesAt: string | null
  participantCount: number
}

export interface DashboardBloomsCoverage {
  level: string
  count: number
}

export interface DashboardBloomsMastery {
  level: string
  mastery: number | null
  questionCount: number
}

export interface DashboardQuestionDifficulty {
  sessionId: string
  sessionTitle: string
  questions: Array<{
    index: number
    text: string
    correctPct: number
    bloomsLevel: string | null
  }>
}

export interface DashboardAnalyticsData {
  range: 30 | 90 | 365
  summary: DashboardSummary
  learningPulse: LearningPulse
  trend: DashboardTrendPoint[]
  recentSessions: DashboardRecentSession[]
  confidenceGrid: {
    sureCorrect: number
    sureWrong: number
    unsureCorrect: number
    unsureWrong: number
  }
  supportLearners: SupportLearner[]
  bloomsCoverage: DashboardBloomsCoverage[]
  bloomsMastery: DashboardBloomsMastery[]
  recentQuestionDifficulty: DashboardQuestionDifficulty | null
  teachingBrief: DashboardTeachingBrief | null
  recentContent: DashboardRecentContent[]
  nextScheduled: DashboardScheduledSession | null
  scheduleCount: number
}
