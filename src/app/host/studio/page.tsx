'use client'

import Link from 'next/link'

const sourceShortcuts = [
  { label: 'Topic', href: '/host/create?start=aitopic', note: 'Generate with AI' },
  { label: 'PDF/DOCX', href: '/host/create?start=aidoc', note: 'Upload notes' },
  { label: 'URL', href: '/host/create?start=aiurl', note: 'Read a page' },
  { label: 'CSV', href: '/host/create?start=csv', note: 'Import bank' },
  { label: 'Templates', href: '/host/templates', note: 'Ready-made' },
  { label: 'Blank', href: '/host/create?start=manual', note: 'Manual build' },
]

export default function StudioPage() {
  return (
    <div className="min-h-full paper-grain" style={{ background: 'var(--color-paper)' }}>
      <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
        <Link href="/host" className="mb-5 inline-flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
          <span aria-hidden>&lt;</span> Dashboard
        </Link>

        <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-7" style={{ borderColor: '#E2E8F0' }}>
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: '#7C3AED' }}>Create</p>
            <h1 className="mt-1 text-3xl font-black leading-tight md:text-5xl" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>
              What do you want to create?
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: 'var(--color-text-muted)' }}>
              Start with the product type. Quiz source choices live inside the builder so hosts do not have to decode quiz intent first.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/host/create"
              className="group rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderColor: '#0F1B3D', background: '#FFFDE6', textDecoration: 'none' }}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: '#F5E642', color: '#0D0D0D', border: '2px solid #0D0D0D' }}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 11l2 2 4-5" />
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                  </svg>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: '#0F1B3D', color: '#F5E642' }}>
                  Default
                </span>
              </div>
              <h2 className="text-2xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Create quiz</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Build a scored quiz, poll-style quiz, practice set, or imported question bank from one builder.
              </p>
              <span className="btn-primary mt-5 inline-flex" style={{ textDecoration: 'none' }}>
                Open quiz builder
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>

            <Link
              href="/host/present/create"
              className="group rounded-2xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderColor: '#BFDBFE', textDecoration: 'none' }}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: '#EFF6FF', color: '#1368CE', border: '1px solid #BFDBFE' }}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M8 20h8M12 16v4" />
                </svg>
              </div>
              <h2 className="text-2xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Create presentation</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#64748B' }}>
                Build an interactive deck with content slides, polls, word clouds, Q&A, and PPTX import.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors group-hover:bg-blue-50" style={{ color: '#1368CE', border: '1px solid #BFDBFE' }}>
                Open slide builder
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-5" style={{ borderColor: '#E2E8F0' }}>
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: '#D97706' }}>Quiz sources</p>
              <h2 className="text-xl font-black" style={{ color: '#0F1B3D', fontFamily: 'var(--font-heading)' }}>Choose a starting point inside quiz creation</h2>
            </div>
            <p className="text-xs font-semibold" style={{ color: '#64748B' }}>All routes open the same quiz builder with the right tab selected.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sourceShortcuts.map(shortcut => (
              <Link
                key={shortcut.label}
                href={shortcut.href}
                className="rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                style={{ borderColor: '#E2E8F0', textDecoration: 'none' }}
              >
                <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>{shortcut.label}</p>
                <p className="mt-0.5 text-xs" style={{ color: '#64748B' }}>{shortcut.note}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
