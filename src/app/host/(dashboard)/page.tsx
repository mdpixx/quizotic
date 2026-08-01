'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import {
  EngagementMasteryCarousel,
  LearningPulseCards,
  NextUpCard,
  TeachingBriefCard,
} from '@/components/host/dashboard/DashboardCards'
import styles from '@/components/host/dashboard/DashboardCommandCenter.module.css'
import { DashboardHeader } from '@/components/host/dashboard/DashboardHeader'
import { DashboardOnboarding } from '@/components/host/dashboard/DashboardOnboarding'
import { NudgeCard } from '@/components/host/NudgeCard'
import {
  AttentionQueue,
  PerformanceTrend,
  RecentWork,
  SectionHeader,
} from '@/components/host/dashboard/DashboardSections'
import type { DashboardAnalyticsData } from '@/components/host/dashboard/types'
import type { DashboardRange } from '@/lib/dashboard-insights'
import { dashboardBody, dashboardDisplay, dashboardUtility } from './dashboard-fonts'

const RANGES: DashboardRange[] = [30, 90, 365]

export default function HostDashboard() {
  const { data: session } = useSession()
  const [range, setRange] = useState<DashboardRange>(30)
  const [data, setData] = useState<DashboardAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/analytics?range=${range}`, { signal })
      if (!response.ok) throw new Error('Dashboard analytics could not be loaded.')
      setData(await response.json() as DashboardAnalyticsData)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError(caught instanceof Error ? caught.message : 'Dashboard analytics could not be loaded.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [range])

  useEffect(() => {
    const controller = new AbortController()
    void fetchDashboard(controller.signal)
    return () => controller.abort()
  }, [fetchDashboard])

  const firstName = session?.user?.name?.trim().split(/\s+/)[0]
  const fontClasses = `${dashboardBody.variable} ${dashboardDisplay.variable} ${dashboardUtility.variable}`

  if (loading && !data) {
    return (
      <div className={`${styles.root} ${fontClasses}`}>
        <div className={styles.loading}><div className={styles.loadingInner}><div className={styles.spinner} />Preparing your teaching brief…</div></div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className={`${styles.root} ${fontClasses}`}>
        <article className={`${styles.card} ${styles.errorState}`}>
          <h2>We couldn&apos;t load the dashboard.</h2>
          <p>{error}</p>
          <button className={`${styles.button} ${styles.primaryButton}`} onClick={() => void fetchDashboard()}>Try again</button>
        </article>
      </div>
    )
  }

  if (data?.summary.totalSessions === 0) return <DashboardOnboarding />
  if (!data) return null

  return (
    <div className={`${styles.root} ${fontClasses}`} id="dashboard-command-center">
      <a className={styles.skipLink} href="#dashboard-main">Skip to dashboard content</a>
      <DashboardHeader scheduleCount={data.scheduleCount} />
      <main className={styles.content} id="dashboard-main">
        <div className={styles.greeting}>
          <div>
            <div className={styles.eyebrow}>Your teaching overview</div>
            <h1>Welcome back{firstName ? `, ${firstName}` : ''}.</h1>
            <p>One clear next step, backed by the learning evidence from your last {range} days.</p>
          </div>
          <div className={styles.rangeSwitch} role="group" aria-label="Dashboard time range">
            {RANGES.map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={range === value}
                onClick={() => setRange(value)}
              >
                {value === 365 ? '1 year' : `${value} days`}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.heroGrid}>
          <TeachingBriefCard brief={data.teachingBrief} />
          <NextUpCard scheduled={data.nextScheduled} recentSession={data.recentSessions[0] ?? null} />
        </div>

        <SectionHeader title="Learning pulse" description={`Compared with the preceding ${range}-day period`} />
        <LearningPulseCards pulse={data.learningPulse} />

        <SectionHeader
          title="Attention queue"
          description="Signals translated into a concrete teaching action"
        />
        <AttentionQueue brief={data.teachingBrief} supportLearners={data.supportLearners} />

        <SectionHeader
          title="Recent work"
          description="Sessions to review and content ready to continue"
          action={<Link className={styles.textLink} href="/host/sessions">All sessions →</Link>}
        />
        <RecentWork sessions={data.recentSessions} content={data.recentContent} />

        <SectionHeader title="Learning picture" description="Deeper patterns after the immediate work is handled" />
        <div className={styles.learningGrid} data-dashboard-grid="learning">
          <PerformanceTrend trend={data.trend} />
          <EngagementMasteryCarousel trend={data.trend} bloomsCoverage={data.bloomsCoverage} bloomsMastery={data.bloomsMastery} />
        </div>

        <div className={styles.footerRail}>
          <div><strong>Ready to run the next learning check?</strong><span>Start a session or browse reusable content when you&apos;re ready.</span></div>
          <div className={styles.footerActions}>
            <Link className={`${styles.button} ${styles.primaryButton}`} href="/host/quizzes">Start a session</Link>
            <Link className={`${styles.button} ${styles.quietButton}`} href="/host/templates">Browse templates</Link>
          </div>
        </div>
        <div className={styles.secondaryUtility}><NudgeCard /></div>
      </main>
    </div>
  )
}
