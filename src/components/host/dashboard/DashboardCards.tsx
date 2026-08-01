'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import type { LearningPulse, PulseMetric } from '@/lib/dashboard-insights'
import styles from './DashboardCommandCenter.module.css'
import type {
  DashboardBloomsCoverage,
  DashboardBloomsMastery,
  DashboardRecentSession,
  DashboardScheduledSession,
  DashboardTeachingBrief,
  DashboardTrendPoint,
} from './types'

const ICONS = {
  sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3Z" strokeLinejoin="round"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m15 9 5-5"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  confidence: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a5 5 0 0 0-5 5v2a3 3 0 0 0-2 3v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4a3 3 0 0 0-2-3V8a5 5 0 0 0-5-5Z"/><path d="M9 10V8a3 3 0 0 1 6 0v2"/></svg>,
  arrowLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrowRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Not set'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  })
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function TeachingBriefCard({ brief }: { brief: DashboardTeachingBrief | null }) {
  const isAttention = brief?.tone !== 'positive'
  const topic = brief?.topic ?? 'Your latest learning signal'
  const headline = brief
    ? isAttention ? `${topic} needs another pass.` : `${brief.sessionTitle} is on track.`
    : 'Run a quiz to unlock your teaching brief.'
  const sourceTitle = brief?.sessionTitle ?? 'Waiting for session evidence'

  return (
    <article className={`${styles.card} ${styles.brief}`}>
      <span className={styles.marginNote}>Focus here first</span>
      <div className={styles.briefTop}>
        <span className={styles.sourcePill}>
          <span className={styles.sourceDot} aria-hidden />
          <b>Teaching brief</b> · {sourceTitle}
        </span>
        <span className={styles.basedOn}>Based on this session&apos;s responses</span>
      </div>
      <h2>{headline}</h2>
      <p className={styles.briefCopy}>
        {brief
          ? isAttention
            ? <>Learners completed the session, but the strongest misconception stayed hidden in the response pattern. A short revision activity will be more useful than repeating the full lesson.</>
            : <>The latest responses show solid understanding. Continue with the next activity and use the full report for question-level evidence.</>
          : <>Once learners complete a scored quiz, Quizotic will turn difficult questions and confidence patterns into one clear next step.</>}
      </p>
      <div className={styles.proofRow} aria-label="Evidence for the teaching brief">
        <div className={styles.proof}>
          <strong data-tone={isAttention ? 'attention' : undefined}>{brief?.hardQuestionCount ?? '—'}</strong>
          <span>questions below 50% accuracy</span>
        </div>
        <div className={styles.proof}>
          <strong data-tone={isAttention ? 'attention' : undefined}>{brief?.confidentlyWrongPct == null ? '—' : `${brief.confidentlyWrongPct}%`}</strong>
          <span>of rated answers were confidently wrong in this session</span>
        </div>
        <div className={styles.proof}>
          <strong>{brief?.supportLearnerCount ?? '—'}</strong>
          <span>learners need a closer look</span>
        </div>
      </div>
      <div className={styles.briefActions}>
        <Link className={`${styles.button} ${styles.darkButton} ${styles.smallButton}`} href="/host/build?start=aidoc">
          {ICONS.sparkle} Create revision quiz
        </Link>
        {brief && (
          <Link className={`${styles.button} ${styles.smallButton}`} href={`/host/reports/${brief.sessionId}`}>
            Review questions
          </Link>
        )}
        <Link className={`${styles.button} ${styles.quietButton} ${styles.smallButton}`} href="/host/reports">
          View all reports →
        </Link>
      </div>
    </article>
  )
}

export function NextUpCard({
  scheduled,
  recentSession,
}: {
  scheduled: DashboardScheduledSession | null
  recentSession: DashboardRecentSession | null
}) {
  const date = scheduled?.opensAt ? new Date(scheduled.opensAt) : recentSession ? new Date(recentSession.date) : null
  const title = scheduled?.title ?? recentSession?.title ?? 'Choose your next activity'
  const badge = scheduled?.phase === 'open' ? 'Open now' : scheduled ? 'Scheduled' : recentSession ? 'Ready to rerun' : 'Ready'
  const typeLine = scheduled
    ? `Quiz · ${scheduled.questionCount} questions`
    : recentSession ? `${recentSession.type} · ${recentSession.participants} learners` : 'Quiz, presentation, or self-paced practice'

  return (
    <article className={`${styles.card} ${styles.nextCard}`}>
      <div className={styles.nextTop}>
        <span className={styles.eyebrow}>Next up</span>
        <span className={styles.readyPill}>{badge}</span>
      </div>
      <div className={styles.dateTile}>
        <div className={styles.dateBox} aria-hidden>
          <span>{date ? date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase() : 'NEXT'}</span>
          <strong>{date ? date.toLocaleDateString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }) : '→'}</strong>
        </div>
        <div className={styles.sessionTitle}>
          <strong>{title}</strong>
          <span>{typeLine}</span>
        </div>
      </div>
      <div className={styles.sessionDetails}>
        {scheduled ? (
          <>
            <div className={styles.detail}><span>Opens</span><strong>{fmtDateTime(scheduled.opensAt)}</strong></div>
            <div className={styles.detail}><span>Closes</span><strong>{fmtDateTime(scheduled.closesAt)}</strong></div>
            <div className={styles.detail}><span>Responses</span><strong>{scheduled.participantCount}</strong></div>
          </>
        ) : recentSession ? (
          <>
            <div className={styles.detail}><span>Last run</span><strong>{timeAgo(recentSession.date)}</strong></div>
            <div className={styles.detail}><span>Accuracy</span><strong>{recentSession.avgScore == null ? 'No score' : `${recentSession.avgScore}%`}</strong></div>
            <div className={styles.detail}><span>Completion</span><strong>{recentSession.completionPct == null ? 'No data' : `${recentSession.completionPct}%`}</strong></div>
          </>
        ) : (
          <>
            <div className={styles.detail}><span>Start from</span><strong>Your quiz library</strong></div>
            <div className={styles.detail}><span>Audience</span><strong>Live or self-paced</strong></div>
            <div className={styles.detail}><span>Preparation</span><strong>Choose an activity</strong></div>
          </>
        )}
      </div>
      <div className={styles.nextActions}>
        <Link className={`${styles.button} ${styles.primaryButton} ${styles.smallButton}`} href={scheduled ? '/host/scheduled' : '/host/quizzes'}>
          {scheduled ? 'View schedule' : recentSession ? 'Run again' : 'Choose a quiz'}
        </Link>
        <Link className={`${styles.button} ${styles.onDarkButton} ${styles.smallButton}`} href={scheduled ? '/host/quizzes' : '/host/templates'}>
          {scheduled ? 'Open library' : 'Templates'}
        </Link>
      </div>
    </article>
  )
}

