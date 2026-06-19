'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { track } from '@/lib/analytics'
import { QuizoticLogo } from '@/components/QuizoticLogo'

// Two taps and you're in. Org name, discovery channel, and referral entry
// moved to a dismissible dashboard card (CompleteProfileCard) so a new user
// reaches real value first. Link-based referrals still work — the API reads
// the quizotic_ref cookie on this POST regardless of form fields.

const ICON_STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const ROLE_ICONS: Record<string, React.ReactNode> = {
  teacher: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5" /></svg>,
  trainer: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>,
  student: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><path d="M2 4h6a4 4 0 014 4v12a3 3 0 00-3-3H2z" /><path d="M22 4h-6a4 4 0 00-4 4v12a3 3 0 013-3h7z" /></svg>,
  hr: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.5a5 5 0 015-5h3a5 5 0 015 5V20" /><path d="M16 5a3.5 3.5 0 010 6.5M21.5 20v-1.5a5 5 0 00-3.5-4.77" /></svg>,
  manager: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><path d="M9 12h6M9 16h4" /></svg>,
  other: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><path d="M12 3l2 5.5L19.5 11 14 13l-2 5.5L10 13l-5.5-2L10 8.5z" /></svg>,
}

const ROLES = [
  { id: 'teacher', label: 'Teacher' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'student', label: 'Student' },
  { id: 'hr', label: 'HR / L&D' },
  { id: 'manager', label: 'Manager' },
  { id: 'other', label: 'Other' },
]

const FIRST_CREATE = [
  {
    id: 'quiz',
    label: 'A live quiz',
    desc: 'Scored questions, leaderboard, winner',
    href: '/host/build',
    icon: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>,
  },
  {
    id: 'presentation',
    label: 'A presentation',
    desc: 'Interactive slides — polls, word clouds, Q&A',
    href: '/host/present/create',
    icon: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><rect x="2" y="4" width="20" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>,
  },
  {
    id: 'templates',
    label: 'Start from a template',
    desc: 'Ready-made quizzes you can edit',
    href: '/host/templates',
    icon: <svg viewBox="0 0 24 24" width="24" height="24" {...ICON_STROKE}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
]

function Tile({ icon, label, desc, selected, onClick }: {
  icon: React.ReactNode; label: string; desc?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="flex flex-col items-center gap-1.5 rounded-xl p-4 transition-all hover:scale-[1.04] active:scale-[0.97]"
      style={{
        background: selected ? '#FFFDE6' : '#fff',
        border: selected ? '2px solid #0F1B3D' : '2px solid #E5E7EB',
        minWidth: 100,
      }}
    >
      <span style={{ color: selected ? '#0F1B3D' : '#64748B' }}>{icon}</span>
      <span className="text-sm font-semibold" style={{ color: selected ? '#0F1B3D' : '#4A5568' }}>
        {label}
      </span>
      {desc && (
        <span className="text-xs text-center leading-snug" style={{ color: '#94A3B8' }}>
          {desc}
        </span>
      )}
    </button>
  )
}

export default function OnboardPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [firstCreate, setFirstCreate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  // First authenticated screen after account creation — top of the funnel.
  useEffect(() => { track('onboard_started') }, [])

  async function handleSubmit(skip = false) {
    setSaving(true)
    await fetch('/api/user/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skip ? {} : { role }),
    })
    // Org details are asked later on the dashboard, not here.
    try { localStorage.setItem('quizotic:profilePending', '1') } catch { /* best-effort */ }
    track('onboard_completed', { skipped: skip, role: skip ? null : role, firstCreate: skip ? null : firstCreate })
    // Refresh the JWT so middleware knows onboarding is complete
    await update({ onboarded: true })
    // Default to the builder when the user didn't pick a destination —
    // momentum beats landing on a blank dashboard (matches the 6→3 activation drop).
    const destination = skip ? '/host' : (FIRST_CREATE.find(o => o.id === firstCreate)?.href ?? '/host/build')
    router.push(destination)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0F1B3D' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <QuizoticLogo variant="onDark" className="text-xl" markSize={32} />
        </div>

        {/* Greeting */}
        <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
          Welcome, {firstName}!
          <motion.span
            className="inline-block ml-2"
            animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={{ duration: 1.8, delay: 0.3, ease: 'easeInOut' }}
          >
            👋
          </motion.span>
        </h1>
        <p className="text-base mb-8" style={{ color: '#94A3B8' }}>
          Two quick taps and you&apos;re in.
        </p>

        {/* Role selection */}
        <div className="mb-8">
          <p className="text-base font-bold mb-3" style={{ color: '#fff' }}>What best describes you?</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(r => (
              <Tile key={r.id} icon={ROLE_ICONS[r.id]} label={r.label} selected={role === r.id} onClick={() => setRole(r.id)} />
            ))}
          </div>
        </div>

        {/* First-create routing — sends the user straight to value */}
        <div className="mb-8">
          <p className="text-base font-bold mb-3" style={{ color: '#fff' }}>What do you want to create first?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {FIRST_CREATE.map(o => (
              <Tile key={o.id} icon={o.icon} label={o.label} desc={o.desc} selected={firstCreate === o.id} onClick={() => setFirstCreate(o.id)} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex-1 py-3 rounded-full text-base font-bold transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50"
            style={{ background: '#FBD13B', color: '#0D0D0D', border: '2px solid #0D0D0D', fontFamily: 'var(--font-heading)' }}
          >
            {saving ? 'Saving...' : firstCreate ? "Let's go →" : 'Continue →'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ color: '#64748B' }}
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  )
}
