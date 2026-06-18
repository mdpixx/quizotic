// Robust PDF text extraction with three-tier fallback.
//
// Why this module exists: pdf-parse@2 silently returns empty/junk text for
// any PDF whose content is rasterised — PowerPoint / Keynote / Google Slides
// exports, scanned documents, image-only marketing decks, vector PDFs with
// non-standard font encoding. The /api/generate-quiz route used to feed that
// junk straight to the AI, which then fabricated unrelated questions.
//
// Pipeline (each tier only fires if the previous one's output fails the
// content-quality bar):
//   1. pdf-parse `getText()`  — fast, free, works for normal text PDFs.
//   2. pdf-parse `getScreenshot()` + Tesseract.js OCR — for English image
//      PDFs (PowerPoint exports, basic scans). Free, ~3s for a typical deck.
//   3. Same screenshots + a vision-capable LLM (Gemini 2.0 Flash) — handles
//      everything Tesseract can't: handwriting, non-English scripts, low-
//      quality scans, infographic-heavy pages where text is fragmented.
//      Costs ~$0.02 per invocation; only fires when Tiers 1+2 both fail.
//
// All tiers share the same OCR_TIME_BUDGET_MS deadline so a single request
// can't tie up a worker forever.

const MIN_USEFUL_CHARS = 200          // below this, treat as failed extraction
const TEXT_SLICE_LIMIT = 50_000       // generous slice for the AI prompt
const MAX_OCR_PAGES = 20              // cap to bound Tesseract runtime
const MAX_VISION_PAGES = 10           // cap to bound Gemini Vision cost (~$0.02/PDF)
const OCR_TIME_BUDGET_MS = 60_000     // hard ceiling per request (covers all tiers)

let workerPromise = null

// Bound a promise so a tier that stalls (e.g. Tesseract trying to download its
// language data from a CDN that is slow/blocked) can't hang the whole request.
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

async function getTesseractWorker() {
  if (workerPromise) return workerPromise
  const tesseractMod = await import('tesseract.js')
  const Tesseract = tesseractMod.default ?? tesseractMod
  workerPromise = Tesseract.createWorker('eng', 1, {
    // Silence the per-line download/progress logs in production.
    logger: () => {},
    // CRITICAL: without an errorHandler, tesseract.js does a bare `throw` from
    // inside its worker message handler when a job fails (e.g. the English
    // language data can't be downloaded at runtime). That throw happens on a
    // later event-loop tick, so it becomes an UNCAUGHT exception that bypasses
    // every try/catch around this call and can take down the process. Routing
    // it through a handler keeps the failure as a normal rejection so the OCR
    // tier can degrade to the vision tier instead of crashing the request.
    errorHandler: (err) => {
      console.warn('[pdf-extract] tesseract worker error:', err?.message ?? err)
    },
  }).catch((err) => {
    workerPromise = null  // allow retry on next request
    throw err
  })
  return workerPromise
}

