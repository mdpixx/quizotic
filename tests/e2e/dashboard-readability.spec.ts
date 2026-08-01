import { expect, test, type Locator, type Page } from '@playwright/test'

import { hostAuthCookie } from './socket-auth'

const metric = (value: number, deltaKind: 'percent' | 'points' = 'points') => ({
  value,
  previous: value - 2,
  delta: 2,
  deltaKind,
})

const analytics = {
  range: 30,
  summary: { totalSessions: 3, totalParticipants: 64, avgScore: 61, completionRate: 94, presentationCount: 1, presentationSessionCount: 1 },
  learningPulse: {
    learnerReach: metric(64, 'percent'),
    accuracy: metric(61),
    completion: metric(94),
    confidence: metric(72),
  },
  trend: [
    { date: '2026-07-20', sessions: 1, participants: 18, avgScore: 54, completionRate: 89 },
    { date: '2026-07-26', sessions: 1, participants: 22, avgScore: 63, completionRate: 94 },
    { date: '2026-08-01', sessions: 1, participants: 24, avgScore: 66, completionRate: 100 },
  ],
  recentSessions: [
    { id: 'session-1', contentId: 'quiz-1', type: 'quiz', title: 'AI Masterclass', date: '2026-08-01T08:30:00.000Z', participants: 24, avgScore: 48, completionPct: 100, duration: 720, status: 'ended' },
    { id: 'session-2', contentId: 'presentation-1', type: 'presentation', title: 'Team Kickoff', date: '2026-07-26T08:30:00.000Z', participants: 22, avgScore: null, completionPct: 94, duration: 900, status: 'ended' },
  ],
  confidenceGrid: { sureCorrect: 80, sureWrong: 22, unsureCorrect: 16, unsureWrong: 12 },
  supportLearners: [{ name: 'Anita Rao', sessions: 2, latestScore: 34, change: -18, scores: [52, 34], reason: 'low_and_declining' }],
  bloomsCoverage: [],
  bloomsMastery: [],
  recentQuestionDifficulty: {
    sessionId: 'session-1',
    sessionTitle: 'AI Masterclass',
    questions: [{ index: 0, text: 'What does context window mean in an AI model?', correctPct: 24, bloomsLevel: null }],
  },
  teachingBrief: {
    sessionId: 'session-1',
    sessionTitle: 'AI Masterclass',
    topic: 'Context window',
    tone: 'attention',
    hardQuestionCount: 1,
    confidentlyWrongPct: 17,
    confidentlyWrongCount: 22,
    misconceptionQuestionCount: 1,
    supportLearnerCount: 1,
    weakestQuestion: { index: 0, text: 'What does context window mean in an AI model?', correctPct: 24, bloomsLevel: null },
  },
  recentContent: [
    { id: 'quiz-1', type: 'quiz', title: 'AI Masterclass', updatedAt: '2026-08-01T08:00:00.000Z' },
    { id: 'presentation-1', type: 'presentation', title: 'Team Kickoff', updatedAt: '2026-07-31T08:00:00.000Z' },
  ],
  nextScheduled: null,
  scheduleCount: 2,
}

async function prepareDashboard(page: Page, baseURL: string | undefined) {
  await page.route('**/api/auth/session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'dashboard-readability-host', name: 'Mahesh' }, expires: '2026-08-02T00:00:00Z' }),
  }))
  await page.route('**/api/analytics?range=*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(analytics),
  }))
  await page.route('**/api/lifecycle/nudge', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().method() === 'GET' ? { nudge: null } : { ok: true }),
  }))
  const cookie = await hostAuthCookie('dashboard-readability-host')
  await page.context().addCookies([{ name: 'authjs.session-token', value: cookie.split('=')[1], url: baseURL ?? 'http://127.0.0.1:3000' }])
}

test('dashboard typography, grids, Create menu, and feature request stay usable', async ({ page, baseURL }) => {
  await prepareDashboard(page, baseURL)
  let feedbackPayload: Record<string, unknown> = {}
  await page.route('**/api/feedback', async route => {
    feedbackPayload = await route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/host', { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('menuitem')).toHaveCount(2)
  await expect(page.getByRole('menuitem').nth(0)).toContainText('Quiz')
  await expect(page.getByRole('menuitem').nth(1)).toContainText('Presentation')
  await expect(page.getByText('AI-assisted practice')).toHaveCount(0)
  await page.keyboard.press('Escape')

  const attentionAction = page.getByRole('link', { name: 'See questions and learners' })
  await expect(attentionAction).toHaveAttribute('href', '/host/reports/session-1#misconceptions')
  const attentionGrid = page.locator('[data-dashboard-grid="attention"]')
  await expect(attentionGrid.getByRole('link', { name: 'Review question' })).toHaveCount(0)
  await expect(attentionGrid.getByRole('link', { name: 'Open confidence report' })).toHaveCount(0)
  await expect(attentionGrid.getByRole('link', { name: 'Review learners' })).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: 'AI Masterclass' }).getByRole('link', { name: 'View report' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'AI Masterclass' }).getByRole('link', { name: 'Open', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Request a feature' }).click()
  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toBeVisible()
  await page.locator('textarea').fill('Add class-wise report comparisons')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  expect(feedbackPayload).toMatchObject({ type: 'feature' })
  expect(String(feedbackPayload?.message)).toContain('via dashboard-feature-request')
  await page.getByRole('button', { name: 'Close' }).click()

  const grids = ['attention', 'recent', 'learning']
  const leftWidths: number[] = []
  const rightWidths: number[] = []
  for (const grid of grids) {
    const cards = page.locator(`[data-dashboard-grid="${grid}"] > *`)
    const left = await cards.nth(0).boundingBox()
    const right = await cards.nth(1).boundingBox()
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    leftWidths.push(left?.width ?? 0)
    rightWidths.push(right?.width ?? 0)
  }
  expect(Math.max(...leftWidths) - Math.min(...leftWidths)).toBeLessThanOrEqual(1)
  expect(Math.max(...rightWidths) - Math.min(...rightWidths)).toBeLessThanOrEqual(1)

  const fontSize = async (locator: Locator) => Number.parseFloat(await locator.evaluate(element => getComputedStyle(element).fontSize))
  expect(await fontSize(page.getByText('One clear next step, backed by the learning evidence from your last 30 days.'))).toBeGreaterThanOrEqual(14)
  expect(await fontSize(page.getByText('Recent accuracy and direction', { exact: true }))).toBeGreaterThanOrEqual(12)
  expect(await fontSize(page.getByRole('row').filter({ hasText: 'AI Masterclass' }).getByRole('cell').nth(1))).toBeGreaterThanOrEqual(12)
  expect(await fontSize(page.locator('[title*="session"]').first())).toBeGreaterThanOrEqual(11)
  for (const width of [1440, 1180, 980, 640]) {
    await page.setViewportSize({ width, height: 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
  }
})
