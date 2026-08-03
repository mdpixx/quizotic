// Structural validation of the generated .xlsx.
//
// Excel silently "repairs" a workbook that violates the OOXML schema, and the
// user just sees an error dialog. Three real defects shipped past the earlier
// content tests because those only asserted cell values:
//
//   1. A sheet named "Bloom's" — exceljs writes Print_Titles as
//      'Bloom's'!$4:$4, but an apostrophe inside a quoted sheet reference must
//      be doubled. Invalid formula → repair.
//   2. Data-bar conditional formatting made exceljs emit an <extLst> between
//      <conditionalFormatting> and <pageMargins>. CT_Worksheet requires extLst
//      to be the final child → repair.
//   3. That extLst carried a partial x14 data-bar definition.
//
// These assertions run against the real zip so a regression cannot slip out.

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildSessionWorkbook } from '../lib/report-workbook'
import { fullFixture } from './fixtures/report-fixture'

// CT_Worksheet child sequence (ECMA-376 §18.3.1.99), trimmed to what we emit.
const WORKSHEET_ORDER = [
  'sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData',
  'sheetCalcPr', 'sheetProtection', 'protectedRanges', 'scenarios', 'autoFilter',
  'sortState', 'dataConsolidate', 'customSheetViews', 'mergeCells', 'phoneticPr',
  'conditionalFormatting', 'dataValidations', 'hyperlinks', 'printOptions',
  'pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks',
  'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing',
  'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls',
  'webPublishItems', 'tableParts', 'extLst',
]

async function buildZip() {
  const wb = buildSessionWorkbook(fullFixture())
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  return JSZip.loadAsync(buffer)
}

describe('workbook file integrity', () => {
  it('emits worksheet children in schema order', async () => {
    const zip = await buildZip()
    const sheets = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    expect(sheets.length).toBeGreaterThan(0)

    for (const name of sheets) {
      const xml = await zip.file(name)!.async('string')
      const seen: string[] = []
      for (const match of xml.matchAll(/<(?!\/)(\w+)[\s/>]/g)) {
        const tag = match[1]
        const rank = WORKSHEET_ORDER.indexOf(tag)
        if (rank === -1) continue // nested element, not a worksheet child
        if (seen[seen.length - 1] !== tag) seen.push(tag)
      }
      const ranks = seen.map(t => WORKSHEET_ORDER.indexOf(t))
      const sorted = [...ranks].sort((a, b) => a - b)
      expect(ranks, `${name} child order: ${seen.join(' → ')}`).toEqual(sorted)
    }
  })

  it('uses sheet names that are safe inside quoted formula references', async () => {
    const wb = buildSessionWorkbook(fullFixture())
    for (const ws of wb.worksheets) {
      // Excel forbids : \ / ? * [ ] outright, caps at 31 chars, and an
      // apostrophe needs doubling in every reference exceljs writes unquoted.
      expect(ws.name, `sheet name "${ws.name}"`).not.toMatch(/['[\]:*?/\\]/)
      expect(ws.name.length).toBeLessThanOrEqual(31)
    }
  })

  it('writes no x14 conditional-formatting extensions', async () => {
    const zip = await buildZip()
    for (const name of Object.keys(zip.files)) {
      if (!name.startsWith('xl/worksheets/sheet')) continue
      const xml = await zip.file(name)!.async('string')
      expect(xml, `${name} carries an x14 extension`).not.toContain('x14:cfRule')
      expect(xml, `${name} carries an extLst`).not.toContain('<extLst>')
    }
  })

  it('declares every part it references in [Content_Types].xml', async () => {
    const zip = await buildZip()
    const types = await zip.file('[Content_Types].xml')!.async('string')
    const defaults = Array.from(types.matchAll(/Extension="([^"]+)"/g)).map(m => m[1].toLowerCase())
    const overrides = Array.from(types.matchAll(/PartName="([^"]+)"/g)).map(m => m[1])
    for (const name of Object.keys(zip.files)) {
      if (zip.files[name].dir || name === '[Content_Types].xml') continue
      const ext = name.split('.').pop()!.toLowerCase()
      const declared = overrides.includes(`/${name}`) || defaults.includes(ext)
      expect(declared, `${name} is not declared in [Content_Types].xml`).toBe(true)
    }
  })

  it('resolves every relationship target to a part that exists', async () => {
    const zip = await buildZip()
    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith('.rels')) continue
      const xml = await zip.file(name)!.async('string')
      const base = name.replace(/_rels\/[^/]+$/, '')
      for (const m of xml.matchAll(/Target="([^"]+)"[^>]*?(TargetMode="External")?\/>/g)) {
        if (m[2] || m[1].startsWith('http')) continue
        // Normalise ../ segments against the owning directory.
        const parts = (base + m[1]).split('/')
        const stack: string[] = []
        for (const p of parts) {
          if (p === '..') stack.pop()
          else if (p !== '.' && p !== '') stack.push(p)
        }
        const resolved = stack.join('/')
        expect(zip.files[resolved], `${name} → ${m[1]} (${resolved}) missing`).toBeTruthy()
      }
    }
  })
})
