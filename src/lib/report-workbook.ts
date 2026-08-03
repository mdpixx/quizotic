// Shared Excel workbook builder for session reports.
//
// Pure: takes a normalised SessionWorkbookData (see report-data.ts for the
// server-side gatherer) and returns an ExcelJS workbook. No Prisma, no Next —
// so the whole thing unit-tests without a database or a request.
//
// ── Two rules this file exists to hold ─────────────────────────────────────
//
// 1. ONE header treatment. Every header row is solid navy with white text.
//    Meaning is carried by tinting the *data* cells, never by recolouring
//    header cells — a navy cell beside a near-white one in the same header row
//    reads as a rendering fault, not as a category.
//
// 2. Stay inside the exceljs features that emit plain, in-order OOXML.
//    Data bars and cell comments are both banned: data bars make exceljs write
//    an <extLst> in the middle of the worksheet (it must be the final child)
//    and comments add VML parts we get no value from. Excel repairs either,
//    and the user just sees "unreadable content". Sheet names must also avoid
//    apostrophes — exceljs writes Print_Titles as 'Name'!$4:$4 without
//    doubling an embedded quote, which is an invalid reference.
//    src/__tests__/report-workbook-integrity.test.ts enforces all of this.
//
// 3. ONE typeface, at a fixed size scale. XLSX cannot embed fonts — if the
//    recipient lacks the font, Excel silently substitutes and the layout
//    reflows. Calibri is the only humanist sans that ships with every Office
//    install on both Windows and macOS, so it is the safest crisp choice.
//    Set it on every cell AND as the theme font, or unstyled cells fall back
//    to the viewer's default.

import ExcelJS from 'exceljs'
import type { BloomsLevel, MatchPair } from '@/lib/quiz-types'
import type { MisconceptionSummary } from '@/lib/session-matrix'
import type { TeacherReportInsights } from '@/lib/report-insights'
import { QUIZOTIC_MARK_PNG_BASE64 } from '@/lib/report-logo'

// ── Data contract ───────────────────────────────────────────────────────────

export interface WorkbookMeta {
  quizTitle: string
  subject: string | null
  code: string | null
  hostName: string | null
  mode: 'live' | 'async'
  startedAt: Date
  endedAt: Date | null
  durationSec: number | null
  participantCount: number
  questionCount: number
  classAccuracyPct: number | null
  avgScore: number | null
  completedCount: number
  generatedAt: Date
}

export interface WorkbookConfidence {
  sureCorrect: number
  sureWrong: number
  unsureCorrect: number
  unsureWrong: number
}

export interface WorkbookQuestion {
  index: number // original index in the questions array
  position: number // 1-based display number, leaderboard slides removed
  text: string
  type: string
  typeLabel: string
  isScored: boolean
  isNameCapture: boolean // identity slide — its answers are the "Real name / ID" column
  bloomsLevel: BloomsLevel | null
  explanation: string | null
  correctAnswerText: string | null
  options: string[]
  optionDistribution: number[]
  correctIndexes: number[]
  responses: number
  correct: number
  wrong: number
  unattempted: number
  accuracyPct: number | null // over responders, matching the on-screen number
  avgTimeSec: number | null
  confidence: WorkbookConfidence | null
  // Non-scored payloads — only the one matching `type` is populated.
  wordFrequencies?: Record<string, number>
  textResponses?: Array<{ name?: string | null; answer: string }>
  ratingHistogram?: number[]
  ratingAverage?: number | null
  ratingMax?: number
  rankingItems?: string[]
  rankingAverages?: number[]
  rankingFirstPlaceCounts?: number[]
  matchPairs?: MatchPair[]
}

export type WorkbookCellState = 'correct' | 'wrong' | 'answered' | 'blank'

export interface WorkbookCell {
  state: WorkbookCellState
  display: string
  confidence: 'sure' | 'unsure' | null
  points: number
}

export interface WorkbookParticipant {
  rank: number
  name: string
  identity: string | null // real name / employee code from the name-capture slide
  email: string | null
  team: string | null
  score: number
  accuracyPct: number | null
  correct: number
  wrong: number
  unattempted: number
  answered: number
  timeSec: number | null
  joinedAt: Date | null
  leftAt: Date | null
  completed: boolean
  duplicateName: boolean
  cells: WorkbookCell[] // aligned to questions[]
}

export interface WorkbookBloomsRow {
  level: BloomsLevel
  label: string
  questionCount: number
  correct: number
  wrong: number
  accuracyPct: number | null
}

export interface SessionWorkbookData {
  meta: WorkbookMeta
  questions: WorkbookQuestion[]
  participants: WorkbookParticipant[]
  misconceptions: MisconceptionSummary | null
  blooms: WorkbookBloomsRow[]
  insights: TeacherReportInsights
}

// ── Palette ─────────────────────────────────────────────────────────────────
// argb strings. Hexes match the on-screen report so the download and the
// dashboard read as one product.

