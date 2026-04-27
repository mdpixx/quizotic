-- WebhookEvent: every inbound webhook from Razorpay / Stripe / future
-- providers, captured raw before any business logic runs. Allows replay,
-- forensic reconstruction, and "did we ever receive event X?" queries.
-- Idempotency stays with Payment.providerEventId; this is an audit log.
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"          TEXT        PRIMARY KEY,
  "provider"    TEXT        NOT NULL,                  -- 'razorpay' | 'stripe' | future
  "eventType"   TEXT        NOT NULL,                  -- e.g. 'payment.captured', 'invoice.paid'
  "eventId"     TEXT,                                  -- provider-supplied event id (for dedupe lookups)
  "rawPayload"  JSONB       NOT NULL,                  -- full request body
  "headers"     JSONB,                                 -- selected request headers (signatures, etc.)
  "status"      TEXT        NOT NULL DEFAULT 'received', -- 'received' | 'processed' | 'failed' | 'duplicate'
  "errorMessage" TEXT,                                 -- populated on status='failed'
  "processedAt" TIMESTAMP(3),                          -- when downstream business logic finished
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_eventType_createdAt_idx"
  ON "WebhookEvent" ("provider", "eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "WebhookEvent_eventId_idx"
  ON "WebhookEvent" ("eventId");

CREATE INDEX IF NOT EXISTS "WebhookEvent_status_createdAt_idx"
  ON "WebhookEvent" ("status", "createdAt");

-- EmailLog: every transactional + marketing email send via the email
-- helper. Powers "did the user actually get the email?" support replies
-- and bounce/spam analysis. Resend's id stored so we can cross-reference
-- their dashboard if needed.
CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id"          TEXT        PRIMARY KEY,
  "userId"      TEXT,                                  -- nullable: not every send is to a User row (e.g. magic link to new email)
  "toEmail"     TEXT        NOT NULL,
  "subject"     TEXT        NOT NULL,
  "category"    TEXT        NOT NULL,                  -- 'credit_grant' | 'welcome' | 'magic_link' | 'transactional' etc.
  "providerId"  TEXT,                                  -- Resend message id when send succeeded
  "status"      TEXT        NOT NULL DEFAULT 'queued', -- 'queued' | 'sent' | 'failed'
  "errorMessage" TEXT,
  "metadata"    JSONB,                                 -- ad-hoc context (grantId, ticketId, etc.)
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "EmailLog_userId_createdAt_idx"
  ON "EmailLog" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "EmailLog_category_createdAt_idx"
  ON "EmailLog" ("category", "createdAt");

CREATE INDEX IF NOT EXISTS "EmailLog_status_createdAt_idx"
  ON "EmailLog" ("status", "createdAt");
