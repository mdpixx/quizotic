-- In-app feedback submissions, persisted so admin can triage without an inbox.
-- IF NOT EXISTS keeps this idempotent alongside scripts/ensure-critical-columns.mjs.

CREATE TABLE IF NOT EXISTS "Feedback" (
  "id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "email" TEXT,
  "url" TEXT,
  "userAgent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx" ON "Feedback"("createdAt");
CREATE INDEX IF NOT EXISTS "Feedback_status_idx" ON "Feedback"("status");
