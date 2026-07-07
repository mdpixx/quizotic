'use client'

import { useState } from 'react'
import { captureRaw } from '@/lib/analytics'

type Context = 'pricing' | 'join' | 'dashboard' | 'host-ended' | 'participant-ended'
type Size = 'sm' | 'md'
type Tone = 'light' | 'dark'
type Channel = 'native' | 'whatsapp' | 'email' | 'copy'

interface Props {
  context: Context
  size?: Size
  tone?: Tone
  className?: string
}

const SITE = 'https://www.quizotic.live'

const HEADINGS: Record<Context, string> = {
  pricing: 'Help us grow — share Quizotic',
  join: '',
  dashboard: 'Love Quizotic? Tell a teacher.',
  'host-ended': 'Loved the session? Share Quizotic with a colleague.',
  'participant-ended': '',
}

const BLURBS: Record<Context, string> = {
  pricing:
    'Quizotic is free while we grow — the kindest way to support us is to share it with one teacher, trainer, or event host who would love it.',
  join: 'Want to run your own quiz? Share Quizotic →',
  dashboard: 'One share to the right person can bring an entire school on board.',
  'host-ended': 'Your audience just had a great time — pass it on.',
  'participant-ended': 'Enjoyed it? Share Quizotic →',
}

const MESSAGES: Record<Context, string> = {
  pricing:
    'Try Quizotic — free live quiz and interactive presentation platform with INR billing, UPI, AI question generation and 11 question types.',
  join: 'Try Quizotic — free live quiz and presentation platform. Run a quiz in under 10 minutes.',
  dashboard:
    'I use Quizotic to run live quizzes — free, AI-generated, INR billing. Might be useful for you:',
  'host-ended':
    'Just ran a live quiz on Quizotic — 11 question types, AI generation, INR/UPI billing. Highly recommend:',
  'participant-ended': 'Tried Quizotic today — smooth live quiz tool. Worth a look:',
}

function buildUrl(context: Context, channel: Channel) {
  const params = new URLSearchParams({
    utm_source: 'share',
    utm_medium: channel,
    utm_campaign: context,
  })
  return `${SITE}/?${params.toString()}`
}

function track(context: Context, channel: Channel) {
  try {
    captureRaw('share_quizotic_click', { context, channel })
  } catch {
    // Non-blocking
  }
}

export function ShareQuizotic({ context, size = 'md', tone = 'light', className = '' }: Props) {
  const [copied, setCopied] = useState(false)
  const heading = HEADINGS[context]
  const blurb = BLURBS[context]
  const message = MESSAGES[context]
  const isSm = size === 'sm'

  // Compact inline variant for join + participant-ended (one line, no card)
  if (context === 'join' || context === 'participant-ended') {
    const url = buildUrl(context, 'native')
    const fullText = `${message} ${url}`
    const handleClick = async (e: React.MouseEvent) => {
      e.preventDefault()
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        track(context, 'native')
        try {
          await navigator.share({ title: 'Quizotic', text: message, url })
        } catch {
          // user dismissed
        }
        return
      }
      track(context, 'whatsapp')
      window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank', 'noopener,noreferrer')
    }
    const inlineColor = tone === 'dark' ? 'rgba(255,255,255,0.55)' : '#6B7280'
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-block text-xs underline-offset-4 hover:underline ${className}`}
        style={{ color: inlineColor, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {blurb}
      </button>
    )
  }

  // Card variant for pricing, dashboard, host-ended
  const urlWhats = buildUrl(context, 'whatsapp')
  const urlEmail = buildUrl(context, 'email')
  const urlCopy = buildUrl(context, 'copy')
  const urlNative = buildUrl(context, 'native')
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${message} ${urlWhats}`)}`
  const emailHref = `mailto:?subject=${encodeURIComponent('Try Quizotic')}&body=${encodeURIComponent(
    `${message}\n\n${urlEmail}`,
  )}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${message} ${urlCopy}`)
      setCopied(true)
      track(context, 'copy')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Non-blocking
    }
  }

  const handleNative = async (e: React.MouseEvent) => {
    if (typeof navigator === 'undefined' || !('share' in navigator)) return
    e.preventDefault()
    track(context, 'native')
    try {
      await navigator.share({ title: 'Quizotic', text: message, url: urlNative })
    } catch {
      // user dismissed
    }
  }

  const pad = isSm ? 'p-4' : 'p-6'
  const btnPad = isSm ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div
      className={`rounded-xl ${pad} ${className}`}
      style={{ background: '#FFFBEA', border: '1px solid #FBD13B' }}
    >
      {heading && (
        <h3 className="font-bold mb-1" style={{ color: '#0F1B3D', fontSize: isSm ? 14 : 16 }}>
          {heading}
        </h3>
      )}
      <p style={{ color: '#4B5563', fontSize: isSm ? 12 : 14, marginBottom: 12, lineHeight: 1.5 }}>{blurb}</p>
      <div className="flex flex-wrap gap-2">
        {hasNativeShare && (
          <button
            type="button"
            onClick={handleNative}
            className={`font-semibold rounded-lg ${btnPad}`}
            style={{ background: '#0F1B3D', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}
          >
            Share
          </button>
        )}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(context, 'whatsapp')}
          className={`font-semibold rounded-lg ${btnPad}`}
          style={{ background: '#25D366', color: '#FFFFFF', textDecoration: 'none' }}
        >
          WhatsApp
        </a>
        <a
          href={emailHref}
          onClick={() => track(context, 'email')}
          className={`font-semibold rounded-lg ${btnPad}`}
          style={{
            background: '#FFFFFF',
            color: '#0F1B3D',
            textDecoration: 'none',
            border: '1px solid #0F1B3D',
          }}
        >
          Email
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className={`font-semibold rounded-lg ${btnPad}`}
          style={{
            background: '#FFFFFF',
            color: '#0F1B3D',
            border: '1px solid #0F1B3D',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