const C = {
  navy: 'FF0F1B3D',
  yellow: 'FFFBD13B',
  white: 'FFFFFFFF',
  ink: 'FF0F1B3D',
  muted: 'FF64748B',
  zebra: 'FFF7F8FA',
  line: 'FFE2E8F0',
  violet: 'FF7C3AED',
  // accuracy bands — AccuracyScan in reports/[id]/page.tsx
  green: 'FF16A34A',
  amber: 'FFF59E0B',
  red: 'FFDC2626',
  // confidence quadrants — CONFIDENCE_QUADRANTS in SessionReport.tsx
  masteryBg: 'FFF0FDF4',
  masteryText: 'FF15803D',
  misconceptionBg: 'FFFEF2F2',
  misconceptionText: 'FFB91C1C',
  luckyBg: 'FFFEFCE8',
  luckyText: 'FFA16207',
  gapBg: 'FFF8FAFC',
  gapText: 'FF64748B',
  // matrix cell tints
  correctBg: 'FFDCFCE7',
  wrongBg: 'FFFEE2E2',
  answeredBg: 'FFEDE9FE',
  blankBg: 'FFF1F5F9',
  flagBg: 'FFFFF7ED',
  // medals
  gold: 'FFFFD700',
  silver: 'FFD8D8D8',
  bronze: 'FFE0A870',
} as const

// Muted, desaturated tab colours — a row of saturated primaries at the bottom
// of the window reads as a toy, not a report. These stay distinguishable while
// sitting quietly under the navy header band.
// No apostrophes in any name — see the header note.
const TABS = {
  summary: 'FF0F1B3D',
  participants: 'FF3D4A5C',
  questions: 'FF44507A',
  answerKey: 'FF3F6070',
  matrix: 'FF585274',
  misconceptions: 'FF7A4A4A',
  responses: 'FF77683F',
} as const

// One typeface, one scale. See rule 3 in the header note.
const FONT = 'Calibri'
const SIZE = {
  brand: 18,
  title: 16,
  subtitle: 11,
  section: 12,
  header: 11,
  body: 11,
  small: 10,
  kpi: 22,
} as const

const BLOOMS_LABELS: Record<BloomsLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyse: 'Analyse',
  evaluate: 'Evaluate',
  create: 'Create',
}

export const BLOOMS_ORDER: readonly BloomsLevel[] = [
  'remember', 'understand', 'apply', 'analyse', 'evaluate', 'create',
]

export function bloomsLabel(level: BloomsLevel): string {
  return BLOOMS_LABELS[level]
}

// ── Style helpers ───────────────────────────────────────────────────────────

type Row = ExcelJS.Row
type Sheet = ExcelJS.Worksheet

const DURATION_FMT = '[h]:mm:ss'
const PERCENT_FMT = '0%'
const HEADER_ROW = 4 // every sheet uses the same title / subtitle / blank preamble

function fill(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

/** Every font in the workbook goes through here so none can drift. */
function font(opts: {
  size?: number
  bold?: boolean
  italic?: boolean
  color?: string
} = {}): Partial<ExcelJS.Font> {
  return {
    name: FONT,
    size: opts.size ?? SIZE.body,
    bold: opts.bold,
    italic: opts.italic,
    color: { argb: opts.color ?? C.ink },
  }
}

/** Accuracy cells were unreadable: a colour-scale fill sat behind text tinted
 *  the same hue, so green-on-green and red-on-red vanished. Fixed pairs of a
 *  light tint and its own strong ink guarantee contrast at every band. */
const ACCURACY_BANDS = [
  { min: 80, bg: C.masteryBg, ink: C.masteryText },
  { min: 50, bg: C.luckyBg, ink: C.luckyText },
  { min: 0, bg: C.misconceptionBg, ink: C.misconceptionText },
] as const

function paintAccuracy(cell: ExcelJS.Cell, pct: number | null) {
  cell.numFmt = PERCENT_FMT
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  if (pct == null) {
    cell.font = font({ color: C.muted })
    return
  }
  const band = ACCURACY_BANDS.find(b => pct >= b.min) ?? ACCURACY_BANDS[2]
  cell.fill = fill(band.bg)
  cell.font = font({ bold: true, color: band.ink })
}

function thinBorder(argb: string = C.line): ExcelJS.Borders {
  const side = { style: 'thin' as const, color: { argb } }
  return { top: side, left: side, bottom: side, right: side, diagonal: { style: undefined } }
}

// Excel stores durations as a fraction of a day. A real number (rather than an
// "mm:ss" string) keeps the column sortable and summable.
function toExcelDuration(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds)) return null
  return seconds / 86400
}

// Percentages are stored as fractions with a percent format so Excel's own
// colour scales and charts operate on them natively.
function toFraction(pct: number | null | undefined): number | null {
  return pct == null || !Number.isFinite(pct) ? null : pct / 100
}

function accuracyColor(pct: number | null): string {
  if (pct == null) return C.muted
  if (pct >= 80) return C.green
  if (pct >= 50) return C.amber
  return C.red
}

/** Title / subtitle / spacer plus the letterhead. Always three rows, so
 *  HEADER_ROW is constant and every sheet's header sits at the same place. */
function sheetTitle(wb: ExcelJS.Workbook, ws: Sheet, title: string, subtitle: string, brandCol: number): void {
  const t = ws.addRow([title])
  t.getCell(1).font = font({ size: SIZE.title, bold: true })
  t.getCell(1).alignment = { vertical: 'middle' }
  t.height = 26
  const sub = ws.addRow([subtitle])
  sub.getCell(1).font = font({ size: SIZE.subtitle, color: C.muted })
  sub.getCell(1).alignment = { vertical: 'middle' }
  sub.height = 18
  ws.addRow([])
  brandBlock(wb, ws, brandCol)
}

