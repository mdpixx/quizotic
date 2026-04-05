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
