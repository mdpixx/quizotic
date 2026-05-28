import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['pdf-parse', 'mammoth', 'openai', '@aws-sdk/client-s3', 'jszip'],
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    proxyClientMaxBodySize: 20 * 1024 * 1024, // 20MB in bytes
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'quizotic.live' }],
        destination: 'https://www.quizotic.live/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://eu-assets.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' wss: https://api.razorpay.com https://lux-gateway.razorpay.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "frame-ancestors 'none'",
              "worker-src 'self'",
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

// withSentryConfig wraps the build so source maps upload + tunnel route
// happen on `next build`. Auth token is only needed for source-map upload —
// without it Sentry still receives errors, you just see minified frames.
// Setting `silent: true` keeps build logs clean.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Skip source-map upload entirely if no auth token — graceful for first
  // deploy before the Sentry account is wired up.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Tunnel through a Next.js route so adblockers don't drop client errors.
  tunnelRoute: '/monitoring',
});

