export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_PAGES = 50

// ─── Python output types ────────────────────────────────────────────────────

interface PdfPage {
  index: number
  text: string
  title: string | null
  bodyLines: string[]
  hasImages: boolean
}

// ─── Python subprocess ──────────────────────────────────────────────────────

async function parsePdfWithPython(buffer: Buffer): Promise<PdfPage[]> {
  const tmpPath = path.join(tmpdir(), `pdf-${crypto.randomUUID()}.pdf`)
  try {
    await writeFile(tmpPath, buffer)
    const { stdout } = await execFileAsync('python3', [
      path.join(process.cwd(), 'scripts/parse_pdf.py'), tmpPath
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
    return JSON.parse(stdout)
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}

// ─── API handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  const name = file.name.toLowerCase()
  if (!name.endsWith('.pdf')) {
    return NextResponse.json(
      { success: false, error: 'Invalid file type. Only .pdf files are supported.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File too large. Maximum size is 10MB.' },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const pages = await parsePdfWithPython(buffer)

    if (pages.length > MAX_PAGES) {
      return NextResponse.json(
        { success: false, error: `Too many pages (${pages.length}). Maximum is ${MAX_PAGES}.` },
        { status: 400 }
      )
    }

    // Check if we got meaningful text
    const totalText = pages.reduce((sum, p) => sum + p.text.length, 0)
    const hasText = totalText > 50

    return NextResponse.json({
      success: true,
      pages,
      hasText,
      totalPages: pages.length,
    })
  } catch (err) {
    console.error('PDF parse error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to parse PDF. The file may be corrupted or image-only.' },
      { status: 500 }
    )
  }
}
