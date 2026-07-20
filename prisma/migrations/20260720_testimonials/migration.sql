-- Forward-only migration. If rollback is required, ship a new migration that
-- removes these tables after the application no longer references them.

CREATE TABLE "TestimonialInvite" (
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
    CONSTRAINT "TestimonialInvite_delivery_state_check" CHECK ("deliveryState" IN ('claimed', 'sent', 'retryable', 'unknown'))
);

CREATE TABLE "Testimonial" (
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
    CONSTRAINT "Testimonial_deletion_pending_check" CHECK ("deletionPendingAt" IS NULL OR ("status" = 'declined' AND "publishedAt" IS NULL))
);

CREATE UNIQUE INDEX "TestimonialInvite_tokenHash_key" ON "TestimonialInvite"("tokenHash");
CREATE UNIQUE INDEX "TestimonialInvite_userId_campaignKey_key" ON "TestimonialInvite"("userId", "campaignKey");
CREATE INDEX "TestimonialInvite_expiresAt_idx" ON "TestimonialInvite"("expiresAt");
CREATE UNIQUE INDEX "Testimonial_inviteId_key" ON "Testimonial"("inviteId");
CREATE INDEX "Testimonial_status_publishedAt_idx" ON "Testimonial"("status", "publishedAt");
CREATE INDEX "Testimonial_createdAt_idx" ON "Testimonial"("createdAt");
CREATE INDEX "Testimonial_userId_idx" ON "Testimonial"("userId");

ALTER TABLE "TestimonialInvite"
  ADD CONSTRAINT "TestimonialInvite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Testimonial"
  ADD CONSTRAINT "Testimonial_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "TestimonialInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Testimonial"
  ADD CONSTRAINT "Testimonial_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailSuppression" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("email")
);
