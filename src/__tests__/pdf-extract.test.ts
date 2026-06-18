// Tests for the PDF text-quality validator that gates the AI call.
// The critical regression we are guarding against:
//   PowerPoint-exported PDFs return only "-- 1 of N --\n\n..." page markers
//   from pdf-parse. The route used to feed that to Gemini, which then made
//   up a quiz on whatever default topic it leans toward (medical, in the
//   reported incident). isExtractedTextMeaningful() must reject that input
//   so the route can fall back to OCR or refuse the AI call.

import { describe, expect, it } from 'vitest'
import { isExtractedTextMeaningful, extractPdfText, __test__ } from '../lib/pdf-extract.mjs'

describe('isExtractedTextMeaningful', () => {
  it('rejects empty string', () => {
    expect(isExtractedTextMeaningful('')).toBe(false)
  })

  it('rejects whitespace-only', () => {
    expect(isExtractedTextMeaningful('   \n\t  \n   ')).toBe(false)
  })

  it('rejects pure page markers — the actual production regression case', () => {
    const junk = '\n\n-- 1 of 10 --\n\n\n\n-- 2 of 10 --\n\n\n\n-- 3 of 10 --\n\n\n\n-- 4 of 10 --\n\n\n\n-- 5 of 10 --\n\n\n\n-- 6 of 10 --\n\n\n\n-- 7 of 10 --\n\n\n\n-- 8 of 10 --\n\n\n\n-- 9 of 10 --\n\n\n\n-- 10 of 10 --\n\n'
    expect(isExtractedTextMeaningful(junk)).toBe(false)
  })

  it('rejects content with only page numbers', () => {
    const junk = 'Page 1 of 50\nPage 2 of 50\nPage 3 of 50'
    expect(isExtractedTextMeaningful(junk)).toBe(false)
  })

  it('rejects very short text even when it looks like words', () => {
    expect(isExtractedTextMeaningful('Hello world.')).toBe(false)
  })

  it('rejects pure digits / punctuation', () => {
    expect(isExtractedTextMeaningful('1234567890 !!!! ----- 9999')).toBe(false)
  })

  it('accepts a real lubricants-PDF excerpt (positive case)', () => {
    const real = `Lubricant Selection Guide. Engine oils are categorised by their viscosity grade,
      additive package, and base oil type. SAE 5W-30 is recommended for modern petrol
      engines because it offers cold-start protection while maintaining film strength
      at operating temperature. Mineral, synthetic and semi-synthetic blends each have
      distinct performance envelopes that the maintenance engineer must understand
      before selecting a product for a given application.`
    expect(isExtractedTextMeaningful(real)).toBe(true)
  })

  it('accepts content with mixed page markers + real prose', () => {
    const mixed = '-- 1 of 5 --\nIntroduction to Industrial Lubricants. This handbook covers the fundamentals of base oils, additives, and viscosity grading for maintenance professionals. Chapter one introduces the chemistry of mineral oil refinement.'
    expect(isExtractedTextMeaningful(mixed)).toBe(true)
  })

  it('accepts non-Latin scripts (Hindi)', () => {
    // Long enough to clear MIN_USEFUL_CHARS — important because Hindi PDFs
    // are common in the Indian education / training market we serve and
    // shouldn't be misidentified as junk.
    const hindi = 'यह एक हिंदी पाठ्यक्रम है। इसमें सामग्री व्यवहार और रसायन विज्ञान के बारे में जानकारी है। पहला अध्याय परिचय से शुरू होता है। दूसरा अध्याय रासायनिक यौगिकों के बारे में है। तीसरा अध्याय परीक्षण विधियों पर केंद्रित है। चौथा अध्याय सुरक्षा प्रोटोकॉल पर चर्चा करता है। पाँचवाँ अध्याय पर्यावरणीय प्रभाव की समीक्षा करता है।'
    expect(isExtractedTextMeaningful(hindi)).toBe(true)
  })

  it('handles non-string input gracefully', () => {
    expect(isExtractedTextMeaningful(null as unknown as string)).toBe(false)
    expect(isExtractedTextMeaningful(undefined as unknown as string)).toBe(false)
    expect(isExtractedTextMeaningful(42 as unknown as string)).toBe(false)
  })
})

describe('stripMarkerNoise', () => {
  it('removes "-- N of M --" markers', () => {
    const cleaned: string = __test__.stripMarkerNoise('-- 1 of 10 -- foo bar -- 2 of 10 -- baz')
    expect(cleaned).not.toMatch(/--\s*\d+\s*of/)
    expect(cleaned).toContain('foo bar')
    expect(cleaned).toContain('baz')
  })

  it('removes "Page N of M" prose markers', () => {
    expect(__test__.stripMarkerNoise('Page 3 of 100\nIntroduction')).not.toMatch(/Page \d+ of \d+/)
  })

  it('collapses excessive whitespace', () => {
    const cleaned: string = __test__.stripMarkerNoise('foo\n\n\n   bar\t\t\tbaz')
    expect(cleaned).toBe('foo bar baz')
  })
})

describe('extractPdfText resilience', () => {
  // Regression guard: a non-PDF / corrupt buffer must DEGRADE to source:'none'
  // and never throw. A throw here surfaces to the user as a bare
  // "Generation failed" (and previously could crash the worker via tesseract's
  // unhandled error path).
  it('resolves to source:"none" on a malformed buffer instead of throwing', async () => {
    const garbage = Buffer.from('this is definitely not a pdf file', 'utf8')
    const result = await extractPdfText(garbage, { timeBudgetMs: 2_000 })
    expect(result.source).toBe('none')
    expect(result.text).toBe('')
  })
})

describe('extractor configuration sanity', () => {
  it('the AI input minimum is high enough to require real content', () => {
    // If MIN_USEFUL_CHARS ever drops below ~100 the empty-content regression
    // re-opens. Lock it at the value the audit was based on.
    expect(__test__.MIN_USEFUL_CHARS).toBeGreaterThanOrEqual(100)
  })

  it('the slice limit is generous enough not to chop off a typical training deck', () => {
    // 3000 was the original buggy value — anything close is still a smell.
    expect(__test__.TEXT_SLICE_LIMIT).toBeGreaterThanOrEqual(20_000)
  })

  it('the OCR page cap is bounded', () => {
    // OCR is expensive — if this number goes >50, requests start timing out.
    expect(__test__.MAX_OCR_PAGES).toBeLessThanOrEqual(50)
  })

  it('the vision LLM page cap is bounded', () => {
    // Vision LLM cost is ~$0.002/page. Above 15 pages we'd be paying real
    // money on every Tier-3 invocation; below that it stays trivial.
    expect(__test__.MAX_VISION_PAGES).toBeGreaterThan(0)
    expect(__test__.MAX_VISION_PAGES).toBeLessThanOrEqual(15)
  })
})
