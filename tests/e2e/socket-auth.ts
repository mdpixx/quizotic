// Host-socket auth for protocol-level e2e tests.
//
// create_session / create_presenter_session require a signed-in user (server
// enforcement added 2026-06-10) — raw test sockets must present a valid
// NextAuth session cookie. We mint one with the local NEXTAUTH_SECRET; the
// secret stays in process memory and is never logged.
import { encode } from '@auth/core/jwt'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const COOKIE_NAME = 'authjs.session-token'

function loadSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  const raw = readFileSync(resolve(__dirname, '../../.env'), 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('NEXTAUTH_SECRET=')) {
      return trimmed.slice('NEXTAUTH_SECRET='.length).replace(/^"|"$/g, '')
    }
  }
  throw new Error('NEXTAUTH_SECRET not found in env or .env')
}

/**
 * Returns a Cookie header value for a signed-in test host.
 * Default userId is unique per call so parallel tests don't trip the
 * per-user create_session rate limit (5/min).
 */
export async function hostAuthCookie(userId = `e2e-test-host-${Math.random().toString(36).slice(2, 10)}`): Promise<string> {
  const token = await encode({
    token: { sub: userId, userId },
    secret: loadSecret(),
    salt: COOKIE_NAME,
    maxAge: 3600,
  })
  return `${COOKIE_NAME}=${token}`
}