function PulseCard({ label, metric, icon, note }: {
  label: string
  metric: PulseMetric
  icon: ReactNode
  note: string
}) {
  const value = metric.value === null ? '—' : label === 'Learner reach' ? metric.value : `${metric.value}%`
  const delta = metric.delta
  const deltaText = delta === null
    ? 'No comparison'
    : `${delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} ${Math.abs(delta)}${metric.deltaKind === 'points' ? ' pts' : '%'}`
  return (
    <article className={`${styles.card} ${styles.pulse}`}>
      <div className={styles.pulseTop}><span className={styles.pulseLabel}>{label}</span><span className={styles.pulseIcon}>{icon}</span></div>
      <div className={styles.pulseValue}>
        <strong>{value}</strong>
        <span className={styles.delta} data-negative={delta !== null && delta < 0} data-neutral={delta === null || delta === 0}>{deltaText}</span>
      </div>
      <p>{note}</p>
    </article>
  )
}

export function LearningPulseCards({ pulse }: { pulse: LearningPulse }) {
  return (
    <div className={styles.pulseGrid}>
      <PulseCard label="Learner reach" metric={pulse.learnerReach} icon={ICONS.users} note="Participant joins in this period" />
      <PulseCard label="Accuracy" metric={pulse.accuracy} icon={ICONS.target} note="Average correct answers" />
      <PulseCard label="Completion" metric={pulse.completion} icon={ICONS.check} note="Learners finishing sessions" />
      <PulseCard label="Answer confidence" metric={pulse.confidence} icon={ICONS.confidence} note="Responses marked as sure" />
    </div>
  )
}

