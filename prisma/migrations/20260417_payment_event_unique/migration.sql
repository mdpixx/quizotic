-- Idempotency hardening: dedupe Payment rows by provider webhook event id.
-- Null-safe: Postgres treats each NULL as distinct, so historical rows without
-- a providerEventId are unaffected. Partial unique to skip nulls explicitly.

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerEventId_key"
  ON "Payment" ("providerEventId")
  WHERE "providerEventId" IS NOT NULL;