/** The one header treatment: solid navy, white bold, centred, wrapped. */
function headerRow(ws: Sheet, labels: string[]): Row {
  const row = ws.addRow(labels)
  row.height = 32
  row.eachCell(cell => {
    cell.fill = fill(C.navy)
    cell.font = font({ size: SIZE.header, bold: true, color: C.white })
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder(C.navy)
  })
  return row
}

/** A bold navy label opening a block inside a sheet. No fill — a filled strip
 *  here would compete with the real header rows. */
function sectionLabel(ws: Sheet, text: string): Row {
  const row = ws.addRow([text])
  row.getCell(1).font = font({ size: SIZE.section, bold: true })
  row.height = 22
  return row
}

/** Zebra banding + hairline borders. Cells that already carry a semantic tint
 *  keep it — set those while writing the row, before calling this. */
function bandRows(ws: Sheet, firstRow: number, lastRow: number, lastCol: number) {
  for (let r = firstRow; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const zebra = (r - firstRow) % 2 === 1
    if (!row.height) row.height = 20
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c)
      if (zebra && !cell.fill) cell.fill = fill(C.zebra)
      cell.border = thinBorder()
      if (!cell.alignment) cell.alignment = { vertical: 'middle', indent: 1 }
      // Cells styled inline already carry the workbook font; this catches the
      // rest so nothing falls back to the viewer's default typeface.
      if (!cell.font?.name) cell.font = font()
    }
  }
}

function freezeAndFilter(ws: Sheet, lastCol: number, freezeCols = 0) {
  // Hiding the grid is what separates a designed report from a raw dump —
  // the cell borders we draw become the only structure on screen.
  ws.views = [{
    state: 'frozen',
    xSplit: freezeCols,
    ySplit: HEADER_ROW,
    activeCell: 'A1',
    showGridLines: false,
  }]
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: lastCol } }
}

/** Letterhead: the mark plus the wordmark, at the same anchor on every sheet.
 *  A true Excel background image would not print and would sit behind the
 *  data; a letterhead block prints, never collides with a cell value, and is
 *  what a report a host forwards to management is expected to carry. */
function placeMark(wb: ExcelJS.Workbook, ws: Sheet, col: number) {
  // Anchored top-right, sized in pixels so column widths cannot stretch it.
  ws.addImage(getMarkImageId(wb), {
    tl: { col: col - 0.9, row: 0.15 },
    ext: { width: 34, height: 34 },
    editAs: 'oneCell',
  })
}

function brandBlock(wb: ExcelJS.Workbook, ws: Sheet, wordmarkCol: number) {
  placeMark(wb, ws, wordmarkCol)
  const cell = ws.getCell(1, wordmarkCol)
  cell.value = 'Quizotic'
  cell.font = font({ size: SIZE.subtitle, bold: true, color: C.ink })
  cell.alignment = { horizontal: 'right', vertical: 'middle' }
  const sub = ws.getCell(2, wordmarkCol)
  sub.value = 'quizotic.live'
  sub.font = font({ size: SIZE.small, color: C.muted })
  sub.alignment = { horizontal: 'right', vertical: 'top' }
}

// One image part per workbook, reused by every sheet.
const markIdByWorkbook = new WeakMap<ExcelJS.Workbook, number>()
function getMarkImageId(wb: ExcelJS.Workbook): number {
  const existing = markIdByWorkbook.get(wb)
  if (existing !== undefined) return existing
  const id = wb.addImage({ base64: QUIZOTIC_MARK_PNG_BASE64, extension: 'png' })
  markIdByWorkbook.set(wb, id)
  return id
}

