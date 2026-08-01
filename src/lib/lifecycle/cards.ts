// In-app copy for each campaign. Design spec §4.
//
// Kept separate from the email templates deliberately. The email interrupts
// someone who is not here and has to re-establish context; the card is read by
// someone already looking at their dashboard, so it can be a single line and a
// button. Saying the same number of words in both places would make the card
// feel like an ad.

import type { CampaignKey } from './campaigns'
import { pickStarterTemplate } from './starter-template'

export interface NudgeCardCopy {
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
}

export const NUDGE_CARDS: Record<CampaignKey, NudgeCardCopy> = {
  'activation.host_first_session': {
    title: 'Your quiz is ready to run',
    body: 'Hosting takes one click. Your audience joins on their phones with a six-digit code — no app, no accounts.',
    ctaLabel: 'Host it now',
    ctaHref: '/host/quizzes',
  },
  // Personalised per user in the API route — see personaliseCard below. This
  // is the fallback for someone with no role or orgType on record.
  'activation.create_first_quiz': {
    title: 'Start from a ready-made quiz',
    body: 'Open one you can host as-is, change what you like, and see the room light up once. No blank page.',
    ctaLabel: 'Browse starters',
    ctaHref: '/host/templates',
  },
  'activation.last_touch': {
    title: 'Anything we can help with?',
    body: 'You have not run a session yet. If something got in the way, tell us — it goes straight to the founder.',
    ctaLabel: 'Send feedback',
    ctaHref: '/host?feedback=1',
  },
}

/**
 * Swaps in a named starter quiz for the Tier-1 card, mirroring what the email
 * does. Same reasoning as starter-template.ts: pointing at one concrete quiz
 * asks for a click, where "build your first quiz" asks for effort from someone
 * who has already declined to make it once.
 */
export function personaliseCard(
  campaignKey: string,
  copy: NudgeCardCopy,
  role?: string | null,
  orgType?: string | null,
): NudgeCardCopy {
  if (campaignKey !== 'activation.create_first_quiz') return copy

  const template = pickStarterTemplate(role, orgType)
  if (!template) return copy

  return {
    title: `Try "${template.title}" — no setup`,
    body: `${template.questionCount} ready-made questions on ${template.subject.toLowerCase()}. Open it, tweak anything, host it.`,
    ctaLabel: `Open "${template.title}"`,
    ctaHref: `/host/templates?start=${encodeURIComponent(template.id)}`,
  }
}
