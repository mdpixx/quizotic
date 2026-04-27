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
  user: { id: string; email: string; name: string | null; role: string | null; organization: string | null; createdAt: string }
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
                  <p className="font-semibold text-gray-900 dark:text-white">{data.user.name ?? 'Unnamed'} <span className="text-sm font-normal text-gray-500">({data.user.email})</span></p>
                  {(data.user.role || data.user.organization) && (
                    <p className="text-xs text-gray-500 mt-0.5">{[data.user.role, data.user.organization].filter(Boolean).join(' · ')}</p>
                  )}
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
