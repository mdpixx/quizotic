export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { apiError, unauthorizedApiKey } from '@/lib/public-api'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/quizzes/:id — fetch one owned quiz.
export async function GET(req: NextRequest, { params }: Params) {
  const user = await authenticateApiKey(req)
  if (!user) return unauthorizedApiKey()

  const rl = await rateLimitRequest(req, {
    bucket: 'v1-quiz-detail',
    userId: user.id,
    userLimit: 120,
    ipLimit: 240,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const { id } = await params
  const quiz = await prisma.quiz.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      subject: true,
      language: true,
      theme: true,
      questions: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!quiz) return apiError('not_found', 'Quiz not found', 404)
  return NextResponse.json({ data: quiz })
}
