export const PLAN_LIMITS = {
  free: {
    // 100 is the declared "Early Supporter" boost (standard free plan: 50).
    // Accounts created before paid plans launch keep 100 for life — enforce
    // the 50 cap for post-launch signups via User.createdAt when that day comes.
    // Mirrored in server.mjs join gating (search: maxParticipants).
    maxParticipants: 100,
    maxAiQuestions: 30,      // AI-generated questions per month (proportional)
    maxQuestionsPerGeneration: 10,
    maxSavedQuizzes: 20,
    maxSavedPresentations: 3,
    maxSlidesPerPresentation: 50,
    maxSessionHistory: 3,
    maxImageUploads: 20,     // image uploads per month
    pdfExport: false,
    csvExport: false,
    spacedRetrieval: false,
    showBranding: true,
    maxAiEnhancements: 10,     // AI-enhanced slides per month
    maxAsyncQuizzes: 2,        // active self-serve quizzes at once
    maxAsyncResponsesPerQuiz: 100, // responses per async quiz
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
    maxAsyncQuizzes: Infinity,
    maxAsyncResponsesPerQuiz: Infinity,
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS
