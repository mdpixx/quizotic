import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { StickyNav } from '@/components/landing/StickyNav'

export const metadata: Metadata = {
  title: 'Features — 11 Question Types, AI Quiz Generation & More',
  description:
    'Quizotic offers 11 question types (MCQ, polls, word clouds, drawing, case studies and more), 4 session modes, AI-powered quiz generation, and Bloom\'s Taxonomy tagging. Free to start.',
  alternates: { canonical: '/features' },
}

const itemListLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Quizotic Question Types',
  description: '11 question types for live quizzes and interactive presentations',
  numberOfItems: 11,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Multiple Choice (MCQ)' },
    { '@type': 'ListItem', position: 2, name: 'Multi-Select' },
    { '@type': 'ListItem', position: 3, name: 'True / False' },
    { '@type': 'ListItem', position: 4, name: 'Poll' },
    { '@type': 'ListItem', position: 5, name: 'Open-Ended' },
    { '@type': 'ListItem', position: 6, name: 'Word Cloud' },
    { '@type': 'ListItem', position: 7, name: 'Live Q&A' },
    { '@type': 'ListItem', position: 8, name: 'Rating Scale' },
    { '@type': 'ListItem', position: 9, name: 'Ranking' },
    { '@type': 'ListItem', position: 10, name: 'Case Study' },
    { '@type': 'ListItem', position: 11, name: 'Drawing Canvas' },
  ],
}

const QUESTION_TYPES = [
  {
    name: 'Multiple Choice',
    tag: 'MCQ',
    description: 'Classic A/B/C/D with image support on options. Auto-scores with speed bonus.',
    color: '#EEF2FF',
    border: '#C7D2FE',
    text: '#3730A3',
  },
  {
    name: 'Multi-Select',
    tag: 'Multi',
    description: 'Pick all that apply. Partial credit supported. Great for nuanced assessment.',
    color: '#FFF7ED',
    border: '#FED7AA',
    text: '#C2410C',
  },
  {
    name: 'True / False',
    tag: 'T/F',
    description: 'Fast and effective. Perfect for quick knowledge checks and myth-busting.',
    color: '#F0FDF4',
    border: '#BBF7D0',
    text: '#15803D',
  },
  {
    name: 'Poll',
    tag: 'Poll',
    description: 'No right or wrong answers. Gauge opinions, preferences, and prior knowledge.',
    color: '#FFF1F2',
    border: '#FECDD3',
    text: '#BE123C',
  },
  {
    name: 'Open-Ended',
    tag: 'Open',
    description: 'Free-text responses collected in real time. Host reviews and highlights answers.',
    color: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
  },
  {
    name: 'Word Cloud',
    tag: 'Cloud',
    description: 'Participants submit words; popular answers grow larger. Instantly visual and engaging.',
    color: '#F0F9FF',
    border: '#BAE6FD',
    text: '#0369A1',
  },
  {
    name: 'Live Q&A',
    tag: 'Q&A',
    description: 'Participants submit questions anonymously. Host picks what to address on screen.',
    color: '#FDF4FF',
    border: '#E9D5FF',
    text: '#7E22CE',
  },
  {
    name: 'Rating Scale',
    tag: 'Rating',
    description: '1–5 or 1–10 scale for satisfaction, difficulty, or confidence ratings.',
    color: '#F0FDFA',
    border: '#99F6E4',
    text: '#0F766E',
  },
  {
    name: 'Ranking',
    tag: 'Rank',
    description: 'Participants drag-and-drop to order items. Great for prioritisation exercises.',
    color: '#FFF5F5',
    border: '#FECACA',
    text: '#B91C1C',
  },
  {
    name: 'Case Study',
    tag: 'Case',
    description: 'Scenario + supporting data + MCQ. Built for higher-order Bloom\'s levels (Apply, Analyse, Evaluate).',
    color: '#F8FAFC',
    border: '#CBD5E1',
    text: '#334155',
  },
  {
    name: 'Drawing Canvas',
    tag: 'Draw',
    description: 'Participants sketch answers on a blank canvas. Host displays submissions live.',
    color: '#FFFDE7',
    border: '#FFF176',
    text: '#F57F17',
  },
]

const SESSION_MODES = [
  {
    name: 'Competitive',
    description: 'Live leaderboard, speed scoring, countdown timer. Maximum energy for any crowd.',
    icon: '🏆',
  },
  {
    name: 'Reflection',
    description: 'No scores, no timer pressure. Participants answer thoughtfully; host reveals patterns.',
    icon: '🔍',
  },
  {
    name: 'Self-Paced',
    description: 'Participants move at their own speed. Great for async learning and assessments.',
    icon: '🕰️',
  },
  {
    name: 'Assessment',
    description: 'Formal evaluation mode with shuffled questions, secure window, and PDF reports.',
    icon: '📋',
  },
]

const BLOOMS_LEVELS = [
  { level: 'Remember', color: '#DBEAFE', text: '#1D4ED8' },
  { level: 'Understand', color: '#D1FAE5', text: '#065F46' },
  { level: 'Apply', color: '#FEF3C7', text: '#92400E' },
  { level: 'Analyse', color: '#FCE7F3', text: '#9D174D' },
  { level: 'Evaluate', color: '#EDE9FE', text: '#5B21B6' },
  { level: 'Create', color: '#FFF1F2', text: '#BE123C' },
]

