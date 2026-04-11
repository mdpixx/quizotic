export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth-helpers'
import { parsePptx, type ParsedSlide } from '@/lib/pptx-parser'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_SLIDES = 50

// ─── Types ───────────────────────────────────────────────────────────────────

interface MappedSlide {
  suggestedType: 'title' | 'bullets' | 'image'
  title?: string
  subheading?: string
  bullets?: string[]
  imageUrl?: string
  contentImageUrl?: string
  caption?: string
  speakerNotes?: string
  originalIndex: number
  warnings?: string[]
}

// ─── R2 upload helper ────────────────────────────────────────────────────────

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
  filename: string
): Promise<string> {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1]
  const uuid = crypto.randomUUID()
  const key = `images/${userId}/${yearMonth}/pptx-${uuid}.${ext}`

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

// ─── Slide mapping ───────────────────────────────────────────────────────────

async function mapSlide(slide: ParsedSlide, userId: string): Promise<MappedSlide | null> {
  const warnings: string[] = []

  // Upload the first image (if any) to R2
  let imageUrl: string | undefined
  if (slide.images.length > 0) {
    const img = slide.images[0]
    imageUrl = await uploadToR2(img.data, img.contentType, userId, img.filename)
  }

  // Warnings for non-extractable content
  if (slide.hasChart) {
    warnings.push('Chart detected — converted to text summary')
  }

  const hasText = (slide.title && slide.title.length > 0) || slide.bodyText.length > 0
  const isBlank = !hasText && !imageUrl

  if (isBlank) return null // skip blank slides

  // Determine slide type
  const hasBody = slide.bodyText.length > 0
  const isImageDominant = imageUrl && !hasBody && (!slide.title || slide.title.length < 20)

  if (isImageDominant) {
    return {
      suggestedType: 'image',
      imageUrl,
      caption: slide.title || '',
      speakerNotes: slide.speakerNotes,
      originalIndex: slide.index,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  if (!hasBody && slide.title) {
    // Title-only slide — could be a section divider
    // Split title into heading + subheading if it has multiple sentences
    const parts = slide.title.split(/[.!?]\s+/)
    return {
      suggestedType: 'title',
      title: parts[0],
      subheading: parts.length > 1 ? parts.slice(1).join('. ') : '',
      speakerNotes: slide.speakerNotes,
      originalIndex: slide.index,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  // Default: bullets slide
  return {
    suggestedType: 'bullets',
    title: slide.title,
    bullets: slide.bodyText,
    contentImageUrl: imageUrl, // attach image alongside text if both exist
    speakerNotes: slide.speakerNotes,
    originalIndex: slide.index,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

// ─── API handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Parse multipart form data
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  const name = file.name.toLowerCase()
  if (!name.endsWith('.pptx')) {
    return NextResponse.json(
      { success: false, error: 'Invalid file type. Only .pptx files are supported.' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File too large. Maximum size is 20MB.' },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parsePptx(buffer)

    // Validate slide count
    if (parsed.slides.length > MAX_SLIDES) {
      return NextResponse.json(
        { success: false, error: `Too many slides (${parsed.slides.length}). Maximum is ${MAX_SLIDES}.` },
        { status: 400 }
      )
    }

    if (parsed.slides.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No slides found in the presentation.' },
        { status: 400 }
      )
    }

    // Map all slides (upload images in parallel, batched to avoid overwhelming R2)
    const BATCH_SIZE = 5
    const mappedSlides: MappedSlide[] = []

    for (let i = 0; i < parsed.slides.length; i += BATCH_SIZE) {
      const batch = parsed.slides.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(batch.map(s => mapSlide(s, user.id)))
      for (const result of results) {
        if (result) mappedSlides.push(result)
      }
    }

    return NextResponse.json({
      success: true,
      slides: mappedSlides,
      title: parsed.title,
    })
  } catch (err) {
    console.error('PPTX parse error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to parse PPTX file. The file may be corrupted or in an unsupported format.' },
      { status: 500 }
    )
  }
}
