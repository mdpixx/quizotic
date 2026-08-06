-- Per-participant jumbling for self-paced (scheduled) quizzes.
--
-- Session-scoped rather than quiz-scoped (Quiz.shuffleOptions already exists
-- for live) because the same quiz is routinely hosted live in authored order
-- and shared self-paced shuffled. The share is what carries the setting.
--
-- Both default to false at the column level so existing rows and every live
-- session are unaffected; the publish route turns them ON when it creates a
-- new async session, which is what makes "shuffled by default" true for
-- scheduled quizzes only.
ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;
