export const PLAN_LIMITS = {
  free: {
    maxParticipants: 10,
    maxAiGenerations: 3,     // per month
    maxQuestionsPerGeneration: 10,
    maxSavedQuizzes: 5,
    maxSessionHistory: 3,
    pdfExport: false,
    csvExport: false,
    spacedRetrieval: false,
    showBranding: true,
  },
  pro: {
    maxParticipants: Infinity,
    maxAiGenerations: 30,    // per month
    maxQuestionsPerGeneration: 25,
    maxSavedQuizzes: Infinity,
    maxSessionHistory: 50,
    pdfExport: true,
    csvExport: true,
    spacedRetrieval: true,
    showBranding: false,
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS
