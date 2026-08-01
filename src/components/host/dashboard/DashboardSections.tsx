'use client'

import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SupportLearner } from '@/lib/dashboard-insights'
import styles from './DashboardCommandCenter.module.css'
import type {
  DashboardRecentContent,
  DashboardRecentSession,
  DashboardTeachingBrief,
  DashboardTrendPoint,
} from './types'

const Icon = {
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 9v4m0 4h.01M10.3 4.6 2.7 18a2 2 0 0 0 1.75 3h15.1a2 2 0 0 0 1.75-3L13.7 4.6a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  confidence: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M8 10V8a4 4 0 0 1 8 0v2m-9 0h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  learner: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round"/></svg>,
  quiz: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h5M8 16h7" strokeLinecap="round"/></svg>,
  presentation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 4h16v12H4zM9 20l3-4 3 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

function initials(name: string): string {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

function supportReason(reason: SupportLearner['reason']): string {
  if (reason === 'low_and_declining') return 'Low accuracy and falling'
  if (reason === 'declining') return 'Accuracy is falling'
  return 'Accuracy is below 50%'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

function relativeDate(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  if (days === 0) return 'Edited today'
  if (days === 1) return 'Edited yesterday'
  return `Edited ${days} days ago`
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className={styles.sectionHeader}>
      <div><h2>{title}</h2><p>{description}</p></div>
      {action}
    </div>
  )
}

export function AttentionQueue({
  brief,
  supportLearners,
}: {
  brief: DashboardTeachingBrief | null
  supportLearners: SupportLearner[]
}) {
  const signals = brief ? [
    {
      icon: Icon.alert,
      title: `${brief.topic} is the clearest misconception`,
      copy: <><em>{brief.weakestQuestion.correctPct}% correct</em> on “{brief.weakestQuestion.text}”</>,
      action: 'Review question',
      href: `/host/reports/${brief.sessionId}`,
      tone: 'coral',
    },
    {
      icon: Icon.confidence,
      title: 'Confidence is masking some mistakes',
      copy: brief.confidentlyWrongPct === null
        ? <>Confidence data will appear as learners rate more answers.</>
        : <><em>{brief.confidentlyWrongPct}% of all answers</em> were confidently wrong in this period.</>,
      action: 'Open confidence report',
      href: `/host/reports/${brief.sessionId}`,
      tone: 'blue',
    },
    {
      icon: Icon.learner,
      title: supportLearners.length === 0 ? 'No learner needs an urgent check-in' : `${supportLearners.length} learner${supportLearners.length === 1 ? '' : 's'} may need a check-in`,
      copy: supportLearners.length === 0
        ? <>Recent scored history is stable across the learner roster.</>
        : <>Prioritised from recent accuracy and direction, <em>not from achievement rank</em>.</>,
      action: 'Review learners',
      href: '/host/participants',
      tone: 'blue',
    },
  ] : [{
    icon: Icon.alert,
    title: 'No urgent learning signals yet',
    copy: <>Quizotic will prioritise misconceptions after the next scored session.</>,
    action: 'Choose a quiz',
    href: '/host/quizzes',
    tone: 'blue',
  }]

  return (
    <div className={styles.attentionGrid}>
      <article className={`${styles.card} ${styles.queue}`}>
        {signals.map(signal => (
          <div className={styles.queueRow} key={signal.title}>
            <span className={styles.signalIcon} data-tone={signal.tone === 'blue' ? 'blue' : undefined}>{signal.icon}</span>
            <div className={styles.signalCopy}><strong>{signal.title}</strong><span>{signal.copy}</span></div>
            <Link className={`${styles.button} ${styles.smallButton}`} href={signal.href}>{signal.action}</Link>
          </div>
        ))}
      </article>
      <article className={`${styles.card} ${styles.learners}`}>
        <div className={styles.cardTitle}>
          <div><h3>Learners to support</h3><p>Recent accuracy and direction</p></div>
          <span className={styles.countBadge}>{supportLearners.length}</span>
        </div>
        {supportLearners.length === 0 ? (
          <div className={styles.healthyState}>
            <strong>No learner needs an urgent check-in</strong>
            <span>This uses scored learner history, not a ranking.</span>
          </div>
        ) : supportLearners.map((learner, index) => (
          <div className={styles.learner} key={`${learner.name}-${index}`}>
            <span className={styles.learnerAvatar}>{initials(learner.name)}</span>
            <span className={styles.learnerName}>
              <strong>{learner.name}</strong>
              <span>{learner.archetype ?? supportReason(learner.reason)}</span>
            </span>
            <span className={styles.trendDown}>
              {learner.latestScore}%{learner.change < 0 ? ` ↓ ${Math.abs(learner.change)}` : ''}
            </span>
          </div>
        ))}
        <Link className={`${styles.button} ${styles.smallButton} ${styles.fullButton}`} href="/host/participants">View learner detail</Link>
      </article>
    </div>
  )
}

export function RecentWork({
  sessions,
  content,
}: {
  sessions: DashboardRecentSession[]
  content: DashboardRecentContent[]
}) {
  return (
    <div className={styles.recentGrid}>
      <article className={`${styles.card} ${styles.tableCard}`} aria-label="Recent work" role="table">
        <div className={styles.tableHead} role="row">
          <span role="columnheader">Session</span><span role="columnheader">Date</span><span role="columnheader">Attendance</span><span role="columnheader">Accuracy</span><span role="columnheader">Action</span>
        </div>
        {sessions.length === 0 ? (
          <div className={styles.emptyTable} role="row"><span role="cell">No sessions in this period.</span></div>
        ) : sessions.slice(0, 5).map(session => (
          <div className={styles.tableRow} key={session.id} role="row">
            <span className={styles.sessionName} role="cell"><strong>{session.title}</strong><span>{session.type === 'presentation' ? 'Presentation' : 'Quiz'} · {session.status}</span></span>
            <span role="cell">{formatDate(session.date)}</span>
            <span className={styles.metricStrong} role="cell">{session.participants}</span>
            <span role="cell"><span className={styles.scorePill} data-warning={session.avgScore !== null && session.avgScore < 50}>{session.avgScore === null ? '—' : `${session.avgScore}%`}</span></span>
            <span className={styles.rowActions} role="cell">
              <Link className={styles.tinyButton} href={`/host/reports/${session.id}`}>Report</Link>
              {session.contentId && <Link className={styles.tinyButton} href={session.type === 'presentation' ? `/host/present/create?id=${session.contentId}` : `/host/build?id=${session.contentId}`}>Open</Link>}
            </span>
          </div>
        ))}
      </article>
      <article className={`${styles.card} ${styles.continueCard}`}>
        <div className={styles.cardTitle}>
          <div><h3>Continue creating</h3><p>Recently edited</p></div>
        </div>
        {content.length === 0 ? (
          <div className={styles.healthyState}><strong>Your latest work will appear here</strong><span>Create or edit a quiz to get started.</span></div>
        ) : content.map(item => (
          <Link
            className={styles.asset}
            key={`${item.type}-${item.id}`}
            href={item.type === 'presentation' ? `/host/present/create?id=${item.id}` : `/host/build?id=${item.id}`}
          >
            <span className={styles.assetIcon} data-type={item.type}>{item.type === 'presentation' ? Icon.presentation : Icon.quiz}</span>
            <span className={styles.assetCopy}><strong>{item.title}</strong><span>{item.type === 'presentation' ? 'Presentation' : 'Quiz'} · {relativeDate(item.updatedAt)}</span></span>
            <span className={styles.assetArrow}>→</span>
          </Link>
        ))}
        <Link className={`${styles.button} ${styles.smallButton} ${styles.fullButton}`} href="/host/quizzes">Open content library</Link>
      </article>
    </div>
  )
}

function chartDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export function PerformanceTrend({ trend }: { trend: DashboardTrendPoint[] }) {
  const chartData = trend.map(point => ({ ...point, label: chartDate(point.date) }))
  const latest = [...trend].reverse().find(point => point.avgScore !== null)
  return (
    <article className={`${styles.card} ${styles.trendCard}`}>
      <div className={styles.cardTitle}>
        <div><h3>Performance trend</h3><p>Accuracy and completion across the selected period</p></div>
        <div className={styles.chartLegend} aria-label="Chart legend">
          <span className={styles.legendItem}><i className={styles.legendLine} /> Accuracy</span>
          <span className={styles.legendItem}><i className={styles.legendLine} data-dotted="true" /> Completion</span>
        </div>
      </div>
      {chartData.length === 0 ? (
        <div className={styles.chartEmpty}>Run another scored session to start a trend.</div>
      ) : (
        <div className={styles.chart} role="img" aria-label="Line chart of accuracy and completion percentages across the selected period" aria-describedby="performance-trend-summary">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={230}>
            <LineChart data={chartData} margin={{ top: 15, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#E9EEF5" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#7B879E', fontSize: 8 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={[0, 100]} tick={{ fill: '#7B879E', fontSize: 8 }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
              <Tooltip contentStyle={{ border: '1px solid #D9E1ED', borderRadius: 10, fontSize: 10 }} formatter={(value, name) => [`${value ?? '—'}%`, name === 'avgScore' ? 'Accuracy' : 'Completion']} />
              <Line type="monotone" dataKey="avgScore" stroke="#5B6CFF" strokeWidth={2.5} connectNulls dot={{ r: 2, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="completionRate" stroke="#13A77B" strokeWidth={2} strokeDasharray="5 4" connectNulls dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className={styles.chartCallout} id="performance-trend-summary">
        <span aria-hidden>↗</span>
        {latest ? <span>Latest measured accuracy is <b>{latest.avgScore}%</b>. Use the trend for direction; open a report for question-level evidence.</span> : <span>Accuracy appears after scored quiz responses.</span>}
      </div>
    </article>
  )
}
