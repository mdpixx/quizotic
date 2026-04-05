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

// Base prices in INR (paise-free, display values)
const BASE_PRICES = { monthly: 499, yearly: 4499 }

// Map browser locale to currency code
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

// Fetch exchange rate with 24h localStorage cache
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

  // Fallback rough rates if API fails
  const fallback: Record<string, number> = {
    USD: 0.012, GBP: 0.0095, EUR: 0.011, CAD: 0.016, AUD: 0.018,
    SGD: 0.016, AED: 0.044, SAR: 0.045, JPY: 1.78, MYR: 0.053,
  }
  return fallback[currency] || 0.012
}

// Format amount in local currency
function formatLocalPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export default function BillingPage() {
  const { data: session } = useSession()
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [userCurrency, setUserCurrency] = useState('INR')
  const [fxRate, setFxRate] = useState(1)

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/status').then(r => r.json()),
      fetch('/api/billing/payments').then(r => r.json()),
    ]).then(([statusRes, paymentsRes]) => {
      if (statusRes.plan) setBilling({ plan: statusRes.plan, subscription: statusRes.subscription })
      if (paymentsRes.success) setPayments(paymentsRes.data ?? [])
      setLoading(false)
    })

    // Detect currency and fetch exchange rate
    const currency = detectCurrency()
    setUserCurrency(currency)
    getExchangeRate(currency).then(rate => setFxRate(rate))
  }, [])

  const localPrice = useCallback((inrAmount: number) => {
    if (userCurrency === 'INR') return null
    return formatLocalPrice(inrAmount * fxRate, userCurrency)
  }, [userCurrency, fxRate])

  async function handleCheckout(plan: 'pro_monthly' | 'pro_yearly') {
    setCheckoutLoading(true)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'razorpay', plan }),
    })
    const data = await res.json()
    setCheckoutLoading(false)

    if (data.subscriptionId) {
      const opts = {
        key: data.key_id,
        subscription_id: data.subscriptionId,
        name: 'Quizotic',
        description: plan === 'pro_yearly' ? 'Pro Yearly' : 'Pro Monthly',
        handler: () => window.location.reload(),
        prefill: {
          email: session?.user?.email || '',
          name: session?.user?.name || '',
        },
        theme: { color: '#4361EE' },
      }
      // @ts-expect-error Razorpay is loaded via script
      const rzp = new window.Razorpay(opts)
      rzp.open()
    } else if (data.error) {
      alert(data.error)
    }
  }

  async function handleManage() {
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else if (data.cancelled) {
      window.location.reload()
    }
  }

  function formatAmount(amount: number, currency: string) {
    const value = amount / 100
    return currency === 'inr' ? `Rs${value}` : `$${value}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFBF5' }}>
        <p style={{ color: '#4A5568' }}>Loading...</p>
      </div>
    )
  }

  const isPro = billing?.plan === 'pro'
  const monthlyLocal = localPrice(BASE_PRICES.monthly)
  const yearlyLocal = localPrice(BASE_PRICES.yearly)
  const yearlyPerMonthLocal = localPrice(Math.round(BASE_PRICES.yearly / 12))

  return (
    <div className="min-h-screen p-6" style={{ background: '#FFFBF5' }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="max-w-2xl mx-auto">
        <a href="/host" className="text-sm font-semibold mb-6 inline-block" style={{ color: '#4361EE' }}>
          &larr; Back to Dashboard
        </a>

        <h1 className="text-2xl font-black mb-6" style={{ fontFamily: 'var(--font-heading)', color: '#1B2559' }}>
          Billing
        </h1>

        {/* Current Plan */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: '#1B2559' }}>Current Plan</h2>
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{
              background: isPro ? '#DCFCE7' : '#F0F4FF',
              color: isPro ? '#16A34A' : '#4361EE',
            }}>
              {isPro ? 'Pro' : 'Free'}
            </span>
          </div>

          {isPro && billing?.subscription?.currentPeriodEnd && (
            <p className="text-sm mb-3" style={{ color: '#4A5568' }}>
              {billing.subscription.cancelledAt
                ? `Access until ${new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Renews ${new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}`
              }
            </p>
          )}

          {isPro ? (
            <button onClick={handleManage} className="text-sm font-semibold" style={{ color: '#EF4444' }}>
              Manage / Cancel Subscription
            </button>
          ) : (
            <p className="text-sm" style={{ color: '#4A5568' }}>
              Unlock deeper learning tools with Pro.
            </p>
          )}
        </div>

        {/* Upgrade Section (only for free users) */}
        {!isPro && (
          <div className="rounded-2xl p-6 mb-6" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold" style={{ color: '#1B2559' }}>Upgrade to Pro</h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>
                Coming Soon
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl p-4" style={{ border: '1.5px solid #E2E8F0' }}>
                <p className="text-sm font-bold" style={{ color: '#1B2559' }}>Monthly</p>
                {userCurrency === 'INR' ? (
                  <p className="text-2xl font-black" style={{ color: '#4361EE' }}>
                    Rs499<span className="text-sm font-normal">/mo</span>
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-black" style={{ color: '#4361EE' }}>
                      {monthlyLocal}<span className="text-sm font-normal">/mo</span>
                    </p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>Rs499/mo</p>
                  </>
                )}
              </div>
              <div className="rounded-xl p-4" style={{ border: '1.5px solid #4361EE', background: '#F0F4FF' }}>
                <p className="text-sm font-bold" style={{ color: '#1B2559' }}>
                  Yearly <span className="text-xs" style={{ color: '#16A34A' }}>Save 25%</span>
                </p>
                {userCurrency === 'INR' ? (
                  <>
                    <p className="text-2xl font-black" style={{ color: '#4361EE' }}>
                      Rs4,499<span className="text-sm font-normal">/yr</span>
                    </p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>Rs375/mo</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-black" style={{ color: '#4361EE' }}>
                      {yearlyLocal}<span className="text-sm font-normal">/yr</span>
                    </p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {yearlyPerMonthLocal}/mo &middot; Rs4,499/yr
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white opacity-50 cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #4361EE)' }}
              >
                Subscribe Monthly
              </button>
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white opacity-50 cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #4361EE, #7C3AED)' }}
              >
                Subscribe Yearly
              </button>
            </div>

            <p className="text-xs text-center mt-3" style={{ color: '#9CA3AF' }}>
              Pro subscriptions launching soon. Enjoy the free tier for now!
              {userCurrency !== 'INR' && ' Prices shown are approximate.'}
            </p>
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #E2E8F0' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#1B2559' }}>Payment History</h2>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: '#9CA3AF' }}>
                  <th className="text-left pb-2 font-semibold">Date</th>
                  <th className="text-left pb-2 font-semibold">Amount</th>
                  <th className="text-left pb-2 font-semibold">Status</th>
                  <th className="text-right pb-2 font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td className="py-2" style={{ color: '#4A5568' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 font-semibold" style={{ color: '#1B2559' }}>{formatAmount(p.amount, p.currency)}</td>
                    <td className="py-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        background: p.status === 'succeeded' ? '#DCFCE7' : '#FEF2F2',
                        color: p.status === 'succeeded' ? '#16A34A' : '#EF4444',
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: '#4361EE' }}>
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
      </div>
    </div>
  )
}
