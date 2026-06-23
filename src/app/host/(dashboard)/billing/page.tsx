'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PLAN_LIMITS } from '@/lib/limits'

interface BillingStatus {
  plan: 'free' | 'pro'
  subscription: {
    plan: string
    status: string
    provider: string | null
    currentPeriodEnd: string | null
    cancelledAt: string | null
  } | null
}

interface BucketUsage {
  used: number
  limit: number
  bonusCredits?: number
}

interface AiUsage {
  plan: string
  questions: BucketUsage
  enhancements: BucketUsage
}

function normaliseLimit(v: number | null | undefined): number {
  return v === null || v === undefined ? Infinity : v
}

function UsageMeter({ label, used, limit, bonusCredits }: { label: string; used: number; limit: number; bonusCredits?: number }) {
  const unlimited = limit === Infinity
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100)
  const exhausted = !unlimited && used >= limit
  const warning = !unlimited && !exhausted && used >= limit * 0.8
  const barColor = exhausted ? '#EF4444' : warning ? '#F59E0B' : 'var(--color-ink)'
  const numberColor = exhausted ? '#EF4444' : 'var(--color-ink)'

  return (
    <div className="sm:text-right">
      <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      <p className="text-3xl font-black font-display" style={{ color: numberColor }}>
        {used}
        <span className="text-base font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {' / '}{unlimited ? 'Unlimited' : limit}
        </span>
      </p>
      {!unlimited && (
        <div className="w-40 h-2.5 rounded-full mt-2 ml-auto" style={{ background: 'var(--color-paper-2)' }}>
          <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      )}
      {bonusCredits && bonusCredits > 0 && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>+{bonusCredits} referral bonus</p>
      )}
    </div>
  )
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/status').then(r => r.json()),
      fetch('/api/user/ai-usage').then(r => r.json()),
    ]).then(([statusRes, usageRes]) => {
      if (statusRes.plan) setBilling({ plan: statusRes.plan, subscription: statusRes.subscription })
      if (usageRes?.questions && usageRes?.enhancements) {
        setAiUsage({
          plan: usageRes.plan,
          questions: {
            used: usageRes.questions.used,
            limit: normaliseLimit(usageRes.questions.limit),
            bonusCredits: usageRes.questions.bonusCredits,
          },
          enhancements: {
            used: usageRes.enhancements.used,
            limit: normaliseLimit(usageRes.enhancements.limit),
          },
        })
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="paper-grain min-h-screen flex items-center justify-center" style={{ background: 'var(--color-paper)' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-line)', borderTopColor: 'var(--color-yellow)' }} />
          <p className="text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading your plan...</p>
        </div>
      </div>
    )
  }

  const isPro = billing?.plan === 'pro'
  const f = PLAN_LIMITS.free

  const limits = [
    { label: 'Participants per session', value: `Up to ${f.maxParticipants}` },
    { label: 'Saved quizzes', value: `${f.maxSavedQuizzes} quizzes` },
    { label: 'Saved presentations', value: `${f.maxSavedPresentations} presentations` },
    { label: 'AI-generated questions / month', value: `${f.maxAiQuestions} questions` },
    { label: 'AI-enhanced slides / month', value: `${f.maxAiEnhancements} enhancements` },
    { label: 'Session history', value: `Last ${f.maxSessionHistory} sessions` },
    { label: 'Image uploads / month', value: `${f.maxImageUploads} images` },
  ]

  return (
    <div className="paper-grain min-h-screen pb-16" style={{ background: 'var(--color-paper)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <a href="/host" className="text-base font-semibold mb-6 inline-block transition-colors hover:text-[var(--color-secondary-dark)]" style={{ color: 'var(--color-ink)' }}>
          &larr; Back to Dashboard
        </a>

        {/* Page header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black font-display mb-3" style={{ color: 'var(--color-ink)' }}>
            Your Account
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Quizotic is free while we grow. No pricing, no tiers — just usage.
          </p>
        </div>

        {/* ─── Your Current Plan ──────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1px solid var(--color-line)', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 4px 16px -8px rgba(15,27,61,0.08)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold font-display" style={{ color: 'var(--color-ink)' }}>Your current plan</h2>
                <span className="chip font-display" style={{
                  background: isPro ? '#DCFCE7' : 'var(--color-paper-2)',
                  color: isPro ? '#16A34A' : 'var(--color-ink)',
                }}>
                  {isPro ? 'Extended access' : 'Free'}
                </span>
              </div>

              {isPro ? (
                <p className="text-base" style={{ color: 'var(--color-ink)' }}>
                  You have extended access. Everything Quizotic offers today is unlocked for your account.
                </p>
              ) : (
                <p className="text-base" style={{ color: 'var(--color-ink)' }}>
                  Everything Quizotic offers today — live quizzes, interactive presentations, AI generation, real-time leaderboards, word clouds, polls and more — works fully within the limits shown below.
                </p>
              )}
            </div>

            {/* Usage meters */}
            {aiUsage && (
              <div className="flex-shrink-0 flex flex-col gap-4 sm:items-end">
                <UsageMeter label="AI Questions This Month" used={aiUsage.questions.used} limit={aiUsage.questions.limit} bonusCredits={aiUsage.questions.bonusCredits} />
                <UsageMeter label="AI Enhancements This Month" used={aiUsage.enhancements.used} limit={aiUsage.enhancements.limit} />
              </div>
            )}
          </div>
        </div>

        {/* ─── What you get today ──────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1px solid var(--color-line)', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 4px 16px -8px rgba(15,27,61,0.08)' }}>
          <h2 className="text-xl font-bold font-display mb-5" style={{ color: 'var(--color-ink)' }}>
            What you have access to
          </h2>
          <div className="grid gap-3">
            {limits.map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center py-3 px-4 rounded-[12px]"
                style={{ background: 'var(--color-paper)', border: '1px solid var(--color-line)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {label}
                </span>
                <span className="text-sm font-bold font-display" style={{ color: 'var(--color-ink)' }}>
                  {value}
                </span>
              </div>
            ))}
            <div
              className="flex justify-between items-center py-3 px-4 rounded-[12px]"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                AI quiz generation
              </span>
              <span className="text-sm font-bold font-display" style={{ color: 'var(--color-success)' }}>
                Included
              </span>
            </div>
            <div
              className="flex justify-between items-center py-3 px-4 rounded-[12px]"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                No app install for participants
              </span>
              <span className="text-sm font-bold font-display" style={{ color: 'var(--color-success)' }}>
                Always free
              </span>
            </div>
          </div>
        </div>

        {/* ─── Feedback / Need more? ──────────────────────────────────────── */}
        <div
          className="rounded-[16px] p-8 mb-8 text-center"
          style={{ background: 'var(--color-ink)' }}
        >
          <h2 className="text-xl font-bold font-display mb-3" style={{ color: 'var(--color-yellow)' }}>
            Need more? Tell us.
          </h2>
          <p
            className="text-sm mb-6 leading-relaxed mx-auto"
            style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 480 }}
          >
            We personally read every message. If you&apos;re running large classes, corporate
            training, or hitting a limit that&apos;s blocking you — reach out. Your feedback
            directly shapes what gets unlocked next.
          </p>
          <a
            href="mailto:info@quizotic.live"
            className="btn-primary inline-block"
            style={{
              textDecoration: 'none',
            }}
          >
            info@quizotic.live
          </a>
        </div>

        {/* ─── Learn more ─────────────────────────────────────────────────── */}
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Read the full story on our{' '}
          <Link href="/pricing" className="font-semibold underline" style={{ color: 'var(--color-ink)' }}>
            pricing page
          </Link>
          .
        </div>
      </div>
    </div>
  )
}
