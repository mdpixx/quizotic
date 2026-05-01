// Browser-side Sentry. Captures runtime exceptions, unhandled promise
// rejections, and React render errors from the participant + host UIs.
//
// Graceful no-DSN: if NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev,
// or the env var hasn't been added to Railway yet) Sentry.init is
// skipped entirely — no warnings, no crashes, no network calls.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
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
