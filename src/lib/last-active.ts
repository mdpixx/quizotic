import { prisma } from '@/lib/prisma'

// Per-instance debounce so we don't write to User on every authenticated
// request. A user who hits the dashboard 50 times in a minute should only
// produce one DB write. Cache lives in process memory; if Railway ever
// scales horizontally (REDIS_URL set), the worst case is N writes per
// minute where N = instance count. Acceptable.

const DEBOUNCE_MS = 60_000
const lastWritten = new Map<string, number>()

export function bumpLastActive(userId: string): void {
  if (!userId) return
  const now = Date.now()
  const prev = lastWritten.get(userId) ?? 0
  if (now - prev < DEBOUNCE_MS) return
  lastWritten.set(userId, now)

  // Fire-and-forget — never await, never throw. Bumping last-active is a
  // best-effort signal, not the source of truth for anything user-facing.
  prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } })
    .catch((err: unknown) => {
      console.warn('[last-active] update failed for', userId, err instanceof Error ? err.message : err)
    })
}

// Test hook
export const __test__ = { lastWritten, DEBOUNCE_MS }
