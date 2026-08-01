// Picks the one starter quiz to put in front of a Tier-1 user. Spec §3.
//
// The alternative considered here was generating a quiz with AI for the user's
// role/orgType and dropping it straight into their library. That was rejected,
// and the reason is correctness rather than cost:
//
//   Tier is derived from `quizCount` (see tiers.ts). Creating a quiz on someone's
//   behalf flips them Tier 1 → Tier 2 without them having done anything. The exit
//   re-check would then block the very email that created it; `host_first_session`
//   would later fire at someone who never built a quiz, telling them "your quiz is
//   built"; and activation — the metric the whole system is judged on (spec §9) —
//   would count a quiz we made as intent they showed.
//
// The templates below are hand-written, already shipped, and cost nothing to
// send. More importantly the user still performs the creative act, so a
// Tier 1 → 2 transition stays a real signal.
//
// Selection favours the LOWEST-FRICTION template that fits, not the most
// impressive one. The goal is a hosted session this week, so a quiz that can be
// run as-is beats one that needs their content typed in first.

import { QUIZ_TEMPLATES, type QuizTemplate, type TemplateAudience } from '@/lib/quiz-templates'
import { appBaseUrl } from './unsubscribe'

/** Which slice of the gallery this person's work lives in. */
export function audienceFor(role?: string | null, orgType?: string | null): TemplateAudience {
  const org = orgType?.trim().toLowerCase()
  if (org === 'school' || org === 'college' || org === 'coaching') return 'Schools'
  if (org === 'corporate' || org === 'government') return 'Corporate'

  // orgType is optional at signup, so fall back to role before giving up.
  const r = role?.trim().toLowerCase()
  if (r === 'teacher' || r === 'student') return 'Schools'
  if (r === 'trainer' || r === 'hr' || r === 'manager') return 'Corporate'

  return 'Both'
}

// Ready-to-run beats subject-specific. 'Lesson Recap' is general knowledge, so a
// teacher can host it before writing a single question; 'Icebreaker Trivia'
// plays in any meeting. The Corporate templates that look like a better content
// match — onboarding, compliance — all need real policy text typed in first,
// which is exactly the friction that leaves people at Tier 1.
const STARTER_BY_AUDIENCE: Record<TemplateAudience, string> = {
  Schools: 'lesson-recap',
  Corporate: 'icebreaker-trivia',
  Both: 'icebreaker-trivia',
}

export function pickStarterTemplate(
  role?: string | null,
  orgType?: string | null,
): QuizTemplate | null {
  const audience = audienceFor(role, orgType)
  const id = STARTER_BY_AUDIENCE[audience]
  return QUIZ_TEMPLATES.find(t => t.id === id) ?? QUIZ_TEMPLATES[0] ?? null
}

/**
 * Deep link that opens the gallery with this template's preview already up, so
 * the mail lands one click from a quiz in their library rather than on a wall
 * of choices.
 */
export function starterTemplateUrl(template: QuizTemplate): string {
  return `${appBaseUrl()}/host/templates?start=${encodeURIComponent(template.id)}`
}
