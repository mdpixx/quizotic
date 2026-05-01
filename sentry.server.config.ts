// Next.js server-side Sentry (App Router API routes, server components,
// route handlers). Distinct from the custom Socket.IO server.mjs which
// runs its own @sentry/node init at the top of that file.
//
// Graceful no-DSN: if SENTRY_DSN is unset Sentry.init is skipped.

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
