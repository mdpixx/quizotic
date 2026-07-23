-- Post-session smiley feedback (1–5) from hosts and participants.
-- Anonymous by design: no participant identity is stored, only role + an
-- optional session reference — keeps participant rows DPDP-clean for under-18s.
-- IF NOT EXISTS keeps this idempotent alongside scripts/ensure-critical-columns.mjs.

CREATE TABLE IF NOT EXISTS "SessionFeedback" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "sessionCode" TEXT,
  "role" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "reasons" TEXT[] NOT NULL DEFAULT '{}',
  "comment" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SessionFeedback_sessionId_idx" ON "SessionFeedback"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionFeedback_createdAt_idx" ON "SessionFeedback"("createdAt");
