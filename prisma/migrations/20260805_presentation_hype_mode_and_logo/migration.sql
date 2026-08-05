-- Presentation chrome settings for the calm stage.
--
-- hypeMode gates every energetic element on the live presentation stage:
-- floating voter emoji, the vote-velocity waveform, milestone badges, toasts
-- and milestone confetti. It defaults to FALSE, which means existing
-- presentations become calm the first time they are presented after this
-- deploys. That is the intended behaviour change, not an oversight — the
-- energetic chrome was never opt-in and reads as noise in a corporate room.
--
-- logoUrl is the host's own logo, rendered top-left on every slide and above
-- the question on the participant screen. Stored as a plain URL because
-- uploads already go to R2 via the shared ImageUpload component.

ALTER TABLE "Presentation" ADD COLUMN IF NOT EXISTS "hypeMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Presentation" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
