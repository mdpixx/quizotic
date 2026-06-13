-- Scheduled self-paced quizzes: participants cannot start before opensAt.
-- NULL = open immediately (preserves existing share-now behavior).
-- IF NOT EXISTS keeps this idempotent alongside scripts/ensure-critical-columns.mjs,
-- which adds the same column before `prisma migrate deploy` runs.

ALTER TABLE "GameSession" ADD COLUMN IF NOT EXISTS "opensAt" TIMESTAMP(3);
