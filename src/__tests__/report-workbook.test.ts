import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildSessionWorkbook, workbookFilename } from '../lib/report-workbook'
import type { Question } from '../lib/quiz-types'
import {
  ATTENDEES,
  START,
  fixture,
  question,
  type RawAnswer,
} from './fixtures/report-fixture'

function sheetNames(wb: ExcelJS.Workbook): string[] {
  return wb.worksheets.map(ws => ws.name)
}

// ── assemble() ──────────────────────────────────────────────────────────────

describe('assemble', () => {
  it('drops leaderboard slides and renumbers the remaining questions', () => {
    const data = fixture()
    expect(data.questions).toHaveLength(6)
    expect(data.questions.map(q => q.position)).toEqual([1, 2, 3, 4, 5, 6])
    expect(data.questions.some(q => q.type === 'leaderboard')).toBe(false)
    // Original indexes survive so the misconception summary can key off them.
    expect(data.questions.map(q => q.index)).toEqual([0, 1, 2, 4, 5, 6])
  })

  it('computes accuracy over responders and unattempted against the roster', () => {
    const q1 = fixture().questions.find(q => q.index === 1)!
    expect(q1.responses).toBe(3)
    expect(q1.correct).toBe(2)
    expect(q1.wrong).toBe(1)
    expect(q1.accuracyPct).toBe(67)
    expect(q1.unattempted).toBe(0)

    const q2 = fixture().questions.find(q => q.index === 2)!
    expect(q2.responses).toBe(2)
    expect(q2.unattempted).toBe(1) // three on the roster, two answered
    expect(q2.accuracyPct).toBe(50)
  })

  it('averages answer time from timeMs, which the cached stats never stored', () => {
    const q1 = fixture().questions.find(q => q.index === 1)!
    // (12000 + 16000 + 25000) / 3 = 17667ms
    expect(q1.avgTimeSec).toBe(18)
  })

  it('splits confidence into the four quadrants', () => {
    const data = fixture()
    expect(data.questions.find(q => q.index === 1)!.confidence).toEqual({
      sureCorrect: 1, sureWrong: 0, unsureCorrect: 1, unsureWrong: 1,
    })
    expect(data.questions.find(q => q.index === 2)!.confidence).toEqual({
      sureCorrect: 1, sureWrong: 1, unsureCorrect: 0, unsureWrong: 0,
    })
    // Non-scored slides carry no quadrants at all.
    expect(data.questions.find(q => q.index === 4)!.confidence).toBeNull()
  })

  it('names who was confidently wrong', () => {
    const summary = fixture().misconceptions
    expect(summary).not.toBeNull()
    expect(summary!.answerCount).toBe(1)
    expect(summary!.questions[0].participants.map(p => p.name)).toEqual(['Kuldeep'])
  })

  it('promotes the name-capture answer to the identity column', () => {
    const ved = fixture().participants.find(p => p.score === 2000)!
    expect(ved.identity).toBe('00508845')
  })

  it('flags participants sharing a display name', () => {
    const duplicates = fixture().participants.filter(p => p.duplicateName)
    expect(duplicates.map(p => p.name)).toEqual(['Ved', 'Ved'])
  })

  it('resolves option indexes to readable answers in the matrix cells', () => {
    const data = fixture()
    const ved = data.participants.find(p => p.identity === '00508845')!
    const col = data.questions.findIndex(q => q.index === 1)
    expect(ved.cells[col]).toMatchObject({
      state: 'correct',
      display: 'A. ASTM D2270',
      confidence: 'sure',
    })
    const pollCol = data.questions.findIndex(q => q.index === 4)
    expect(ved.cells[pollCol]).toMatchObject({ state: 'answered', display: 'B. Evening' })
  })

  it('marks unanswered questions blank rather than wrong', () => {
    const data = fixture()
    const secondVed = data.participants.find(p => p.name === 'Ved' && p.identity === null)!
    const col = data.questions.findIndex(q => q.index === 2)
    expect(secondVed.cells[col].state).toBe('blank')
    expect(secondVed.unattempted).toBe(1)
  })

  it('marks the identity slide so the Responses sheet can skip it', () => {
    const data = fixture()
    expect(data.questions.find(q => q.index === 0)!.isNameCapture).toBe(true)
    expect(data.questions.find(q => q.index === 5)!.isNameCapture).toBe(false)
  })

  it('captures poll, word cloud and rating payloads', () => {
    const data = fixture()
    expect(data.questions.find(q => q.index === 4)!.optionDistribution).toEqual([1, 1, 0])
    expect(data.questions.find(q => q.index === 5)!.wordFrequencies).toEqual({ useful: 2, practical: 1 })
    const rating = data.questions.find(q => q.index === 6)!
    expect(rating.ratingHistogram).toEqual([0, 0, 0, 1, 1])
    expect(rating.ratingAverage).toBe(4.5)
  })

  it('rolls up accuracy by Bloom\'s level', () => {
    const blooms = fixture().blooms
    expect(blooms.map(b => b.level)).toEqual(['remember', 'analyse'])
    expect(blooms.find(b => b.level === 'remember')).toMatchObject({ correct: 2, wrong: 1, accuracyPct: 67 })
  })

  it('resolves the answer key text for scored questions only', () => {
    const data = fixture()
    expect(data.questions.find(q => q.index === 1)!.correctAnswerText).toBe('A. ASTM D2270')
    expect(data.questions.find(q => q.index === 4)!.correctAnswerText).toBeNull()
  })

  it('ranks participants by score', () => {
    const ranks = fixture().participants.map(p => ({ rank: p.rank, score: p.score }))
    expect(ranks).toEqual([{ rank: 1, score: 2000 }, { rank: 2, score: 1000 }, { rank: 3, score: 0 }])
  })
})

