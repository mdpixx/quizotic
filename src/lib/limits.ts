export const PLAN_LIMITS = {
  free: {
    maxParticipants: 50,
    maxAiQuestions: 30,      // AI-generated questions per month (proportional)
    maxQuestionsPerGeneration: 10,
    maxSavedQuizzes: 5,
    maxSavedPresentations: 3,
    maxSlidesPerPresentation: 50,
    maxSessionHistory: 3,
    maxImageUploads: 20,     // image uploads per month
    pdfExport: false,
    csvExport: false,
    spacedRetrieval: false,
    showBranding: true,
    maxAiEnhancements: 10,     // AI-enhanced slides per month
  },
  pro: {
    maxParticipants: Infinity,
    maxAiQuestions: 750,     // AI-generated questions per month (proportional)
    maxQuestionsPerGeneration: 25,
    maxSavedQuizzes: Infinity,
    maxSavedPresentations: Infinity,
    maxSlidesPerPresentation: Infinity,
    maxSessionHistory: 50,
    maxImageUploads: 500,    // image uploads per month
    pdfExport: true,
    csvExport: true,
    spacedRetrieval: true,
    showBranding: false,
    maxAiEnhancements: 50,     // AI-enhanced slides per month
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS
