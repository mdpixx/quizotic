import JSZip from 'jszip'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedImage {
  data: Buffer
  contentType: string
  filename: string
}

export interface ParsedSlide {
  index: number
  title?: string
  bodyText: string[]
  speakerNotes?: string
  images: ParsedImage[]
  hasTable: boolean
  tableText?: string       // flattened table content as readable text
  hasChart: boolean
}

export interface ParsedPresentation {
  slides: ParsedSlide[]
  title?: string
}

// ─── XML helpers ─────────────────────────────────────────────────────────────

/** Extract all text between <a:t>...</a:t> tags from an XML string */
function extractTextRuns(xml: string): string[] {
  const texts: string[] = []
  const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    const decoded = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
    texts.push(decoded)
  }
  return texts
}

/** Extract text grouped by paragraph <a:p> from a shape/text body */
function extractParagraphs(xml: string): string[] {
  const paragraphs: string[] = []
  const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g
  let m: RegExpExecArray | null
  while ((m = pRegex.exec(xml)) !== null) {
    const runs = extractTextRuns(m[1])
    const line = runs.join('').trim()
    if (line) paragraphs.push(line)
  }
  return paragraphs
}

/** Check if a shape is a title placeholder */
function isTitleShape(shapeXml: string): boolean {
  return /type="title"/i.test(shapeXml)
    || /type="ctrTitle"/i.test(shapeXml)
}

/** Check if a shape is a body/content placeholder */
function isBodyShape(shapeXml: string): boolean {
  return /type="body"/i.test(shapeXml)
    || /type="subTitle"/i.test(shapeXml)
    || /idx="1"/i.test(shapeXml)
}

/** Extract relationship IDs for images from a shape */
function extractImageRelIds(shapeXml: string): string[] {
  const ids: string[] = []
  // blipFill → blip r:embed="rIdX"
  const regex = /r:embed="(rId\d+)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(shapeXml)) !== null) {
    ids.push(m[1])
  }
  return ids
}

/** Extract table text from <a:tbl> element — rows × cells, flattened */
function extractTableText(tableXml: string): string {
  const rows: string[][] = []
  const rowRegex = /<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g
  let rm: RegExpExecArray | null
  while ((rm = rowRegex.exec(tableXml)) !== null) {
    const cells: string[] = []
    const cellRegex = /<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g
    let cm: RegExpExecArray | null
    while ((cm = cellRegex.exec(rm[1])) !== null) {
      const texts = extractTextRuns(cm[1])
      cells.push(texts.join(' ').trim())
    }
    rows.push(cells)
  }
  if (rows.length === 0) return ''
  // Format as readable text: "Header1 | Header2 \n Val1 | Val2"
  return rows.map(r => r.join(' | ')).join('\n')
}

/** Parse relationship file to build rId → target path map */
function parseRels(relsXml: string): Map<string, { target: string; type: string }> {
  const map = new Map<string, { target: string; type: string }>()
  // Match <Relationship ...> or <Relationship .../> — any attribute order
  const tagRegex = /<Relationship\s([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = tagRegex.exec(relsXml)) !== null) {
    const attrs = m[1]
    const id = attrs.match(/Id="([^"]+)"/)
    const target = attrs.match(/Target="([^"]+)"/)
    const type = attrs.match(/Type="([^"]+)"/)
    if (id && target && type) {
      map.set(id[1], { target: target[1], type: type[1] })
    }
  }
  return map
}

/** Get slide order from presentation.xml */
function getSlideOrder(presentationXml: string): string[] {
  const ids: string[] = []
  // Match <p:sldId ...> or <p:sldId .../> — both self-closing and non-self-closing
  const regex = /<p:sldId\s([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(presentationXml)) !== null) {
    const rId = m[1].match(/r:id="([^"]+)"/)
    if (rId) ids.push(rId[1])
  }
  return ids
}

// ─── Content type detection ──────────────────────────────────────────────────

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.emf': 'image/x-emf',
  '.wmf': 'image/x-wmf',
  '.svg': 'image/svg+xml',
}

function getImageContentType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return IMAGE_TYPES[ext] || 'image/png'
}

