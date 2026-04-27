-- CreditGrant: admin-issued AI credit adjustments. Aggregated alongside
-- Referral.rewardValue by the quota library to compute bonus credits.
CREATE TABLE IF NOT EXISTS "CreditGrant" (
  "id"        TEXT        PRIMARY KEY,
  "userId"    TEXT        NOT NULL,
  "bucket"    TEXT        NOT NULL,
  "amount"    INTEGER     NOT NULL,
  "reason"    TEXT        NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "grantedBy" TEXT        NOT NULL,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreditGrant_userId_bucket_expiresAt_idx"
  ON "CreditGrant" ("userId", "bucket", "expiresAt");

-- AdminAuditLog: every admin mutation, forever. Read-only after insert.
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"          TEXT        PRIMARY KEY,
  "actorId"     TEXT        NOT NULL,
  "actorEmail"  TEXT        NOT NULL,
  "action"      TEXT        NOT NULL,
  "targetType"  TEXT,
  "targetId"    TEXT,
  "payload"     JSONB       NOT NULL,
  "beforeState" JSONB,
  "afterState"  JSONB,
  "reason"      TEXT        NOT NULL,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_createdAt_idx"
  ON "AdminAuditLog" ("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_createdAt_idx"
  ON "AdminAuditLog" ("targetType", "targetId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog" ("action", "createdAt");
