// Browser-side Sentry. Captures runtime exceptions, unhandled promise
// rejections, and React render errors from the participant + host UIs.
//
// Graceful no-DSN: if NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev,
// or the env var hasn't been added to Railway yet) Sentry.init is
// skipped entirely — no warnings, no crashes, no network calls.

import * as Sentry from '@sentry/nextjs'
import { isNoiseError } from '@/lib/error-noise'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // Drop known third-party browser noise (extensions, translation widgets,
    // benign ResizeObserver warnings) so it doesn't bury real bugs or burn
    // quota. Same matcher PostHog uses — see lib/error-noise.ts.
    ignoreErrors: [/Object Not Found Matching Id:\s*\d+/i, /ResizeObserver loop/i],
    beforeSend(event) {
      const value = event.exception?.values?.[0]?.value
      if (isNoiseError(value)) return null
      return event
    },
    // Performance traces — keep low while traffic is small to stay on the
    // free tier. Bump later when sample volume matters more than cost.
    tracesSampleRate: 0.1,
    // Replay on errors only — full session replay is expensive and not
    // needed for the kind of bugs we care about (server schema mismatches,
    // socket protocol drift). Errors-only gives us video of the moment
    // something broke without burning quota.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    // Drop events from local dev unless explicitly opted-in.
    enabled: process.env.NODE_ENV === 'production',
  })
}
