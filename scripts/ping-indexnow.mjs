#!/usr/bin/env node
// Submits all public URLs to IndexNow (Bing, Yandex; Google via partnership).
// Run after any deploy: node scripts/ping-indexnow.mjs

const HOST = 'https://www.quizotic.live'
const KEY = '4b9032c7408c4b1cb570c5b0292de316'
const KEY_LOCATION = `${HOST}/${KEY}.txt`

// All indexable public URLs — mirrors sitemap.ts priority list
const URLS = [
  // Core
  '/',
  '/features',
  '/pricing',
  '/about',
  '/faq',

  // Solution pages
  '/ai-quiz-generator',
  '/ncert-quiz-generator',
  '/pdf-to-quiz',
  '/quiz-maker',
  '/live-quiz',
  '/interactive-presentation',
  '/gamified-learning',
  '/live-polling',

  // Hub indexes (new)
  '/vs',
  '/for',
  '/alternatives',

  // VS pages
  '/vs/kahoot',
  '/vs/mentimeter',
  '/vs/quizizz',
  '/vs/slido',
  '/vs/ahaslides',

  // For pages
  '/for/teachers',
  '/for/schools',
  '/for/colleges',
  '/for/coaching-institutes',
  '/for/corporate-trainers',
  '/for/event-hosts',

  // Alternatives pages
  '/alternatives/kahoot',
  '/alternatives/mentimeter',
  '/alternatives/quizizz',
  '/alternatives/slido',
  '/alternatives/ahaslides',
  '/alternatives/poll-everywhere',

  // Learn articles (top traffic potential)
  '/learn/slido-alternatives-india-2026',
  '/learn/mentimeter-vs-slido-vs-quizotic',
  '/learn/best-quiz-app-jee-neet-coaching-institutes',
  '/learn/how-to-run-a-live-quiz-cbse-classroom',
  '/learn/audience-polling-tool-comparison',
  '/learn/cbse-class-10-free-quiz-questions',
  '/learn/how-to-create-quiz-from-pdf',
  '/learn/kahoot-pricing-india-vs-alternatives',
  '/learn/compliance-training-quiz-tool-india',
  '/learn/how-to-make-interactive-presentation',

  // Templates
  '/templates',
].map(path => `${HOST}${path}`)

async function pingIndexNow() {
  const body = {
    host: 'www.quizotic.live',
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: URLS,
  }

  console.log(`Pinging IndexNow with ${URLS.length} URLs...`)

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  if (res.status === 200) {
    console.log('✓ IndexNow accepted all URLs (200 OK)')
  } else if (res.status === 202) {
    console.log('✓ IndexNow queued for processing (202 Accepted)')
  } else {
    const text = await res.text().catch(() => '')
    console.error(`✗ IndexNow returned ${res.status}: ${text}`)
    process.exit(1)
  }
}

pingIndexNow().catch(err => {
  console.error('✗ IndexNow ping failed:', err.message)
  process.exit(1)
})