function isUploadableImage(contentType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export async function parsePptx(buffer: Buffer): Promise<ParsedPresentation> {
  const zip = await JSZip.loadAsync(buffer)

  // 1. Get presentation title from docProps/core.xml
  let presTitle: string | undefined
  const coreXml = await zip.file('docProps/core.xml')?.async('string')
  if (coreXml) {
    const titleMatch = coreXml.match(/<dc:title>([\s\S]*?)<\/dc:title>/)
    if (titleMatch) presTitle = titleMatch[1].trim() || undefined
  }

  // 2. Get slide order from presentation.xml
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string')
  if (!presentationXml) throw new Error('Invalid PPTX: missing presentation.xml')

  // Parse presentation-level rels to map rIds to slide paths
  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')
  if (!presRelsXml) throw new Error('Invalid PPTX: missing presentation.xml.rels')

  const presRels = parseRels(presRelsXml)
  const slideRIds = getSlideOrder(presentationXml)

  // Map rIds to slide file paths
  const slidePaths: string[] = []
  for (const rId of slideRIds) {
    const rel = presRels.get(rId)
    if (rel) {
      // Target is relative to ppt/, e.g. "slides/slide1.xml"
      const path = rel.target.startsWith('/') ? rel.target.slice(1) : `ppt/${rel.target}`
      slidePaths.push(path)
    }
  }

  // Fallback: if presentation.xml parsing found no slides, enumerate ZIP entries directly
  if (slidePaths.length === 0) {
    const slideFiles = Object.keys(zip.files)
      .filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0')
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0')
        return na - nb
      })
    slidePaths.push(...slideFiles)
  }

  // 3. Parse each slide
  const slides: ParsedSlide[] = []

  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i]
    const slideXml = await zip.file(slidePath)?.async('string')
    if (!slideXml) continue

    // Extract all shapes
    const shapes: string[] = []
    const spRegex = /<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/g
    let sm: RegExpExecArray | null
    while ((sm = spRegex.exec(slideXml)) !== null) {
      shapes.push(sm[0])
    }

    // Find title and body text
    let title: string | undefined
    const bodyLines: string[] = []

    for (const shape of shapes) {
      const paragraphs = extractParagraphs(shape)
      if (paragraphs.length === 0) continue

      if (isTitleShape(shape)) {
        title = paragraphs.join(' ')
      } else if (isBodyShape(shape)) {
        bodyLines.push(...paragraphs)
      } else {
        // Other shapes — add text if substantial
        const text = paragraphs.join(' ')
        if (text.length > 5) bodyLines.push(...paragraphs)
      }
    }

    // If no title found from placeholders, use the first text > 3 chars
    if (!title && bodyLines.length > 0) {
      title = bodyLines.shift()
    }

    // Detect tables
    const hasTable = /<a:tbl\b/.test(slideXml)
    let tableText: string | undefined
    if (hasTable) {
      const tableMatch = slideXml.match(/<a:tbl\b[^>]*>([\s\S]*?)<\/a:tbl>/)
      if (tableMatch) {
        tableText = extractTableText(tableMatch[0])
        // Add table content to body if not already captured
        if (tableText && !bodyLines.some(l => l.includes(tableText!.split('\n')[0]))) {
          bodyLines.push(`[Table]\n${tableText}`)
        }
      }
    }

    // Detect charts and SmartArt
    const hasChart = /<c:chart\b/.test(slideXml) || /chart\d+\.xml/.test(slideXml)
      || /<dgm:relIds\b/.test(slideXml)

    // Extract images from this slide
    const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/'))
    const slideFilename = slidePath.substring(slidePath.lastIndexOf('/') + 1)
    const relsPath = `${slideDir}/_rels/${slideFilename}.rels`
    const slideRelsXml = await zip.file(relsPath)?.async('string')

    const images: ParsedImage[] = []
    if (slideRelsXml) {
      const slideRels = parseRels(slideRelsXml)

      // Collect image rIds from slide shapes (blipFill)
      const imageRelIds = extractImageRelIds(slideXml)
      // Also check for background images
      const bgImageIds = extractImageRelIds(slideXml.match(/<p:bg\b[\s\S]*?<\/p:bg>/)?.[0] || '')

      const allImageIds = [...new Set([...imageRelIds, ...bgImageIds])]

      for (const rId of allImageIds) {
        const rel = slideRels.get(rId)
        if (!rel) continue
        // Only process image relationships
        if (!rel.type.includes('image')) continue

        const imgPath = rel.target.startsWith('/')
          ? rel.target.slice(1)
          : `${slideDir}/${rel.target}`.replace(/\/slides\/\.\.\//, '/')

        // Normalize path: ppt/slides/../media/image1.png → ppt/media/image1.png
        const normalizedPath = imgPath.replace(/[^/]+\/\.\.\//g, '')

        const imgFile = zip.file(normalizedPath)
        if (!imgFile) continue

        const data = Buffer.from(await imgFile.async('uint8array'))
        const contentType = getImageContentType(normalizedPath)

        // Only include uploadable image types (skip EMF, WMF, etc.)
        if (isUploadableImage(contentType)) {
          images.push({
            data,
            contentType,
            filename: normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1),
          })
        }
      }
    }

    // Extract speaker notes
    let speakerNotes: string | undefined
    const slideNum = slidePath.match(/slide(\d+)\.xml/)?.[1]
    if (slideNum) {
      const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`
      const notesXml = await zip.file(notesPath)?.async('string')
      if (notesXml) {
        const notesParagraphs = extractParagraphs(notesXml)
        // Filter out common boilerplate like slide number placeholders
        const meaningful = notesParagraphs.filter(p =>
          p.length > 2 && !/^\d+$/.test(p) && !/^slide\s*\d*$/i.test(p)
        )
        if (meaningful.length > 0) speakerNotes = meaningful.join('\n')
      }
    }

    slides.push({
      index: i,
      title,
      bodyText: bodyLines,
      speakerNotes,
      images,
      hasTable,
      tableText,
      hasChart,
    })
  }

  return { slides, title: presTitle }
}
