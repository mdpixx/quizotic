export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth-helpers'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import JSZip from 'jszip'

const execFileAsync = promisify(execFile)

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_SLIDES = 50

// ─── Python output types ────────────────────────────────────────────────────

interface PythonParagraph {
  text: string
  level: number
  bold: boolean
  fontSize: number | null
}

interface PythonSlide {
  index: number
  slideType: 'title' | 'section' | 'content' | 'image_dominant' | 'table' | 'blank'
  title: string | null
  subtitle: string | null
  bodyParagraphs: PythonParagraph[]
  tableData: string[][] | null
  speakerNotes: string | null
  imageCount: number
  hasChart: boolean
  hasSmartArt: boolean
  layoutName: string
}

// ─── Mapped slide output ────────────────────────────────────────────────────

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

// ─── Image extraction from ZIP ──────────────────────────────────────────────

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function isUploadableImage(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return ext in IMAGE_TYPES
}

function getImageContentType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return IMAGE_TYPES[ext] || 'image/png'
}

async function extractImagesFromZip(buffer: Buffer): Promise<Map<number, { data: Buffer; contentType: string }[]>> {
  const zip = await JSZip.loadAsync(buffer)
  const slideImages = new Map<number, { data: Buffer; contentType: string }[]>()

  // Parse presentation rels to get slide order
  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')
  if (!presRelsXml) return slideImages

  // Get slide filenames in order
  const slideFiles: string[] = []
  const presXml = await zip.file('ppt/presentation.xml')?.async('string')
  if (presXml) {
    // Extract rIds from slide list
    const sldIdRegex = /<p:sldId\s([^>]*?)\/?>/g
    let m: RegExpExecArray | null
    const rIds: string[] = []
    while ((m = sldIdRegex.exec(presXml)) !== null) {
      const rId = m[1].match(/r:id="([^"]+)"/)
      if (rId) rIds.push(rId[1])
    }

    // Map rIds to file paths
    const relRegex = /<Relationship\s([^>]*?)\/?>/g
    const rels = new Map<string, string>()
    let rm: RegExpExecArray | null
    while ((rm = relRegex.exec(presRelsXml)) !== null) {
      const id = rm[1].match(/Id="([^"]+)"/)
      const target = rm[1].match(/Target="([^"]+)"/)
      if (id && target) rels.set(id[1], target[1])
    }

    for (const rId of rIds) {
      const target = rels.get(rId)
      if (target) {
        const filePath = target.startsWith('/') ? target.slice(1) : `ppt/${target}`
        slideFiles.push(filePath)
      }
    }
  }

  // Fallback: enumerate ZIP entries
  if (slideFiles.length === 0) {
    const files = Object.keys(zip.files)
      .filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0')
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0')
        return na - nb
      })
    slideFiles.push(...files)
  }

  // For each slide, extract images via relationships
  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i]
    const slideXml = await zip.file(slidePath)?.async('string')
    if (!slideXml) continue

    const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/'))
    const slideFilename = slidePath.substring(slidePath.lastIndexOf('/') + 1)
    const relsPath = `${slideDir}/_rels/${slideFilename}.rels`
    const slideRelsXml = await zip.file(relsPath)?.async('string')
    if (!slideRelsXml) continue

    // Parse slide rels
    const relRegex = /<Relationship\s([^>]*?)\/?>/g
    const slideRels = new Map<string, { target: string; type: string }>()
    let rm: RegExpExecArray | null
    while ((rm = relRegex.exec(slideRelsXml)) !== null) {
      const id = rm[1].match(/Id="([^"]+)"/)
      const target = rm[1].match(/Target="([^"]+)"/)
      const type = rm[1].match(/Type="([^"]+)"/)
      if (id && target && type) {
        slideRels.set(id[1], { target: target[1], type: type[1] })
      }
    }

    // Find image rIds in slide XML
    const imageRIds: string[] = []
    const embedRegex = /r:embed="([^"]+)"/g
    let em: RegExpExecArray | null
    while ((em = embedRegex.exec(slideXml)) !== null) {
      imageRIds.push(em[1])
    }

    const images: { data: Buffer; contentType: string }[] = []
    const seen = new Set<string>()

    for (const rId of imageRIds) {
      const rel = slideRels.get(rId)
      if (!rel || !rel.type.includes('image')) continue

      const imgPath = rel.target.startsWith('/')
        ? rel.target.slice(1)
        : `${slideDir}/${rel.target}`.replace(/\/slides\/\.\.\//, '/')
      const normalizedPath = imgPath.replace(/[^/]+\/\.\.\//g, '')

      if (seen.has(normalizedPath)) continue
      seen.add(normalizedPath)

      const imgFilename = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1)
      if (!isUploadableImage(imgFilename)) continue

      const imgFile = zip.file(normalizedPath)
      if (!imgFile) continue

      const data = Buffer.from(await imgFile.async('uint8array'))
      const contentType = getImageContentType(imgFilename)
      images.push({ data, contentType })
    }

    if (images.length > 0) {
      slideImages.set(i, images)
    }
  }

  return slideImages
}

// ─── Python subprocess ──────────────────────────────────────────────────────

