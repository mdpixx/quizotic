-- Pending Pro grants: admin-issued Pro for an email with no account yet.
-- Applied automatically in NextAuth events.createUser when the person signs up.
-- IF NOT EXISTS keeps this idempotent across dev/staging databases.

CREATE TABLE IF NOT EXISTS "PendingProGrant" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "months" INTEGER NOT NULL DEFAULT 1,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingProGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingProGrant_email_key"
  ON "PendingProGrant"("email");

CREATE INDEX IF NOT EXISTS "PendingProGrant_appliedAt_idx"
  ON "PendingProGrant"("appliedAt");
