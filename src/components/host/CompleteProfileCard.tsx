'use client'

import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'

// The org/discovery questions deferred from the slim onboarding screen.
// Shown once on the dashboard (flag set by /auth/onboard), dismissible,
// and gone forever after save or dismiss. Posts to the same merge-only
// /api/user/onboard endpoint, so saving here never wipes the role.

const PENDING_KEY = 'quizotic:profilePending'

const ORG_TYPES = [
  { id: 'school', label: 'School' },
  { id: 'college', label: 'College / University' },
  { id: 'coaching', label: 'Coaching Institute' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'government', label: 'Government / PSU' },
  { id: 'other', label: 'Other' },
]

const DISCOVERY_CHANNELS = [
  { id: 'google', label: 'Google Search' },
  { id: 'social', label: 'Social Media' },
  { id: 'friend', label: 'Friend / Colleague' },
  { id: 'event', label: 'Event / Conference' },
  { id: 'other', label: 'Other' },
]

const selectStyle: React.CSSProperties = {
  background: '#fff',
  border: '1.5px solid #E2E8F0',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 13,
  color: '#0F1B3D',
  width: '100%',
  outline: 'none',
}

export function CompleteProfileCard({ onDismissed }: { onDismissed?: () => void } = {}) {
  const [visible, setVisible] = useState(false)
  const [orgType, setOrgType] = useState('')
  const [organization, setOrganization] = useState('')
  const [discoveryChannel, setDiscoveryChannel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(PENDING_KEY) === '1')
    } catch { /* private mode — stay hidden */ }
  }, [])

  function clearFlag() {
    try { localStorage.removeItem(PENDING_KEY) } catch { /* best-effort */ }
    setVisible(false)
    onDismissed?.()
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/user/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgType: orgType || undefined,
          organization: organization.trim() || undefined,
          discoveryChannel: discoveryChannel || undefined,
        }),
      })
      track('profile_completed', { orgType: orgType || null, discoveryChannel: discoveryChannel || null })
    } finally {
      setSaving(false)
      clearFlag()
    }
  }

  if (!visible) return null

  return (
    <div className="rounded-2xl border p-4 h-full" style={{ background: '#FFFDF0', borderColor: '#F1E9A8' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-black" style={{ color: '#0F1B3D' }}>Help us tailor Quizotic to you</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>30 seconds, fully optional.</p>
        </div>
        <button
          onClick={clearFlag}
          aria-label="Dismiss"
          className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
          style={{ color: '#94A3B8' }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={orgType} onChange={e => setOrgType(e.target.value)} aria-label="Organization type" style={selectStyle}>
          <option value="">Where do you work?</option>
          {ORG_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <input
          type="text"
          value={organization}
          onChange={e => setOrganization(e.target.value)}
          placeholder="Organization name (optional)"
          aria-label="Organization name"
          style={selectStyle}
        />
        <select value={discoveryChannel} onChange={e => setDiscoveryChannel(e.target.value)} aria-label="How did you hear about us" style={selectStyle}>
          <option value="">How did you hear about us?</option>
          {DISCOVERY_CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={saving || (!orgType && !organization.trim() && !discoveryChannel)}
          className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: '#0F1B3D', color: '#fff' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={clearFlag} className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: '#94A3B8' }}>
          Don&apos;t ask again
        </button>
      </div>
    </div>
  )
}
