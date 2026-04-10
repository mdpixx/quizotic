'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface PaymentRecord {
  id: string
  provider: string
  amount: number
  currency: string
  status: string
  invoiceUrl: string | null
  createdAt: string
}

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

// Base prices in INR
const BASE_PRICES = { monthly: 499, yearly: 4499 }

function detectCurrency(): string {
  try {
    const locale = navigator.language || 'en-IN'
    const parts = locale.split('-')
    const region = parts[1]?.toUpperCase()
    const regionToCurrency: Record<string, string> = {
      IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD',
      EU: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
      JP: 'JPY', SG: 'SGD', AE: 'AED', SA: 'SAR', KW: 'KWD',
      QA: 'QAR', BH: 'BHD', OM: 'OMR', MY: 'MYR', BD: 'BDT',
      LK: 'LKR', NP: 'NPR', PK: 'PKR', NG: 'NGN', KE: 'KES',
      ZA: 'ZAR', BR: 'BRL', MX: 'MXN', PH: 'PHP', ID: 'IDR',
      TH: 'THB', VN: 'VND', KR: 'KRW', CN: 'CNY', HK: 'HKD',
      TW: 'TWD', NZ: 'NZD', SE: 'SEK', NO: 'NOK', DK: 'DKK',
      CH: 'CHF', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
      TR: 'TRY', IL: 'ILS', EG: 'EGP',
    }
    return regionToCurrency[region] || 'USD'
  } catch {
    return 'USD'
  }
}

async function getExchangeRate(currency: string): Promise<number> {
  if (currency === 'INR') return 1
  const cacheKey = `qz_fx_${currency}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    const { rate, ts } = JSON.parse(cached)
    if (Date.now() - ts < 24 * 60 * 60 * 1000) return rate
  }
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/INR`)
    const data = await res.json()
    if (data.result === 'success' && data.rates[currency]) {
      const rate = data.rates[currency]
      localStorage.setItem(cacheKey, JSON.stringify({ rate, ts: Date.now() }))
      return rate
    }
  } catch { /* fall through */ }
  const fallback: Record<string, number> = {
    USD: 0.012, GBP: 0.0095, EUR: 0.011, CAD: 0.016, AUD: 0.018,
    SGD: 0.016, AED: 0.044, SAR: 0.045, JPY: 1.78, MYR: 0.053,
  }
  return fallback[currency] || 0.012
}

function formatLocalPrice(amount: number, currency: string): string {
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(amount)
    return formatted.replace(/^([^\d\s]+)(\d)/, '$1 $2')
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function getCurrencySymbol(currency: string): string {
  if (currency === 'INR') return 'Rs'
  try {
    // Format 0 and extract just the symbol portion
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0)
    const sym = parts.find(p => p.type === 'currency')?.value ?? currency
    return sym
  } catch {
    return currency
  }
}

// ── Feature comparison: grouped by category, verified against codebase ──

interface FeatureRow {
  name: string
  free: boolean | string
  pro: boolean | string
}

