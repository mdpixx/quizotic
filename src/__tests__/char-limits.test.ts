import { describe, expect, it } from 'vitest'
import {
  OPTION_CHAR_LIMIT,
  OPTION_CHAR_LIMIT_LONG,
  QUESTION_CHAR_LIMIT,
  QUESTION_CHAR_LIMIT_LONG,
  SCENARIO_CHAR_LIMIT,
  SCENARIO_CHAR_LIMIT_LONG,
  SUPPORTING_DETAIL_CHAR_LIMIT,
  SUPPORTING_DETAIL_CHAR_LIMIT_LONG,
  optionCharLimit,
  questionCharLimit,
  scenarioCharLimit,
  supportingDetailCharLimit,
} from '../lib/quiz-types'
import * as builderLogic from '../lib/quiz-builder-logic'
import { normalizeQuestion } from '../lib/public-api'
import { toPublicQuestion } from '../lib/scoring'

describe('character limits', () => {
  it('gives a slide with no longText flag the default caps', () => {
    expect(questionCharLimit({})).toBe(QUESTION_CHAR_LIMIT)
    expect(optionCharLimit({})).toBe(OPTION_CHAR_LIMIT)
    expect(scenarioCharLimit({})).toBe(SCENARIO_CHAR_LIMIT)
    expect(supportingDetailCharLimit({})).toBe(SUPPORTING_DETAIL_CHAR_LIMIT)
  })

  it('treats an explicit false the same as absent', () => {
    expect(questionCharLimit({ longText: false })).toBe(QUESTION_CHAR_LIMIT)
    expect(optionCharLimit({ longText: false })).toBe(OPTION_CHAR_LIMIT)
  })

  it('raises every cap on a longText slide', () => {
    expect(questionCharLimit({ longText: true })).toBe(QUESTION_CHAR_LIMIT_LONG)
    expect(optionCharLimit({ longText: true })).toBe(OPTION_CHAR_LIMIT_LONG)
    expect(scenarioCharLimit({ longText: true })).toBe(SCENARIO_CHAR_LIMIT_LONG)
    expect(supportingDetailCharLimit({ longText: true })).toBe(SUPPORTING_DETAIL_CHAR_LIMIT_LONG)
  })

  it('raises the question and option caps by 10x', () => {
    expect(QUESTION_CHAR_LIMIT_LONG).toBe(QUESTION_CHAR_LIMIT * 10)
    expect(OPTION_CHAR_LIMIT_LONG).toBe(OPTION_CHAR_LIMIT * 10)
  })

  // The builder imports its constants from quiz-builder-logic while
  // quiz-validation imports them from quiz-types. If those two ever became
  // separate definitions, the input a host can type and the ceiling the
  // validator enforces would silently disagree.
  it('exposes the same values through quiz-builder-logic', () => {
    expect(builderLogic.QUESTION_CHAR_LIMIT).toBe(QUESTION_CHAR_LIMIT)
    expect(builderLogic.OPTION_CHAR_LIMIT).toBe(OPTION_CHAR_LIMIT)
    expect(builderLogic.questionCharLimit({ longText: true })).toBe(QUESTION_CHAR_LIMIT_LONG)
    expect(builderLogic.optionCharLimit({ longText: true })).toBe(OPTION_CHAR_LIMIT_LONG)
  })
})

// Every layer between the builder and the player either spreads the question or
// rebuilds it from a field whitelist. A whitelist that forgets the flag lays a
// 1,600-character question out as if it were 160 and clips it, with nothing in
// the logs to say why.
describe('longText survives the serialization boundaries', () => {
  const long = {
    id: 'q1',
    type: 'mcq' as const,
    text: 'x'.repeat(1200),
    options: ['a', 'b'],
    correctAnswer: '0',
    timerSeconds: 60,
    points: 1000 as const,
    longText: true,
  }

  it('reaches the self-paced player through toPublicQuestion', () => {
    expect(toPublicQuestion(long)).toMatchObject({ longText: true })
  })

  it('survives the REST API normalizer', () => {
    expect(normalizeQuestion(long, 0)).toMatchObject({ longText: true })
  })

  it('is omitted rather than written as false for a standard question', () => {
    expect('longText' in normalizeQuestion({ ...long, longText: undefined }, 0)).toBe(false)
    expect('longText' in normalizeQuestion({ ...long, longText: false }, 0)).toBe(false)
  })
})
