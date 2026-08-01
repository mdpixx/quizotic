-- Lifecycle activation nudges. Design spec: docs/lifecycle-automation-spec.md
--
-- Nudge is one row per (user, campaign). The unique key on (userId, campaignKey)
-- is the idempotency guarantee for the whole system: a campaign can physically
-- never be sent to the same person twice, even if the worker double-fires or two
-- replicas race. Every other guardrail is a policy that could be misconfigured;
-- this one cannot.
--
-- User.lifecycleOptOutAt only ever gates the 'lifecycle' email channel.
-- Transactional mail — magic links above all — must keep flowing, or
-- unsubscribing from a nudge would lock someone out of their own account.
--
-- IF NOT EXISTS throughout keeps this idempotent alongside
-- scripts/ensure-critical-columns.mjs, which is what actually builds the
-- production schema.

CREATE TABLE IF NOT EXISTS "Nudge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "campaignKey" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shownAt" TIMESTAMP(3),
  "actedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "emailedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Nudge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Nudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Nudge_userId_campaignKey_key" ON "Nudge"("userId", "campaignKey");
CREATE INDEX IF NOT EXISTS "Nudge_state_createdAt_idx" ON "Nudge"("state", "createdAt");
CREATE INDEX IF NOT EXISTS "Nudge_userId_idx" ON "Nudge"("userId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lifecycleOptOutAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_unsubscribeToken_key" ON "User"("unsubscribeToken");
