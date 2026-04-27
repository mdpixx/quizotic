-- FeatureFlag: server-side toggle for releasing features incrementally.
-- Three modes:
--   1. Boolean kill-switch:    enabled=true/false applies to everyone.
--   2. Percentage rollout:     rolloutPercent=N (0-100); deterministic
--      hash of userId + flag.key decides if a given user is in.
--   3. Per-user / per-email allowlist: see FeatureFlagAssignment.
--
-- Allowlist always wins over percentage rollout. enabled=false on the
-- flag itself acts as a global kill regardless of rollout / assignments.
CREATE TABLE IF NOT EXISTS "FeatureFlag" (
  "id"             TEXT        PRIMARY KEY,
  "key"            TEXT        NOT NULL UNIQUE,                  -- e.g. 'pdf_vision_tier'
  "description"    TEXT,
  "enabled"        BOOLEAN     NOT NULL DEFAULT FALSE,           -- master switch
  "rolloutPercent" INTEGER     NOT NULL DEFAULT 0,               -- 0-100, applied when enabled=true and no assignment
  "metadata"       JSONB,
  "createdBy"      TEXT,                                         -- admin user id
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "FeatureFlag_enabled_idx" ON "FeatureFlag" ("enabled");

-- FeatureFlagAssignment: per-user override (force on or force off).
-- Useful for: opening beta features to specific testers; killing a
-- feature for a specific user who's running into a bug; staged rollout
-- where we hand-pick early adopters before flipping the percentage.
CREATE TABLE IF NOT EXISTS "FeatureFlagAssignment" (
  "id"        TEXT        PRIMARY KEY,
  "flagId"    TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "enabled"   BOOLEAN     NOT NULL,                              -- explicit override
  "reason"    TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeatureFlagAssignment_flagId_fkey"
    FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE,
  CONSTRAINT "FeatureFlagAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "FeatureFlagAssignment_flagId_userId_key" UNIQUE ("flagId", "userId")
);

CREATE INDEX IF NOT EXISTS "FeatureFlagAssignment_userId_idx"
  ON "FeatureFlagAssignment" ("userId");
