// In-app copy for each campaign. Design spec §4.
//
// Kept separate from the email templates deliberately. The email interrupts
// someone who is not here and has to re-establish context; the card is read by
// someone already looking at their dashboard, so it can be a single line and a
// button. Saying the same number of words in both places would make the card
// feel like an ad.

import type { CampaignKey } from './campaigns'

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
  'activation.create_first_quiz': {
    title: 'Build your first quiz',
    body: 'Pick a topic, let the AI draft the questions, edit what you do not like. About five minutes.',
    ctaLabel: 'Start building',
    ctaHref: '/host/build',
  },
  'activation.last_touch': {
    title: 'Anything we can help with?',
    body: 'You have not run a session yet. If something got in the way, tell us — it goes straight to the founder.',
    ctaLabel: 'Send feedback',
    ctaHref: '/host?feedback=1',
  },
}
