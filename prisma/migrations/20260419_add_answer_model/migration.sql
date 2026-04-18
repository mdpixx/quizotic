-- Per-question answer audit log. Persisted at submit time (best-effort,
-- fire-and-forget) so scores can be reconstructed if RAM state is lost
-- (server restart, redeploy mid-game). Driven by a recurring zero-score
-- production incident where in-memory game state was the only source of truth.

CREATE TABLE IF NOT EXISTS "Answer" (
  "id"             TEXT NOT NULL,
  "sessionId"      TEXT NOT NULL,
  "attendeeId"     TEXT,
  "participantId"  TEXT NOT NULL,
  "questionIndex"  INTEGER NOT NULL,
  "answer"         JSONB NOT NULL,
  "isCorrect"      BOOLEAN,
  "basePoints"     INTEGER NOT NULL DEFAULT 0,
  "streakBonus"    INTEGER NOT NULL DEFAULT 0,
  "points"         INTEGER NOT NULL DEFAULT 0,
  "timeMs"         INTEGER NOT NULL DEFAULT 0,
  "confidence"     TEXT,
  "submittedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- Idempotency: outbox retries from the client are safe; INSERT ... ON CONFLICT DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS "Answer_sessionId_participantId_questionIndex_key"
  ON "Answer" ("sessionId", "participantId", "questionIndex");

CREATE INDEX IF NOT EXISTS "Answer_sessionId_idx" ON "Answer" ("sessionId");
CREATE INDEX IF NOT EXISTS "Answer_attendeeId_idx" ON "Answer" ("attendeeId");

ALTER TABLE "Answer"
  ADD CONSTRAINT "Answer_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
