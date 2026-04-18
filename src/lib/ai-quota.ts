import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserPlan, getReferralBonusCredits, type Plan } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/limits'

export type AiAction = 'ai_generate' | 'ai_translate' | 'ai_enhance'
export type AiBucket = 'questions' | 'enhancements'

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
  enhancements: { used: number; limit: number }
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
  const logs = await prisma.usageLog.findMany({
    where: { userId, action: { in: QUESTION_ACTIONS }, createdAt: { gte: since } },
    select: { metadata: true },
  })
  return logs.reduce((sum, log) => {
    const meta = log.metadata as Record<string, unknown> | null
    const count = meta?.questionCount
    return sum + (typeof count === 'number' ? count : DEFAULT_QUESTION_COST)
  }, 0)
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
      getReferralBonusCredits(userId),
    ])
    const baseLimit = PLAN_LIMITS[plan].maxAiQuestions
    const limit = baseLimit === Infinity ? Infinity : baseLimit + bonusCredits
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
    const allowed = limit === Infinity || used + requestedCost <= limit
    return { allowed, plan, bucket, used, limit, bonusCredits, remaining }
  }

  const used = await countEnhancements(userId, since)
  const limit = PLAN_LIMITS[plan].maxAiEnhancements ?? Infinity
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
  const allowed = limit === Infinity || used + requestedCost <= limit
  return { allowed, plan, bucket, used, limit, bonusCredits: 0, remaining }
}

export async function logAiUsage(
  userId: string,
  action: AiAction,
  metadata: Record<string, unknown>,
): Promise<void> {
  await prisma.usageLog
    .create({ data: { userId, action, metadata: metadata as Prisma.InputJsonValue } })
    .catch(err => console.error('[usage-log] failed to record:', err instanceof Error ? err.message : err))
}

export async function getAiUsageSummary(userId: string): Promise<AiUsageSummary> {
  const since = startOfCurrentMonth()
  const [plan, questionsUsed, enhancementsUsed, bonusCredits] = await Promise.all([
    getUserPlan(userId),
    countQuestions(userId, since),
    countEnhancements(userId, since),
    getReferralBonusCredits(userId),
  ])

  const baseQuestionLimit = PLAN_LIMITS[plan].maxAiQuestions
  const questionLimit = baseQuestionLimit === Infinity ? Infinity : baseQuestionLimit + bonusCredits
  const enhancementLimit = PLAN_LIMITS[plan].maxAiEnhancements ?? Infinity

  return {
    plan,
    questions: { used: questionsUsed, limit: questionLimit, bonusCredits },
    enhancements: { used: enhancementsUsed, limit: enhancementLimit },
  }
}
