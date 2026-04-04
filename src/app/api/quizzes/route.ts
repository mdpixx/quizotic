import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/quizzes — list all quizzes
export async function GET() {
  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, subject: true, language: true, questions: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ success: true, data: quizzes })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load quizzes' }, { status: 500 })
  }
}

// POST /api/quizzes — create or update a quiz
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, title, subject, language, questions } = body

    if (!title || !questions) {
      return NextResponse.json({ success: false, error: 'title and questions are required' }, { status: 400 })
    }

    const quiz = await prisma.quiz.upsert({
      where: { id: id ?? '' },
      update: { title, subject, language, questions },
      create: { id, title, subject, language, questions },
    })

    return NextResponse.json({ success: true, data: quiz })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save quiz' }, { status: 500 })
  }
}