// ── buildSessionWorkbook() ──────────────────────────────────────────────────

describe('buildSessionWorkbook', () => {
  it('builds every sheet when all data types are present', () => {
    const wb = buildSessionWorkbook(fixture())
    expect(sheetNames(wb)).toEqual([
      'Summary', 'Participants', 'Question Analysis', 'Answer Key',
      'Participant x Question', 'Misconceptions', 'Responses',
    ])
  })

  it('omits the conditional sheets when their data is absent', () => {
    // Scored questions only: no confidence data, no unscored slides.
    const bare: Question[] = [
      question({ id: 'q1', type: 'mcq', text: 'Plain question', options: ['A', 'B'], correctAnswer: '0' }),
    ]
    const answers: RawAnswer[] = [
      { attendeeId: 'a1', participantId: 'p1', questionIndex: 0, answer: '0', isCorrect: true, points: 1000, timeMs: 1000, confidence: null },
    ]
    const wb = buildSessionWorkbook(fixture({ questions: bare, answers, attendees: [ATTENDEES[0]] }))
    const names = sheetNames(wb)
    expect(names).not.toContain('Misconceptions')
    expect(names).not.toContain('Responses')
    expect(names).toContain('Question Analysis')
  })

  it('survives a session with no answers at all', () => {
    const wb = buildSessionWorkbook(fixture({ answers: [], attendees: [] }))
    expect(sheetNames(wb)).toContain('Summary')
    expect(sheetNames(wb)).not.toContain('Participants')
  })

  it("folds Bloom's into the Summary rather than spending a tab on five rows", () => {
    const wb = buildSessionWorkbook(fixture())
    expect(sheetNames(wb)).not.toContain("Bloom's")
    const ws = wb.getWorksheet('Summary')!
    const labels: string[] = []
    ws.eachRow(row => {
      const v = row.getCell(1).value
      if (typeof v === 'string') labels.push(v)
    })
    expect(labels).toContain('Remember')
    expect(labels.some(l => l.includes("Bloom's level"))).toBe(true)
  })

  it('gives every header cell the same navy treatment', () => {
    // A pastel header cell beside a navy one reads as a rendering fault. The
    // semantic tints belong on the data cells underneath.
    const wb = buildSessionWorkbook(fixture())
    for (const name of ['Participants', 'Question Analysis', 'Answer Key', 'Misconceptions']) {
      const header = wb.getWorksheet(name)!.getRow(4)
      header.eachCell(cell => {
        expect((cell.fill as ExcelJS.FillPattern)?.fgColor, `${name} header`).toEqual({ argb: 'FF0F1B3D' })
        expect(cell.font?.color).toEqual({ argb: 'FFFFFFFF' })
      })
    }
  })

  it('drops the columns Participants already carries from the matrix', () => {
    const wb = buildSessionWorkbook(fixture())
    const data = fixture()
    const ws = wb.getWorksheet('Participant x Question')!
    // Identity, name, then exactly one column per question — no trailing
    // score/accuracy/time repeat.
    expect(ws.getRow(4).cellCount).toBe(2 + data.questions.length)
  })

  it('writes percentages as fractions so Excel formats and charts them natively', async () => {
    const wb = buildSessionWorkbook(fixture())
    const ws = wb.getWorksheet('Question Analysis')!
    const header = ws.getRow(4)
    expect(header.getCell(5).value).toBe('Accuracy')
    const firstDataRow = ws.getRow(5)
    expect(firstDataRow.getCell(5).numFmt).toBe('0%')
  })

  it('numbers the summary re-teach list by display position, not raw index', () => {
    // Q index 2 sits at display position 3 once the leaderboard slide is gone.
    // The Summary must agree with the Question Analysis sheet.
    const wb = buildSessionWorkbook(fixture())
    const ws = wb.getWorksheet('Summary')!
    const labels: string[] = []
    ws.eachRow(row => {
      const first = row.getCell(1).value
      if (typeof first === 'string' && /^Q\d+$/.test(first)) labels.push(first)
    })
    expect(labels).toContain('Q3')
    expect(labels).not.toContain('Q0')
  })

  it('freezes headers and adds an autofilter on tabular sheets', () => {
    const wb = buildSessionWorkbook(fixture())
    const ws = wb.getWorksheet('Participants')!
    expect(ws.views[0]).toMatchObject({ state: 'frozen' })
    expect(ws.autoFilter).toBeTruthy()
  })

  it('lists every question on the answer key, not only the scored ones', () => {
    // A host fielding a challenge needs to look up any question. Unscored
    // slides say so explicitly rather than being silently dropped.
    const wb = buildSessionWorkbook(fixture())
    const data = fixture()
    const ws = wb.getWorksheet('Answer Key')!
    const rows: Array<{ text: string; answer: string }> = []
    ws.eachRow((row, n) => {
      if (n <= 4) return
      const text = row.getCell(2).value
      if (typeof text === 'string') rows.push({ text, answer: String(row.getCell(4).value ?? '') })
    })
    expect(rows).toHaveLength(data.questions.length)
    expect(rows.find(r => r.text.includes('Viscosity Index'))!.answer).toBe('A. ASTM D2270')
    expect(rows.find(r => r.text.includes('Which shift do you work'))!.answer)
      .toContain('No correct answer')
    expect(rows.some(r => r.text.includes('employee code'))).toBe(true)
  })

  it('keeps the accuracy fill and its text at different luminance', () => {
    // Green text on a green fill was invisible in the shipped file. Every
    // painted accuracy cell must pair a light tint with its own dark ink.
    const wb = buildSessionWorkbook(fixture())
    const ws = wb.getWorksheet('Question Analysis')!
    const pairs: Array<[string, string]> = []
    ws.eachRow((row, n) => {
      if (n <= 4) return
      const cell = row.getCell(5)
      const bg = (cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb
      const ink = cell.font?.color?.argb
      if (bg && ink) pairs.push([bg, ink])
    })
    expect(pairs.length).toBeGreaterThan(0)
    for (const [bg, ink] of pairs) {
      expect(bg).not.toBe(ink)
      // Crude luminance gap. Absolute, because the totals row deliberately
      // inverts it — yellow ink on navy rather than dark ink on a tint.
      const lum = (argb: string) => {
        const [r, g, b] = [2, 4, 6].map(i => parseInt(argb.slice(i, i + 2), 16))
        return 0.299 * r + 0.587 * g + 0.114 * b
      }
      expect(Math.abs(lum(bg) - lum(ink))).toBeGreaterThan(90)
    }
  })

  it('uses one typeface and no stray default-font cells', () => {
    const wb = buildSessionWorkbook(fixture())
    for (const ws of wb.worksheets) {
      ws.eachRow(row => {
        row.eachCell(cell => {
          if (cell.value == null || cell.value === '') return
          expect(cell.font?.name, `${ws.name}!${cell.address}`).toBe('Calibri')
        })
      })
    }
  })

  it('anchors the brand mark on every sheet', () => {
    const wb = buildSessionWorkbook(fixture())
    for (const ws of wb.worksheets) {
      expect(ws.getImages().length, `${ws.name} has no brand mark`).toBeGreaterThan(0)
    }
    // One image part, reused — not one copy per sheet.
    expect(wb.model.media.filter(m => m.type === 'image')).toHaveLength(1)
  })

  it('hides the gridlines so the drawn borders are the only structure', () => {
    const wb = buildSessionWorkbook(fixture())
    for (const ws of wb.worksheets) {
      expect(ws.views[0]?.showGridLines, `${ws.name}`).toBe(false)
    }
  })

  it('leaves the identity slide out of the responses sheet', () => {
    const wb = buildSessionWorkbook(fixture())
    const ws = wb.getWorksheet('Responses')!
    let sawEmployeeCode = false
    ws.eachRow(row => {
      row.eachCell(cell => {
        if (typeof cell.value === 'string' && cell.value.includes('00508845')) sawEmployeeCode = true
      })
    })
    expect(sawEmployeeCode).toBe(false)
  })

  it('tints the matrix cells by outcome', () => {
    const wb = buildSessionWorkbook(fixture())
    const ws = wb.getWorksheet('Participant x Question')!
    // Row 4 is the header; the top-ranked participant is row 5, Q2 is column 4.
    const cell = ws.getRow(5).getCell(4)
    expect((cell.fill as ExcelJS.FillPattern).fgColor).toEqual({ argb: 'FFDCFCE7' })
  })

  it('serialises to a real xlsx buffer', async () => {
    const wb = buildSessionWorkbook(fixture())
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer
    expect(buffer.byteLength).toBeGreaterThan(5000)
    // PK zip magic — a valid OOXML container.
    expect(Buffer.from(buffer.slice(0, 2)).toString()).toBe('PK')
  })
})

describe('workbookFilename', () => {
  it('slugs the title and stamps the session date', () => {
    expect(workbookFilename({ quizTitle: 'Lubes Knowledge League!', startedAt: START }))
      .toBe('quizotic-lubes-knowledge-league-2026-08-01.xlsx')
  })

  it('falls back when the title has no usable characters', () => {
    expect(workbookFilename({ quizTitle: '!!!', startedAt: START }))
      .toBe('quizotic-session-2026-08-01.xlsx')
  })
})