interface FeatureGroup {
  category: string
  color: string // row background tint for the group
  features: FeatureRow[]
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    category: 'Quiz Creation',
    color: '#F3F4F6',
    features: [
      { name: 'Quiz types — MCQ, True/False, Poll, Open-ended', free: true, pro: true },
      { name: 'Quiz types — Word Cloud, Q&A, Rating, Ranking, Case Study', free: false, pro: true },
      { name: 'AI-powered quiz generation', free: '30 questions/mo', pro: '750 questions/mo' },
      { name: 'Questions per AI generation', free: 'Up to 10', pro: 'Up to 25' },
      { name: 'AI quiz translation (multi-language)', free: true, pro: true },
      { name: 'Generate from document (PDF, DOCX)', free: true, pro: true },
      { name: 'Generate from any URL', free: true, pro: true },
      { name: 'Quiz templates library', free: true, pro: true },
      { name: 'Saved quizzes', free: 'Up to 5', pro: 'Unlimited' },
    ],
  },
  {
    category: 'Interactive Presentations',
    color: '#F5F0FF',
    features: [
      { name: 'Presentation slide deck builder', free: true, pro: true },
      { name: 'All 18 slide types (Interactive, Spatial, Energy, Content)', free: true, pro: true },
      { name: 'Slides per presentation', free: 'Up to 10', pro: 'Unlimited' },
      { name: 'Saved presentations', free: 'Up to 3', pro: 'Unlimited' },
    ],
  },
  {
    category: 'Live Sessions & Engagement',
    color: '#ECFDF5',
    features: [
      { name: 'Participants per session (quiz & presentation)', free: 'Up to 50', pro: 'Unlimited' },
      { name: 'Real-time leaderboards & podium', free: true, pro: true },
      { name: 'Team mode (2-6 teams)', free: true, pro: true },
      { name: 'Anonymous mode (hide names)', free: true, pro: true },
      { name: 'Competitive & reflection modes', free: true, pro: true },
      { name: 'Sound effects & gamification', free: true, pro: true },
      { name: 'QR code join for participants', free: true, pro: true },
    ],
  },
  {
    category: 'Reports & Learning Insights',
    color: '#FFF7ED',
    features: [
      { name: 'Session reports with question-level accuracy', free: true, pro: true },
      { name: 'Confidence grids (misconception detection)', free: true, pro: true },
      { name: "Bloom's taxonomy tagging & distribution", free: true, pro: true },
      { name: 'CSV data export', free: false, pro: true },
      { name: 'PDF export of results', free: false, pro: true },
      { name: 'Session history', free: 'Last 3', pro: 'Last 50' },
    ],
  },
  {
    category: 'Pro Extras',
    color: '#FEF2F2',
    features: [
      { name: 'Brand-free sessions (no Quizotic watermark)', free: false, pro: true },
      { name: 'Spaced retrieval learning', free: false, pro: true },
    ],
  },
]

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-semibold" style={{ color: '#0F1B3D' }}>{value}</span>
  }
  if (value) {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="mx-auto">
        <circle cx="11" cy="11" r="11" fill="#DCFCE7" />
        <path d="M7 11.5L9.5 14L15 8.5" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="mx-auto">
      <circle cx="11" cy="11" r="11" fill="#F3F4F6" />
      <path d="M8 8L14 14M14 8L8 14" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function PricingPage() {
  const { data: session } = useSession()
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [userCurrency, setUserCurrency] = useState('INR')
  const [fxRate, setFxRate] = useState(1)

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/status').then(r => r.json()),
      fetch('/api/billing/payments').then(r => r.json()),
      fetch('/api/user/ai-usage').then(r => r.json()),
    ]).then(([statusRes, paymentsRes, usageRes]) => {
      if (statusRes.plan) setBilling({ plan: statusRes.plan, subscription: statusRes.subscription })
      if (paymentsRes.success) setPayments(paymentsRes.data ?? [])
      if (usageRes.used !== undefined) setAiUsage(usageRes)
      setLoading(false)
    })

    const currency = detectCurrency()
    setUserCurrency(currency)
    getExchangeRate(currency).then(rate => setFxRate(rate))
  }, [])

  const localPrice = useCallback((inrAmount: number) => {
    if (userCurrency === 'INR') return null
    return formatLocalPrice(inrAmount * fxRate, userCurrency)
  }, [userCurrency, fxRate])

  async function handleCancelSubscription() {
    setCancelling(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.cancelled) {
        window.location.reload()
      } else if (data.error) {
        alert(data.error)
        setCancelling(false)
        setCancelConfirm(false)
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setCancelling(false)
      setCancelConfirm(false)
    }
  }

  function formatAmount(amount: number, currency: string) {
    const value = amount / 100
    return currency === 'inr' ? `Rs ${value}` : `$ ${value}`
  }

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
  const monthlyLocal = localPrice(BASE_PRICES.monthly)
  const yearlyLocal = localPrice(BASE_PRICES.yearly)
  const yearlyPerMonthLocal = localPrice(Math.round(BASE_PRICES.yearly / 12))

  return (
    <div className="min-h-screen pb-16" style={{ background: '#F8F9FA' }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <a href="/host" className="text-base font-semibold mb-6 inline-block" style={{ color: '#0F1B3D' }}>
          &larr; Back to Dashboard
        </a>

        {/* Page header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-heading)', color: '#0F1B3D' }}>
            Plans & Pricing
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#374151' }}>
            Everything you need to run engaging quizzes and interactive presentations for your classroom, training, or event — starting free.
          </p>
        </div>

        {/* ─── Your Current Plan ──────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 sm:p-8 mb-10" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold" style={{ color: '#0F1B3D' }}>Your Current Plan</h2>
                <span className="text-sm font-bold px-3 py-1 rounded-full" style={{
                  background: isPro ? '#DCFCE7' : '#F3F4F6',
                  color: isPro ? '#16A34A' : '#0F1B3D',
                }}>
                  {isPro ? 'Pro' : 'Free'}
                </span>
              </div>

              {isPro ? (
                <>
                  <p className="text-base mb-1" style={{ color: '#0F1B3D' }}>
                    You have full access to all Pro features. Thank you for supporting better learning!
                  </p>
                  {billing?.subscription?.currentPeriodEnd && (
                    <p className="text-base" style={{ color: '#374151' }}>
                      {billing.subscription.cancelledAt
                        ? `Access until ${new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews on ${new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}`
                      }
                    </p>
                  )}
                </>
              ) : (
                <p className="text-base" style={{ color: '#0F1B3D' }}>
                  You&apos;re on the Free plan — great for getting started! Upgrade to Pro when you&apos;re ready for larger sessions, more AI credits, exports, and advanced learning tools.
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

          {/* What you're missing (free users) */}
          {!isPro && (
            <div className="mt-6 pt-6" style={{ borderTop: '1px solid #E2E8F0' }}>
              <p className="text-sm font-bold mb-3" style={{ color: '#6B7280', letterSpacing: '0.05em' }}>WHAT PRO UNLOCKS FOR YOU</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Unlimited participants per session (vs 50)',
                  '750 AI questions per month (vs 30)',
                  'Up to 25 questions per generation (vs 10)',
                  'Unlimited saved quizzes & presentations',
                  'Unlimited slides per presentation (vs 10)',
                  '5 more question types (Word Cloud, Q&A, Rating, Ranking, Case Study)',
                  'CSV & PDF export of session results',
                  'Session history — last 50 (vs 3)',
                  'No Quizotic branding on sessions',
                ].map(item => (
                  <div key={item} className="flex items-start gap-2.5">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 flex-shrink-0">
                      <path d="M4.5 9L7.5 12L13.5 5.5" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-base" style={{ color: '#0F1B3D' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Plan Cards — side-by-side aligned comparison ─────────────── */}
        <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="rounded-2xl flex flex-col" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
            {/* Header */}
            <div className="p-6 sm:p-8 pb-5">
              <h3 className="text-xl font-bold mb-1" style={{ color: '#0F1B3D' }}>Free</h3>
              <p className="text-base mb-4" style={{ color: '#374151' }}>For exploring and small groups</p>
              <p className="text-4xl font-black" style={{ color: '#0F1B3D' }}>
                {getCurrencySymbol(userCurrency)} 0<span className="text-base font-medium ml-1" style={{ color: '#6B7280' }}>/forever</span>
              </p>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>No credit card needed</p>
            </div>

            {/* Aligned feature rows */}
            <div className="flex-1 px-6 sm:px-8">
              {[
                { label: 'Participants', value: 'Up to 50 / session' },
                { label: 'AI questions', value: '30 / month' },
                { label: 'Per generation', value: 'Up to 10 questions' },
                { label: 'Saved quizzes', value: '5' },
                { label: 'Saved presentations', value: '3' },
                { label: 'Slides per deck', value: 'Up to 10' },
                { label: 'Session history', value: 'Last 3' },
                { label: 'Quiz types', value: '4 (MCQ, T/F, Poll, Open-ended)' },
                { label: 'Presentation slides', value: 'All 18 types' },
                { label: 'Reports & analytics', value: 'Full reports, Bloom\'s, confidence grids' },
                { label: 'CSV / PDF export', value: false },
                { label: 'Spaced retrieval', value: false },
                { label: 'Remove branding', value: false },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-3 py-2.5"
                  style={{ borderTop: i === 0 ? '1px solid #E2E8F0' : '1px solid #F1F5F9' }}
                >
                  <span className="text-sm font-medium" style={{ color: '#6B7280' }}>{row.label}</span>
                  {typeof row.value === 'string' ? (
                    <span className="text-sm font-bold text-right" style={{ color: '#0F1B3D' }}>{row.value}</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
                      <path d="M6 6L12 12M12 6L6 12" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="p-6 sm:p-8 pt-5">
              {!isPro ? (
                <div className="py-3 rounded-xl text-base font-bold text-center" style={{ background: '#F3F4F6', color: '#0F1B3D' }}>
                  Your Current Plan
                </div>
              ) : (
                <div className="py-3 rounded-xl text-base font-medium text-center" style={{ color: '#9CA3AF' }}>
                  &mdash;
                </div>
              )}
            </div>
          </div>

          {/* Pro Plan — highlighted */}
          <div className="rounded-2xl flex flex-col relative" style={{
            background: '#fff',
            border: '2.5px solid #0F1B3D',
            boxShadow: '0 4px 32px rgba(15,27,61,0.15)',
          }}>
            {/* Top badges */}
            <div className="absolute -top-3.5 left-6 flex items-center gap-2">
              <span className="px-4 py-1.5 rounded-full text-sm font-bold text-white" style={{ background: '#0F1B3D' }}>
                Recommended
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: '#16A34A' }}>
                Save 25% yearly
              </span>
            </div>

            {/* Header — same height structure as Free */}
            <div className="p-6 sm:p-8 pb-5 mt-1">
              <h3 className="text-xl font-bold mb-1" style={{ color: '#0F1B3D' }}>Pro</h3>
              <p className="text-base mb-4" style={{ color: '#374151' }}>For educators, trainers & serious learners</p>
              <div>
                {userCurrency === 'INR' ? (
                  <p className="text-4xl font-black" style={{ color: '#0F1B3D' }}>
                    Rs 499<span className="text-base font-medium ml-1" style={{ color: '#6B7280' }}>/month</span>
                  </p>
                ) : (
                  <p className="text-4xl font-black" style={{ color: '#0F1B3D' }}>
                    {monthlyLocal}<span className="text-base font-medium ml-1" style={{ color: '#6B7280' }}>/month</span>
                  </p>
                )}
                <p className="text-sm mt-1" style={{ color: '#16A34A', fontWeight: 600 }}>
                  {userCurrency === 'INR'
                    ? 'or Rs 4,499/yr (Rs 375/mo)'
                    : `or ${yearlyLocal}/yr (${yearlyPerMonthLocal}/mo)`
                  }
                  {userCurrency !== 'INR' && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> &middot; Rs 499/mo</span>}
                </p>
              </div>
            </div>

            {/* Aligned feature rows — matches Free row-by-row */}
            <div className="flex-1 px-6 sm:px-8">
              {[
                { label: 'Participants', value: 'Unlimited', highlight: true },
                { label: 'AI questions', value: '750 / month', highlight: true },
                { label: 'Per generation', value: 'Up to 25 questions', highlight: true },
                { label: 'Saved quizzes', value: 'Unlimited', highlight: true },
                { label: 'Saved presentations', value: 'Unlimited', highlight: true },
                { label: 'Slides per deck', value: 'Unlimited', highlight: true },
                { label: 'Session history', value: 'Last 50', highlight: true },
                { label: 'Quiz types', value: 'All 9 (+ Word Cloud, Q&A, Rating, Ranking, Case Study)', highlight: true },
                { label: 'Presentation slides', value: 'All 18 types', highlight: false },
                { label: 'Reports & analytics', value: 'Full reports, Bloom\'s, confidence grids', highlight: false },
                { label: 'CSV / PDF export', value: true, highlight: true },
                { label: 'Spaced retrieval', value: true, highlight: true },
                { label: 'Remove branding', value: true, highlight: true },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-3 py-2.5"
                  style={{ borderTop: i === 0 ? '1px solid #E2E8F0' : '1px solid #F1F5F9' }}
                >
                  <span className="text-sm font-medium" style={{ color: '#6B7280' }}>{row.label}</span>
                  {typeof row.value === 'string' ? (
                    <span className="text-sm font-bold text-right" style={{ color: row.highlight ? '#0F1B3D' : '#0F1B3D' }}>{row.value}</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
                      <circle cx="9" cy="9" r="9" fill="#DCFCE7" />
                      <path d="M5.5 9.5L7.5 11.5L12.5 6.5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="p-6 sm:p-8 pt-5">
              {isPro ? (
                <div className="py-3 rounded-xl text-base font-bold text-center" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                  Your Current Plan
                </div>
              ) : (
                <button
                  disabled
                  className="w-full py-3 rounded-xl text-base font-bold text-white opacity-60 cursor-not-allowed relative overflow-hidden"
                  style={{ background: '#0F1B3D' }}
                >
                  Upgrade to Pro
                  <span className="absolute top-1.5 right-3 text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>
                    Coming Soon
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── GST / Tax note ──────────────────────────────────────────── */}
        <div className="rounded-xl px-5 py-4 mb-10 flex items-start gap-3" style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A' }}>
          <span className="text-lg flex-shrink-0 mt-0.5">🧾</span>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: '#92400E' }}>Pricing &amp; GST</p>
            <p className="text-sm" style={{ color: '#78350F', lineHeight: 1.6 }}>
              All prices shown are <strong>exclusive of GST</strong>. For Indian customers, 18% GST will be added at checkout as per government regulations.
              Your invoice will include a full GST breakdown with our GSTIN number. International customers are not charged GST.
            </p>
          </div>
        </div>

        {/* ─── Feature Comparison Table (grouped, color-coded) ─────────── */}
        <div className="rounded-2xl overflow-hidden mb-10" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <div className="p-6 sm:p-8 pb-4">
            <h2 className="text-2xl font-bold" style={{ color: '#0F1B3D' }}>Full Feature Comparison</h2>
            <p className="text-base mt-1" style={{ color: '#374151' }}>
              Every feature Quizotic offers today — quizzes, presentations, and learning tools — at a glance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th className="text-left px-6 py-4 text-base font-bold" style={{ color: '#374151', minWidth: 280 }}>Feature</th>
                  <th className="text-center px-5 py-4 text-base font-bold" style={{ color: '#374151', minWidth: 120 }}>Free</th>
                  <th className="text-center px-5 py-4 text-base font-bold" style={{ color: '#fff', minWidth: 140, background: '#0F1B3D', borderRadius: '12px 12px 0 0' }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map(group => (
                  <>
                    {/* Category header row */}
                    <tr key={group.category} style={{ background: group.color }}>
                      <td colSpan={3} className="px-6 py-3">
                        <span className="text-sm font-bold" style={{ color: '#374151', letterSpacing: '0.03em' }}>
                          {group.category.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                    {/* Feature rows */}
                    {group.features.map((feature, i) => (
                      <tr
                        key={feature.name}
                        style={{
                          background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        <td className="px-6 py-3.5 text-base font-medium" style={{ color: '#0F1B3D' }}>{feature.name}</td>
                        <td className="px-5 py-3.5 text-center"><FeatureValue value={feature.free} /></td>
                        <td className="px-5 py-3.5 text-center" style={{ background: i % 2 === 0 ? '#F3F4F6' : '#EBEDEF' }}>
                          <FeatureValue value={feature.pro} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Why Upgrade? (free users) ───────────────────────────────────── */}
        {!isPro && (
          <div className="rounded-2xl p-6 sm:p-8 mb-10" style={{ background: 'linear-gradient(135deg, #F3F4F6 0%, #F3F4F6 100%)', border: '1.5px solid #E0E7FF' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: '#0F1B3D' }}>Why go Pro?</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              <div>
                <p className="text-base font-bold mb-1.5" style={{ color: '#0F1B3D' }}>Teach bigger groups</p>
                <p className="text-base" style={{ color: '#374151' }}>
                  Free supports 50 learners per session. Pro removes the cap entirely — run sessions with your entire batch, department, or event audience.
                </p>
              </div>
              <div>
                <p className="text-base font-bold mb-1.5" style={{ color: '#0F1B3D' }}>Prepare faster</p>
                <p className="text-base" style={{ color: '#374151' }}>
                  Generate up to 25 questions at a time from any topic, document, or URL. With 750 AI credits a month, you can build a full question bank in minutes.
                </p>
              </div>
              <div>
                <p className="text-base font-bold mb-1.5" style={{ color: '#0F1B3D' }}>Measure learning</p>
                <p className="text-base" style={{ color: '#374151' }}>
                  Export results as CSV or PDF. Use confidence grids to spot misconceptions and spaced retrieval to help learners retain what they&apos;ve learned.
                </p>
              </div>
            </div>
            <p className="text-sm mt-5" style={{ color: '#6B7280' }}>
              Pro subscriptions are launching soon. Enjoy the Free tier meanwhile — no credit card required.
              {userCurrency !== 'INR' && ' Prices shown are approximate.'}
            </p>
          </div>
        )}

        {/* ─── FAQ ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 sm:p-8 mb-10" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <h2 className="text-2xl font-bold mb-6" style={{ color: '#0F1B3D' }}>Frequently Asked Questions</h2>
          <div className="space-y-5">
            {[
              {
                q: 'Is Quizotic really free to use?',
                a: 'Yes. The Free plan is genuinely free — no credit card, no trial period, no expiry. You can create quizzes and presentations, run live sessions with up to 50 participants, use AI to generate questions, and access all 18 presentation slide types. It\'s designed to let you get real value before you ever think about upgrading.',
              },
              {
                q: 'How are AI question credits counted?',
                a: 'Credits are counted per question generated, not per request. If you generate 5 questions from a topic, that uses 5 credits. If you generate 25, that\'s 25. Translating a quiz also counts each translated question. This way, smaller generations cost less. Your credits reset on the 1st of every month.',
              },
              {
                q: 'What happens when I run out of AI credits?',
                a: 'You can still create quizzes manually — type your own questions, use templates, or duplicate existing quizzes. You just won\'t be able to use AI generation or translation until your credits reset next month, or you upgrade to Pro for 750 credits.',
              },
              {
                q: 'Do participants need an account to join?',
                a: 'No. Participants join by scanning a QR code or entering a game code at quizotic.live/join. No sign-up, no app install, no login. They just need a browser on their phone or laptop.',
              },
              {
                q: 'What\'s the difference between Quizzes and Presentations?',
                a: 'Quizzes are scored — learners answer questions, earn points, and compete on a leaderboard with podium results. Presentations are interactive slide decks — polls, word clouds, rating scales, Q&A, and more — where you gather audience input in real time. Both are included on all plans.',
              },
              {
                q: 'Can I use Quizotic for corporate training or workshops?',
                a: 'Absolutely. Quizotic is built for any learning setting — classrooms, coaching centres, corporate L&D, onboarding, workshops, and events. Free supports up to 50 participants per session, and Pro removes the cap entirely. Session exports on Pro make it easy to share results with stakeholders.',
              },
              {
                q: 'What question types are available?',
                a: 'Free plan includes MCQ, True/False, Poll, and Open-ended. Pro adds Word Cloud, Q&A, Rating Scale, Ranking, and Case Study — 9 types total. For presentations, all 18 slide types (interactive polls, spatial activities, energy moments, and content slides) are available on both plans.',
              },
              {
                q: 'Can I export session results?',
                a: 'Pro users can export results as CSV (for spreadsheets) or PDF (for sharing). Free users can view full session reports in the browser, including question-level accuracy, confidence grids, and Bloom\'s taxonomy distribution.',
              },
              {
                q: 'When will Pro subscriptions be available?',
                a: 'Soon! We\'re finalising payment integration with Razorpay (for UPI, cards, and net banking in India) and Stripe (for international cards). In the meantime, the Free tier is fully functional. Follow us for updates.',
              },
              {
                q: 'Is my data secure?',
                a: 'Yes. Quizotic uses Google OAuth for authentication, encrypted database connections, and does not store any payment information directly. Session data is stored securely in a managed PostgreSQL database.',
              },
            ].map(faq => (
              <details key={faq.q} className="group" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <summary className="flex items-center justify-between cursor-pointer list-none py-3">
                  <span className="text-base font-bold" style={{ color: '#0F1B3D' }}>{faq.q}</span>
                  <svg
                    width="20" height="20" viewBox="0 0 20 20" fill="none"
                    className="flex-shrink-0 ml-4 transition-transform group-open:rotate-180"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <p className="text-base mt-2 pb-2" style={{ color: '#374151', lineHeight: 1.7 }}>
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* ─── Payment History ────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <div className="rounded-2xl p-6 sm:p-8 mb-10" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: '#0F1B3D' }}>Payment History</h2>
            <table className="w-full">
              <thead>
                <tr style={{ color: '#6B7280' }}>
                  <th className="text-left pb-3 text-base font-bold">Date</th>
                  <th className="text-left pb-3 text-base font-bold">Amount</th>
                  <th className="text-left pb-3 text-base font-bold">Status</th>
                  <th className="text-right pb-3 text-base font-bold">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td className="py-3 text-base" style={{ color: '#374151' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-base font-bold" style={{ color: '#0F1B3D' }}>{formatAmount(p.amount, p.currency)}</td>
                    <td className="py-3">
                      <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{
                        background: p.status === 'succeeded' ? '#DCFCE7' : '#FEF2F2',
                        color: p.status === 'succeeded' ? '#16A34A' : '#EF4444',
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold" style={{ color: '#0F1B3D' }}>
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Danger Zone (Pro users) ────────────────────────────────────── */}
        {isPro && (
          <div className="rounded-2xl p-6 sm:p-8" style={{ background: '#fff', border: '2px solid #FCA5A5' }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#991B1B' }}>Danger Zone</h2>
            <p className="text-base mb-5" style={{ color: '#374151' }}>
              Cancelling your subscription will downgrade you to the Free plan at the end of your current billing period.
              You&apos;ll lose access to exports, unlimited participants, extended session history, and advanced question types.
            </p>

            {!cancelConfirm ? (
              <button
                onClick={() => setCancelConfirm(true)}
                className="text-base font-bold px-5 py-2.5 rounded-xl transition-colors hover:bg-red-50"
                style={{ border: '2px solid #EF4444', color: '#EF4444', background: 'transparent' }}
              >
                Cancel Subscription
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="text-base font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-50"
                  style={{ background: '#EF4444' }}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, cancel my subscription'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  disabled={cancelling}
                  className="text-base font-medium px-5 py-2.5 rounded-xl"
                  style={{ color: '#374151' }}
                >
                  Never mind
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
