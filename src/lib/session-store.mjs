// Durable store for live sessions, backed by Redis.
//
// Sessions are the source of truth in server.mjs's in-memory `sessions` Map;
// this module mirrors them to Redis so a restarted instance (every Railway
// redeploy, or a crash) can rehydrate the Map instead of dropping every
// in-flight game — the cause of the "Game not found" join failures.
//
// Design:
//   - Memory stays the hot read/write path. Redis is only the durability layer:
//     write-through on create + a throttled snapshot from the broadcast loop,
//     a flush on shutdown, and a rehydrate on boot.
//   - Everything no-ops cleanly when the store isn't initialised (no REDIS_URL),
//     so local dev behaves exactly as before.

import { serializeSession, deserializeSession } from './session-state.mjs'

const KEY_PREFIX = 'quizotic:session:'
// Abandoned sessions self-expire; refreshed on every write so active games
// never lapse. Long enough to cover a full class plus reconnect grace.
const TTL_SECONDS = 6 * 60 * 60

let redis = null

// Wire in the ioredis client (called from server.mjs once REDIS_URL is up).
export function initSessionStore(client) {
  redis = client || null
}

export function isSessionStoreEnabled() {
  return !!redis
}

export async function saveSession(gameCode, session) {
  if (!redis || !gameCode || !session) return
  try {
    const payload = JSON.stringify(serializeSession(session))
    await redis.set(KEY_PREFIX + gameCode, payload, 'EX', TTL_SECONDS)
  } catch (err) {
    console.error('[session-store] save failed', gameCode, err?.message ?? err)
  }
}

export async function removeSession(gameCode) {
  if (!redis || !gameCode) return
  try {
    await redis.del(KEY_PREFIX + gameCode)
  } catch (err) {
    console.error('[session-store] remove failed', gameCode, err?.message ?? err)
  }
}

// Best-effort flush of many sessions at once (used on graceful shutdown so an
// intentional deploy never loses state). Accepts the live Map's entries.
export async function saveAllSessions(entries) {
  if (!redis || !entries) return 0
  let saved = 0
  for (const [gameCode, session] of entries) {
    if (session?.status === 'ended') continue
    await saveSession(gameCode, session)
    saved++
  }
  return saved
}

// Load every persisted session for boot rehydration. Uses SCAN (not KEYS) so
// it stays safe on a shared/production Redis. Returns [gameCode, session][].
export async function loadAllSessions() {
  if (!redis) return []
  const out = []
  try {
    const keys = []
    let cursor = '0'
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 200)
      cursor = next
      if (batch?.length) keys.push(...batch)
    } while (cursor !== '0')

    if (!keys.length) return []

    const values = await redis.mget(keys)
    for (let i = 0; i < keys.length; i++) {
      if (!values[i]) continue
      const gameCode = keys[i].slice(KEY_PREFIX.length)
      try {
        const session = deserializeSession(JSON.parse(values[i]))
        if (session) out.push([gameCode, session])
      } catch (err) {
        console.error('[session-store] parse failed', keys[i], err?.message ?? err)
      }
    }
  } catch (err) {
    console.error('[session-store] loadAll failed', err?.message ?? err)
  }
  return out
}
