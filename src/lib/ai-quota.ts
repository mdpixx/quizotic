import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserPlan, getBonusCredits, type Plan, type AiBucket } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

export type AiAction = 'ai_generate' | 'ai_translate' | 'ai_enhance'
export type { AiBucket }

export interface AiQuotaCheck {
  allowed: boolean
  plan: Plan
  bucket: AiBucket
  used: number
  limit: number
  bonusCredits: number
  remaining: number
}

export interface AiUsageSummary {
  plan: Plan
  questions: { used: number; limit: number; bonusCredits: number }
  enhancements: { used: number; limit: number; bonusCredits: number }
}

const QUESTION_ACTIONS: AiAction[] = ['ai_generate', 'ai_translate']
const ENHANCEMENT_ACTIONS: AiAction[] = ['ai_enhance']
const DEFAULT_QUESTION_COST = 5

function startOfCurrentMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function bucketFor(action: AiAction): AiBucket {
  return ENHANCEMENT_ACTIONS.includes(action) ? 'enhancements' : 'questions'
}

async function countQuestions(userId: string, since: Date): Promise<number> {
  // Typed column read — Session 2 promoted questionCount out of JSON.
  // For rows where the typed column is still 0 (backfill never ran, or a
  // future caller forgot to populate it) we read the JSON shadow value
  // and sum that instead. Last-resort fallback is DEFAULT_QUESTION_COST so
  // a degenerate row still gets metered — never let the count drift to 0
  // when rows clearly exist.
  const rows = await prisma.usageLog.findMany({
    where: { userId, action: { in: QUESTION_ACTIONS }, createdAt: { gte: since } },
    select: { questionCount: true, metadata: true },
  })
  let total = 0
  for (const r of rows) {
    if (r.questionCount > 0) {
      total += r.questionCount
      continue
    }
    // Typed column missing — try the JSON shadow.
    const meta = r.metadata as Record<string, unknown> | null
    const fromJson = meta?.questionCount
    if (typeof fromJson === 'number' && Number.isFinite(fromJson) && fromJson > 0) {
      total += Math.floor(fromJson)
      continue
    }
    // Both empty — assume the legacy default so the user still gets metered.
    total += DEFAULT_QUESTION_COST
  }
  return total
}

async function countEnhancements(userId: string, since: Date): Promise<number> {
  return prisma.usageLog.count({
    where: { userId, action: 'ai_enhance', createdAt: { gte: since } },
  })
}

export async function checkAiQuota(
  userId: string,
  action: AiAction,
  requestedCost: number,
): Promise<AiQuotaCheck> {
  const since = startOfCurrentMonth()
  const bucket = bucketFor(action)
  const plan = await getUserPlan(userId)

  if (bucket === 'questions') {
    const [used, bonusCredits] = await Promise.all([
      countQuestions(userId, since),
      getBonusCredits(userId, 'questions'),
    ])
    const baseLimit = PLAN_LIMITS[plan].maxAiQuestions
    const limit = baseLimit === Infinity ? Infinity : baseLimit + bonusCredits
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
    const allowed = limit === Infinity || used + requestedCost <= limit
    return { allowed, plan, bucket, used, limit, bonusCredits, remaining }
  }

  // Enhancements bucket also honours admin-granted bonus credits now.
  const [used, bonusCredits] = await Promise.all([
    countEnhancements(userId, since),
    getBonusCredits(userId, 'enhancements'),
  ])
  const baseLimit = PLAN_LIMITS[plan].maxAiEnhancements ?? Infinity
  const limit = baseLimit === Infinity ? Infinity : baseLimit + bonusCredits
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
  const allowed = limit === Infinity || used + requestedCost <= limit
  return { allowed, plan, bucket, used, limit, bonusCredits, remaining }
}

export async function logAiUsage(
  userId: string,
  action: AiAction,
  metadata: Record<string, unknown>,
): Promise<void> {
  // Typed columns mirror the metadata fields the quota library depends on,
  // so a future caller that forgets to populate metadata.questionCount
  // can't quietly under-bill the user. The JSON column keeps the rest
  // (mode, difficulty, extractionSource, etc.) for ad-hoc analytics.
  const rawCount = metadata?.questionCount
  const questionCount = typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount > 0
    ? Math.floor(rawCount)
    : (action === 'ai_enhance' ? 0 : 5) // ai_enhance is per-call; questions default to 5
  const rawModel = metadata?.model
  const model = typeof rawModel === 'string' && rawModel.length > 0 ? rawModel.slice(0, 200) : null

  await prisma.usageLog
    .create({
      data: {
        userId,
        action,
        questionCount,
        model,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })
    .catch(err => console.error('[usage-log] failed to record:', err instanceof Error ? err.message : err))
}

export async function getAiUsageSummary(userId: string): Promise<AiUsageSummary> {
  const since = startOfCurrentMonth()
  const [plan, questionsUsed, enhancementsUsed, questionsBonus, enhancementsBonus] = await Promise.all([
    getUserPlan(userId),
    countQuestions(userId, since),
    countEnhancements(userId, since),
    getBonusCredits(userId, 'questions'),
    getBonusCredits(userId, 'enhancements'),
  ])

  const baseQuestionLimit = PLAN_LIMITS[plan].maxAiQuestions
  const questionLimit = baseQuestionLimit === Infinity ? Infinity : baseQuestionLimit + questionsBonus
  const baseEnhancementLimit = PLAN_LIMITS[plan].maxAiEnhancements ?? Infinity
  const enhancementLimit = baseEnhancementLimit === Infinity ? Infinity : baseEnhancementLimit + enhancementsBonus

  return {
    plan,
    questions: { used: questionsUsed, limit: questionLimit, bonusCredits: questionsBonus },
    enhancements: { used: enhancementsUsed, limit: enhancementLimit, bonusCredits: enhancementsBonus },
  }
}
