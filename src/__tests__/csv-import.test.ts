import { describe, expect, it } from 'vitest'
import { SAMPLE_CSV, VALID_POINTS, VALID_TIMERS, parseCsvToQuestions } from '@/lib/csv-import'

// The importer clamps `timer` and `points` to a fixed set of allowed values.
// It used to do that silently: a host who typed 25 got 20 and never found out
// until the quiz ran. These tests lock the warning contract, plus the parsing
// behaviour the warnings sit on top of.

describe('parseCsvToQuestions — happy path', () => {
  it('imports the shipped template without warnings', () => {
    const result = parseCsvToQuestions(SAMPLE_CSV)
    expect(result.error).toBeUndefined()
    expect(result.warnings).toBeUndefined()
    expect(result.questions).toHaveLength(3)
  })

  it('reads options, correct letter, timer and points off the template', () => {
    const [first] = parseCsvToQuestions(SAMPLE_CSV).questions
    expect(first.type).toBe('mcq')
    expect(first.options).toEqual(['3', '4', '5', '6'])
    expect(first.correctAnswer).toBe('1') // B
    expect(first.timerSeconds).toBe(20)
    expect(first.points).toBe(1000)
  })

  it('treats a row with no options as open-ended', () => {
    const last = parseCsvToQuestions(SAMPLE_CSV).questions[2]
    expect(last.type).toBe('openended')
    expect(last.options).toBeUndefined()
  })
})

describe('parseCsvToQuestions — coercion warnings', () => {
  const header = 'question,optionA,optionB,correctAnswer,timer,points'

  it('warns when a timer is coerced, and still imports the question', () => {
    const result = parseCsvToQuestions(`${header}\n"Q1",yes,no,A,25,1000`)
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].timerSeconds).toBe(20)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings?.[0]).toContain('"25"')
    expect(result.warnings?.[0]).toContain(String(VALID_TIMERS[0]))
  })

  it('warns when points are coerced', () => {
    const result = parseCsvToQuestions(`${header}\n"Q1",yes,no,A,20,750`)
    expect(result.questions[0].points).toBe(1000)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings?.[0]).toContain('"750"')
    expect(result.warnings?.[0]).toContain(String(VALID_POINTS[0]))
  })

  it('reports timer and points separately when both are off-list', () => {
    const result = parseCsvToQuestions(`${header}\n"Q1",yes,no,A,25,750`)
    expect(result.warnings).toHaveLength(2)
  })

  // A 200-row export with the same bad timer everywhere should say it once.
  it('collapses the same bad value across many rows into one warning', () => {
    const rows = Array.from({ length: 50 }, (_, i) => `"Q${i}",yes,no,A,25,1000`).join('\n')
    const result = parseCsvToQuestions(`${header}\n${rows}`)
    expect(result.questions).toHaveLength(50)
    expect(result.warnings).toHaveLength(1)
  })

  it('summarises once there are more distinct bad values than it will name', () => {
    const bad = [11, 12, 13, 14, 16, 17, 18]
    const rows = bad.map((t, i) => `"Q${i}",yes,no,A,${t},1000`).join('\n')
    const warning = parseCsvToQuestions(`${header}\n${rows}`).warnings?.[0] ?? ''
    expect(warning).toMatch(/and \d+ other values/)
  })

  // A blank cell means "use the default" — that is not a mistake worth flagging.
  it('does not warn about empty timer/points cells', () => {
    const result = parseCsvToQuestions(`${header}\n"Q1",yes,no,A,,`)
    expect(result.warnings).toBeUndefined()
    expect(result.questions[0].timerSeconds).toBe(20)
    expect(result.questions[0].points).toBe(1000)
  })

  it('does not warn when the columns are absent entirely', () => {
    const result = parseCsvToQuestions('question,optionA,optionB,correctAnswer\n"Q1",yes,no,A')
    expect(result.warnings).toBeUndefined()
    expect(result.questions[0].timerSeconds).toBe(20)
  })
})

describe('parseCsvToQuestions — errors', () => {
  it('rejects a file with only a header row', () => {
    expect(parseCsvToQuestions('question,optionA').error).toMatch(/empty or has only a header/)
  })

  it('rejects a file with no question column', () => {
    expect(parseCsvToQuestions('prompt,optionA\n"Q1",yes').error).toMatch(/"question" not found/)
  })

  it('rejects a file whose rows are all blank questions', () => {
    expect(parseCsvToQuestions('question,optionA\n,yes').error).toMatch(/No valid questions/)
  })
})
