// The Tier-1 starter quiz. Spec §3, and the resolution of the spec's open
// question about AI generation vs a template gallery.
//
// The load-bearing property is the one that is easy to lose in a later
// refactor: this must never CREATE a quiz for the user. Tier is derived from
// quizCount, so a quiz we made would flip them Tier 1 -> Tier 2, block the very
// email that made it, later tell them "your quiz is built" when they built
// nothing, and count our quiz as their intent in the activation metric.
//
// Everything here is therefore about picking and linking, never writing.

import { describe, expect, it } from 'vitest'
import {
  audienceFor,
  pickStarterTemplate,
  starterTemplateUrl,
} from '../lib/lifecycle/starter-template'
import { QUIZ_TEMPLATES } from '../lib/quiz-templates'
import { renderNudgeEmail } from '../lib/lifecycle/templates'
import { campaignFor } from '../lib/lifecycle/campaigns'
import { NUDGE_CARDS, personaliseCard } from '../lib/lifecycle/cards'

const createFirstQuiz = campaignFor('activation.create_first_quiz')!
const hostFirstSession = campaignFor('activation.host_first_session')!

describe('audience inference', () => {
  it('maps every education orgType to Schools', () => {
    for (const org of ['school', 'college', 'coaching']) {
      expect(audienceFor(null, org), org).toBe('Schools')
    }
  })

  it('maps corporate and government to Corporate', () => {
    for (const org of ['corporate', 'government']) {
      expect(audienceFor(null, org), org).toBe('Corporate')
    }
  })

  it('falls back to role when orgType is missing', () => {
    // orgType is optional at signup — the deferred profile card collects it
    // later, so plenty of Tier-1 users have a role and nothing else.
    expect(audienceFor('teacher', null)).toBe('Schools')
    expect(audienceFor('student', null)).toBe('Schools')
    expect(audienceFor('trainer', null)).toBe('Corporate')
    expect(audienceFor('hr', null)).toBe('Corporate')
    expect(audienceFor('manager', null)).toBe('Corporate')
  })

  it('prefers orgType over role when both are present', () => {
    // A trainer at a college is running classes, not corporate workshops.
    expect(audienceFor('trainer', 'college')).toBe('Schools')
  })

  it('is case and whitespace tolerant', () => {
    expect(audienceFor(null, ' School ')).toBe('Schools')
    expect(audienceFor(' HR ', null)).toBe('Corporate')
  })

  it('lands on Both when it knows nothing', () => {
    expect(audienceFor(null, null)).toBe('Both')
    expect(audienceFor('other', 'other')).toBe('Both')
  })
})

