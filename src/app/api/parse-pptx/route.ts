export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimitRequest, rateLimitResponse } from '@/lib/rate-limit'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import JSZip from 'jszip'
import {
  type MappedSlide,
  type PythonSlideOutput,
  isAllowedDeckFilename,
  pickPresentationTitle,
  toBulletsFallback,
} from '@/lib/parse-pptx-helpers'

const execFileAsync = promisify(execFile)

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_SLIDES = 50

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

// ─── Fast pre-flight: count slides from the PPTX zip ───────────────────────
//
// PPTX is a zip file with one XML per slide at `ppt/slides/slide<N>.xml`.
// Counting those entries is O(50ms) for a 20MB file — vs the 30-150s it
// takes LibreOffice to render the full deck. We run this BEFORE the Python
// subprocess so users hitting MAX_SLIDES get rejected immediately instead of
// waiting minutes only to be told the file was too big.
async function countSlidesQuick(buffer: Buffer): Promise<number> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    let n = 0
    zip.forEach((relPath) => {
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(relPath)) n++
    })
    return n
  } catch {
    // If zip parsing fails, fall through to Python — it'll surface a better
    // error (invalid pptx, corrupted file, etc.)
    return -1
  }
}

// ─── Python subprocess ──────────────────────────────────────────────────────

interface ProcessedPptx {
  slides: PythonSlideOutput[]
  tmpDir: string
}

async function processPptx(buffer: Buffer, originalName: string): Promise<ProcessedPptx> {
  const uuid = crypto.randomUUID()
  const tmpDir = path.join(tmpdir(), `pptx-${uuid}`)
  const ext = originalName.toLowerCase().endsWith('.pdf') ? '.pdf' : '.pptx'
  const tmpPath = path.join(tmpDir, `input${ext}`)

  const { mkdir } = await import('fs/promises')
  await mkdir(tmpDir, { recursive: true })
  await writeFile(tmpPath, buffer)

  console.log('[parse-pptx] Running Python script with 300s timeout...')
  const { stdout, stderr } = await execFileAsync('python3', [
    path.join(process.cwd(), 'scripts/parse_pptx.py'), tmpPath, tmpDir
  ], { timeout: 300000, maxBuffer: 10 * 1024 * 1024 })
  console.log('[parse-pptx] Python stdout length:', stdout.length, 'stderr:', stderr || '(none)')

  if (!stdout.trim()) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    throw new Error(stderr || 'Python script produced no output')
  }

  return { slides: JSON.parse(stdout), tmpDir }
}

// ─── API handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimitRequest(req, {
    bucket: 'parse-pptx',
    userId: user.id,
    userLimit: 10,
    ipLimit: 15,
    windowMs: 60_000,
  })
  if (!rl.ok) return rateLimitResponse(rl)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  const name = file.name.toLowerCase()
  const isPdf = name.endsWith('.pdf')
  if (!isAllowedDeckFilename(name)) {
    return NextResponse.json(
      { success: false, error: 'Invalid file type. Only .pptx and .pdf files are supported.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File too large. Maximum size is 20MB.' },
      { status: 400 }
    )
  }

  let tmpDir: string | undefined
  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // Fast pre-check for PPTX only — reject oversized decks before running
    // LibreOffice so users don't wait minutes only to learn the file is too big.
    // PDF page count is determined by the Python script after rendering.
    if (!isPdf) {
      const quickCount = await countSlidesQuick(buffer)
      if (quickCount > MAX_SLIDES) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many slides (${quickCount}). Maximum is ${MAX_SLIDES}. Please split your presentation into smaller decks and try again.`,
          },
          { status: 400 }
        )
      }
      if (quickCount === 0) {
        return NextResponse.json(
          { success: false, error: 'No slides found in the presentation.' },
          { status: 400 }
        )
      }
    }

    const result = await processPptx(buffer, name)
    const pySlides = result.slides
    tmpDir = result.tmpDir

    // Safety net — if the quick count disagreed with python-pptx (unusual),
    // honour the authoritative python count.
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

    // Get presentation title from first slide with a title.
    // Defensive truncation in case Python returned a long mashed title anyway.
    const presTitle = pickPresentationTitle(pySlides, file.name)

    // Upload slide images to R2 in batches
    const BATCH_SIZE = 5
    const mappedSlides: MappedSlide[] = []

    for (let i = 0; i < pySlides.length; i += BATCH_SIZE) {
      const batch = pySlides.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (slide): Promise<MappedSlide> => {
          // LibreOffice rendering pipeline failed for this slide — keep it
          // anyway as a bullets slide so the user doesn't silently lose it.
          if (!slide.imagePath) {
            console.warn(`[parse-pptx] Slide ${slide.index} has no rendered image, using text fallback`)
            return toBulletsFallback(slide)
          }

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
          } catch (uploadErr) {
            console.error(`[parse-pptx] Slide ${slide.index} R2 upload failed, using text fallback:`, uploadErr)
            return toBulletsFallback(slide)
          }
        })
      )

      for (const r of results) {
        mappedSlides.push(r)
      }
    }

    if (mappedSlides.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No slides found in the presentation.' },
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
  } finally {
    // Clean up temp directory after images have been read and uploaded
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
