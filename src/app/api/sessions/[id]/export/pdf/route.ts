export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// GET /api/sessions/[id]/export/pdf — printable session report (Pro only)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const plan = await getUserPlan(user.id)

    if (plan !== 'pro') {
      return NextResponse.json({ error: 'PDF export is not enabled on your account. Email info@quizotic.live if you need it — we review every request.' }, { status: 403 })
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

    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const navy = rgb(0.06, 0.11, 0.24)     // #0F1B3D
    const yellow = rgb(0.96, 0.9, 0.26)    // #F5E642
    const gray = rgb(0.55, 0.55, 0.6)
    const white = rgb(1, 1, 1)
    const green = rgb(0.09, 0.64, 0.24)

    const pageW = 595.28   // A4 width
    const pageH = 841.89   // A4 height
    const margin = 48
    const colW = pageW - margin * 2

    function newPage() {
      const p = pdfDoc.addPage([pageW, pageH])
      // Navy header band
      p.drawRectangle({ x: 0, y: pageH - 52, width: pageW, height: 52, color: navy })
      p.drawText('Quizotic', { x: margin, y: pageH - 35, size: 18, font: helveticaBold, color: yellow })
      p.drawText('Session Report', { x: margin + 90, y: pageH - 35, size: 14, font: helvetica, color: white })
      // Footer
      p.drawText('quizotic.live', {
        x: pageW - margin - 60, y: 18, size: 9, font: helvetica, color: gray,
      })
      return { page: p, y: pageH - 72 }
    }

    function ensureSpace(currentY: number, needed: number, ctx: { page: ReturnType<typeof pdfDoc.addPage>, y: number }) {
      if (currentY - needed < margin) {
        const { page, y } = newPage()
        ctx.page = page
        ctx.y = y
      }
    }

    const ctx = newPage()

    // ── Title block ───────────────────────────────────────────────────────────
    ctx.page.drawText(quizTitle, { x: margin, y: ctx.y, size: 20, font: helveticaBold, color: navy, maxWidth: colW })
    ctx.y -= 28
    const dateStr = session.createdAt.toISOString().split('T')[0]
    ctx.page.drawText(`${dateStr}  ·  ${session.participantCount ?? 0} participants  ·  ${questionCount} questions  ·  ${Math.round(duration / 60)} min`, {
      x: margin, y: ctx.y, size: 11, font: helvetica, color: gray,
    })
    ctx.y -= 24

    // Divider
    ctx.page.drawLine({ start: { x: margin, y: ctx.y }, end: { x: pageW - margin, y: ctx.y }, thickness: 1, color: rgb(0.87, 0.87, 0.90) })
    ctx.y -= 20

    // ── Leaderboard section ───────────────────────────────────────────────────
    if (leaderboard.length > 0) {
      ctx.page.drawText('Leaderboard', { x: margin, y: ctx.y, size: 14, font: helveticaBold, color: navy })
      ctx.y -= 20

      const topN = leaderboard.slice(0, 10)
      for (let i = 0; i < topN.length; i++) {
        ensureSpace(ctx.y, 22, ctx)
        const entry = topN[i]
        const name = (entry.name as string) || 'Anonymous'
        const score = (entry.score as number) ?? 0
        const medalColors: ReturnType<typeof rgb>[] = [rgb(1, 0.84, 0), rgb(0.75, 0.75, 0.75), rgb(0.8, 0.5, 0.2)]
        const rowColor = i < 3 ? medalColors[i] : rgb(0.96, 0.96, 0.98)

        ctx.page.drawRectangle({ x: margin, y: ctx.y - 14, width: colW, height: 20, color: rowColor })
        ctx.page.drawText(String(i + 1), { x: margin + 6, y: ctx.y - 10, size: 10, font: helveticaBold, color: navy })
        ctx.page.drawText(name.slice(0, 40), { x: margin + 28, y: ctx.y - 10, size: 10, font: helvetica, color: navy })
        ctx.page.drawText(String(score), { x: pageW - margin - 50, y: ctx.y - 10, size: 10, font: helveticaBold, color: navy })
        ctx.y -= 22
      }
      ctx.y -= 8
    }

    // ── Question stats section ────────────────────────────────────────────────
    if (questionStats.length > 0) {
      ensureSpace(ctx.y, 40, ctx)
      ctx.page.drawText('Question Stats', { x: margin, y: ctx.y, size: 14, font: helveticaBold, color: navy })
      ctx.y -= 20

      for (const stat of questionStats) {
        ensureSpace(ctx.y, 50, ctx)
        const qNum = ((stat.index as number) ?? 0) + 1
        const text = ((stat.text as string) || '').slice(0, 80)
        const correctPct = stat.correctPct as number | null
        const blooms = (stat.bloomsLevel as string) || ''

        ctx.page.drawText(`Q${qNum}.`, { x: margin, y: ctx.y, size: 10, font: helveticaBold, color: navy })
        ctx.page.drawText(text, { x: margin + 28, y: ctx.y, size: 10, font: helvetica, color: navy, maxWidth: colW - 100 })
        ctx.y -= 16

        const pctColor = correctPct != null && correctPct >= 60 ? green : correctPct != null && correctPct < 40 ? rgb(0.85, 0.15, 0.15) : gray
        const pctText = correctPct != null ? `${correctPct}% correct` : 'Non-scored'
        ctx.page.drawText(pctText, { x: margin + 28, y: ctx.y, size: 9, font: helveticaBold, color: pctColor })
        if (blooms) {
          ctx.page.drawText(`Bloom's: ${blooms}`, { x: margin + 130, y: ctx.y, size: 9, font: helvetica, color: gray })
        }

        // Bar chart for correct %
        if (correctPct != null) {
          const barW = Math.round((correctPct / 100) * 120)
          ctx.page.drawRectangle({ x: margin + 28, y: ctx.y - 12, width: 120, height: 6, color: rgb(0.9, 0.9, 0.93) })
          if (barW > 0) {
            ctx.page.drawRectangle({ x: margin + 28, y: ctx.y - 12, width: barW, height: 6, color: pctColor })
          }
        }

        ctx.y -= 28
      }
    }

    const pdfBytes = await pdfDoc.save()
    const filename = `quizotic-${quizTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${session.createdAt.toISOString().split('T')[0]}.pdf`

    return new NextResponse(pdfBytes as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
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