// Strip the page-marker noise pdf-parse v2 emits even for image-only PDFs
// (e.g. "-- 1 of 10 --\n\n-- 2 of 10 --\n\n..."). What remains is the actual
// extracted prose — which we then evaluate for length.
function stripMarkerNoise(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, ' ')
    .replace(/page\s+\d+\s+of\s+\d+/gi, ' ')
    .replace(/\f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Heuristic "is this real content?" check. Empty / whitespace-only / pure
// digits / runs of punctuation all fail. Anything with at least
// MIN_USEFUL_CHARS letters AND a real word passes.
export function isExtractedTextMeaningful(text) {
  const cleaned = stripMarkerNoise(text)
  if (cleaned.length < MIN_USEFUL_CHARS) return false
  const letterRun = cleaned.match(/[a-zA-ZÀ-ɏऀ-ॿ一-鿿]{4,}/g)
  if (!letterRun || letterRun.length < 5) return false
  return true
}

// Tier 3 — vision LLM extraction. Sends page screenshots (already rendered
// for Tier 2) to a multimodal model and asks for plain-text extraction plus
// brief one-line descriptions of any diagrams/charts. Reuses the existing
// OPENROUTER_API_KEY and the same Gemini 2.0 Flash model the route uses for
// question generation, so no new credentials or providers are introduced.
//
// Returns the model's text output, or '' on any failure (so the caller can
// just check truthiness against the meaningfulness bar).
async function extractViaVisionLLM(pages, deadline) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('[pdf-extract] vision tier skipped — OPENROUTER_API_KEY not set')
    return ''
  }
  const usable = (pages ?? []).filter((p) => p?.dataUrl).slice(0, MAX_VISION_PAGES)
  if (usable.length === 0) return ''

  const remainingMs = Math.max(0, deadline - Date.now())
  if (remainingMs < 5_000) {
    console.warn(`[pdf-extract] vision tier skipped — only ${remainingMs}ms left in budget`)
    return ''
  }

  let OpenAI
  try {
    OpenAI = (await import('openai')).default
  } catch (err) {
    console.warn('[pdf-extract] vision tier skipped — openai package not loadable:', err?.message ?? err)
    return ''
  }

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  })
  const model = process.env.QUIZ_VISION_MODEL ?? process.env.QUIZ_AI_MODEL ?? 'google/gemini-2.5-flash'

  const prompt = [
    'These are screenshots of consecutive pages from a single PDF document.',
    'Extract ALL the text accurately, in reading order, preserving paragraphs.',
    'For diagrams, charts, tables, or figures: write a brief 1-2 sentence description of what they convey (key labels, axes, values, relationships).',
    'For non-English text, transcribe it in the original script.',
    'Output one section per page in this format:',
    '',
    '=== Page 1 ===',
    '<extracted text and figure descriptions>',
    '',
    '=== Page 2 ===',
    '...',
    '',
    'Output plain text only — no markdown, no commentary, no apologies.',
  ].join('\n')

  const content = [
    { type: 'text', text: prompt },
    ...usable.map((p) => ({
      type: 'image_url',
      image_url: { url: p.dataUrl },
    })),
  ]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.min(remainingMs, 45_000))
  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content }],
      },
      { signal: controller.signal },
    )
    const out = response?.choices?.[0]?.message?.content ?? ''
    return typeof out === 'string' ? out : ''
  } catch (err) {
    console.warn(`[pdf-extract] vision tier failed (${usable.length} pages, model=${model}):`, err?.message ?? err)
    return ''
  } finally {
    clearTimeout(timer)
  }
}

// Run OCR on the given pages, stopping early once we've got enough text or
// run out of time/page budget. Re-uses the singleton worker so the second
// request in a process doesn't pay the language-pack init cost.
async function ocrPages(pages, deadline) {
  // Nothing rendered (e.g. getScreenshot failed) — don't pay the worker
  // init/download cost just to OCR zero pages.
  if (!pages || pages.length === 0) return ''
  let worker
  try {
    // Bound init: if the language data can't be fetched, tesseract.js neither
    // resolves nor rejects (it just keeps retrying), so without a timeout this
    // would hang until the request dies. 15s is enough for a healthy cold-start
    // download but short enough to leave budget for the vision tier.
    const initBudget = Math.min(Math.max(0, deadline - Date.now()), 15_000)
    worker = await withTimeout(getTesseractWorker(), initBudget, 'tesseract-init')
  } catch (err) {
    // Worker init failed/timed out (commonly: language data couldn't be
    // fetched). Reset the cached promise so a poisoned init doesn't stick for
    // later requests, and skip OCR so the caller falls through to the vision tier.
    console.warn('[pdf-extract] OCR tier unavailable — worker init failed:', err?.message ?? err)
    workerPromise = null
    return ''
  }
  const out = []
  let chars = 0
  for (let i = 0; i < pages.length && i < MAX_OCR_PAGES; i++) {
    if (Date.now() > deadline) break
    const png = pages[i]?.data
    if (!png || png.byteLength === 0) continue
    try {
      const buf = png instanceof Uint8Array && !(png instanceof Buffer)
        ? Buffer.from(png)
        : png
      const { data } = await worker.recognize(buf)
      const t = (data?.text ?? '').trim()
      if (t) {
        out.push(t)
        chars += t.length
      }
      // Early exit — once we have ~30k chars there's no value in OCRing more.
      if (chars >= 30_000) break
    } catch (err) {
      console.warn('[pdf-extract] OCR page', i + 1, 'failed:', err?.message ?? err)
    }
  }
  return out.join('\n\n')
}

