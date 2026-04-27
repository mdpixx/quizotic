-- User geo + activity columns. lastActiveAt powers churn / win-back queries.
-- country and locale are captured at first sign-in from request headers and
-- not overwritten on subsequent logins (a user travelling to Singapore
-- doesn't relocate). All three are nullable so existing rows aren't broken.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale"       TEXT;

CREATE INDEX IF NOT EXISTS "User_lastActiveAt_idx" ON "User" ("lastActiveAt");
CREATE INDEX IF NOT EXISTS "User_country_idx"      ON "User" ("country");

-- UsageLog typed columns. Quota math currently reads `metadata.questionCount`
-- out of the JSON blob — one schema drift away from a billing incident.
-- Promoting to typed columns keeps the JSON for ad-hoc context but pulls
-- the numbers we depend on into the row itself.
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "questionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageLog" ADD COLUMN IF NOT EXISTS "model"         TEXT;

-- One-shot backfill of historical rows. Idempotent: only updates rows where
-- the typed column hasn't been populated yet (questionCount=0 default,
-- model IS NULL). Reading `(metadata->>'questionCount')::int` falls back to
-- 5 (the previous DEFAULT_QUESTION_COST in ai-quota.ts) when missing.
UPDATE "UsageLog"
SET "questionCount" = COALESCE(NULLIF(metadata->>'questionCount', '')::int, 5)
WHERE "questionCount" = 0
  AND metadata IS NOT NULL
  AND action IN ('ai_generate', 'ai_translate');

UPDATE "UsageLog"
SET "model" = NULLIF(metadata->>'model', '')
WHERE "model" IS NULL
  AND metadata IS NOT NULL;
