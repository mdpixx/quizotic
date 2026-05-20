-- Async/self-paced quiz sharing.
-- Adds durable link state on GameSession and per-attendee deadline support for
-- future timed async attempts. Uses IF NOT EXISTS because this feature has
-- already been iterated on in development databases.

ALTER TABLE "GameSession"
  ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS "shareSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "allowRetries" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "closesAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "timeLimitMinutes" INTEGER;

ALTER TABLE "Attendee"
  ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_shareSlug_key"
  ON "GameSession"("shareSlug");

CREATE INDEX IF NOT EXISTS "GameSession_shareSlug_idx"
  ON "GameSession"("shareSlug");
