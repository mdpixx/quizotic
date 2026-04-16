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

interface AiUsage {
  used: number
  limit: number
  plan: string
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
      if (usageRes.used !== undefined) setAiUsage(usageRes)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F1B3D', borderTopColor: 'transparent' }} />
          <p className="text-base font-medium" style={{ color: '#374151' }}>Loading your plan...</p>
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
    { label: 'Session history', value: `Last ${f.maxSessionHistory} sessions` },
    { label: 'Image uploads / month', value: `${f.maxImageUploads} images` },
  ]

  return (
    <div className="min-h-screen pb-16" style={{ background: '#F8F9FA' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <a href="/host" className="text-base font-semibold mb-6 inline-block" style={{ color: '#0F1B3D' }}>
          &larr; Back to Dashboard
        </a>

        {/* Page header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Your Account
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#374151' }}>
            Quizotic is free while we grow. No pricing, no tiers — just usage.
          </p>
        </div>

        {/* ─── Your Current Plan ──────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold" style={{ color: '#0F1B3D' }}>Your current plan</h2>
                <span className="text-sm font-bold px-3 py-1 rounded-full" style={{
                  background: isPro ? '#DCFCE7' : '#F3F4F6',
                  color: isPro ? '#16A34A' : '#0F1B3D',
                }}>
                  {isPro ? 'Extended access' : 'Free'}
                </span>
              </div>

              {isPro ? (
                <p className="text-base" style={{ color: '#0F1B3D' }}>
                  You have extended access. Everything Quizotic offers today is unlocked for your account.
                </p>
              ) : (
                <p className="text-base" style={{ color: '#0F1B3D' }}>
                  Everything Quizotic offers today — live quizzes, interactive presentations, AI generation, real-time leaderboards, word clouds, polls and more — works fully within the limits shown below.
                </p>
              )}
            </div>

            {/* Usage meter */}
            {aiUsage && (
              <div className="sm:text-right flex-shrink-0">
                <p className="text-sm font-bold mb-1" style={{ color: '#374151' }}>AI Questions This Month</p>
                <p className="text-3xl font-black" style={{ color: aiUsage.used >= aiUsage.limit ? '#EF4444' : '#0F1B3D' }}>
                  {aiUsage.used}<span className="text-base font-semibold" style={{ color: '#6B7280' }}> / {aiUsage.limit}</span>
                </p>
                <div className="w-40 h-2.5 rounded-full mt-2" style={{ background: '#E2E8F0' }}>
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min((aiUsage.used / aiUsage.limit) * 100, 100)}%`,
                      background: aiUsage.used >= aiUsage.limit
                        ? '#EF4444'
                        : aiUsage.used >= aiUsage.limit * 0.8
                          ? '#F59E0B'
                          : '#0F1B3D',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── What you get today ──────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 sm:p-8 mb-8" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
            What you have access to
          </h2>
          <div className="grid gap-3">
            {limits.map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center py-3 px-4 rounded-lg"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
              >
                <span className="text-sm font-medium" style={{ color: '#374151' }}>
                  {label}
                </span>
                <span className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                  {value}
                </span>
              </div>
            ))}
            <div
              className="flex justify-between items-center py-3 px-4 rounded-lg"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="text-sm font-medium" style={{ color: '#374151' }}>
                AI quiz generation
              </span>
              <span className="text-sm font-bold" style={{ color: '#16A34A' }}>
                Included
              </span>
            </div>
            <div
              className="flex justify-between items-center py-3 px-4 rounded-lg"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="text-sm font-medium" style={{ color: '#374151' }}>
                No app install for participants
              </span>
              <span className="text-sm font-bold" style={{ color: '#16A34A' }}>
                Always free
              </span>
            </div>
          </div>
        </div>

        {/* ─── Feedback / Need more? ──────────────────────────────────────── */}
        <div
          className="rounded-2xl p-8 mb-8 text-center"
          style={{ background: '#0F1B3D' }}
        >
          <h2 className="text-xl font-bold mb-3" style={{ color: '#F5E642' }}>
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
            className="inline-block text-sm font-bold px-6 py-3 rounded-lg"
            style={{
              background: '#F5E642',
              color: '#0D0D0D',
              textDecoration: 'none',
              border: '2px solid #F5E642',
            }}
          >
            info@quizotic.live
          </a>
        </div>

        {/* ─── Learn more ─────────────────────────────────────────────────── */}
        <div className="text-center text-sm" style={{ color: '#6B7280' }}>
          Read the full story on our{' '}
          <Link href="/pricing" className="font-semibold underline" style={{ color: '#0F1B3D' }}>
            pricing page
          </Link>
          .
        </div>
      </div>
    </div>
  )
}