describe('template selection', () => {
  it('always returns a real template, whatever it is given', () => {
    for (const [role, org] of [
      ['teacher', 'school'],
      ['hr', 'corporate'],
      [null, null],
      ['nonsense', 'nonsense'],
    ] as const) {
      const t = pickStarterTemplate(role, org)
      expect(t, `${role}/${org}`).toBeTruthy()
      expect(QUIZ_TEMPLATES.some(x => x.id === t!.id)).toBe(true)
    }
  })

  it('picks a template the user can host without writing anything', () => {
    // Ready-to-run beats a better content match. Onboarding and compliance look
    // like the obvious corporate picks, but both need real policy text typed in
    // first — which is exactly the friction that leaves people at Tier 1.
    expect(pickStarterTemplate('hr', 'corporate')!.id).toBe('icebreaker-trivia')
    expect(pickStarterTemplate('teacher', 'school')!.id).toBe('lesson-recap')
  })

  it('is deterministic — the same user gets the same quiz every time', () => {
    // The email names the template; a card naming a different one would read
    // as a bug to the user.
    const a = pickStarterTemplate('teacher', 'school')
    const b = pickStarterTemplate('teacher', 'school')
    expect(a!.id).toBe(b!.id)
  })

  it('builds an absolute deep link that opens the chosen template', () => {
    const t = pickStarterTemplate('teacher', 'school')!
    const url = starterTemplateUrl(t)
    expect(url).toMatch(/^https?:\/\//)
    expect(url).toContain(`/host/templates?start=${t.id}`)
  })
})

describe('the Tier-1 email names the quiz', () => {
  const render = (role: string | null, orgType: string | null) =>
    renderNudgeEmail(createFirstQuiz, {
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok',
      firstName: 'Priya',
      role,
      orgType,
    })

  it('names the chosen template and links straight to it', () => {
    const t = pickStarterTemplate('teacher', 'school')!
    const { html, text } = render('teacher', 'school')

    for (const out of [html, text]) {
      expect(out).toContain(t.title)
      expect(out).toContain(`/host/templates?start=${t.id}`)
    }
  })

  it('gives a school and a corporate user different quizzes', () => {
    expect(render('teacher', 'school').text).toContain('Lesson Recap')
    expect(render('hr', 'corporate').text).toContain('Icebreaker Trivia')
  })

  it('still renders a usable email when the profile is empty', () => {
    // Never a dangling "A ready-made  quiz" or a broken link.
    const { html, text } = render(null, null)
    expect(text).not.toMatch(/\s{2,}quiz/)
    expect(html).toContain('/host/templates')
    expect(text.length).toBeGreaterThan(200)
  })

  it('leaves the other campaigns alone', () => {
    const { text } = renderNudgeEmail(hostFirstSession, {
      unsubscribeUrl: 'https://www.quizotic.live/api/unsubscribe/tok',
      role: 'teacher',
      orgType: 'school',
    })
    // Someone at Tier 2 already has a quiz — offering them a template would be
    // telling them to start over.
    expect(text).not.toContain('/host/templates?start=')
    expect(text).toContain('/host')
  })

  it('keeps the unsubscribe link on the personalised version', () => {
    const { html, text } = render('teacher', 'school')
    expect(html).toContain('/api/unsubscribe/tok')
    expect(text).toContain('/api/unsubscribe/tok')
  })
})

describe('the in-app card names the same quiz', () => {
  const card = NUDGE_CARDS['activation.create_first_quiz']

  it('matches the template the email would have named', () => {
    const t = pickStarterTemplate('teacher', 'school')!
    const copy = personaliseCard('activation.create_first_quiz', card, 'teacher', 'school')

    expect(copy.title).toContain(t.title)
    expect(copy.ctaHref).toBe(`/host/templates?start=${t.id}`)
  })

  it('leaves other campaigns untouched', () => {
    const other = NUDGE_CARDS['activation.host_first_session']
    expect(personaliseCard('activation.host_first_session', other, 'teacher', 'school')).toBe(other)
  })

  it('falls back to the generic card with no profile', () => {
    const copy = personaliseCard('activation.create_first_quiz', card, null, null)
    expect(copy.ctaHref).toMatch(/^\/host\/templates/)
    expect(copy.title.length).toBeGreaterThan(0)
  })

  it('stays short enough for a dashboard card', () => {
    const copy = personaliseCard('activation.create_first_quiz', card, 'hr', 'corporate')
    expect(copy.body.length).toBeLessThan(180)
  })
})

describe('the gallery honours the deep link', () => {
  it('accepts ?start= and opens that template', () => {
    // Guarded on the source: there is no DOM environment in this project, and
    // a broken link here sends the reader to an undifferentiated wall of
    // templates — the exact friction the personalisation exists to remove.
    const page = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/app/host/templates/page.tsx'),
      'utf8',
    ) as string

    expect(page).toContain("get('start')")
    expect(page).toContain('setPreviewId')
    expect(page).toContain('setFilter')
  })

  it('links to template ids that actually exist', () => {
    // A typo here is a dead link in an email we cannot recall.
    for (const [role, org] of [['teacher', 'school'], ['hr', 'corporate'], [null, null]] as const) {
      const t = pickStarterTemplate(role, org)!
      expect(QUIZ_TEMPLATES.find(x => x.id === t.id), t.id).toBeTruthy()
    }
  })
})
