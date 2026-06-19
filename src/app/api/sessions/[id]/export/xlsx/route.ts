export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import ExcelJS from 'exceljs'

// GET /api/sessions/[id]/export/xlsx — detailed XLSX session report (Pro only)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const plan = await getUserPlan(user.id)

    if (plan !== 'pro') {
      return NextResponse.json({ error: 'XLSX export is not enabled on your account. Email info@quizotic.live if you need it — we review every request.' }, { status: 403 })
    }

    const { id } = await params
    const session = await prisma.gameSession.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const results = session.results as Record<string, unknown> | null
    if (!results) {
      return NextResponse.json({ error: 'No results available for this session' }, { status: 404 })
    }

    const quizTitle = (results.quizTitle as string) || 'Quiz Session'
    const questionCount = (results.questionCount as number) || 0
    const duration = (results.duration as number) || 0
    const questionStats = (results.questionStats as Array<Record<string, unknown>>) || []
    const leaderboard = (results.leaderboard as Array<Record<string, unknown>>) || []

    const attendees = await prisma.attendee.findMany({
      where: { sessionId: id },
      orderBy: { joinedAt: 'asc' },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Quizotic'
    wb.created = session.createdAt

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    const summarySheet = wb.addWorksheet('Summary')
    summarySheet.columns = [
      { width: 25 },
      { width: 35 },
    ]

    const titleRow = summarySheet.addRow(['Session Report'])
    titleRow.getCell(1).font = { bold: true, size: 16 }
    summarySheet.addRow([])

    const summaryData = [
      ['Quiz Title', quizTitle],
      ['Date', session.createdAt.toISOString().split('T')[0]],
      ['Participants', session.participantCount ?? 0],
      ['Questions', questionCount],
      ['Duration (seconds)', duration],
    ]
    for (const [label, value] of summaryData) {
      const row = summarySheet.addRow([label, value])
      row.getCell(1).font = { bold: true }
    }

    // ── Sheet 2: Leaderboard ──────────────────────────────────────────────────
    if (leaderboard.length > 0) {
      const lbSheet = wb.addWorksheet('Leaderboard')
      const hRow = lbSheet.addRow(['Rank', 'Name', 'Score', 'Team'])
      hRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B3D' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      })
      lbSheet.columns = [
        { key: 'rank', width: 8 },
        { key: 'name', width: 28 },
        { key: 'score', width: 14 },
        { key: 'team', width: 20 },
      ]
      leaderboard.forEach((entry, i) => {
        const row = lbSheet.addRow([
          i + 1,
          (entry.name as string) || 'Anonymous',
          (entry.score as number) ?? 0,
          (entry.team as Record<string, unknown>)?.name as string || '',
        ])
        if (i < 3) {
          const medal = ['FFFFD700', 'FFC0C0C0', 'FFCD7F32'][i]
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medal } }
        }
      })
    }

    // ── Sheet 3: Question Stats ───────────────────────────────────────────────
    if (questionStats.length > 0) {
      const qSheet = wb.addWorksheet('Question Stats')
      const hRow = qSheet.addRow(['Q#', 'Question', 'Correct %', "Bloom's Level", 'Explanation'])
      hRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBD13B' } }
        cell.font = { bold: true, color: { argb: 'FF0D0D0D' } }
      })
      qSheet.columns = [
        { key: 'q', width: 6 },
        { key: 'text', width: 50 },
        { key: 'pct', width: 14 },
        { key: 'blooms', width: 16 },
        { key: 'explanation', width: 50 },
      ]
      for (const stat of questionStats) {
        const correctPct = stat.correctPct as number | null
        qSheet.addRow([
          ((stat.index as number) ?? 0) + 1,
          (stat.text as string) || '',
          correctPct != null ? `${correctPct}%` : 'N/A',
          (stat.bloomsLevel as string) || '',
          (stat.explanation as string) || '',
        ])
      }
    }

    // ── Sheet 4: Attendance ───────────────────────────────────────────────────
    if (attendees.length > 0) {
      const attSheet = wb.addWorksheet('Attendance')
      const hRow = attSheet.addRow(['Nickname', 'Email', 'Joined At', 'Left At', 'Duration (sec)', 'Final Score', 'Team'])
      hRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B3D' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      })
      attSheet.columns = [
        { key: 'nickname', width: 24 },
        { key: 'email', width: 30 },
        { key: 'joinedAt', width: 22 },
        { key: 'leftAt', width: 22 },
        { key: 'duration', width: 16 },
        { key: 'finalScore', width: 14 },
        { key: 'team', width: 18 },
      ]
      for (const a of attendees) {
        attSheet.addRow([
          a.nickname ?? '',
          a.email ?? '',
          a.joinedAt ? a.joinedAt.toISOString() : '',
          a.leftAt ? a.leftAt.toISOString() : '',
          a.durationSec ?? '',
          a.finalScore ?? '',
          a.team ?? '',
        ])
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `quizotic-${quizTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${session.createdAt.toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
