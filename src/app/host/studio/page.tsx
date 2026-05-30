'use client'

import Link from 'next/link'

const intents = [
  {
    title: 'Test knowledge',
    eyebrow: 'Scored quiz',
    desc: 'Timed questions, points, confidence, leaderboard, and a Bloom-tagged report.',
    href: '/host/create?intent=test&start=aitopic',
    tone: '#0F1B3D',
    bg: '#FFFDE6',
    actions: [
      { label: 'Generate from topic', href: '/host/create?intent=test&start=aitopic' },
      { label: 'PDF or DOCX', href: '/host/create?intent=test&start=aidoc' },
      { label: 'Start blank', href: '/host/create?intent=test&start=manual' },
    ],
  },
  {
    title: 'Collect opinions',
    eyebrow: 'Polls + responses',
    desc: 'Word clouds, open text, ratings, Q&A, and quick pulse checks without scoring pressure.',
    href: '/host/create?intent=collect&start=manual&type=poll',
    tone: '#0891B2',
    bg: '#ECFEFF',
    actions: [
      { label: 'Poll question', href: '/host/create?intent=collect&start=manual&type=poll' },
      { label: 'Word cloud', href: '/host/create?intent=collect&start=manual&type=wordcloud' },
      { label: 'Q&A', href: '/host/create?intent=collect&start=manual&type=qa' },
    ],
  },
  {
    title: 'Teach with slides',
    eyebrow: 'Interactive deck',
    desc: 'Import a PPTX, add interaction slides, and run a presenter-controlled session.',
    href: '/host/present/create',
    tone: '#2563EB',
    bg: '#EFF6FF',
    actions: [
      { label: 'Import PPTX', href: '/host/present/create?import=pptx' },
      { label: 'Build deck', href: '/host/present/create' },
      { label: 'Use templates', href: '/host/templates' },
    ],
  },
  {
    title: 'Practice/self-paced',
    eyebrow: 'Shareable practice',
    desc: 'Create a quiz once, then share it for homework, coaching practice, or async review.',
    href: '/host/create?intent=practice&start=aidoc',
    tone: '#16A34A',
    bg: '#F0FDF4',
    actions: [
      { label: 'From document', href: '/host/create?intent=practice&start=aidoc' },
      { label: 'From URL', href: '/host/create?intent=practice&start=aiurl' },
      { label: 'Browse templates', href: '/host/templates' },
    ],
  },
]

const migrationCards = [
  { title: 'Kahoot / Quizizz', desc: 'Export XLSX or CSV, then import into Quizotic for editable MCQ and True/False rounds.', href: '/host/create?intent=migrate&start=csv', status: 'CSV ready' },
  { title: 'Mentimeter / AhaSlides', desc: 'Bring slides through PPTX/PDF import, then re-add live interactions inside Quizotic.', href: '/host/present/create?import=pptx', status: 'PPTX ready' },
  { title: 'Teacher handouts', desc: 'Upload PDF/DOCX notes and generate Bloom-tagged questions with explanations.', href: '/host/create?intent=test&start=aidoc', status: 'AI ready' },
]

export default function StudioPage() {
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
              Pick the session intent first. Quizotic will open the right builder, source, and starting format for the job.
            </p>
          </div>
          <Link href="/host/templates" className="btn-ghost self-start md:self-auto" style={{ textDecoration: 'none', color: 'var(--color-ink)' }}>
            Browse templates
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {intents.map(intent => (
            <article key={intent.title} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#E7E2D4' }}>
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
              <div className="flex flex-wrap gap-2">
                {intent.actions.map((action, index) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={index === 0 ? 'btn-primary' : 'btn-ghost'}
                    style={{
                      textDecoration: 'none',
                      ...(index !== 0 ? { color: 'var(--color-text-secondary)', background: '#fff' } : {}),
                    }}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </article>
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
    </div>
  )
}