export default function FeaturesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <StickyNav />
      <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
        <div
          className="max-w-4xl mx-auto px-6 pb-12"
          style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px) + 32px)' }}
        >
          <div className="mb-6">
            <Breadcrumbs items={[
              { name: 'Home', href: '/' },
              { name: 'Features', href: '/features' },
            ]} />
          </div>

          <h1
            className="text-3xl font-black mb-2"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: '#0F1B3D' }}
          >
            Everything you need to run a great session
          </h1>
          <p className="text-base mb-12" style={{ color: '#6B7280' }}>
            11 question types · 4 session modes · AI generation · Bloom&apos;s Taxonomy · No app install
          </p>

          {/* Question Types */}
          <section className="mb-14">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0F1B3D' }}>
              11 Question Types
            </h2>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              From quick knowledge checks to rich case studies — every type of engagement in one platform.
            </p>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {QUESTION_TYPES.map(({ name, tag, description, color, border, text }) => (
                <div
                  key={name}
                  className="rounded-xl p-4"
                  style={{ background: color, border: `1px solid ${border}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: border, color: text }}
                    >
                      {tag}
                    </span>
                    <span className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                      {name}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#4B5563' }}>
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Session Modes */}
          <section className="mb-14">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0F1B3D' }}>
              4 Session Modes
            </h2>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              One quiz, four ways to run it. Switch mode at any time without changing your questions.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SESSION_MODES.map(({ name, description, icon }) => (
                <div
                  key={name}
                  className="rounded-xl p-5"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl" aria-hidden="true">{icon}</span>
                    <span className="font-bold text-sm" style={{ color: '#0F1B3D' }}>{name}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* AI Generation */}
          <section className="mb-14">
            <div
              className="rounded-xl p-6"
              style={{ background: '#0F1B3D' }}
            >
              <h2 className="text-xl font-bold mb-2" style={{ color: '#F5E642' }}>
                AI Quiz Generation
              </h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Paste a topic, paste your notes, or upload a PDF or Word document — Quizotic generates
                a full quiz in seconds. Questions come with explanations, Bloom&apos;s level tags, and
                are ready to launch immediately. You can edit anything before going live.
              </p>
              <ul className="space-y-2">
                {[
                  'Upload PDF, Word, or plain text',
                  'Auto-generates MCQ, True/False, Open-ended mixes',
                  'Each question tagged to a Bloom\'s level',
                  'Explanations included for every question',
                  '30 AI-generated questions per month on the free plan',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <span style={{ color: '#F5E642', flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Bloom's Taxonomy */}
          <section className="mb-14">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0F1B3D' }}>
              Built on Bloom&apos;s Taxonomy
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: '#6B7280' }}>
              Every question can be tagged to Anderson &amp; Krathwohl&apos;s revised Bloom&apos;s
              Taxonomy (2001). After each session, you get a Bloom&apos;s distribution report
              showing the cognitive spread of your quiz — are you testing recall, or pushing
              learners to apply and create?
            </p>
            <div className="flex flex-wrap gap-2">
              {BLOOMS_LEVELS.map(({ level, color, text }) => (
                <span
                  key={level}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: color, color: text }}
                >
                  {level}
                </span>
              ))}
            </div>
          </section>

          {/* Other highlights */}
          <section className="mb-14">
            <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
              More highlights
            </h2>
            <div className="grid gap-3">
              {[
                { label: 'No app install', detail: 'Participants join via a 6-digit code in any browser — phone, tablet, or laptop.' },
                { label: 'Real-time leaderboard', detail: 'Live score updates after every question. Keeps energy high in competitive mode.' },
                { label: 'Session reports', detail: 'Downloadable XLSX with per-participant scores, question-level accuracy, and Bloom\'s distribution.' },
                { label: 'Low-bandwidth friendly', detail: 'Designed for 1–2 Mbps connections. Works in classrooms and training centres anywhere.' },
                { label: 'Simple billing (coming soon)', detail: 'All future paid plans priced in USD with card support.' },
                { label: 'Image support', detail: 'Add images to questions and answer options. Hosted on Cloudflare CDN.' },
              ].map(({ label, detail }) => (
                <div
                  key={label}
                  className="flex gap-4 py-3 px-4 rounded-lg items-start"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  <span className="font-bold text-sm shrink-0 w-44" style={{ color: '#0F1B3D' }}>{label}</span>
                  <span className="text-sm" style={{ color: '#4B5563' }}>{detail}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="text-center pt-4">
            <Link
              href="/auth/signin"
              className="inline-block font-bold px-8 py-3 rounded-lg text-sm"
              style={{
                background: '#F5E642',
                color: '#0D0D0D',
                textDecoration: 'none',
                border: '2px solid #0D0D0D',
                boxShadow: '3px 3px 0 #0D0D0D',
              }}
            >
              Try all 11 question types free →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