/** Landscape, fit-to-width, header repeated on every printed page. */
function printSetup(ws: Sheet, repeatHeader: boolean, orientation: 'landscape' | 'portrait' = 'landscape') {
  ws.pageSetup = {
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    ...(repeatHeader ? { printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}` } : {}),
  }
  ws.headerFooter = { oddFooter: '&LQuizotic · quizotic.live&RPage &P of &N' }
}

function setWidths(ws: Sheet, widths: number[]) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtDateTime(d: Date | null): string {
  return d ? d.toISOString().replace('T', ' ').slice(0, 16) : ''
}

// ── Sheet 1: Summary ────────────────────────────────────────────────────────
// Meta, headline numbers, what to do next, Bloom's roll-up and the legend.
// Bloom's lived on its own tab before; five rows did not justify one.

function buildSummary(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  const { meta, insights } = data
  const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: TABS.summary } } })
  setWidths(ws, [26, 48, 16, 16, 18])
  ws.views = [{ showGridLines: false }]

  const brand = ws.addRow(['Quizotic'])
  ws.mergeCells(brand.number, 1, brand.number, 5)
  brand.height = 30
  brand.getCell(1).fill = fill(C.navy)
  brand.getCell(1).font = font({ size: SIZE.brand, bold: true, color: C.yellow })
  brand.getCell(1).alignment = { vertical: 'middle', indent: 1 }

  const kicker = ws.addRow(['SESSION REPORT'])
  ws.mergeCells(kicker.number, 1, kicker.number, 5)
  kicker.height = 18
  kicker.getCell(1).fill = fill(C.navy)
  kicker.getCell(1).font = font({ size: SIZE.small, bold: true, color: C.white })
  kicker.getCell(1).alignment = { vertical: 'middle', indent: 1 }
  ws.addRow([])
  placeMark(wb, ws, 5)

  const title = ws.addRow([meta.quizTitle])
  ws.mergeCells(title.number, 1, title.number, 5)
  title.getCell(1).font = font({ size: SIZE.title, bold: true })
  title.height = 22

  const detail: Array<[string, string | number | null]> = [
    ['Date', fmtDate(meta.startedAt)],
    ['Session code', meta.code ?? '—'],
    ['Format', meta.mode === 'async' ? 'Self-paced' : 'Live'],
    ['Host', meta.hostName ?? '—'],
  ]
  if (meta.subject) detail.push(['Subject', meta.subject])
  for (const [label, value] of detail) {
    const r = ws.addRow([label, value])
    r.height = 19
    r.getCell(1).font = font({ bold: true, color: C.muted })
    r.getCell(2).font = font()
  }
  if (meta.durationSec != null) {
    const d = ws.addRow(['Duration', toExcelDuration(meta.durationSec)])
    d.height = 19
    d.getCell(1).font = font({ bold: true, color: C.muted })
    d.getCell(2).numFmt = DURATION_FMT
    d.getCell(2).font = font()
  }
  ws.addRow([])

  headerRow(ws, ['Participants', 'Questions', 'Class accuracy', 'Average score', 'Completed'])
  const values = ws.addRow([
    meta.participantCount,
    meta.questionCount,
    toFraction(meta.classAccuracyPct),
    meta.avgScore,
    meta.completedCount,
  ])
  values.height = 40
  values.eachCell((cell, col) => {
    cell.font = font({ size: SIZE.kpi, bold: true, color: col === 3 ? accuracyColor(meta.classAccuracyPct) : C.ink })
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = thinBorder()
    if (col === 3) cell.numFmt = PERCENT_FMT
    if (col === 4) cell.numFmt = '#,##0'
  })
  ws.addRow([])

  const headline: string[] = []
  if (insights.masteredQuestions.length > 0) headline.push(`${insights.masteredQuestions.length} mastered (≥80%)`)
  if (insights.weakestQuestions.length > 0) headline.push(`${insights.weakestQuestions.length} need re-teaching`)
  if (data.misconceptions && data.misconceptions.answerCount > 0) {
    headline.push(`${data.misconceptions.answerCount} confident-but-wrong answers`)
  }
  if (headline.length > 0) {
    const h = ws.addRow([headline.join('   ·   ')])
    ws.mergeCells(h.number, 1, h.number, 5)
    h.height = 26
    h.getCell(1).fill = fill(C.luckyBg)
    h.getCell(1).font = font({ size: SIZE.section, bold: true, color: C.luckyText })
    h.getCell(1).alignment = { vertical: 'middle', indent: 1 }
    h.getCell(1).border = thinBorder(C.luckyText)
  }

  const next = ws.addRow(['What to do next', insights.suggestedNextStep])
  next.height = 34
  next.getCell(1).font = font({ bold: true, color: C.masteryText })
  next.getCell(2).font = font()
  next.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
  ws.mergeCells(next.number, 2, next.number, 5)

  if (insights.weakestQuestions.length > 0) {
    ws.addRow([])
    sectionLabel(ws, 'Re-teach first')
    // Insights key off the raw question index; every sheet numbers questions by
    // display position (leaderboard slides removed). Translate, or the summary
    // points at a different Q-number than the analysis sheet.
    const positionByIndex = new Map(data.questions.map(q => [q.index, q.position]))
    for (const q of insights.weakestQuestions) {
      const r = ws.addRow([`Q${positionByIndex.get(q.index) ?? q.index + 1}`, q.text, toFraction(q.correctPct)])
      r.height = 19
      r.getCell(1).font = font({ bold: true, color: C.misconceptionText })
      r.getCell(2).font = font()
      paintAccuracy(r.getCell(3), q.correctPct)
    }
  }

  if (data.blooms.length > 0) {
    ws.addRow([])
    sectionLabel(ws, "Performance by Bloom's level")
    const hint = ws.addRow(['Which cognitive levels the group holds, and which they only recognise.'])
    hint.getCell(1).font = font({ color: C.muted })
    hint.height = 18
    const bloomsHeader = headerRow(ws, ['Level', 'Questions', 'Correct', 'Wrong', 'Accuracy'])
    for (const b of data.blooms) {
      const r = ws.addRow([b.label, b.questionCount, b.correct, b.wrong, toFraction(b.accuracyPct)])
      r.getCell(1).alignment = { indent: 1, vertical: 'middle' }
      for (const col of [2, 3, 4]) r.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(3).fill = fill(C.masteryBg)
      r.getCell(4).fill = fill(C.misconceptionBg)
      paintAccuracy(r.getCell(5), b.accuracyPct)
    }
    bandRows(ws, bloomsHeader.number + 1, ws.rowCount, 5)
  }

  ws.addRow([])
  sectionLabel(ws, 'How to read this workbook')
  const legend: Array<[string, string]> = [
    ['Accuracy colours', 'Green ≥80% · amber 50–79% · red under 50%'],
    ['Mastery', 'Answered correctly and felt sure — solid knowledge'],
    ['Misconception', 'Answered wrongly but felt sure — re-teach this first'],
    ['Lucky', 'Answered correctly but felt unsure — not yet secure'],
    ['Gap', 'Answered wrongly and felt unsure — a known unknown'],
    ['Amber name', 'Two participants used the same display name — check before merging'],
  ]
  for (const [term, meaning] of legend) {
    const r = ws.addRow([term, meaning])
    r.height = 18
    r.getCell(1).font = font({ size: SIZE.small, bold: true, color: C.muted })
    r.getCell(2).font = font({ size: SIZE.small, color: C.muted })
    ws.mergeCells(r.number, 2, r.number, 5)
  }

  ws.addRow([])
  const foot = ws.addRow([`Generated by Quizotic · quizotic.live · ${fmtDateTime(meta.generatedAt)} UTC`])
  ws.mergeCells(foot.number, 1, foot.number, 5)
  foot.getCell(1).font = font({ size: SIZE.small, italic: true, color: C.muted })

  printSetup(ws, false, 'portrait')
}

// ── Sheet 2: Participants ───────────────────────────────────────────────────
// Leaderboard and attendance were two sheets repeating name, identity, score
// and team for every person. One row per participant instead.

function buildParticipants(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  if (data.participants.length === 0) return
  const ws = wb.addWorksheet('Participants', { properties: { tabColor: { argb: TABS.participants } } })
  setWidths(ws, [8, 28, 24, 15, 13, 13, 12, 12, 16, 14, 19, 19, 18])

  sheetTitle(
    wb, ws, 'Participants',
    `${data.participants.length} joined · ranked by score · accuracy is over all ${data.questions.filter(q => q.isScored).length} scored questions`,
    13,
  )
  headerRow(ws, [
    'Rank', 'Name', 'Real name / ID', 'Team', 'Score', 'Accuracy',
    'Correct', 'Wrong', 'Unattempted', 'Time taken', 'Joined at', 'Left at', 'Status',
  ])

  for (const p of data.participants) {
    const row = ws.addRow([
      p.rank,
      p.name,
      p.identity ?? '',
      p.team ?? '',
      p.score,
      toFraction(p.accuracyPct),
      p.correct,
      p.wrong,
      p.unattempted,
      toExcelDuration(p.timeSec),
      fmtDateTime(p.joinedAt),
      fmtDateTime(p.leftAt),
      p.completed ? 'Completed' : 'Did not finish',
    ])
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(5).font = font({ bold: true })
    row.getCell(5).numFmt = '#,##0'
    row.getCell(7).fill = fill(C.masteryBg)
    row.getCell(8).fill = fill(C.misconceptionBg)
    row.getCell(9).fill = fill(C.gapBg)
    row.getCell(10).numFmt = DURATION_FMT
    for (const col of [5, 7, 8, 9, 10]) {
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    paintAccuracy(row.getCell(6), p.accuracyPct)
    row.getCell(13).font = font({ bold: true, color: p.completed ? C.masteryText : C.luckyText })
    if (p.rank <= 3) {
      row.getCell(1).fill = fill([C.gold, C.silver, C.bronze][p.rank - 1])
      row.getCell(1).font = font({ bold: true })
    }
    // Two rows may be the same human. Flag it rather than let a host merge
    // them silently — the Summary legend explains the tint.
    if (p.duplicateName) {
      row.getCell(2).fill = fill(C.flagBg)
      row.getCell(2).font = font({ italic: true, color: C.luckyText })
    }
  }

  bandRows(ws, HEADER_ROW + 1, ws.rowCount, 13)
  freezeAndFilter(ws, 13, 2)
  printSetup(ws, true)
}

// ── Sheet 3: Question Analysis ──────────────────────────────────────────────

function buildQuestionAnalysis(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  if (data.questions.length === 0) return
  const ws = wb.addWorksheet('Question Analysis', { properties: { tabColor: { argb: TABS.questions } } })
  setWidths(ws, [6, 48, 17, 15, 14, 12, 12, 16, 13, 20, 32, 40, 13, 17, 12, 12])

  sheetTitle(
    wb, ws, 'Question analysis',
    'Accuracy is over the participants who answered. The last four columns split every scored answer by how sure the participant felt.',
    16,
  )
  headerRow(ws, [
    '#', 'Question', 'Type', 'Bloom level', 'Accuracy', 'Correct', 'Wrong', 'Unattempted',
    'Avg time', 'Verdict', 'Correct answer', 'Explanation',
    'Mastery', 'Misconception', 'Lucky', 'Gap',
  ])

  for (const q of data.questions) {
    const verdict = !q.isScored ? 'Unscored'
      : q.accuracyPct == null ? '—'
      : q.accuracyPct >= 80 ? 'Mastered'
      : q.accuracyPct >= 50 ? 'Mixed'
      : 'Needs re-teaching'

    const row = ws.addRow([
      q.position,
      q.text,
      q.typeLabel,
      q.bloomsLevel ? BLOOMS_LABELS[q.bloomsLevel] : '',
      q.isScored ? toFraction(q.accuracyPct) : null,
      q.isScored ? q.correct : null,
      q.isScored ? q.wrong : null,
      q.unattempted,
      toExcelDuration(q.avgTimeSec),
      verdict,
      q.correctAnswerText ?? '',
      q.explanation ?? '',
      q.confidence?.sureCorrect ?? null,
      q.confidence?.sureWrong ?? null,
      q.confidence?.unsureCorrect ?? null,
      q.confidence?.unsureWrong ?? null,
    ])
    row.height = 30
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(11).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(12).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(9).numFmt = DURATION_FMT
    for (const col of [6, 7, 8, 9, 13, 14, 15, 16]) {
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    paintAccuracy(row.getCell(5), q.isScored ? q.accuracyPct : null)
    row.getCell(10).font = font({ bold: true, color: q.isScored ? accuracyColor(q.accuracyPct) : C.violet })

    // Only tint cells that carry a number. An unscored row has no correct or
    // wrong count, and a green/red wash over an empty cell reads as a bug.
    if (q.isScored) {
      row.getCell(6).fill = fill(C.masteryBg)
      row.getCell(7).fill = fill(C.misconceptionBg)
    }
    row.getCell(8).fill = fill(C.gapBg)
    if (q.confidence) {
      row.getCell(13).fill = fill(C.masteryBg)
      row.getCell(14).fill = fill(C.misconceptionBg)
      row.getCell(15).fill = fill(C.luckyBg)
      row.getCell(16).fill = fill(C.gapBg)
      if (q.confidence.sureWrong > 0) {
        row.getCell(14).font = font({ bold: true, color: C.misconceptionText })
      }
    }
  }

  bandRows(ws, HEADER_ROW + 1, ws.rowCount, 16)

  const scored = data.questions.filter(q => q.isScored)
  const totals = ws.addRow([
    '', 'All questions', '', '',
    toFraction(data.meta.classAccuracyPct),
    scored.reduce((s, q) => s + q.correct, 0),
    scored.reduce((s, q) => s + q.wrong, 0),
    data.questions.reduce((s, q) => s + q.unattempted, 0),
    null, '', '', '',
    scored.reduce((s, q) => s + (q.confidence?.sureCorrect ?? 0), 0),
    scored.reduce((s, q) => s + (q.confidence?.sureWrong ?? 0), 0),
    scored.reduce((s, q) => s + (q.confidence?.unsureCorrect ?? 0), 0),
    scored.reduce((s, q) => s + (q.confidence?.unsureWrong ?? 0), 0),
  ])
  totals.height = 22
  totals.eachCell((cell, col) => {
    cell.fill = fill(C.navy)
    cell.font = font({ bold: true, color: col === 5 ? C.yellow : C.white })
    cell.border = thinBorder(C.navy)
    cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center', indent: col === 2 ? 1 : 0 }
  })
  totals.getCell(5).numFmt = PERCENT_FMT

  freezeAndFilter(ws, 16, 2)
  printSetup(ws, true)
}

// ── Sheet 4: Answer Key ─────────────────────────────────────────────────────
// Scored questions only — a poll has no key, and its distribution is on
// Responses. Correct/wrong counts live on Question Analysis, not repeated here.

function buildAnswerKey(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  if (data.questions.length === 0) return

  // Every question in the quiz gets a row — a host reconciling a challenge from
  // a participant needs to look up any question, not only the multiple-choice
  // ones. Fill-in-the-blank and matching carry a key but no options; polls and
  // open slides carry neither, and say so rather than being silently dropped.
  const optionCount = Math.min(8, Math.max(0, ...data.questions.map(q => q.options.length)))
  const ws = wb.addWorksheet('Answer Key', { properties: { tabColor: { argb: TABS.answerKey } } })
  const lastCol = 4 + optionCount
  setWidths(ws, [5, 44, 16, 34, ...Array(optionCount).fill(26)])

  sheetTitle(
    wb, ws, 'Answer key',
    'Every question, with its correct answer. Where the question had options, each cell also shows how many chose it — the correct one is bold on green.',
    lastCol,
  )
  headerRow(ws, [
    '#', 'Question', 'Type', 'Correct answer',
    ...Array.from({ length: optionCount }, (_, i) => `Option ${String.fromCharCode(65 + i)}`),
  ])

  for (const q of data.questions) {
    const answer = q.correctAnswerText
      ?? (q.isScored ? 'Not recorded' : 'No correct answer — participation only')
    const cells: (string | number)[] = [q.position, q.text, q.typeLabel, answer]
    for (let i = 0; i < optionCount; i++) {
      const label = q.options[i]
      if (label === undefined) { cells.push(''); continue }
      const count = q.optionDistribution[i] ?? 0
      const pct = q.responses > 0 ? Math.round((count / q.responses) * 100) : 0
      cells.push(`${label}\n${count} chose this (${pct}%)`)
    }
    const row = ws.addRow(cells)
    row.height = 38
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle', indent: 1 }
    row.getCell(3).alignment = { vertical: 'middle', indent: 1 }
    row.getCell(4).alignment = { wrapText: true, vertical: 'middle', indent: 1 }
    row.getCell(4).font = q.isScored
      ? font({ bold: true, color: C.masteryText })
      : font({ italic: true, color: C.muted })
    for (let i = 0; i < optionCount; i++) {
      const cell = row.getCell(5 + i)
      cell.alignment = { wrapText: true, vertical: 'middle', indent: 1 }
      if (q.isScored && q.correctIndexes.includes(i)) {
        cell.fill = fill(C.masteryBg)
        cell.font = font({ bold: true, color: C.masteryText })
      }
    }
  }

  bandRows(ws, HEADER_ROW + 1, ws.rowCount, lastCol)
  freezeAndFilter(ws, lastCol, 2)
  printSetup(ws, true)
}

// ── Sheet 5: Participant x Question ─────────────────────────────────────────
// Just the grid. Score, accuracy and time per participant are on Participants.

function buildMatrix(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  if (data.participants.length === 0 || data.questions.length === 0) return
  // "x" not "×" — the sheet name ends up inside formula references.
  const ws = wb.addWorksheet('Participant x Question', { properties: { tabColor: { argb: TABS.matrix } } })

  const qCount = data.questions.length
  setWidths(ws, [26, 22, ...Array(qCount).fill(22)])

  sheetTitle(
    wb, ws, 'Every participant against every question',
    'Green correct · red wrong · violet answered (unscored) · grey no answer. Bold means the participant said they were sure.',
    2 + qCount,
  )
  // Q-numbers alone would be unreadable, so the header carries a short label.
  headerRow(ws, [
    'Participant', 'Real name / ID',
    ...data.questions.map(q => `Q${q.position}. ${q.text.length > 40 ? `${q.text.slice(0, 40)}…` : q.text}`),
  ])

  for (const p of data.participants) {
    const row = ws.addRow([
      p.name,
      p.identity ?? '',
      ...data.questions.map((_, i) => p.cells[i]?.display ?? ''),
    ])
    row.height = 20
    data.questions.forEach((_, i) => {
      const cell = row.getCell(3 + i)
      const state = p.cells[i]?.state
      cell.fill = fill(
        state === 'correct' ? C.correctBg
        : state === 'wrong' ? C.wrongBg
        : state === 'answered' ? C.answeredBg
        : C.blankBg,
      )
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      cell.font = font({ bold: p.cells[i]?.confidence === 'sure' })
    })
    if (p.duplicateName) {
      row.getCell(1).fill = fill(C.flagBg)
      row.getCell(1).font = font({ italic: true, color: C.luckyText })
    }
  }

  bandRows(ws, HEADER_ROW + 1, ws.rowCount, 2 + qCount)
  freezeAndFilter(ws, 2 + qCount, 2)
  printSetup(ws, true)
}

// ── Sheet 6: Misconceptions ─────────────────────────────────────────────────
// Only the named follow-up list. The quadrant counts stay on Question Analysis.

function buildMisconceptions(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  const summary = data.misconceptions
  if (!summary || summary.answerCount === 0) return

  const ws = wb.addWorksheet('Misconceptions', { properties: { tabColor: { argb: TABS.misconceptions } } })
  setWidths(ws, [6, 46, 17, 15, 13, 74])

  sheetTitle(
    wb, ws, 'Confidently wrong',
    `${summary.learnerCount} ${summary.learnerCount === 1 ? 'participant' : 'participants'} answered wrongly while feeling sure — ${summary.answerCount} answers across ${summary.questionCount} ${summary.questionCount === 1 ? 'question' : 'questions'}. Start the next session here.`,
    6,
  )
  headerRow(ws, ['#', 'Question', 'Confidently wrong', 'Respondents', 'Share', 'Who to follow up with'])

  const positionByIndex = new Map(data.questions.map(q => [q.index, q.position]))
  for (const q of summary.questions) {
    const row = ws.addRow([
      positionByIndex.get(q.index) ?? q.index + 1,
      q.label,
      q.answerCount,
      q.respondentCount,
      toFraction(q.affectedPct),
      q.participants.map(p => p.name).join(', '),
    ])
    row.height = 30
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(6).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(3).fill = fill(C.misconceptionBg)
    row.getCell(3).font = font({ bold: true, color: C.misconceptionText })
    row.getCell(5).numFmt = PERCENT_FMT
    for (const col of [3, 4, 5]) row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
  }

  bandRows(ws, HEADER_ROW + 1, ws.rowCount, 6)
  freezeAndFilter(ws, 6, 2)
  printSetup(ws, true)
}

// ── Sheet 7: Responses ──────────────────────────────────────────────────────

function buildResponses(wb: ExcelJS.Workbook, data: SessionWorkbookData) {
  // The name-capture slide is an identity prompt, not a discussion question —
  // its answers are already the "Real name / ID" column on every other sheet.
  const nonScored = data.questions.filter(q => !q.isScored && !q.isNameCapture)
  if (nonScored.length === 0) return

  const ws = wb.addWorksheet('Responses', { properties: { tabColor: { argb: TABS.responses } } })
  setWidths(ws, [7, 54, 18, 16, 16])
  sheetTitle(
    wb, ws, 'Polls, word clouds, ratings and open responses',
    'Everything the unscored slides collected — none of this survives a scores-only export.',
    5,
  )

  for (const q of nonScored) {
    // One navy band per question. Same treatment as a header row, because
    // that is exactly what it is.
    const band = ws.addRow([`Q${q.position}`, q.text, q.typeLabel, `${q.responses} responses`])
    band.height = 24
    for (let c = 1; c <= 5; c++) {
      const cell = band.getCell(c)
      cell.fill = fill(C.navy)
      cell.font = font({ size: SIZE.header, bold: true, color: C.white })
      cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
      cell.border = thinBorder(C.navy)
    }

    const columns = (labels: string[]) => {
      const r = ws.addRow(['', ...labels])
      r.height = 16
      r.eachCell((cell, col) => {
        if (col === 1) return
        cell.font = font({ size: SIZE.small, bold: true, color: C.muted })
        cell.border = thinBorder()
        cell.alignment = { horizontal: col === 2 ? 'left' : 'center', indent: col === 2 ? 1 : 0 }
      })
      return r
    }
    const first = ws.rowCount + 1

    if (q.type === 'wordcloud' && q.wordFrequencies) {
      const entries = Object.entries(q.wordFrequencies).sort((a, b) => b[1] - a[1])
      if (entries.length === 0) { ws.addRow(['', 'No words submitted']); ws.addRow([]); continue }
      columns(['Word', 'Mentions', 'Share'])
      const total = entries.reduce((s, [, n]) => s + n, 0)
      for (const [word, count] of entries) {
        const r = ws.addRow(['', word, count, total > 0 ? count / total : 0])
        r.getCell(4).numFmt = PERCENT_FMT
        for (const col of [3, 4]) r.getCell(col).alignment = { horizontal: 'center' }
      }
    } else if (q.type === 'rating' && q.ratingHistogram) {
      columns(['Rating', 'Count', 'Share'])
      const total = q.ratingHistogram.reduce((s, n) => s + n, 0)
      q.ratingHistogram.forEach((count, i) => {
        const r = ws.addRow(['', `${i + 1} star${i === 0 ? '' : 's'}`, count, total > 0 ? count / total : 0])
        r.getCell(4).numFmt = PERCENT_FMT
        for (const col of [3, 4]) r.getCell(col).alignment = { horizontal: 'center' }
      })
      const avg = ws.addRow(['', 'Average', q.ratingAverage ?? null, ''])
      avg.getCell(2).font = font({ bold: true })
      avg.getCell(3).font = font({ bold: true, color: C.luckyText })
      avg.getCell(3).alignment = { horizontal: 'center' }
    } else if (q.type === 'ranking' && q.rankingItems) {
      columns(['Item', 'Average position', 'Ranked first'])
      q.rankingItems.forEach((item, i) => {
        const r = ws.addRow(['', item, q.rankingAverages?.[i] ?? null, q.rankingFirstPlaceCounts?.[i] ?? 0])
        for (const col of [3, 4]) r.getCell(col).alignment = { horizontal: 'center' }
      })
    } else if (q.textResponses && q.textResponses.length > 0) {
      columns(['Response', 'Participant'])
      for (const t of q.textResponses) {
        const r = ws.addRow(['', t.answer, t.name ?? ''])
        r.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
      }
    } else if (q.options.length > 0) {
      columns(['Option', 'Votes', 'Share'])
      q.options.forEach((opt, i) => {
        const count = q.optionDistribution[i] ?? 0
        const r = ws.addRow(['', opt, count, q.responses > 0 ? count / q.responses : 0])
        r.getCell(4).numFmt = PERCENT_FMT
        for (const col of [3, 4]) r.getCell(col).alignment = { horizontal: 'center' }
      })
    } else {
      ws.addRow(['', 'No responses recorded'])
    }

    for (let r = first; r <= ws.rowCount; r++) {
      const bodyRow = ws.getRow(r)
      if (!bodyRow.height) bodyRow.height = 19
      for (let c = 2; c <= 5; c++) {
        const cell = bodyRow.getCell(c)
        cell.border = thinBorder()
        if (!cell.font?.name) cell.font = font()
        if (!cell.alignment) cell.alignment = { vertical: 'middle', indent: 1 }
      }
    }
    ws.addRow([])
  }

  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW - 1, activeCell: 'A1', showGridLines: false }]
  printSetup(ws, false)
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function buildSessionWorkbook(data: SessionWorkbookData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Quizotic'
  wb.company = 'Quizotic'
  wb.created = data.meta.startedAt
  wb.modified = data.meta.generatedAt
  wb.title = `${data.meta.quizTitle} — session report`
  wb.subject = 'Quizotic session report'
  // XLSX has no font embedding, so a viewer without Calibri gets a substitute.
  // Setting it on the theme as well as every cell keeps the fallback uniform
  // rather than mixing the theme default with our explicit font.
  wb.views = [{ x: 0, y: 0, width: 20000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

  buildSummary(wb, data)
  buildParticipants(wb, data)
  buildQuestionAnalysis(wb, data)
  buildAnswerKey(wb, data)
  buildMatrix(wb, data)
  buildMisconceptions(wb, data)
  buildResponses(wb, data)

  return wb
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function workbookFilename(meta: Pick<WorkbookMeta, 'quizTitle' | 'startedAt'>): string {
  const slug = meta.quizTitle.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'session'
  return `quizotic-${slug.slice(0, 50)}-${fmtDate(meta.startedAt)}.xlsx`
}
