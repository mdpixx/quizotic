export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { getGoogleSheetsToken, createGoogleSheet } from '@/lib/google-sheets'

// POST /api/sessions/[id]/export/sheets
// Push session results to a new Google Sheet. Returns the sheet URL.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()

    const accessToken = await getGoogleSheetsToken(user.id)
    if (!accessToken) {
      return NextResponse.json({
        error: 'google_sheets_not_connected',
        message: 'Please sign out and sign back in with Google to enable Sheets export.',
      }, { status: 403 })
    }

    const { id } = await params
    const session = await prisma.gameSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const results = session.results as Record<string, unknown> | null
    const quizTitle = (results?.quizTitle as string) || 'Quiz Session'
    const leaderboard = (results?.leaderboard as Array<Record<string, unknown>>) || []
    const questionStats = (results?.questionStats as Array<Record<string, unknown>>) || []

    const attendees = await prisma.attendee.findMany({
      where: { sessionId: id },
      orderBy: { joinedAt: 'asc' },
    })

    const sheetTitle = `${quizTitle} — ${session.createdAt.toISOString().split('T')[0]}`

    // Summary sheet
    const summaryRows: (string | number)[][] = [
      ['Quiz Title', quizTitle],
      ['Date', session.createdAt.toISOString().split('T')[0]],
      ['Participants', session.participantCount ?? 0],
      ['Questions', (results?.questionCount as number) ?? 0],
      ['Duration (s)', (results?.duration as number) ?? 0],
    ]

    // Leaderboard sheet
    const lbRows: (string | number)[][] = [['Rank', 'Name', 'Score', 'Team']]
    leaderboard.forEach((e, i) => {
      lbRows.push([
        i + 1,
        (e.name as string) || 'Anonymous',
        (e.score as number) ?? 0,
        (e.team as Record<string, unknown>)?.name as string || '',
      ])
    })

    // Question stats sheet
    const qRows: (string | number)[][] = [["Q#", "Question", "Correct %", "Bloom's Level", "Explanation"]]
    questionStats.forEach(s => {
      const correctPct = s.correctPct as number | null
      qRows.push([
        ((s.index as number) ?? 0) + 1,
        (s.text as string) || '',
        correctPct != null ? `${correctPct}%` : 'N/A',
        (s.bloomsLevel as string) || '',
        (s.explanation as string) || '',
      ])
    })

    // Attendance sheet
    const attRows: (string | number)[][] = [['Nickname', 'Email', 'Joined At', 'Duration (s)', 'Final Score', 'Team']]
    attendees.forEach(a => {
      attRows.push([
        a.nickname ?? '',
        a.email ?? '',
        a.joinedAt ? a.joinedAt.toISOString() : '',
        a.durationSec ?? '',
        a.finalScore ?? '',
        a.team ?? '',
      ])
    })

    const url = await createGoogleSheet(accessToken, sheetTitle, [
      { sheetTitle: 'Summary', rows: summaryRows },
      { sheetTitle: 'Leaderboard', rows: lbRows },
      { sheetTitle: 'Question Stats', rows: qRows },
      { sheetTitle: 'Attendance', rows: attRows },
    ])

    return NextResponse.json({ success: true, url })
  } catch (err) {
    if (err instanceof Error && err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Export failed', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
