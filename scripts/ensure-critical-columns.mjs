#!/usr/bin/env node
// Idempotent schema-repair shim, runs BEFORE `prisma migrate deploy` on boot.
//
// Why this exists: Prisma tracks applied migrations in `_prisma_migrations`.
// If a migration gets recorded there but the actual DDL didn't land (shadow
// DB drift, interrupted deploy, same-day prefix ordering bugs, manual DB
// surgery) Prisma will refuse to re-run it and the app crashes with
// "column X does not exist" at runtime.
//
// This script runs plain idempotent SQL against the live DB so critical
// schema is always present regardless of Prisma's ledger state. Every
// statement uses `IF NOT EXISTS` so it's safe to re-run forever.
//
// When a migration adds a table/column that the API code immediately
// depends on, mirror it here. Otherwise a Prisma-ledger drift will strand
// every user behind a 500.

import { Pool } from 'pg'

const CRITICAL_COLUMNS = [
  // Original belt-and-suspenders entries
  { table: 'Quiz', column: 'theme', type: 'TEXT' },
  { table: 'Presentation', column: 'theme', type: 'TEXT' },
  // Session 2 — User geo + activity
  { table: 'User', column: 'lastActiveAt', type: 'TIMESTAMP(3)' },
  { table: 'User', column: 'country', type: 'TEXT' },
  { table: 'User', column: 'locale', type: 'TEXT' },
  // Session 2 — UsageLog typed columns
  { table: 'UsageLog', column: 'questionCount', type: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'UsageLog', column: 'model', type: 'TEXT' },
  // Session 5 — GameSession.quizVersionId
  { table: 'GameSession', column: 'quizVersionId', type: 'TEXT' },
  // Phase 2 — Quiz self-paced preference (builder settings gear)
  { table: 'Quiz', column: 'selfPaced', type: 'BOOLEAN NOT NULL DEFAULT false' },
  { table: 'Quiz', column: 'timeLimitMinutes', type: 'INTEGER' },
  { table: 'Quiz', column: 'allowRetries', type: 'BOOLEAN NOT NULL DEFAULT false' },
  // Scheduled self-paced quizzes — participants cannot start before opensAt
  { table: 'GameSession', column: 'opensAt', type: 'TIMESTAMP(3)' },
  // Per-participant answer-option shuffling. The builder's save path writes
  // this on every quiz save, so a missing column 500s the entire save flow —
  // exactly the failure mode this script exists to prevent.
  { table: 'Quiz', column: 'shuffleOptions', type: 'BOOLEAN NOT NULL DEFAULT false' },
  // Feedback kind ('general' | 'feature' | 'bug'). /api/feedback writes it on
  // every submission, including the dashboard's Request a feature button.
  { table: 'Feedback', column: 'type', type: `TEXT NOT NULL DEFAULT 'general'` },
]

