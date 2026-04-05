export const PLAN_LIMITS = {
  free: {
    maxParticipants: 50,
    maxAiQuestions: 30,      // AI-generated questions per month (proportional)
    maxQuestionsPerGeneration: 10,
    maxSavedQuizzes: 5,
    maxSavedPresentations: 3,
    maxSlidesPerPresentation: 10,
    maxSessionHistory: 3,
    pdfExport: false,
    csvExport: false,
    spacedRetrieval: false,
    showBranding: true,
  },
  pro: {
    maxParticipants: Infinity,
    maxAiQuestions: 750,     // AI-generated questions per month (proportional)
    maxQuestionsPerGeneration: 25,
    maxSavedQuizzes: Infinity,
    maxSavedPresentations: Infinity,
    maxSlidesPerPresentation: Infinity,
    maxSessionHistory: 50,
    pdfExport: true,
    csvExport: true,
    spacedRetrieval: true,
    showBranding: false,
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS
