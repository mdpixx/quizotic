'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const ROLES = [
  { id: 'teacher', label: 'Teacher', icon: '🎓' },
  { id: 'trainer', label: 'Trainer', icon: '💼' },
  { id: 'student', label: 'Student', icon: '🎒' },
  { id: 'hr', label: 'HR / L&D', icon: '👔' },
  { id: 'manager', label: 'Manager', icon: '📋' },
  { id: 'other', label: 'Other', icon: '🌟' },
]

const ORG_TYPES = [
  { id: 'school', label: 'School', icon: '🏫' },
  { id: 'college', label: 'College / University', icon: '🎓' },
  { id: 'coaching', label: 'Coaching Institute', icon: '📚' },
  { id: 'corporate', label: 'Corporate', icon: '🏢' },
  { id: 'government', label: 'Government / PSU', icon: '🏛' },
  { id: 'other', label: 'Other', icon: '🌐' },
]

const DISCOVERY_CHANNELS = [
  { id: 'google', label: 'Google Search', icon: '🔍' },
  { id: 'social', label: 'Social Media', icon: '📱' },
  { id: 'friend', label: 'Friend / Colleague', icon: '👥' },
  { id: 'event', label: 'Event / Conference', icon: '🎤' },
  { id: 'other', label: 'Other', icon: '💡' },
]

function Tile({ icon, label, selected, onClick }: {
  icon: string; label: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl p-4 transition-all hover:scale-[1.04] active:scale-[0.97]"
      style={{
        background: selected ? '#EEF2FF' : '#fff',
        border: selected ? '2px solid #4361EE' : '2px solid #E5E7EB',
        minWidth: 100,
      }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-semibold" style={{ color: selected ? '#4361EE' : '#4A5568' }}>
        {label}
      </span>
    </button>
  )
}

export default function OnboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [orgType, setOrgType] = useState<string | null>(null)
  const [organization, setOrganization] = useState('')
  const [discoveryChannel, setDiscoveryChannel] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState('')
  const [showReferral, setShowReferral] = useState(false)
  const [saving, setSaving] = useState(false)

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  async function handleSubmit(skip = false) {
    setSaving(true)
    await fetch('/api/user/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        skip
          ? {}
          : {
              role,
              orgType,
              organization: organization.trim() || null,
              discoveryChannel,
              referralCode: referralCode.trim() || null,
            }
      ),
    })
    router.push('/host')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FFFBF5' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
            style={{ background: 'var(--brand-gradient)' }}>Q</div>
          <span className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
            Quizo<span style={{ color: '#4361EE' }}>tic</span>
          </span>
        </div>

        {/* Greeting */}
        <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
          Welcome, {firstName}!
          <motion.span
            className="inline-block ml-2"
            animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={{ duration: 1.8, delay: 0.3, ease: 'easeInOut' }}
          >
            👋
          </motion.span>
        </h1>
        <p className="text-base mb-8" style={{ color: '#6B7280' }}>
          Tell us a bit about yourself so we can personalize your experience.
        </p>

        {/* Role selection */}
        <div className="mb-6">
          <p className="text-base font-bold mb-3" style={{ color: '#1B2559' }}>What best describes you?</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(r => (
              <Tile key={r.id} icon={r.icon} label={r.label} selected={role === r.id} onClick={() => setRole(r.id)} />
            ))}
          </div>
        </div>

        {/* Org type selection */}
        <div className="mb-6">
          <p className="text-base font-bold mb-3" style={{ color: '#1B2559' }}>Where do you work?</p>
          <div className="grid grid-cols-3 gap-2">
            {ORG_TYPES.map(o => (
              <Tile key={o.id} icon={o.icon} label={o.label} selected={orgType === o.id} onClick={() => setOrgType(o.id)} />
            ))}
          </div>
        </div>

        {/* Organization name */}
        <div className="mb-6">
          <p className="text-base font-bold mb-2" style={{ color: '#1B2559' }}>
            Organization name <span className="font-normal text-sm" style={{ color: '#9CA3AF' }}>(optional)</span>
          </p>
          <input
            type="text"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            placeholder="e.g. Delhi Public School, Infosys, IIT Delhi"
            className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
            style={{ borderColor: '#E5E7EB', color: '#1B2559' }}
          />
        </div>

        {/* How did you hear about us */}
        <div className="mb-6">
          <p className="text-base font-bold mb-3" style={{ color: '#1B2559' }}>How did you hear about us?</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {DISCOVERY_CHANNELS.map(c => (
              <Tile key={c.id} icon={c.icon} label={c.label} selected={discoveryChannel === c.id} onClick={() => setDiscoveryChannel(c.id)} />
            ))}
          </div>
        </div>

        {/* Referral code */}
        <div className="mb-8">
          {!showReferral ? (
            <button
              onClick={() => setShowReferral(true)}
              className="text-sm font-semibold transition-colors hover:text-blue-600"
              style={{ color: '#4361EE' }}
            >
              Have a referral code?
            </button>
          ) : (
            <div>
              <p className="text-sm font-bold mb-2" style={{ color: '#1B2559' }}>
                Referral code <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
              </p>
              <input
                type="text"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value)}
                placeholder="e.g. priya-k7x2"
                className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                style={{ borderColor: '#E5E7EB', color: '#1B2559' }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-base font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'var(--brand-gradient)', fontFamily: 'var(--font-heading)' }}
          >
            {saving ? 'Saving...' : 'Continue →'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="text-sm font-semibold transition-colors hover:text-blue-600 disabled:opacity-50"
            style={{ color: '#9CA3AF' }}
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  )
}
