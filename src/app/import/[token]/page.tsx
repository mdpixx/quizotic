import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ImportQuizButton from './ImportQuizButton'

export const dynamic = 'force-dynamic'

// Share links are personal invitations — never surface them in search.
export const metadata: Metadata = {
  title: 'Add a shared quiz — Quizotic',
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ token: string }> }

export default async function ImportPage({ params }: PageProps) {
  const { token } = await params

  // Sign-in is required before anything is shown: the preview itself is
  // gated so tokens leaked into crawlers/link previews reveal nothing.
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/auth/signin?intent=signup&callbackUrl=${encodeURIComponent(`/import/${token}`)}`)
  }

  const link = await prisma.quizShareLink.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      quiz: {
        select: {
          userId: true,
          title: true,
          subject: true,
          language: true,
          questions: true,
          user: { select: { name: true } },
        },
      },
    },
  })

  if (!link || !link.quiz) {
    return (
      <StatusCard
        icon="?"
        title="This share link is invalid"
        body="The link may have been copied incompletely, or the quiz no longer exists. Ask your colleague to send a fresh link."
      />
    )
  }
  if (link.revokedAt) {
    return (
      <StatusCard
        icon="⏻"
        title="This share link has been turned off"
        body="The quiz owner disabled this link. Ask them to share a new one if you still need a copy."
      />
    )
  }
  if (link.quiz.userId === session.user.id) {
    return (
      <StatusCard
        icon="✓"
        title="This is your own quiz"
        body="It's already in your library — no need to import it. Use Duplicate from your quiz list if you want a copy."
        ctaHref="/host/quizzes"
        ctaLabel="Go to my quizzes"
      />
    )
  }

  // Only safe scalars cross into the page: title, subject, count, sharer name.
  // The questions array (with answers) stays server-side.
  const questionCount = Array.isArray(link.quiz.questions) ? link.quiz.questions.length : 0
  const sharedByName = link.quiz.user?.name ?? 'a Quizotic teacher'

  return (
    <Shell>
      <div
        className="rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: '#FBD13B' }}>
          Shared with you
        </p>
        <h1
          className="text-2xl font-black leading-snug mb-1"
          style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}
        >
          {link.quiz.title}
        </h1>
        <p className="text-sm mb-5" style={{ color: '#94A3B8' }}>
          Shared by {sharedByName}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <InfoTile label="Questions" value={String(questionCount)} />
          <InfoTile label="Subject" value={link.quiz.subject ?? '—'} />
        </div>

        <p
          className="text-xs mb-5 rounded-lg px-3 py-2"
          style={{ background: 'rgba(251,209,59,0.1)', color: '#FBD13B' }}
        >
          {`Importing saves an independent copy to your library. You can edit and host it like your own quiz — later changes by ${sharedByName} won't affect it.`}
        </p>

        <ImportQuizButton token={token} />
      </div>
    </Shell>
  )
}

// ─── Server-rendered shell + shared bits ─────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F1B3D' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <BrandWordmark />
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: string
  title: string
  body: string
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <Shell>
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div
          className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 text-2xl"
          style={{ background: 'rgba(251,209,59,0.1)', border: '1.5px solid rgba(251,209,59,0.3)', color: '#FBD13B' }}
        >
          {icon}
        </div>
        <h1 className="text-xl font-black mb-2" style={{ color: '#fff', fontFamily: 'var(--font-heading)' }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: '#94A3B8' }}>{body}</p>
        {ctaHref && ctaLabel && (
          <a
            href={ctaHref}
            className="inline-block w-full mt-5 py-3 rounded-xl font-black text-sm"
            style={{ background: '#FBD13B', color: '#0D0D0D', fontFamily: 'var(--font-heading)' }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </Shell>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-sm font-bold truncate" style={{ color: '#fff' }}>{value}</p>
    </div>
  )
}

function BrandWordmark() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FBD13B' }}>
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="#0F1B3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-sm font-bold" style={{ color: '#FBD13B' }}>
        quizotic<span style={{ color: 'rgba(251,209,59,0.5)' }}>.live</span>
      </span>
    </div>
  )
}
