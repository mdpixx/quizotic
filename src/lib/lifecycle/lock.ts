// Single-holder lock for the hourly lifecycle tick.
//
// Railway can run more than one replica, and a cron hit lands on exactly one
// of them — but a retry, an overlapping slow run, or a manual trigger can all
// produce two ticks at once. The tick is idempotent by construction, so a
// double-fire is harmless rather than dangerous; this lock exists to stop two
// replicas doing the same scan at the same time, not to guarantee correctness.
//
// That distinction is why the fallback is permissive: with no REDIS_URL there
// is only one replica by definition, so running unlocked is correct. Failing
// closed here would mean local development and any Redis blip silently stop
// the lifecycle system, and the unique constraint on Nudge already prevents
// the outcome that would actually matter.

type LockClient = {
  set: (
    key: string,
    value: string,
    mode: 'PX',
    ttl: number,
    condition: 'NX',
  ) => Promise<'OK' | null>
  eval: (script: string, numKeys: number, ...args: string[]) => Promise<unknown>
}

let client: LockClient | null = null
let initTried = false

async function getRedis(): Promise<LockClient | null> {
  if (client) return client
  if (initTried) return null
  initTried = true
  if (!process.env.REDIS_URL) return null
  try {
    const mod = await import('ioredis')
    const Redis = mod.Redis ?? mod.default
    const c = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    })
    c.on('error', (err: Error) => {
      console.warn('[lifecycle] redis error:', err.message)
    })
    client = c as unknown as LockClient
    return client
  } catch (err) {
    console.warn('[lifecycle] failed to init redis, running unlocked:', (err as Error).message)
    return null
  }
}

// Release only if we still hold it. Without the value check, a run that
// overran its TTL would delete the *next* holder's lock on the way out.
const RELEASE = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`

export interface Lock {
  acquired: boolean
  release: () => Promise<void>
}

const NOOP_RELEASE = async () => {}

/**
 * Attempts to take `key` for `ttlMs`.
 *
 * The TTL is a deadlock guard, not a duration estimate — if a replica dies
 * mid-tick the lock has to expire on its own. Set it comfortably longer than a
 * normal run but shorter than the cron interval.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<Lock> {
  const redis = await getRedis()
  if (!redis) return { acquired: true, release: NOOP_RELEASE }

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    const ok = await redis.set(key, token, 'PX', ttlMs, 'NX')
    if (ok !== 'OK') return { acquired: false, release: NOOP_RELEASE }

    return {
      acquired: true,
      release: async () => {
        try {
          await redis.eval(RELEASE, 1, key, token)
        } catch (err) {
          // The TTL will clean up. Not worth failing a completed tick over.
          console.warn('[lifecycle] lock release failed:', (err as Error).message)
        }
      },
    }
  } catch (err) {
    // Redis unreachable. See the note at the top: permissive is the right
    // failure mode here, because the tick is idempotent and the real
    // duplicate-send guarantee lives in the database.
    console.warn('[lifecycle] lock acquire failed, running unlocked:', (err as Error).message)
    return { acquired: true, release: NOOP_RELEASE }
  }
}

export const __test__ = { reset: () => { client = null; initTried = false } }