async function parsePptxWithPython(buffer: Buffer): Promise<PythonSlide[]> {
  const tmpPath = path.join(tmpdir(), `pptx-${crypto.randomUUID()}.pptx`)
  try {
    await writeFile(tmpPath, buffer)
    const { stdout } = await execFileAsync('python3', [
      path.join(process.cwd(), 'scripts/parse_pptx.py'), tmpPath
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
    return JSON.parse(stdout)
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}

// ─── Slide mapping ──────────────────────────────────────────────────────────

function formatTableAsBullets(tableData: string[][]): string[] {
  if (tableData.length === 0) return []
  const header = tableData[0]
  const lines: string[] = []

  if (tableData.length === 1) {
    // Single row — just join cells
    lines.push(header.join(' | '))
    return lines
  }

  // Header row as first bullet
  lines.push(header.join(' | '))
  // Data rows
  for (let r = 1; r < tableData.length; r++) {
    lines.push(tableData[r].join(' | '))
  }
  return lines
}

function formatBodyParagraphs(paragraphs: PythonParagraph[]): string[] {
  return paragraphs.map(p => {
    const indent = p.level > 0 ? '  '.repeat(p.level) : ''
    return `${indent}${p.text}`
  })
}

async function mapSlide(
  pySlide: PythonSlide,
  userId: string,
  slideImages: Map<number, { data: Buffer; contentType: string }[]>,
): Promise<MappedSlide | null> {
  const warnings: string[] = []
  const idx = pySlide.index

  // Upload first image if available
  let imageUrl: string | undefined
  const images = slideImages.get(idx)
  if (images && images.length > 0) {
    imageUrl = await uploadToR2(images[0].data, images[0].contentType, userId)
  }

  if (pySlide.hasChart) warnings.push('Chart detected — converted to text summary')
  if (pySlide.hasSmartArt) warnings.push('SmartArt detected — text extracted')

  // Skip blank slides
  if (pySlide.slideType === 'blank') return null

  const hasText = (pySlide.title && pySlide.title.length > 0) || pySlide.bodyParagraphs.length > 0
  if (!hasText && !imageUrl && !pySlide.tableData) return null

  // Map based on Python-detected slide type
  switch (pySlide.slideType) {
    case 'title':
    case 'section':
      return {
        suggestedType: 'title',
        title: pySlide.title || '',
        subheading: pySlide.subtitle || '',
        speakerNotes: pySlide.speakerNotes || undefined,
        originalIndex: idx,
        ...(imageUrl ? { contentImageUrl: imageUrl } : {}),
        warnings: warnings.length > 0 ? warnings : undefined,
      }

    case 'image_dominant':
      if (imageUrl) {
        return {
          suggestedType: 'image',
          imageUrl,
          caption: pySlide.title || '',
          speakerNotes: pySlide.speakerNotes || undefined,
          originalIndex: idx,
          warnings: warnings.length > 0 ? warnings : undefined,
        }
      }
      // Fallback to bullets if no image uploaded
      return {
        suggestedType: 'bullets',
        title: pySlide.title || '',
        bullets: formatBodyParagraphs(pySlide.bodyParagraphs),
        speakerNotes: pySlide.speakerNotes || undefined,
        originalIndex: idx,
        warnings: warnings.length > 0 ? warnings : undefined,
      }

    case 'table': {
      const tableBullets = pySlide.tableData ? formatTableAsBullets(pySlide.tableData) : []
      const bodyBullets = formatBodyParagraphs(pySlide.bodyParagraphs)
      return {
        suggestedType: 'bullets',
        title: pySlide.title || '',
        bullets: [...bodyBullets, ...(tableBullets.length > 0 ? ['[Table]', ...tableBullets] : [])],
        speakerNotes: pySlide.speakerNotes || undefined,
        originalIndex: idx,
        ...(imageUrl ? { contentImageUrl: imageUrl } : {}),
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    case 'content':
    default: {
      const bullets = formatBodyParagraphs(pySlide.bodyParagraphs)
      // If no body but has title only, make it a title slide
      if (bullets.length === 0 && pySlide.title) {
        return {
          suggestedType: 'title',
          title: pySlide.title,
          subheading: pySlide.subtitle || '',
          speakerNotes: pySlide.speakerNotes || undefined,
          originalIndex: idx,
          ...(imageUrl ? { contentImageUrl: imageUrl } : {}),
          warnings: warnings.length > 0 ? warnings : undefined,
        }
      }

      return {
        suggestedType: 'bullets',
        title: pySlide.title || '',
        bullets: bullets.length > 0 ? bullets : [''],
        contentImageUrl: imageUrl,
        speakerNotes: pySlide.speakerNotes || undefined,
        originalIndex: idx,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }
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

    // Parse structure with Python (text, hierarchy, metadata)
    const pySlides = await parsePptxWithPython(buffer)

    // Extract images from ZIP (Node.js — reuse existing R2 upload)
    const slideImages = await extractImagesFromZip(buffer)

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

    // Get presentation title from first title slide
    let presTitle: string | undefined
    const titleSlide = pySlides.find(s => s.slideType === 'title')
    if (titleSlide?.title) presTitle = titleSlide.title

    // Map slides (batch image uploads)
    const BATCH_SIZE = 5
    const mappedSlides: MappedSlide[] = []

    for (let i = 0; i < pySlides.length; i += BATCH_SIZE) {
      const batch = pySlides.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(s => mapSlide(s, user.id, slideImages))
      )
      for (const result of results) {
        if (result) mappedSlides.push(result)
      }
    }

    return NextResponse.json({
      success: true,
      slides: mappedSlides,
      title: presTitle,
    })
  } catch (err) {
    console.error('PPTX parse error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to parse PPTX file. The file may be corrupted or in an unsupported format.' },
      { status: 500 }
    )
  }
}
