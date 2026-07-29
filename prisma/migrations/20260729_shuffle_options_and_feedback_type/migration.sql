-- Quiz.shuffleOptions: per-quiz host toggle for per-participant answer-option
-- jumbling. Display-only; scoring stays in original-index space.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;

-- Feedback.type: split feature requests out from bugs / general feedback so
-- the admin Voice tab can triage roadmap signal separately. Existing rows
-- default to 'general'.
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS "Feedback_type_idx" ON "Feedback"("type");
