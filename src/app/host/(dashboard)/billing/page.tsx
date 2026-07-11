'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PLAN_LIMITS } from '@/lib/limits'
import { captureRaw } from '@/lib/analytics'

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

type ShareChannel = 'native' | 'whatsapp' | 'email' | 'copy'

function ReferralShareCard({ code, bonusEarned }: { code: string; bonusEarned: number }) {
  const [copied, setCopied] = useState(false)
  // Card only mounts client-side (after the referral-code fetch resolves),
  // so reading navigator during render can't cause a hydration mismatch.
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  const link = `https://www.quizotic.live/r/${code}`
  const message =
    'I use Quizotic to run live quizzes in my sessions — free, no app install for participants, AI question generation. Join with my link:'

  const track = (channel: ShareChannel) => {
    try {
      captureRaw('share_quizotic_click', { context: 'billing-referral', channel })
    } catch {
      // Non-blocking
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      track('copy')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Non-blocking
    }
  }

  const handleNative = async () => {
    track('native')
    try {
      await navigator.share({ title: 'Quizotic', text: message, url: link })
    } catch {
      // user dismissed
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`
  const emailHref = `mailto:?subject=${encodeURIComponent('Try Quizotic — free live quizzes')}&body=${encodeURIComponent(`${message}\n\n${link}`)}`

  return (
    <div className="rounded-[16px] p-6 sm:p-8 mb-8" style={{ background: '#FFFBEA', border: '1px solid var(--color-yellow)' }}>
      <h2 className="text-xl font-bold font-display mb-2" style={{ color: 'var(--color-ink)' }}>
        Share Quizotic — earn AI questions
      </h2>
      <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--color-text-secondary)', maxWidth: 560 }}>
        We don&apos;t run ads — Quizotic grows when one educator tells another. Every colleague
        who signs up with your personal link gets the full free plan (including the
        100-participant boost), and you get <strong style={{ color: 'var(--color-ink)' }}>+10 bonus AI questions</strong>,
        added automatically — up to +100.
      </p>

      {/* Personal link */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 rounded-[12px] p-2 pl-4"
        style={{ background: '#fff', border: '1px solid var(--color-line)' }}
      >
        <code className="text-sm flex-1 truncate py-2 sm:py-0" style={{ color: 'var(--color-ink)' }}>
          {link}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="font-semibold rounded-[10px] px-4 py-2 text-sm flex-shrink-0"
          style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canNativeShare && (
          <button
            type="button"
            onClick={handleNative}
            className="font-semibold rounded-[10px] px-4 py-2 text-sm"
            style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Share
          </button>
        )}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('whatsapp')}
          className="font-semibold rounded-[10px] px-4 py-2 text-sm"
          style={{ background: '#25D366', color: '#fff', textDecoration: 'none' }}
        >
          WhatsApp
        </a>
        <a
          href={emailHref}
          onClick={() => track('email')}
          className="font-semibold rounded-[10px] px-4 py-2 text-sm"
          style={{ background: '#fff', color: 'var(--color-ink)', textDecoration: 'none', border: '1px solid var(--color-ink)' }}
        >
          Email
        </a>
        {bonusEarned > 0 && (
          <span className="text-sm font-semibold ml-auto" style={{ color: 'var(--color-success)' }}>
            +{bonusEarned} bonus questions earned
          </span>
        )}
      </div>
    </div>
  )
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/status').then(r => r.json()),
      fetch('/api/user/ai-usage').then(r => r.json()),
      fetch('/api/user/referral-code').then(r => r.json()).catch(() => ({ code: null })),
    ]).then(([statusRes, usageRes, codeRes]) => {
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
      if (codeRes?.code) setReferralCode(codeRes.code)
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
    { label: 'Participants per session', value: `Up to ${f.maxParticipants}`, boost: true },
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
            Quizotic is free while we grow — and early accounts keep the best of it for life.
          </p>
        </div>

        {/* ─── Your Current Plan ──────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1px solid var(--color-line)', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 4px 16px -8px rgba(15,27,61,0.08)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold font-display" style={{ color: 'var(--color-ink)' }}>Your current plan</h2>
                <span className="chip font-display" style={{
                  background: isPro ? '#DCFCE7' : 'var(--color-yellow)',
                  color: isPro ? '#16A34A' : 'var(--color-ink)',
                }}>
                  {isPro ? 'Extended access' : 'Free · Early Supporter'}
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

          {/* Early Supporter boost — the thing they keep */}
          {!isPro && (
            <div className="mt-6 rounded-[12px] p-4" style={{ background: '#FFFBEB', border: '1px solid #F59E0B' }}>
              <p className="text-sm font-bold mb-1" style={{ color: '#92400E' }}>
                ⚡ Your Early Supporter boost: {f.maxParticipants} participants per session
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#78350F' }}>
                The standard free plan is 50. Because your account was created while we&apos;re
                growing, you get {f.maxParticipants} — and you keep it for life, even after paid
                plans launch. It never goes away.
              </p>
            </div>
          )}
        </div>

        {/* ─── What you get today ──────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1px solid var(--color-line)', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 4px 16px -8px rgba(15,27,61,0.08)' }}>
          <h2 className="text-xl font-bold font-display mb-5" style={{ color: 'var(--color-ink)' }}>
            What you have access to
          </h2>
          <div className="grid gap-3">
            {limits.map(({ label, value, boost }) => (
              <div
                key={label}
                className="flex justify-between items-center gap-3 py-3 px-4 rounded-[12px]"
                style={{ background: 'var(--color-paper)', border: '1px solid var(--color-line)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {label}
                  {boost && !isPro && (
                    <span
                      className="chip font-display ml-2 align-middle"
                      style={{ background: 'var(--color-yellow)', color: 'var(--color-ink)', fontSize: 11 }}
                    >
                      ⚡ boost
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold font-display whitespace-nowrap" style={{ color: 'var(--color-ink)' }}>
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

        {/* ─── Share & earn ───────────────────────────────────────────────── */}
        {referralCode && (
          <ReferralShareCard code={referralCode} bonusEarned={aiUsage?.questions.bonusCredits ?? 0} />
        )}

        {/* ─── Our promise ────────────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1px solid var(--color-ink)' }}>
          <h2 className="text-xl font-bold font-display mb-4" style={{ color: 'var(--color-ink)' }}>
            Our promise to you
          </h2>
          <ul className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            <li>
              <strong style={{ color: 'var(--color-ink)' }}>The free plan never shrinks for existing accounts.</strong>{' '}
              What works for you today keeps working. We&apos;ve seen other tools quietly cut
              their free limits — we won&apos;t.
            </li>
            <li>
              <strong style={{ color: 'var(--color-ink)' }}>Paid plans add capability — they never take it away.</strong>{' '}
              When paid plans arrive, they&apos;ll fund the servers by offering more, not by
              clawing back what you already have.
            </li>
            <li>
              <strong style={{ color: 'var(--color-ink)' }}>Early accounts keep their boost for life.</strong>{' '}
              Your 100 participants per session stays yours — that&apos;s our thank-you for
              being here before the crowd.
            </li>
          </ul>
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
          {' '}· or{' '}
          <Link href="/about" className="font-semibold underline" style={{ color: 'var(--color-ink)' }}>
            meet the person behind Quizotic
          </Link>
          .
        </div>
      </div>
    </div>
  )
}
