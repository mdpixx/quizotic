export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/billing'
import { ReportDataError, buildSessionWorkbookData } from '@/lib/report-data'
import { XLSX_CONTENT_TYPE, buildSessionWorkbook, workbookFilename } from '@/lib/report-workbook'

// GET /api/sessions/[id]/export/xlsx — full session report workbook (Pro only).
// [id] accepts the session id or the six-digit room code: the host's end-of-
// session screen only knows the code, and an id-only lookup made that button
// 404 for every user.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const plan = await getUserPlan(user.id)

    if (plan !== 'pro') {
      return NextResponse.json({
        error: 'Excel export is not enabled on your account. Email info@quizotic.live if you need it — we review every request.',
      }, { status: 403 })
    }

    const { id } = await params
    const data = await buildSessionWorkbookData(id, user.id)
    const workbook = buildSessionWorkbook(data)
    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${workbookFilename(data.meta)}"`,
      },
    })
  } catch (err) {
    if (err instanceof ReportDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    // requireAuth() throws Error('Unauthorized'). The string this catch used to
    // compare against was 'Authentication required', which never matched — so a
    // signed-out request 500'd instead of 401'ing.
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