// Tables introduced in Sessions 1, 3, 4, 5, 6, 7-8. Each block is a single
// SQL statement that creates the table only if it does not exist. Indexes
// follow in CRITICAL_INDEXES.
const CRITICAL_TABLES = [
  // Per-question answer audit log. Live quizzes silently failed in production
  // when this table was missing — `relation "Answer" does not exist` killed
  // every persistAnswer call, so scores existed only in RAM. Mirrored from
  // prisma/migrations/20260419_add_answer_model/migration.sql.
  `CREATE TABLE IF NOT EXISTS "Answer" (
     "id" TEXT NOT NULL,
     "sessionId" TEXT NOT NULL,
     "attendeeId" TEXT,
     "participantId" TEXT NOT NULL,
     "questionIndex" INTEGER NOT NULL,
     "answer" JSONB NOT NULL,
     "isCorrect" BOOLEAN,
     "basePoints" INTEGER NOT NULL DEFAULT 0,
     "streakBonus" INTEGER NOT NULL DEFAULT 0,
     "points" INTEGER NOT NULL DEFAULT 0,
     "timeMs" INTEGER NOT NULL DEFAULT 0,
     "confidence" TEXT,
     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Answer_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "Answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  // Session 1 — CreditGrant
  `CREATE TABLE IF NOT EXISTS "CreditGrant" (
     "id" TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "bucket" TEXT NOT NULL,
     "amount" INTEGER NOT NULL,
     "reason" TEXT NOT NULL,
     "expiresAt" TIMESTAMP(3),
     "grantedBy" TEXT NOT NULL,
     "metadata" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "CreditGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
   )`,
  // Session 1 — AdminAuditLog
  `CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
     "id" TEXT PRIMARY KEY,
     "actorId" TEXT NOT NULL,
     "actorEmail" TEXT NOT NULL,
     "action" TEXT NOT NULL,
     "targetType" TEXT,
     "targetId" TEXT,
     "payload" JSONB NOT NULL,
     "beforeState" JSONB,
     "afterState" JSONB,
     "reason" TEXT NOT NULL,
     "ipAddress" TEXT,
     "userAgent" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  // Session 3 — WebhookEvent
  `CREATE TABLE IF NOT EXISTS "WebhookEvent" (
     "id" TEXT PRIMARY KEY,
     "provider" TEXT NOT NULL,
     "eventType" TEXT NOT NULL,
     "eventId" TEXT,
     "rawPayload" JSONB NOT NULL,
     "headers" JSONB,
     "status" TEXT NOT NULL DEFAULT 'received',
     "errorMessage" TEXT,
     "processedAt" TIMESTAMP(3),
     "ipAddress" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  // Session 3 — EmailLog
  `CREATE TABLE IF NOT EXISTS "EmailLog" (
     "id" TEXT PRIMARY KEY,
     "userId" TEXT,
     "toEmail" TEXT NOT NULL,
     "subject" TEXT NOT NULL,
     "category" TEXT NOT NULL,
     "providerId" TEXT,
     "status" TEXT NOT NULL DEFAULT 'queued',
     "errorMessage" TEXT,
     "metadata" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
   )`,
  // Session 4 — Coupon
  `CREATE TABLE IF NOT EXISTS "Coupon" (
     "id" TEXT PRIMARY KEY,
     "code" TEXT NOT NULL UNIQUE,
     "kind" TEXT NOT NULL,
     "value" INTEGER NOT NULL,
     "bucket" TEXT,
     "currency" TEXT,
     "description" TEXT,
     "maxRedemptions" INTEGER,
     "redemptionCount" INTEGER NOT NULL DEFAULT 0,
     "perUserLimit" INTEGER NOT NULL DEFAULT 1,
     "validFrom" TIMESTAMP(3),
     "validUntil" TIMESTAMP(3),
     "active" BOOLEAN NOT NULL DEFAULT TRUE,
     "createdBy" TEXT NOT NULL,
     "metadata" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  // Session 4 — CouponRedemption
  `CREATE TABLE IF NOT EXISTS "CouponRedemption" (
     "id" TEXT PRIMARY KEY,
     "couponId" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "appliedTo" TEXT,
     "appliedRefId" TEXT,
     "metadata" JSONB,
     "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE,
     CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
   )`,
  // Session 5 — QuizVersion
  `CREATE TABLE IF NOT EXISTS "QuizVersion" (
     "id" TEXT PRIMARY KEY,
     "quizId" TEXT,
     "title" TEXT NOT NULL,
     "subject" TEXT,
     "language" TEXT,
     "theme" TEXT,
     "snapshot" JSONB NOT NULL,
     "questionCount" INTEGER NOT NULL DEFAULT 0,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "QuizVersion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL
   )`,
  // Session 6 — DataDeletionRequest
  `CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
     "id" TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'pending',
     "reason" TEXT,
     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "graceExpiresAt" TIMESTAMP(3) NOT NULL,
     "completedAt" TIMESTAMP(3),
     "completedBy" TEXT,
     "metadata" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "DataDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
   )`,
  // Session 6 — ModerationFlag
  `CREATE TABLE IF NOT EXISTS "ModerationFlag" (
     "id" TEXT PRIMARY KEY,
     "reporterId" TEXT,
     "targetType" TEXT NOT NULL,
     "targetId" TEXT NOT NULL,
     "category" TEXT NOT NULL,
     "details" TEXT,
     "status" TEXT NOT NULL DEFAULT 'open',
     "disposition" TEXT,
     "reviewedBy" TEXT,
     "reviewedAt" TIMESTAMP(3),
     "metadata" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "ModerationFlag_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL
   )`,
  // Session 7-8 — FeatureFlag
  `CREATE TABLE IF NOT EXISTS "FeatureFlag" (
     "id" TEXT PRIMARY KEY,
     "key" TEXT NOT NULL UNIQUE,
     "description" TEXT,
     "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
     "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
     "metadata" JSONB,
     "createdBy" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  // Session 7-8 — FeatureFlagAssignment
  `CREATE TABLE IF NOT EXISTS "FeatureFlagAssignment" (
     "id" TEXT PRIMARY KEY,
     "flagId" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "enabled" BOOLEAN NOT NULL,
     "reason" TEXT,
     "createdBy" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "FeatureFlagAssignment_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE,
     CONSTRAINT "FeatureFlagAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
     CONSTRAINT "FeatureFlagAssignment_flagId_userId_key" UNIQUE ("flagId", "userId")
   )`,
  // Phase 2 — in-app feedback persisted for the admin triage panel
  `CREATE TABLE IF NOT EXISTS "Feedback" (
     "id" TEXT NOT NULL,
     "message" TEXT NOT NULL,
     "email" TEXT,
     "url" TEXT,
     "userAgent" TEXT,
     "status" TEXT NOT NULL DEFAULT 'new',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
   )`,
  // Quiz sharing — "share a copy" tokens; mirrored from
  // prisma/migrations/20260716_quiz_share_link/migration.sql
  `CREATE TABLE IF NOT EXISTS "QuizShareLink" (
     "id" TEXT NOT NULL,
     "token" TEXT NOT NULL,
     "quizId" TEXT NOT NULL,
     "revokedAt" TIMESTAMP(3),
     "importCount" INTEGER NOT NULL DEFAULT 0,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "QuizShareLink_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "QuizShareLink_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  // Post-session smiley feedback (1-5) from hosts and participants. Anonymous
  // by design — no participant identity, only role + an optional session
  // reference, which keeps participant rows DPDP-clean for under-18s. No FK on
  // sessionId: the code resolves it best-effort from the room code and stores
  // sessionCode as a fallback, so a missing GameSession must not reject the row.
  // Mirrored from prisma/migrations/20260723_session_feedback/migration.sql.
  //
  // This table is why the mirror matters: it was live in the code from #103/#104
  // but absent from production for weeks, 500ing the feedback endpoint and the
  // admin voice-of-customer panel, because nothing on the real boot path ever
  // created it (see railway.json — Railway's startCommand overrides the
  // Dockerfile CMD, so `prisma migrate deploy` never ran).
  `CREATE TABLE IF NOT EXISTS "SessionFeedback" (
     "id" TEXT NOT NULL,
     "sessionId" TEXT,
     "sessionCode" TEXT,
     "role" TEXT NOT NULL,
     "rating" INTEGER NOT NULL,
     "reasons" TEXT[] NOT NULL DEFAULT '{}',
     "comment" TEXT,
     "email" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "SessionFeedback_pkey" PRIMARY KEY ("id")
   )`,
  // Admin-issued Pro for an email with no account yet; applied in NextAuth's
  // events.createUser. Mirrored from
  // prisma/migrations/20260602_pending_pro_grant/migration.sql.
  `CREATE TABLE IF NOT EXISTS "PendingProGrant" (
     "id" TEXT NOT NULL,
     "email" TEXT NOT NULL,
     "months" INTEGER NOT NULL DEFAULT 1,
     "appliedAt" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "PendingProGrant_pkey" PRIMARY KEY ("id")
   )`,
  // Invite-only customer stories. Mirrored from
  // prisma/migrations/20260720_testimonials/migration.sql, with that
  // migration's trailing ALTER TABLE … ADD CONSTRAINT foreign keys folded
  // inline: Postgres has no ADD CONSTRAINT IF NOT EXISTS, so a separate ALTER
  // would error on every boot after the first. Inline constraints ride along
  // with CREATE TABLE IF NOT EXISTS and are skipped wholesale once the table
  // exists. TestimonialInvite must precede Testimonial — these run in order and
  // Testimonial references it.
  `CREATE TABLE IF NOT EXISTS "TestimonialInvite" (
     "id" TEXT NOT NULL,
     "tokenHash" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "campaignKey" TEXT NOT NULL,
     "expiresAt" TIMESTAMP(3) NOT NULL,
     "usedAt" TIMESTAMP(3),
     "deliveryState" TEXT NOT NULL DEFAULT 'claimed',
     "deliveryAttemptedAt" TIMESTAMP(3),
     "emailSentAt" TIMESTAMP(3),
     "lastDeliveryError" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "TestimonialInvite_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "TestimonialInvite_delivery_state_check" CHECK ("deliveryState" IN ('claimed', 'sent', 'retryable', 'unknown')),
     CONSTRAINT "TestimonialInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS "Testimonial" (
     "id" TEXT NOT NULL,
     "inviteId" TEXT,
     "userId" TEXT,
     "emailSnapshot" TEXT NOT NULL,
     "name" TEXT NOT NULL,
     "designation" TEXT NOT NULL,
     "organization" TEXT,
     "quote" TEXT NOT NULL,
     "displayQuote" TEXT,
     "photoUrl" TEXT,
     "photoKey" TEXT,
     "publicationConsent" BOOLEAN NOT NULL DEFAULT false,
     "editingAllowed" BOOLEAN NOT NULL DEFAULT false,
     "materialChange" BOOLEAN NOT NULL DEFAULT false,
     "consentVersion" TEXT NOT NULL,
     "consentGrantedAt" TIMESTAMP(3) NOT NULL,
     "reconfirmedAt" TIMESTAMP(3),
     "reconfirmedQuote" TEXT,
     "deletionPendingAt" TIMESTAMP(3),
     "status" TEXT NOT NULL DEFAULT 'new',
     "publishedAt" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "Testimonial_status_check" CHECK ("status" IN ('new', 'shortlisted', 'published', 'declined')),
     CONSTRAINT "Testimonial_publication_consent_check" CHECK ("status" <> 'published' OR "publicationConsent"),
     CONSTRAINT "Testimonial_publication_timestamp_check" CHECK (("status" = 'published') = ("publishedAt" IS NOT NULL)),
     CONSTRAINT "Testimonial_deletion_pending_check" CHECK ("deletionPendingAt" IS NULL OR ("status" = 'declined' AND "publishedAt" IS NULL)),
     CONSTRAINT "Testimonial_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TestimonialInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE,
     CONSTRAINT "Testimonial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
   )`,
  // Hard bounces / complaints — checked before any transactional send.
  `CREATE TABLE IF NOT EXISTS "EmailSuppression" (
     "email" TEXT NOT NULL,
     "reason" TEXT NOT NULL,
     "source" TEXT NOT NULL DEFAULT 'manual',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("email")
   )`,
]

const CRITICAL_INDEXES = [
  // Answer (per-question audit log) — unique key gives idempotent INSERT … ON CONFLICT
  `CREATE UNIQUE INDEX IF NOT EXISTS "Answer_sessionId_participantId_questionIndex_key" ON "Answer" ("sessionId", "participantId", "questionIndex")`,
  `CREATE INDEX IF NOT EXISTS "Answer_sessionId_idx" ON "Answer" ("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "Answer_attendeeId_idx" ON "Answer" ("attendeeId")`,
  // Session 1
  `CREATE INDEX IF NOT EXISTS "CreditGrant_userId_bucket_expiresAt_idx" ON "CreditGrant" ("userId", "bucket", "expiresAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog" ("actorId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog" ("targetType", "targetId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog" ("action", "createdAt")`,
  // Session 2
  `CREATE INDEX IF NOT EXISTS "User_lastActiveAt_idx" ON "User" ("lastActiveAt")`,
  `CREATE INDEX IF NOT EXISTS "User_country_idx" ON "User" ("country")`,
  // Session 3
  `CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_eventType_createdAt_idx" ON "WebhookEvent" ("provider", "eventType", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "WebhookEvent_eventId_idx" ON "WebhookEvent" ("eventId")`,
  `CREATE INDEX IF NOT EXISTS "WebhookEvent_status_createdAt_idx" ON "WebhookEvent" ("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "EmailLog_userId_createdAt_idx" ON "EmailLog" ("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "EmailLog_category_createdAt_idx" ON "EmailLog" ("category", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "EmailLog_status_createdAt_idx" ON "EmailLog" ("status", "createdAt")`,
  // Session 4
  `CREATE INDEX IF NOT EXISTS "Coupon_active_validUntil_idx" ON "Coupon" ("active", "validUntil")`,
  `CREATE INDEX IF NOT EXISTS "Coupon_kind_idx" ON "Coupon" ("kind")`,
  `CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_couponId_idx" ON "CouponRedemption" ("userId", "couponId")`,
  `CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption" ("couponId")`,
  // Session 5
  `CREATE INDEX IF NOT EXISTS "QuizVersion_quizId_createdAt_idx" ON "QuizVersion" ("quizId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "GameSession_quizVersionId_idx" ON "GameSession" ("quizVersionId")`,
  // Session 6
  `CREATE INDEX IF NOT EXISTS "DataDeletionRequest_userId_idx" ON "DataDeletionRequest" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "DataDeletionRequest_status_graceExpiresAt_idx" ON "DataDeletionRequest" ("status", "graceExpiresAt")`,
  `CREATE INDEX IF NOT EXISTS "ModerationFlag_status_createdAt_idx" ON "ModerationFlag" ("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ModerationFlag_targetType_targetId_idx" ON "ModerationFlag" ("targetType", "targetId")`,
  // Session 7-8
  `CREATE INDEX IF NOT EXISTS "FeatureFlag_enabled_idx" ON "FeatureFlag" ("enabled")`,
  `CREATE INDEX IF NOT EXISTS "FeatureFlagAssignment_userId_idx" ON "FeatureFlagAssignment" ("userId")`,
  // Phase 2 — feedback triage
  `CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx" ON "Feedback" ("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Feedback_status_idx" ON "Feedback" ("status")`,
  // Quiz sharing — share-a-copy tokens
  `CREATE UNIQUE INDEX IF NOT EXISTS "QuizShareLink_token_key" ON "QuizShareLink" ("token")`,
  `CREATE INDEX IF NOT EXISTS "QuizShareLink_quizId_idx" ON "QuizShareLink" ("quizId")`,
  // Post-session feedback — lookups are by session and by recency
  `CREATE INDEX IF NOT EXISTS "SessionFeedback_sessionId_idx" ON "SessionFeedback" ("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "SessionFeedback_createdAt_idx" ON "SessionFeedback" ("createdAt")`,
  // Admin-issued Pro for not-yet-registered emails — one grant per address
  `CREATE UNIQUE INDEX IF NOT EXISTS "PendingProGrant_email_key" ON "PendingProGrant" ("email")`,
  `CREATE INDEX IF NOT EXISTS "PendingProGrant_appliedAt_idx" ON "PendingProGrant" ("appliedAt")`,
  // Testimonials — invite lookup by token hash, one invite per user+campaign
  `CREATE UNIQUE INDEX IF NOT EXISTS "TestimonialInvite_tokenHash_key" ON "TestimonialInvite" ("tokenHash")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TestimonialInvite_userId_campaignKey_key" ON "TestimonialInvite" ("userId", "campaignKey")`,
  `CREATE INDEX IF NOT EXISTS "TestimonialInvite_expiresAt_idx" ON "TestimonialInvite" ("expiresAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Testimonial_inviteId_key" ON "Testimonial" ("inviteId")`,
  `CREATE INDEX IF NOT EXISTS "Testimonial_status_publishedAt_idx" ON "Testimonial" ("status", "publishedAt")`,
  `CREATE INDEX IF NOT EXISTS "Testimonial_createdAt_idx" ON "Testimonial" ("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Testimonial_userId_idx" ON "Testimonial" ("userId")`,
]

// Idempotent data backfills. Each one reconciles a typed column with the
// JSON metadata source-of-truth on every boot, so a missed migration UPDATE
// can't silently undercount usage / billing. Tight WHERE clauses limit
// scope to rows that need fixing — after the first pass succeeds, every
// subsequent boot's UPDATE matches 0 rows and finishes instantly.
//
// When you add a future migration that contains a backfill UPDATE, mirror
// it here using the same idempotent pattern. The migration deploys to fresh
// DBs; this entry covers prod ledgers that drift.
const CRITICAL_BACKFILLS = [
  {
    label: 'UsageLog.questionCount from JSON metadata',
    sql: `UPDATE "UsageLog"
          SET "questionCount" = COALESCE(NULLIF(metadata->>'questionCount', '')::int, 5)
          WHERE "questionCount" = 0
            AND action IN ('ai_generate', 'ai_translate')
            AND metadata IS NOT NULL`,
  },
  {
    label: 'UsageLog.model from JSON metadata',
    sql: `UPDATE "UsageLog"
          SET model = NULLIF(metadata->>'model', '')
          WHERE model IS NULL
            AND metadata IS NOT NULL
            AND metadata ? 'model'`,
  },
]

async function runStatement(pool, sql, label) {
  try {
    const result = await pool.query(sql)
    const rowSuffix = typeof result?.rowCount === 'number' && result.command !== 'CREATE' && result.command !== 'ALTER'
      ? ` rowCount=${result.rowCount}`
      : ''
    console.log(`[ensure-columns] OK — ${label}${rowSuffix}`)
  } catch (err) {
    console.warn(`[ensure-columns] skipped ${label}: ${err.message}`)
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[ensure-columns] DATABASE_URL not set — skipping (build-time stub)')
    return
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    // Tables first (so columns / indexes that reference them have a target).
    for (let i = 0; i < CRITICAL_TABLES.length; i++) {
      const tableMatch = CRITICAL_TABLES[i].match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)
      const label = tableMatch ? `CREATE TABLE ${tableMatch[1]}` : `CREATE TABLE #${i}`
      await runStatement(pool, CRITICAL_TABLES[i], label)
    }
    // Then column additions on existing tables.
    for (const { table, column, type } of CRITICAL_COLUMNS) {
      await runStatement(
        pool,
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
        `${table}.${column}`,
      )
    }
    // Indexes next.
    for (let i = 0; i < CRITICAL_INDEXES.length; i++) {
      const idxMatch = CRITICAL_INDEXES[i].match(/CREATE INDEX IF NOT EXISTS "(\w+)"/)
      const label = idxMatch ? `INDEX ${idxMatch[1]}` : `INDEX #${i}`
      await runStatement(pool, CRITICAL_INDEXES[i], label)
    }
    // Data backfills last — typed columns must exist before the UPDATE
    // statements can populate them.
    for (const { sql, label } of CRITICAL_BACKFILLS) {
      await runStatement(pool, sql, label)
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('[ensure-columns] fatal', err)
  // Never block boot on this — it's a belt-and-suspenders guard. If the DB
  // is unreachable, prisma migrate deploy will fail loudly next and Railway
  // will surface that instead.
  process.exit(0)
})
