-- DataDeletionRequest: GDPR / India DPDP Act right-to-erasure tracking.
-- A user requests their data be deleted; we have a regulatory window to
-- comply (GDPR: 30 days; DPDP: similar). The 7-day grace gives the user
-- a chance to cancel before destructive action is taken. Status flow:
--   'pending'   -> user has filed; grace window running
--   'approved'  -> grace passed, ready for the deletion job
--   'completed' -> data anonymised / removed; row kept as audit
--   'cancelled' -> user reversed the request before grace expired
--   'rejected'  -> admin denied (e.g. open dispute); audit row required
CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
  "id"            TEXT        PRIMARY KEY,
  "userId"        TEXT        NOT NULL,
  "status"        TEXT        NOT NULL DEFAULT 'pending',
  "reason"        TEXT,                                      -- user-provided
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "graceExpiresAt" TIMESTAMP(3) NOT NULL,                    -- when status auto-promotes to 'approved'
  "completedAt"   TIMESTAMP(3),
  "completedBy"   TEXT,                                      -- admin user id when manually completed
  "metadata"      JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DataDeletionRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "DataDeletionRequest_userId_idx"
  ON "DataDeletionRequest" ("userId");

CREATE INDEX IF NOT EXISTS "DataDeletionRequest_status_graceExpiresAt_idx"
  ON "DataDeletionRequest" ("status", "graceExpiresAt");

-- ModerationFlag: any user (host or attendee) reports inappropriate
-- content on a session, quiz, or attendee response. Admin queue
-- triages -> 'resolved' with a disposition ('removed' | 'no_action' |
-- 'banned'). Same row used for spam reports, copyright complaints, etc.
CREATE TABLE IF NOT EXISTS "ModerationFlag" (
  "id"          TEXT        PRIMARY KEY,
  "reporterId"  TEXT,                                        -- nullable: anonymous attendees
  "targetType"  TEXT        NOT NULL,                        -- 'quiz' | 'session' | 'answer' | 'user'
  "targetId"    TEXT        NOT NULL,
  "category"    TEXT        NOT NULL,                        -- 'spam' | 'hate' | 'sexual' | 'copyright' | 'other'
  "details"     TEXT,                                        -- free-text from reporter
  "status"      TEXT        NOT NULL DEFAULT 'open',         -- 'open' | 'reviewing' | 'resolved' | 'dismissed'
  "disposition" TEXT,                                        -- 'removed' | 'no_action' | 'banned' | null
  "reviewedBy"  TEXT,                                        -- admin user id
  "reviewedAt"  TIMESTAMP(3),
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModerationFlag_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ModerationFlag_status_createdAt_idx"
  ON "ModerationFlag" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ModerationFlag_targetType_targetId_idx"
  ON "ModerationFlag" ("targetType", "targetId");