// Public API. Returns:
//   { text, source: 'text' | 'ocr' | 'vision' | 'none',
//     pageCount, charCount, ocrPagesUsed, visionPagesUsed }
// `text` is already trimmed and slice-limited; the caller can pass it
// directly to the AI prompt.
export async function extractPdfText(buffer, opts = {}) {
  const startedAt = Date.now()
  const deadline = startedAt + (opts.timeBudgetMs ?? OCR_TIME_BUDGET_MS)

  let parser = null
  let pageCount = 0
  let textPath = ''
  let pages = []
  let cleanedOcr = ''
  try {
    // Open the parser. If even this throws (corrupt/encrypted PDF, loader
    // failure) there is no tier we can run — degrade to 'none' rather than
    // letting the exception bubble up as a generic "Generation failed".
    try {
      const { PDFParse } = await import('pdf-parse')
      parser = new PDFParse({ data: buffer })
    } catch (err) {
      console.warn('[pdf-extract] could not open PDF parser:', err?.message ?? err)
      return { text: '', source: 'none', pageCount: 0, charCount: 0, ocrPagesUsed: 0, visionPagesUsed: 0 }
    }

    // Tier 1 — fast text extraction.
    try {
      const textResult = await parser.getText()
      pageCount = textResult?.pages?.length ?? 0
      textPath = stripMarkerNoise(textResult?.text ?? '')
    } catch (err) {
      console.warn('[pdf-extract] text tier failed:', err?.message ?? err)
    }

    if (isExtractedTextMeaningful(textPath)) {
      return {
        text: textPath.slice(0, TEXT_SLICE_LIMIT),
        source: 'text',
        pageCount,
        charCount: textPath.length,
        ocrPagesUsed: 0,
        visionPagesUsed: 0,
      }
    }

    // Render page screenshots once — shared by the OCR and vision tiers.
    console.log(`[pdf-extract] text path produced ${textPath.length} useful chars across ${pageCount} pages — falling back to OCR`)
    try {
      const screenshot = await parser.getScreenshot()
      pages = screenshot?.pages ?? []
    } catch (err) {
      console.warn('[pdf-extract] page rendering (getScreenshot) failed:', err?.message ?? err)
      pages = []
    }

    // Tier 2 — Tesseract OCR.
    try {
      const ocrText = await ocrPages(pages, deadline)
      cleanedOcr = stripMarkerNoise(ocrText)
    } catch (err) {
      console.warn('[pdf-extract] OCR tier failed:', err?.message ?? err)
    }

    if (isExtractedTextMeaningful(cleanedOcr)) {
      return {
        text: cleanedOcr.slice(0, TEXT_SLICE_LIMIT),
        source: 'ocr',
        pageCount,
        charCount: cleanedOcr.length,
        ocrPagesUsed: Math.min(pages.length, MAX_OCR_PAGES),
        visionPagesUsed: 0,
      }
    }

    // Tier 3 — Vision LLM. Reuses the same screenshots so we don't re-render
    // pages. Handles handwriting, non-English scripts, low-quality scans,
    // diagram-heavy pages — anything Tesseract garbles.
    console.log(`[pdf-extract] OCR produced ${cleanedOcr.length} useful chars — falling back to vision LLM`)
    let cleanedVision = ''
    try {
      const visionText = await extractViaVisionLLM(pages, deadline)
      cleanedVision = stripMarkerNoise(visionText)
    } catch (err) {
      console.warn('[pdf-extract] vision tier failed:', err?.message ?? err)
    }

    if (isExtractedTextMeaningful(cleanedVision)) {
      const visionPagesUsed = Math.min(pages.length, MAX_VISION_PAGES)
      console.log(`[pdf-extract] vision tier succeeded — ${cleanedVision.length} useful chars from ${visionPagesUsed} pages`)
      return {
        text: cleanedVision.slice(0, TEXT_SLICE_LIMIT),
        source: 'vision',
        pageCount,
        charCount: cleanedVision.length,
        ocrPagesUsed: Math.min(pages.length, MAX_OCR_PAGES),
        visionPagesUsed,
      }
    }

    // All three tiers produced nothing usable. Caller must surface a friendly
    // error to the user and skip the AI call entirely.
    console.warn(`[pdf-extract] all tiers failed — text=${textPath.length} ocr=${cleanedOcr.length} vision=${cleanedVision.length}`)
    return {
      text: '',
      source: 'none',
      pageCount,
      charCount: 0,
      ocrPagesUsed: pages.length ? Math.min(pages.length, MAX_OCR_PAGES) : 0,
      visionPagesUsed: 0,
    }
  } finally {
    try { if (parser) await parser.destroy() } catch { /* noop */ }
  }
}

export const __test__ = {
  stripMarkerNoise,
  MIN_USEFUL_CHARS,
  TEXT_SLICE_LIMIT,
  MAX_OCR_PAGES,
  MAX_VISION_PAGES,
}
