// Edge runtime Sentry (middleware / proxy.ts). Same DSN, lighter init.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
  })
}
