export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth-helpers'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_SLIDES = 50

// ─── Python output types ────────────────────────────────────────────────────

interface PythonSlideOutput {
  index: number
  title: string | null
  subtitle: string | null
  bodyText: string
  speakerNotes: string | null
  fullText: string
  layoutName: string
  imagePath: string | null
}

// ─── Mapped slide output ────────────────────────────────────────────────────

interface MappedSlide {
  suggestedType: 'image'
  imageUrl: string
  caption: string
  aiContext?: string // hidden text for AI enhancement
  originalIndex: number
}

// ─── R2 upload helper ───────────────────────────────────────────────────────

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

async function uploadToR2(
  data: Buffer,
  contentType: string,
  userId: string,
): Promise<string> {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const uuid = crypto.randomUUID()
  const key = `images/${userId}/${yearMonth}/pptx-${uuid}.png`

  const r2 = getR2Client()
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME ?? 'quizotic-uploads',
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  return `${process.env.R2_PUBLIC_URL}/${key}`
}

// ─── Python subprocess ──────────────────────────────────────────────────────

async function processPptx(buffer: Buffer): Promise<PythonSlideOutput[]> {
  const uuid = crypto.randomUUID()
  const tmpDir = path.join(tmpdir(), `pptx-${uuid}`)
  const tmpPath = path.join(tmpDir, 'input.pptx')

  try {
    // Create temp directory and write file
    const { mkdir } = await import('fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(tmpPath, buffer)

    const { stdout, stderr } = await execFileAsync('python3', [
      path.join(process.cwd(), 'scripts/parse_pptx.py'), tmpPath, tmpDir
    ], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 })

    if (!stdout.trim()) {
      throw new Error(stderr || 'Python script produced no output')
    }

    return JSON.parse(stdout)
  } finally {
    // Clean up temp directory
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
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
  if (!name.endsWith('.pptx')) {
    return NextResponse.json(
      { success: false, error: 'Invalid file type. Only .pptx files are supported.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File too large. Maximum size is 20MB.' },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const pySlides = await processPptx(buffer)

    if (pySlides.length > MAX_SLIDES) {
      return NextResponse.json(
        { success: false, error: `Too many slides (${pySlides.length}). Maximum is ${MAX_SLIDES}.` },
        { status: 400 }
      )
    }

    if (pySlides.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No slides found in the presentation.' },
        { status: 400 }
      )
    }

    // Get presentation title from first slide with a title
    let presTitle: string | undefined
    for (const s of pySlides) {
      if (s.title && s.title.length > 0) {
        presTitle = s.title
        break
      }
    }

    // Upload slide images to R2 in batches
    const BATCH_SIZE = 5
    const mappedSlides: MappedSlide[] = []

    for (let i = 0; i < pySlides.length; i += BATCH_SIZE) {
      const batch = pySlides.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (slide): Promise<MappedSlide | null> => {
          if (!slide.imagePath) return null

          try {
            const imageData = await readFile(slide.imagePath)
            const imageUrl = await uploadToR2(imageData, 'image/png', user.id)

            return {
              suggestedType: 'image',
              imageUrl,
              caption: slide.title || `Slide ${slide.index + 1}`,
              aiContext: slide.fullText || undefined,
              originalIndex: slide.index,
            }
          } catch {
            return null
          }
        })
      )

      for (const result of results) {
        if (result) mappedSlides.push(result)
      }
    }

    if (mappedSlides.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not render slides. The file may be corrupted.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      slides: mappedSlides,
      title: presTitle,
    })
  } catch (err) {
    console.error('PPTX parse error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to process PPTX file. The file may be corrupted or in an unsupported format.' },
      { status: 500 }
    )
  }
}
