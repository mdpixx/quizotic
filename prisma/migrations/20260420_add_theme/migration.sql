-- Add theme field to Quiz and Presentation for quiz-level theming.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "theme" TEXT;
ALTER TABLE "Presentation" ADD COLUMN IF NOT EXISTS "theme" TEXT;
