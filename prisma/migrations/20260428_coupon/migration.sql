-- Coupon: promotional codes that grant either bonus AI credits, plan
-- discounts, or extended Pro access. Admin-created, optionally usage-capped
-- and time-bounded. Redemptions live in a separate table for full audit.
CREATE TABLE IF NOT EXISTS "Coupon" (
  "id"              TEXT        PRIMARY KEY,
  "code"            TEXT        NOT NULL UNIQUE,             -- user-typed string, e.g. 'WELCOME50'
  "kind"            TEXT        NOT NULL,                    -- 'credits' | 'pro_days' | 'percent_off' | 'amount_off'
  "value"           INTEGER     NOT NULL,                    -- credits=count, pro_days=days, percent_off=0-100, amount_off=smallest currency unit
  "bucket"          TEXT,                                    -- only for kind='credits': 'questions' | 'enhancements'
  "currency"        TEXT,                                    -- only for kind='amount_off': 'usd' | 'inr'
  "description"     TEXT,
  "maxRedemptions"  INTEGER,                                 -- null = unlimited
  "redemptionCount" INTEGER     NOT NULL DEFAULT 0,
  "perUserLimit"    INTEGER     NOT NULL DEFAULT 1,          -- typical promo: once per user
  "validFrom"       TIMESTAMP(3),
  "validUntil"      TIMESTAMP(3),
  "active"          BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdBy"       TEXT        NOT NULL,                    -- admin user id
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Coupon_active_validUntil_idx" ON "Coupon" ("active", "validUntil");
CREATE INDEX IF NOT EXISTS "Coupon_kind_idx"               ON "Coupon" ("kind");

-- CouponRedemption: one row per successful redemption. Used by the per-user
-- and total-redemption gates, and as an audit trail for refunds / disputes.
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id"            TEXT        PRIMARY KEY,
  "couponId"      TEXT        NOT NULL,
  "userId"        TEXT        NOT NULL,
  "appliedTo"     TEXT,                                       -- 'subscription' | 'credits' — what was modified
  "appliedRefId"  TEXT,                                       -- target id (subscription, credit grant, etc.)
  "metadata"      JSONB,
  "redeemedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE,
  CONSTRAINT "CouponRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_couponId_idx"
  ON "CouponRedemption" ("userId", "couponId");

CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx"
  ON "CouponRedemption" ("couponId");
