import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

interface Reflection {
  participantName: string
  questionIndex: number
  confidenceLevel: 'low' | 'medium' | 'high'
  revisitNote: string
  submittedAt: string
}

interface SessionResults {
  leaderboard?: unknown[]
  questionStats?: unknown[]
  reflections?: Reflection[]
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { gameCode, participantName, questionIndex, confidenceLevel, revisitNote } = body

    if (!gameCode || !participantName || questionIndex === undefined || !confidenceLevel) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (!['low', 'medium', 'high'].includes(confidenceLevel)) {
      return NextResponse.json({ success: false, error: 'Invalid confidence level' }, { status: 400 })
    }

    const session = await prisma.gameSession.findUnique({
      where: { code: gameCode.toUpperCase() },
    })

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const results = (session.results as SessionResults) ?? {}
    const reflections: Reflection[] = results.reflections ?? []

    const newReflection: Reflection = {
      participantName: String(participantName).slice(0, 40),
      questionIndex: Number(questionIndex),
      confidenceLevel,
      revisitNote: String(revisitNote ?? '').slice(0, 300),
      submittedAt: new Date().toISOString(),
    }

    reflections.push(newReflection)

    await prisma.gameSession.update({
      where: { code: gameCode.toUpperCase() },
      data: { results: { ...results, reflections } as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authSession = await auth()
    if (!authSession?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const gameCode = searchParams.get('gameCode')

    if (!gameCode) {
      return NextResponse.json({ success: false, error: 'gameCode required' }, { status: 400 })
    }

    const session = await prisma.gameSession.findUnique({
      where: { code: gameCode.toUpperCase() },
    })

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    // Verify the session belongs to this user
    if (session.userId !== authSession.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const results = (session.results as SessionResults) ?? {}
    const reflections: Reflection[] = results.reflections ?? []

    const count = reflections.length

    // Count by confidence level
    const confDist = { low: 0, medium: 0, high: 0 }
    for (const r of reflections) {
      confDist[r.confidenceLevel] = (confDist[r.confidenceLevel] ?? 0) + 1
    }

    // Top questions by mention count
    const qMap = new Map<number, number>()
    for (const r of reflections) {
      qMap.set(r.questionIndex, (qMap.get(r.questionIndex) ?? 0) + 1)
    }
    const topQuestions = [...qMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([index, mentions]) => ({ index, mentions }))

    // Revisit notes (non-empty)
    const revisitNotes = reflections
      .filter(r => r.revisitNote.trim())
      .slice(-20)
      .map(r => ({ participantName: r.participantName, note: r.revisitNote }))

    return NextResponse.json({
      success: true,
      data: { count, confDist, topQuestions, revisitNotes },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
