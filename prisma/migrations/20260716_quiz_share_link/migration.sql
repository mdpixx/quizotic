-- QuizShareLink: multi-use, revocable "share a copy" tokens. Another
-- signed-in user opens /import/<token> and clones the quiz into their own
-- library. Distinct from GameSession.shareSlug (participant play links).
-- IF NOT EXISTS keeps this idempotent alongside scripts/ensure-critical-columns.mjs.
CREATE TABLE IF NOT EXISTS "QuizShareLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "importCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuizShareLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuizShareLink_quizId_fkey" FOREIGN KEY ("quizId")
    REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuizShareLink_token_key" ON "QuizShareLink"("token");
CREATE INDEX IF NOT EXISTS "QuizShareLink_quizId_idx" ON "QuizShareLink"("quizId");