function istKey(date: Date): string {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function EngagementSlide({ trend }: { trend: Array<Pick<DashboardTrendPoint, 'date' | 'sessions'>> }) {
  const counts = new Map<string, number>()
  for (const point of trend) counts.set(point.date.slice(0, 10), point.sessions)
  const today = new Date()
  const todayKey = istKey(today)
  const anchor = new Date(`${todayKey}T00:00:00Z`)
  const dayOfWeek = (anchor.getUTCDay() + 6) % 7
  const start = new Date(anchor)
  start.setUTCDate(anchor.getUTCDate() - dayOfWeek - 21)
  const cells = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = date.toISOString().slice(0, 10)
    return { date, key, count: counts.get(key) ?? 0, future: key > todayKey }
  })
  const color = (count: number, future: boolean) => {
    if (future) return 'transparent'
    if (count === 0) return '#EAF0F7'
    if (count === 1) return '#BEC8E9'
    if (count <= 3) return '#547BCE'
    if (count <= 5) return '#193B95'
    return '#0F1B3D'
  }
  const total = cells.reduce((sum, cell) => sum + cell.count, 0)
  return (
    <div className={styles.carouselBody}>
      <div className={styles.heatWeekdays}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className={styles.heatGrid}>
        {cells.map(cell => (
          <div
            className={styles.heatCell}
            key={cell.key}
            title={cell.future ? undefined : `${cell.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${cell.count} sessions`}
            style={{ background: color(cell.count, cell.future), border: cell.future ? '1px dashed #D9E1ED' : undefined, color: cell.count >= 2 ? '#fff' : '#0F1B3D' }}
          >
            {!cell.future && cell.date.getUTCDate()}
          </div>
        ))}
      </div>
      <div className={styles.heatMeta}>
        <span>{start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
        <strong>{total} session{total === 1 ? '' : 's'} · 4 weeks</strong>
        <span>{anchor.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
      </div>
      <div className={styles.heatLegend}>
        <span>less</span>
        {['#EAF0F7', '#BEC8E9', '#547BCE', '#193B95', '#0F1B3D'].map(swatch => <span key={swatch} className={styles.heatSwatch} style={{ background: swatch }} />)}
        <span>more</span>
      </div>
    </div>
  )
}

export function MasterySlide({
  bloomsCoverage,
  bloomsMastery,
}: {
  bloomsCoverage: DashboardBloomsCoverage[]
  bloomsMastery: DashboardBloomsMastery[]
}) {
  const taggedQuestions = bloomsCoverage.reduce((sum, item) => sum + item.count, 0)
  if (taggedQuestions === 0) {
    return (
      <div className={styles.setupPrompt}>
        <span className={styles.setupIcon}>{ICONS.sparkle}</span>
        <strong>Set up thinking-skill mastery</strong>
        <p>Tag questions with Bloom’s levels while editing a quiz. This card will then show where learners can recall, apply, and analyse.</p>
        <Link href="/host/quizzes" className={`${styles.button} ${styles.smallButton}`}>Choose a quiz to tag</Link>
      </div>
    )
  }

  const rows = bloomsCoverage.map(coverage => ({
    ...coverage,
    mastery: bloomsMastery.find(item => item.level === coverage.level)?.mastery ?? null,
  }))
  const weakest = rows
    .filter(row => row.mastery !== null)
    .sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100))[0]
  return (
    <div className={styles.carouselBody}>
      {rows.map(row => {
        const value = row.mastery ?? 0
        const tone = value < 50 ? 'low' : value < 70 ? 'mid' : undefined
        return (
          <div className={styles.masteryRow} key={row.level}>
            <div className={styles.masteryLabel}><span>{row.level}</span><strong>{row.mastery === null ? '—' : `${row.mastery}%`}</strong></div>
            <div className={styles.bar}><span data-tone={tone} style={{ width: `${value}%` }} /></div>
          </div>
        )
      })}
      {weakest && (
        <div className={styles.masteryNote}>
          <strong>Prioritise {weakest.level}</strong>
          <span>Learners are least secure at this thinking level. Review the tagged questions before the next practice activity.</span>
        </div>
      )}
    </div>
  )
}

export function EngagementMasteryCarousel({
  trend,
  bloomsCoverage,
  bloomsMastery,
}: {
  trend: Array<Pick<DashboardTrendPoint, 'date' | 'sessions'>>
  bloomsCoverage: DashboardBloomsCoverage[]
  bloomsMastery: DashboardBloomsMastery[]
}) {
  const [activeSlide, setActiveSlide] = useState(0)
  const reduceMotion = useReducedMotion()
  const goTo = (next: number) => setActiveSlide((next + 2) % 2)
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeSlide - 1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeSlide + 1) }
  }
  const isEngagement = activeSlide === 0
  return (
    <article className={`${styles.card} ${styles.carousel}`} tabIndex={0} onKeyDown={onKeyDown} aria-roledescription="carousel" aria-label="Engagement and thinking-skill insights">
      <div className={styles.carouselHeader}>
        <div className={styles.cardTitle}>
          <div>
            <h3>{isEngagement ? 'Engagement' : 'Thinking-skill mastery'}</h3>
            <p>{isEngagement ? 'Sessions per day · darker means more' : 'Correct answers by Bloom’s level'}</p>
          </div>
        </div>
        <div className={styles.carouselControls}>
          <button className={styles.carouselArrow} onClick={() => goTo(activeSlide - 1)} aria-label="Previous insight">{ICONS.arrowLeft}</button>
          <div className={styles.slideDots} aria-hidden>
            <span className={styles.slideDot} data-active={isEngagement} />
            <span className={styles.slideDot} data-active={!isEngagement} />
          </div>
          <button className={styles.carouselArrow} onClick={() => goTo(activeSlide + 1)} aria-label="Next insight">{ICONS.arrowRight}</button>
        </div>
      </div>
      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSlide}
            initial={reduceMotion ? false : { opacity: 0, x: activeSlide === 0 ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: activeSlide === 0 ? 16 : -16 }}
            transition={{ duration: reduceMotion ? 0 : .18 }}
          >
            {isEngagement
              ? <EngagementSlide trend={trend} />
              : <MasterySlide bloomsCoverage={bloomsCoverage} bloomsMastery={bloomsMastery} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </article>
  )
}
