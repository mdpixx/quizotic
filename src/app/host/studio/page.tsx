'use client'

import { useState } from 'react'
import Link from 'next/link'
import { QuizVsSlidesModal } from '@/components/host/QuizVsSlidesModal'

// Each intent has ONE primary action. The source choice (AI topic, document,
// blank, CSV, PPTX) lives in the builder's own tab bar — so the studio stays a
// single clean fork rather than a wall of 12 links.
const intents = [
  {
    title: 'Test knowledge',
    eyebrow: 'Scored quiz',
    desc: 'Timed questions, points, confidence, leaderboard, and a Bloom-tagged report.',
    href: '/host/create?intent=test&start=aitopic',
    cta: 'Build a quiz',
    tone: '#0F1B3D',
    bg: '#FFFDE6',
  },
  {
    title: 'Collect opinions',
    eyebrow: 'Polls + responses',
    desc: 'Word clouds, open text, ratings, Q&A, and quick pulse checks without scoring pressure.',
    href: '/host/create?intent=collect&start=manual&type=poll',
    cta: 'Collect responses',
    tone: '#0891B2',
    bg: '#ECFEFF',
  },
  {
    title: 'Teach with slides',
    eyebrow: 'Interactive deck',
    desc: 'Import a PPTX, add interaction slides, and run a presenter-controlled session.',
    href: '/host/present/create',
    cta: 'Open slide builder',
    tone: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    title: 'Practice/self-paced',
    eyebrow: 'Shareable practice',
    desc: 'Create a quiz once, then share it for homework, coaching practice, or async review.',
    href: '/host/create?intent=practice&start=aidoc',
    cta: 'Create practice set',
    tone: '#16A34A',
    bg: '#F0FDF4',
  },
]

const migrationCards = [
  { title: 'Kahoot / Quizizz', desc: 'Export XLSX or CSV, then import into Quizotic for editable MCQ and True/False rounds.', href: '/host/create?intent=migrate&start=csv', status: 'CSV ready' },
  { title: 'Mentimeter / AhaSlides', desc: 'Bring slides through PPTX/PDF import, then re-add live interactions inside Quizotic.', href: '/host/present/create?import=pptx', status: 'PPTX ready' },
  { title: 'Teacher handouts', desc: 'Upload PDF/DOCX notes and generate Bloom-tagged questions with explanations.', href: '/host/create?intent=test&start=aidoc', status: 'AI ready' },
]

export default function StudioPage() {
  const [compareOpen, setCompareOpen] = useState(false)

  return (
    <div className="min-h-full paper-grain" style={{ background: 'var(--color-paper)' }}>
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/host" className="mb-3 inline-flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
              <span aria-hidden>&lt;</span> Dashboard
            </Link>
            <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: '#7C3AED' }}>Create Studio</p>
            <h1 className="mt-1 text-3xl font-black leading-tight md:text-5xl" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
              What are you trying to run?
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: 'var(--color-text-muted)' }}>
              Pick the session intent first. Quizotic opens the right builder, source, and starting format for the job.
            </p>
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="mt-3 text-sm underline decoration-dotted hover:decoration-solid font-semibold"
              style={{ color: '#0F1B3D' }}
            >
              Quiz or Slides &mdash; what&apos;s the difference?
            </button>
          </div>
          <Link href="/host/templates" className="btn-ghost self-start md:self-auto" style={{ textDecoration: 'none', color: 'var(--color-ink)' }}>
            Browse templates
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {intents.map(intent => (
            <Link
              key={intent.title}
              href={intent.href}
              className="group flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: '#E7E2D4', textDecoration: 'none' }}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: intent.bg, color: intent.tone }}>
                    {intent.eyebrow}
                  </span>
                  <h2 className="mt-3 text-2xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>{intent.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: '#64748B' }}>{intent.desc}</p>
                </div>
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border md:flex" style={{ background: intent.bg, borderColor: `${intent.tone}30`, color: intent.tone }}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
              </div>
              <span className="btn-primary mt-auto self-start" style={{ textDecoration: 'none' }}>
                {intent.cta}
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: '#E7E2D4' }}>
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: '#D97706' }}>Migration hub</p>
              <h2 className="text-xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Bring existing content in</h2>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Switching should take minutes, not an afternoon.</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {migrationCards.map(card => (
              <Link key={card.title} href={card.href} className="rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: '#E2E8F0', textDecoration: 'none' }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black" style={{ color: '#0F1B3D' }}>{card.title}</h3>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: '#F0FDF4', color: '#047857' }}>{card.status}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{card.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <QuizVsSlidesModal open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  )
}
