-- QuizVersion: an immutable snapshot of a quiz's content (title +
-- questions JSON) taken at session-start time. Solves the regression
-- where a host edits a quiz that's already been played in past sessions
-- — historical session reports now reference the version that was
-- actually played, not whatever the quiz looks like today.
--
-- Snapshots are intentionally not de-duplicated: every session gets its
-- own version row even if the quiz was unchanged. Storage cost is small
-- (a few KB per session) and the simpler model is worth it.
CREATE TABLE IF NOT EXISTS "QuizVersion" (
  "id"            TEXT        PRIMARY KEY,
  "quizId"        TEXT,                                  -- nullable: ad-hoc quizzes have no source row
  "title"         TEXT        NOT NULL,
  "subject"       TEXT,
  "language"      TEXT,
  "theme"         TEXT,
  "snapshot"      JSONB       NOT NULL,                  -- the questions array at session-start time
  "questionCount" INTEGER     NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizVersion_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "QuizVersion_quizId_createdAt_idx"
  ON "QuizVersion" ("quizId", "createdAt");

-- Link GameSession to its QuizVersion. Nullable because historical
-- sessions predate this column; new sessions populate it at start time.
ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "quizVersionId" TEXT;

CREATE INDEX IF NOT EXISTS "GameSession_quizVersionId_idx"
  ON "GameSession" ("quizVersionId");
