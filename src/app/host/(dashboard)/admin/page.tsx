'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Stats {
  users: { total: number; thisMonth: number; thisWeek: number; today: number; onboarded: number; referrals: number }
  quizzes: { total: number; thisMonth: number }
  sessions: { total: number; thisMonth: number }
  subscriptions: { active: number; byPlan: Array<{ plan: string; count: number }> }
  aiUsage: { total: number; thisMonth: number }
  breakdowns: {
    discovery: Array<{ channel: string; count: number }>
    roles: Array<{ role: string; count: number }>
  }
  recentUsers: Array<{
    id: string; name: string | null; email: string; role: string | null
    orgType: string | null; organization: string | null; onboarded: boolean
    referredByCode: string | null; discoveryChannel: string | null; createdAt: string
  }>
  recentSessions: Array<{
    id: string; code: string; type: string; hostName: string | null
    status: string; participantCount: number; createdAt: string; endedAt: string | null
  }>
  topUsers: Array<{ email: string | null; name: string | null; quizCount: number }>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function TableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function Badge({ text, color = 'gray' }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] ?? colors.gray}`}>
      {text}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/host')
      return
    }
    if (status !== 'authenticated') return

    fetch('/api/admin/stats')
      .then(r => {
        if (r.status === 403) throw new Error('You do not have admin access.')
        if (!r.ok) throw new Error('Failed to load stats')
        return r.json()
      })
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">{error}</p>
          <Link href="/host" className="text-indigo-600 text-sm mt-2 inline-block hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time stats for quizotic.live</p>
          </div>
          <Link href="/host" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Back to Host</Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Total Users" value={stats.users.total} sub={`${stats.users.thisMonth} this month`} />
          <StatCard label="This Week" value={stats.users.thisWeek} sub={`${stats.users.today} today`} />
          <StatCard label="Onboarded" value={stats.users.onboarded} sub={`${stats.users.total > 0 ? Math.round((stats.users.onboarded / stats.users.total) * 100) : 0}% rate`} />
          <StatCard label="Active Subs" value={stats.subscriptions.active} sub={stats.subscriptions.byPlan.map(p => `${p.plan}: ${p.count}`).join(', ') || 'none'} />
          <StatCard label="Quizzes" value={stats.quizzes.total} sub={`${stats.quizzes.thisMonth} this month`} />
          <StatCard label="Sessions" value={stats.sessions.total} sub={`${stats.sessions.thisMonth} this month`} />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="AI Generations" value={stats.aiUsage.total} sub={`${stats.aiUsage.thisMonth} this month`} />
          <StatCard label="Referrals" value={stats.users.referrals} sub="users via referral" />
          <StatCard
            label="Top Discovery"
            value={stats.breakdowns.discovery.sort((a, b) => b.count - a.count)[0]?.channel ?? 'N/A'}
            sub={stats.breakdowns.discovery.map(d => `${d.channel}: ${d.count}`).join(', ') || 'no data'}
          />
          <StatCard
            label="Top Role"
            value={stats.breakdowns.roles.sort((a, b) => b.count - a.count)[0]?.role ?? 'N/A'}
            sub={stats.breakdowns.roles.map(r => `${r.role}: ${r.count}`).join(', ') || 'no data'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Users */}
          <TableSection title="Recent Users">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {stats.recentUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{u.name ?? 'Anonymous'}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role ? <Badge text={u.role} color="blue" /> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {u.discoveryChannel ? <Badge text={u.discoveryChannel} color="purple" /> : <span className="text-gray-400">-</span>}
                      {u.referredByCode && <Badge text={`ref: ${u.referredByCode}`} color="green" />}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>

          {/* Recent Sessions */}
          <TableSection title="Recent Sessions">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Participants</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {stats.recentSessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{s.code}</td>
                    <td className="px-4 py-3">
                      <Badge text={s.type} color={s.type === 'quiz' ? 'blue' : 'yellow'} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.hostName ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.participantCount}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
                {stats.recentSessions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No sessions yet</td></tr>
                )}
              </tbody>
            </table>
          </TableSection>
        </div>

        {/* Credits — manual AI credit grants for support / comp flows */}
        <CreditsPanel />

        {/* Coupons — promotional codes (credits / pro_days / future percent_off) */}
        <CouponsPanel />

        {/* Moderation — user-submitted reports queue */}
        <ModerationPanel />

        {/* Data deletion requests — GDPR / DPDP right-to-erasure */}
        <DeletionsPanel />

        {/* Feature flags — staged rollouts and kill switches */}
        <FeatureFlagsPanel />

        {/* Top Users by Quiz Count */}
        <TableSection title="Top Users by Quiz Count">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Quizzes Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {stats.topUsers.map((u, i) => (
                <tr key={u.email ?? i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{u.name ?? 'Anonymous'}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{u.quizCount}</td>
                </tr>
              ))}
              {stats.topUsers.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No quizzes created yet</td></tr>
              )}
            </tbody>
          </table>
        </TableSection>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
          Data pulled live from database. For user behavior analytics (clicks, funnels, recordings), check PostHog.
        </p>
      </div>
    </div>
  )
}

// ─── Credits panel ────────────────────────────────────────────────────────────
// Search a user by email, see their plan + monthly usage + bonus credits +
// recent grants, and issue a manual credit adjustment with required reason.
// Every grant writes an AdminAuditLog row server-side and triggers a
// notification email to the user.

interface CreditsLookup {
  user: {
    id: string; email: string; name: string | null
    role: string | null; organization: string | null; createdAt: string
    country: string | null; locale: string | null; lastActiveAt: string | null
  }
  plan: string
  monthlyUsage: {
    questions: { used: number; limit: number; bonusCredits: number }
    enhancements: { used: number; limit: number; bonusCredits: number }
  }
  grants: Array<{
    id: string; bucket: string; amount: number; reason: string
    expiresAt: string | null; grantedBy: string; grantedAt: string; isActive: boolean
  }>
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function flagFor(country: string | null): string {
  if (!country || country.length !== 2) return ''
  // Map A-Z (65) to regional indicator U+1F1E6 (127462)
  const A = 65
  const RIA = 0x1F1E6
  return String.fromCodePoint(...country.toUpperCase().split('').map(c => RIA + (c.charCodeAt(0) - A)))
}

function CreditsPanel() {
  const [emailInput, setEmailInput] = useState('')
  const [data, setData] = useState<CreditsLookup | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function search(email: string) {
    if (!email.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/admin/credits/list?email=${encodeURIComponent(email.trim())}`)
      const body = await res.json()
      if (!res.ok) {
        setData(null)
        setSearchError(body.error ?? 'Lookup failed')
      } else {
        setData(body as CreditsLookup)
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setSearching(false)
    }
  }

  function refresh() {
    if (data?.user.email) void search(data.user.email)
  }

  return (
    <TableSection title="Credits — manual AI credit grants">
      <div className="px-5 py-4 space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); void search(emailInput) }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="email"
            placeholder="user@example.com"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="submit"
            disabled={searching || !emailInput.trim()}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && (
          <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {searchError}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/50 dark:bg-gray-900/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {data.user.country && <span className="mr-1.5" title={data.user.country}>{flagFor(data.user.country)}</span>}
                    {data.user.name ?? 'Unnamed'} <span className="text-sm font-normal text-gray-500">({data.user.email})</span>
                  </p>
                  {(data.user.role || data.user.organization) && (
                    <p className="text-xs text-gray-500 mt-0.5">{[data.user.role, data.user.organization].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Last active: <span className="text-gray-600 dark:text-gray-300 font-medium">{formatRelative(data.user.lastActiveAt)}</span>
                    {data.user.locale && <> · Locale: <span className="text-gray-600 dark:text-gray-300">{data.user.locale}</span></>}
                    <> · Joined {formatRelative(data.user.createdAt)}</>
                  </p>
                </div>
                <Badge text={data.plan === 'pro' ? 'Pro' : 'Free'} color={data.plan === 'pro' ? 'purple' : 'gray'} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <BucketStat label="Questions" used={data.monthlyUsage.questions.used} limit={data.monthlyUsage.questions.limit} bonus={data.monthlyUsage.questions.bonusCredits} />
                <BucketStat label="Enhancements" used={data.monthlyUsage.enhancements.used} limit={data.monthlyUsage.enhancements.limit} bonus={data.monthlyUsage.enhancements.bonusCredits} />
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setShowGrantModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold transition-colors"
                >
                  + Grant credits
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Recent grants ({data.grants.length})</h4>
              {data.grants.length === 0 ? (
                <p className="text-sm text-gray-400">No grants for this user yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-3 py-2">Bucket</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2">Expires</th>
                        <th className="px-3 py-2">By</th>
                        <th className="px-3 py-2">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {data.grants.map(g => (
                        <tr key={g.id} className={g.isActive ? '' : 'opacity-50'}>
                          <td className="px-3 py-2"><Badge text={g.bucket} color={g.bucket === 'questions' ? 'blue' : 'yellow'} /></td>
                          <td className="px-3 py-2 font-mono font-semibold text-gray-900 dark:text-white">{g.amount > 0 ? `+${g.amount}` : g.amount}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate" title={g.reason}>{g.reason}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{g.expiresAt ? new Date(g.expiresAt).toLocaleDateString('en-IN') : 'Never'}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{g.grantedBy}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(g.grantedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showGrantModal && data && (
        <GrantModal
          targetEmail={data.user.email}
          onClose={() => setShowGrantModal(false)}
          onSuccess={(emailSent) => {
            setShowGrantModal(false)
            setToast(emailSent ? 'Credits granted — email sent.' : 'Credits granted (email failed; check Resend).')
            setTimeout(() => setToast(null), 4000)
            refresh()
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </TableSection>
  )
}

function BucketStat({ label, used, limit, bonus }: { label: string; used: number; limit: number; bonus: number }) {
  const limitText = !isFinite(limit) ? '∞' : String(limit)
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{used} / {limitText}</p>
      <p className="text-xs text-gray-500 mt-0.5">Bonus credits: <span className="font-semibold text-gray-700 dark:text-gray-300">{bonus}</span></p>
    </div>
  )
}

function GrantModal({ targetEmail, onClose, onSuccess }: { targetEmail: string; onClose: () => void; onSuccess: (emailSent: boolean) => void }) {
  const [bucket, setBucket] = useState<'questions' | 'enhancements'>('questions')
  const [amount, setAmount] = useState<number>(50)
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('') // YYYY-MM-DD or empty for never
  const [ticketId, setTicketId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reasonValid = reason.trim().length >= 5 && reason.trim().length <= 500
  const amountValid = Number.isFinite(amount) && amount !== 0
  const canSubmit = reasonValid && amountValid && !submitting

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        email: targetEmail,
        bucket,
        amount,
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt + 'T23:59:59Z').toISOString() : null,
        ticketId: ticketId.trim() || undefined,
      }
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Grant failed')
        return
      }
      onSuccess(json.emailSent ?? false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grant failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 space-y-4"
      >
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Grant credits</h3>
          <p className="text-sm text-gray-500 mt-0.5">Target: <span className="font-mono">{targetEmail}</span></p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">Bucket</label>
          <div className="flex gap-2">
            {(['questions', 'enhancements'] as const).map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBucket(b)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  bucket === b
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {b === 'questions' ? 'Questions' : 'Enhancements'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-400 mt-1">Negative to revoke.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Expires</label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-400 mt-1">Empty = never.</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
            Reason <span className="text-red-500">*</span>
            <span className="float-right font-normal text-gray-400">{reason.trim().length}/500</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Comp for AI generation failure on 2026-04-26"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none"
          />
          {!reasonValid && reason.length > 0 && (
            <p className="text-xs text-red-500 mt-1">Reason must be 5-500 characters.</p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Ticket ID (optional)</label>
          <input
            type="text"
            value={ticketId}
            onChange={e => setTicketId(e.target.value)}
            placeholder="e.g. SUP-123"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
          />
        </div>

        {error && (
          <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Granting…' : 'Grant credits'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Coupons panel ─────────────────────────────────────────────────────────
// List existing promotional codes + create new ones. Toggle active /
// extend validity from the same panel. The user-facing redeem endpoint at
// /api/coupons/redeem consumes whatever lives here.

interface Coupon {
  id: string; code: string; kind: string; value: number
  bucket: string | null; currency: string | null
  description: string | null
  maxRedemptions: number | null; redemptionCount: number; perUserLimit: number
  validFrom: string | null; validUntil: string | null; active: boolean
  createdAt: string
}

function CouponsPanel() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function refresh() {
    try {
      const res = await fetch("/api/admin/coupons")
      const body = await res.json()
      if (!res.ok) { setLoadError(body.error ?? "Load failed"); return }
      setCoupons(body.coupons as Coupon[])
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Load failed")
    }
  }

  useEffect(() => { void refresh() }, [])

  async function toggleActive(c: Coupon) {
    const res = await fetch(`/api/admin/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active, reason: c.active ? "Manual deactivation" : "Manual reactivation" }),
    })
    if (res.ok) {
      setToast(c.active ? `Deactivated ${c.code}` : `Activated ${c.code}`)
      setTimeout(() => setToast(null), 3000)
      void refresh()
    }
  }

  return (
    <TableSection title="Coupons — promotional codes">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{coupons === null ? "Loading…" : `${coupons.length} codes`}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold transition-colors"
          >
            + New coupon
          </button>
        </div>

        {loadError && (
          <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{loadError}</div>
        )}

        {coupons && coupons.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Used</th>
                  <th className="px-3 py-2">Per-user</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {coupons.map(c => (
                  <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-mono font-semibold text-gray-900 dark:text-white">{c.code}</td>
                    <td className="px-3 py-2"><Badge text={c.kind} color={c.kind === "credits" ? "blue" : c.kind === "pro_days" ? "purple" : "gray"} /></td>
                    <td className="px-3 py-2 font-mono">{c.value}{c.bucket ? ` ${c.bucket}` : ""}{c.kind === "percent_off" ? "%" : ""}</td>
                    <td className="px-3 py-2 text-xs">{c.redemptionCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                    <td className="px-3 py-2 text-xs">{c.perUserLimit}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.validUntil ? new Date(c.validUntil).toLocaleDateString("en-IN") : "Never"}</td>
                    <td className="px-3 py-2"><Badge text={c.active ? "Active" : "Inactive"} color={c.active ? "green" : "gray"} /></td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => toggleActive(c)} className="text-xs text-blue-600 hover:underline">{c.active ? "Deactivate" : "Reactivate"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {coupons && coupons.length === 0 && (
          <p className="text-sm text-gray-400 px-1">No coupons yet. Create one to start a promo.</p>
        )}
      </div>

      {showCreateModal && (
        <CouponCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(code) => {
            setShowCreateModal(false)
            setToast(`Created ${code}`)
            setTimeout(() => setToast(null), 3000)
            void refresh()
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold shadow-lg">{toast}</div>
      )}
    </TableSection>
  )
}

function CouponCreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (code: string) => void }) {
  const [code, setCode] = useState("")
  const [kind, setKind] = useState<"credits" | "pro_days" | "percent_off" | "amount_off">("credits")
  const [value, setValue] = useState<number>(50)
  const [bucket, setBucket] = useState<"questions" | "enhancements">("questions")
  const [currency, setCurrency] = useState<"usd" | "inr">("inr")
  const [description, setDescription] = useState("")
  const [maxRedemptions, setMaxRedemptions] = useState<number | "">("")
  const [perUserLimit, setPerUserLimit] = useState<number>(1)
  const [validUntil, setValidUntil] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const codeValid = /^[A-Z0-9_-]{3,40}$/i.test(code)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!codeValid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        code: code.toUpperCase(),
        kind,
        value,
        description: description.trim() || undefined,
        perUserLimit,
        active: true,
      }
      if (kind === "credits") body.bucket = bucket
      if (kind === "amount_off") body.currency = currency
      if (maxRedemptions !== "") body.maxRedemptions = maxRedemptions
      if (validUntil) body.validUntil = new Date(validUntil + "T23:59:59Z").toISOString()

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Create failed"); return }
      onSuccess(json.coupon.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">New coupon</h3>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Code</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME50" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-mono uppercase text-gray-900 dark:text-white" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Kind</label>
            <select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
              <option value="credits">credits</option>
              <option value="pro_days">pro_days</option>
              <option value="percent_off">percent_off (checkout)</option>
              <option value="amount_off">amount_off (checkout)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Value</label>
            <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          </div>
        </div>

        {kind === "credits" && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Bucket</label>
            <select value={bucket} onChange={e => setBucket(e.target.value as typeof bucket)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
              <option value="questions">questions</option>
              <option value="enhancements">enhancements</option>
            </select>
          </div>
        )}

        {kind === "amount_off" && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value as typeof currency)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
              <option value="inr">INR</option>
              <option value="usd">USD</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Per-user limit</label>
            <input type="number" min={1} value={perUserLimit} onChange={e => setPerUserLimit(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Total max</label>
            <input type="number" min={1} value={maxRedemptions} onChange={e => setMaxRedemptions(e.target.value === "" ? "" : Number(e.target.value))} placeholder="∞" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Expires</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Description (optional)</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Onboarding promo for first 100 signups" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
        </div>

        {error && (
          <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={!codeValid || submitting} className="px-4 py-2 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? "Creating…" : "Create coupon"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Moderation panel ──────────────────────────────────────────────────────
// User-submitted reports of inappropriate content. Lists open + reviewing
// flags by default; admin can transition to resolved / dismissed with a
// disposition and required reason.

interface ModerationFlag {
  id: string; reporterId: string | null; targetType: string; targetId: string
  category: string; details: string | null; status: string; disposition: string | null
  reviewedBy: string | null; reviewedAt: string | null; createdAt: string
}

function ModerationPanel() {
  const [flags, setFlags] = useState<ModerationFlag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewing' | 'resolved' | 'dismissed' | 'all'>('open')
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  async function refresh() {
    try {
      const url = statusFilter === 'all' ? '/api/admin/moderation' : `/api/admin/moderation?status=${statusFilter}`
      const res = await fetch(url)
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Load failed'); return }
      setFlags(body.flags as ModerationFlag[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    }
  }

  useEffect(() => { void refresh() }, [statusFilter])

  return (
    <TableSection title="Moderation — user reports">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-gray-500">{flags === null ? 'Loading…' : `${flags.length} flag${flags.length === 1 ? '' : 's'}`}</p>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
          >
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        {flags && flags.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {flags.map(f => (
                  <tr key={f.id}>
                    <td className="px-3 py-2 text-xs">
                      <Badge text={f.targetType} color="gray" />
                      <code className="ml-1.5 text-gray-500">{f.targetId.slice(0, 12)}…</code>
                    </td>
                    <td className="px-3 py-2"><Badge text={f.category} color={f.category === 'spam' ? 'gray' : f.category === 'copyright' ? 'blue' : 'red'} /></td>
                    <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={f.details ?? ''}>{f.details ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge text={f.status} color={f.status === 'open' ? 'red' : f.status === 'reviewing' ? 'yellow' : f.status === 'resolved' ? 'green' : 'gray'} />
                      {f.disposition && <p className="text-xs text-gray-400 mt-0.5">{f.disposition}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(f.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {(f.status === 'open' || f.status === 'reviewing') && (
                        <button onClick={() => setReviewingId(f.id)} className="text-xs text-blue-600 hover:underline">Review</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {flags && flags.length === 0 && (
          <p className="text-sm text-gray-400 px-1">Nothing in this queue. Clean inbox.</p>
        )}
      </div>

      {reviewingId && (
        <ModerationReviewModal
          flag={flags?.find(f => f.id === reviewingId) ?? null}
          onClose={() => setReviewingId(null)}
          onSuccess={() => { setReviewingId(null); void refresh() }}
        />
      )}
    </TableSection>
  )
}

function ModerationReviewModal({ flag, onClose, onSuccess }: { flag: ModerationFlag | null; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState<'reviewing' | 'resolved' | 'dismissed'>('resolved')
  const [disposition, setDisposition] = useState<'removed' | 'no_action' | 'banned' | ''>('removed')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!flag) return null

  const reasonValid = reason.trim().length >= 5 && reason.trim().length <= 500
  const canSubmit = reasonValid && !submitting

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { id: flag!.id, status, reason: reason.trim() }
      if (status === 'resolved' && disposition) body.disposition = disposition
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Update failed'); return }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Review report</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            <Badge text={flag.targetType} color="gray" />
            <span className="ml-2">{flag.category}</span>
          </p>
          <p className="text-xs text-gray-500 mt-2"><code>{flag.targetId}</code></p>
          {flag.details && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 italic">&ldquo;{flag.details}&rdquo;</p>}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">New status</label>
          <div className="flex gap-2">
            {(['reviewing', 'resolved', 'dismissed'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${status === s ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{s}</button>
            ))}
          </div>
        </div>

        {status === 'resolved' && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">Disposition</label>
            <select value={disposition} onChange={e => setDisposition(e.target.value as typeof disposition)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
              <option value="removed">Content removed</option>
              <option value="no_action">No action needed</option>
              <option value="banned">User banned</option>
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
            Reason <span className="text-red-500">*</span>
            <span className="float-right font-normal text-gray-400">{reason.trim().length}/500</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="What did you find when reviewing? What action was taken?"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none"
          />
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={!canSubmit} className="px-4 py-2 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Deletion requests panel ───────────────────────────────────────────────
// GDPR / DPDP right-to-erasure queue. User files via /api/user/data-deletion;
// 7-day grace before approval; admin can approve early, reject, or mark
// completed after running the actual deletion job.

interface DeletionRequest {
  id: string; userId: string; status: string; reason: string | null
  requestedAt: string; graceExpiresAt: string; completedAt: string | null
  user: { email: string; name: string | null }
}

function DeletionsPanel() {
  const [requests, setRequests] = useState<DeletionRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled' | 'all'>('pending')
  const [actingId, setActingId] = useState<string | null>(null)

  async function refresh() {
    try {
      const url = statusFilter === 'all' ? '/api/admin/deletions' : `/api/admin/deletions?status=${statusFilter}`
      const res = await fetch(url)
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Load failed'); return }
      setRequests(body.requests as DeletionRequest[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    }
  }

  useEffect(() => { void refresh() }, [statusFilter])

  return (
    <TableSection title="Data deletion requests — GDPR / DPDP">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-gray-500">{requests === null ? 'Loading…' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}</p>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        {requests && requests.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Filed</th>
                  <th className="px-3 py-2">Grace ends</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {requests.map(r => {
                  const graceExpired = new Date(r.graceExpiresAt).getTime() < Date.now()
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-semibold text-gray-900 dark:text-white">{r.user.name ?? '—'}</div>
                        <div className="text-gray-500">{r.user.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge text={r.status} color={r.status === 'pending' ? 'yellow' : r.status === 'approved' ? 'red' : r.status === 'completed' ? 'gray' : 'green'} />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(r.requestedAt)}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: graceExpired ? '#dc2626' : '#6b7280' }}>
                        {graceExpired && r.status === 'pending' ? 'Ready ' : ''}{new Date(r.graceExpiresAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(r.status === 'pending' || r.status === 'approved') && (
                          <button onClick={() => setActingId(r.id)} className="text-xs text-blue-600 hover:underline">Action</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {requests && requests.length === 0 && <p className="text-sm text-gray-400 px-1">No requests in this status.</p>}
      </div>

      {actingId && (
        <DeletionActionModal
          request={requests?.find(r => r.id === actingId) ?? null}
          onClose={() => setActingId(null)}
          onSuccess={() => { setActingId(null); void refresh() }}
        />
      )}
    </TableSection>
  )
}

function DeletionActionModal({ request, onClose, onSuccess }: { request: DeletionRequest | null; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState<'approved' | 'completed' | 'rejected'>('approved')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!request) return null
  const reasonValid = reason.trim().length >= 5 && reason.trim().length <= 500

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reasonValid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/deletions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request!.id, status, reason: reason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Update failed'); return }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Action deletion request</h3>
          <p className="text-sm text-gray-500 mt-0.5">{request.user.name ?? '—'} ({request.user.email})</p>
          {request.reason && <p className="text-sm italic text-gray-700 dark:text-gray-300 mt-2">&ldquo;{request.reason}&rdquo;</p>}
          <p className="text-xs text-gray-400 mt-2">Filed {formatDate(request.requestedAt)} · Grace ends {new Date(request.graceExpiresAt).toLocaleDateString('en-IN')}</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">Action</label>
          <div className="flex gap-2 flex-wrap">
            {(['approved', 'completed', 'rejected'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${status === s ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{s}</button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong>approved</strong> = ready for deletion job to run ·{' '}
            <strong>completed</strong> = data has been removed ·{' '}
            <strong>rejected</strong> = denied (open dispute / legal hold)
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
            Reason <span className="text-red-500">*</span>
            <span className="float-right font-normal text-gray-400">{reason.trim().length}/500</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why this action? Required for the audit trail."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none"
          />
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={!reasonValid || submitting} className="px-4 py-2 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold disabled:opacity-50">
            {submitting ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── FeatureFlags panel ────────────────────────────────────────────────────
// Three-mode toggles: master enabled, % rollout, per-user assignment.
// Admin can create new flags, toggle enabled, dial rollout %, delete.

interface FeatureFlag {
  id: string; key: string; description: string | null; enabled: boolean
  rolloutPercent: number; createdAt: string; updatedAt: string
  _count: { assignments: number }
}

function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  async function refresh() {
    try {
      const res = await fetch('/api/admin/flags')
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Load failed'); return }
      setFlags(body.flags as FeatureFlag[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    }
  }

  useEffect(() => { void refresh() }, [])

  async function quickToggle(flag: FeatureFlag) {
    const res = await fetch(`/api/admin/flags/${encodeURIComponent(flag.key)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !flag.enabled, reason: flag.enabled ? `Quick disable: ${flag.key}` : `Quick enable: ${flag.key}` }),
    })
    if (res.ok) void refresh()
  }

  async function deleteFlag(flag: FeatureFlag) {
    if (!confirm(`Delete flag "${flag.key}" and all its assignments? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/flags/${encodeURIComponent(flag.key)}`, { method: 'DELETE' })
    if (res.ok) void refresh()
  }

  return (
    <TableSection title="Feature flags — staged rollouts and kill switches">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{flags === null ? 'Loading…' : `${flags.length} flag${flags.length === 1 ? '' : 's'}`}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold transition-colors"
          >
            + New flag
          </button>
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        {flags && flags.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2">Key</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Master</th>
                  <th className="px-3 py-2">Rollout</th>
                  <th className="px-3 py-2">Overrides</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {flags.map(f => (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-mono font-semibold text-gray-900 dark:text-white">{f.key}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={f.description ?? ''}>{f.description ?? '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => quickToggle(f)} className="cursor-pointer">
                        <Badge text={f.enabled ? 'enabled' : 'disabled'} color={f.enabled ? 'green' : 'gray'} />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-sm">{f.rolloutPercent}%</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{f._count.assignments}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditingKey(f.key)} className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                      <button onClick={() => deleteFlag(f)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {flags && flags.length === 0 && (
          <p className="text-sm text-gray-400 px-1">No flags yet. Create one to gate a feature.</p>
        )}
      </div>

      {showCreate && (
        <FlagCreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); void refresh() }}
        />
      )}

      {editingKey && (
        <FlagEditModal
          flag={flags?.find(f => f.key === editingKey) ?? null}
          onClose={() => setEditingKey(null)}
          onSuccess={() => { setEditingKey(null); void refresh() }}
        />
      )}
    </TableSection>
  )
}

function FlagCreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [rolloutPercent, setRolloutPercent] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keyValid = /^[a-z0-9_]{2,80}$/.test(key)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyValid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, description: description.trim() || undefined, enabled, rolloutPercent }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Create failed'); return }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">New feature flag</h3>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Key (lowercase, snake_case)</label>
          <input value={key} onChange={e => setKey(e.target.value.toLowerCase())} placeholder="e.g. pdf_vision_tier" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-white" />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this flag control?" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            Master enabled
          </label>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Rollout %</label>
            <input type="number" min={0} max={100} value={rolloutPercent} onChange={e => setRolloutPercent(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          </div>
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={!keyValid || submitting} className="px-4 py-2 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create flag'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FlagEditModal({ flag, onClose, onSuccess }: { flag: FeatureFlag | null; onClose: () => void; onSuccess: () => void }) {
  const [enabled, setEnabled] = useState(flag?.enabled ?? false)
  const [rolloutPercent, setRolloutPercent] = useState(flag?.rolloutPercent ?? 0)
  const [description, setDescription] = useState(flag?.description ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!flag) return null
  const reasonValid = reason.trim().length >= 5

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reasonValid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/flags/${encodeURIComponent(flag!.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, rolloutPercent, description: description.trim() || undefined, reason: reason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Update failed'); return }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit <code className="font-mono">{flag.key}</code></h3>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            Master enabled
          </label>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Rollout %</label>
            <input type="number" min={0} max={100} value={rolloutPercent} onChange={e => setRolloutPercent(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why this change?"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none"
          />
        </div>

        {error && <div className="rounded-lg p-3 text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={!reasonValid || submitting} className="px-4 py-2 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 text-sm font-bold disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
