-- Quiz self-paced preference, set in the builder settings gear. Live hosting
-- stays the default; these only pre-fill the async/share flow.
-- IF NOT EXISTS keeps this idempotent alongside scripts/ensure-critical-columns.mjs,
-- which adds the same columns before `prisma migrate deploy` runs.

ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "selfPaced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "timeLimitMinutes" INTEGER;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "allowRetries" BOOLEAN NOT NULL DEFAULT false;
