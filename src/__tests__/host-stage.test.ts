import { describe, expect, it } from 'vitest'
import {
  buildLeaderboardStageRows,
  getPostQuestionAction,
  getHostQuestionFit,
  getHostTipText,
} from '../lib/host-stage'

describe('getHostTipText', () => {
  it('returns the trimmed tip when the host authored one', () => {
    expect(getHostTipText({ explanation: '  LLMs predict tokens. ', connectedCount: 12 }))
      .toBe('LLMs predict tokens.')
  })

  it('returns null (NO bar) when the tip is empty and participants answered', () => {
    expect(getHostTipText({ explanation: null, connectedCount: 12 })).toBeNull()
    expect(getHostTipText({ explanation: undefined, connectedCount: 3 })).toBeNull()
  })

  it('treats a whitespace-only tip as empty', () => {
    expect(getHostTipText({ explanation: '   ', connectedCount: 5 })).toBeNull()
  })

  it('falls back to the nobody-answered notice only in an empty room', () => {
    expect(getHostTipText({ explanation: null, connectedCount: 0 }))
      .toBe('No participants answered this question.')
    expect(getHostTipText({ explanation: 'Real tip', connectedCount: 0 })).toBe('Real tip')
  })
})

describe('buildLeaderboardStageRows', () => {
  it('adds previous rank and score deltas for visible leaderboard rows', () => {
    const previous = [
      { name: 'Asha', score: 900 },
      { name: 'Ravi', score: 800 },
      { name: 'Meera', score: 700 },
    ]
    const current = [
      { name: 'Meera', score: 1400 },
      { name: 'Asha', score: 1000 },
      { name: 'Ravi', score: 820 },
    ]

    const rows = buildLeaderboardStageRows(current, previous, 5)

    expect(rows.map(row => [row.name, row.rank, row.previousRank, row.rankDelta, row.scoreDelta])).toEqual([
      ['Meera', 1, 3, 2, 700],
      ['Asha', 2, 1, -1, 100],
      ['Ravi', 3, 2, -1, 20],
    ])
  })

  it('marks first-time leaderboard rows without fake movement', () => {
    const rows = buildLeaderboardStageRows([{ name: 'Asha', score: 900 }], [], 5)

    expect(rows[0]).toMatchObject({
      rank: 1,
      previousRank: null,
      rankDelta: 0,
      scoreDelta: 900,
    })
  })
})

describe('getPostQuestionAction', () => {
  it('keeps live questions waiting when nobody is connected', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: false,
      questionEnded: false,
      correctRevealed: false,
      isLastQuestion: false,
      answered: 0,
      connectedCount: 0,
    })).toBe('waiting')
  })

  it('lets a live non-scored question advance when all connected participants answered', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: false,
      questionEnded: false,
      correctRevealed: false,
      isLastQuestion: false,
      answered: 1,
      connectedCount: 1,
    })).toBe('next')
  })

  it('lets a live final non-scored question end when all connected participants answered', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: false,
      questionEnded: false,
      correctRevealed: false,
      isLastQuestion: true,
      answered: 1,
      connectedCount: 1,
    })).toBe('end')
  })

  it('reveals live scored answers first when all connected participants answered', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: true,
      questionEnded: false,
      correctRevealed: false,
      isLastQuestion: false,
      answered: 3,
      connectedCount: 3,
    })).toBe('reveal')
  })

  it('reveals competitive scored answers before standings', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: true,
      questionEnded: true,
      correctRevealed: false,
      isLastQuestion: false,
    })).toBe('reveal')
  })

  it('moves to standings after competitive scored answers are revealed', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: true,
      questionEnded: true,
      correctRevealed: true,
      isLastQuestion: false,
    })).toBe('standings')
  })

  it('ends the quiz after the final revealed competitive question', () => {
    expect(getPostQuestionAction({
      sessionMode: 'competitive',
      isScored: true,
      questionEnded: true,
      correctRevealed: true,
      isLastQuestion: true,
    })).toBe('end')
  })
})

describe('getHostQuestionFit', () => {
  it('keeps short questions in the large presenter treatment', () => {
    expect(getHostQuestionFit({
      questionText: 'Which planet is closest to the Sun?',
      optionTexts: ['Mercury', 'Venus', 'Earth', 'Mars'],
      hasExplanation: false,
    })).toEqual({
      questionClass: 'host-question-fit-large',
      optionClass: 'host-option-fit-large',
      explanationClass: 'host-explanation-fit-roomy',
    })
  })

  it('tightens the presenter stage for long reveal content', () => {
    const longQuestion = 'In a photosynthesis reaction, which of the following correctly describes the complete process by which light energy is converted into stored chemical energy in glucose?'
    const longOptions = [
      'Light is absorbed by chlorophyll, water is split to release oxygen, and ATP and NADPH power the Calvin cycle to fix carbon dioxide into glucose',
      'Carbon dioxide is directly converted into oxygen by mitochondria during cellular respiration without any involvement of sunlight at all',
      'Glucose is broken down into water and carbon dioxide, releasing stored light energy back into the surrounding environment',
      'Oxygen molecules from the atmosphere are absorbed by roots and transported upward to leaves where they become glucose',
    ]

    expect(getHostQuestionFit({
      questionText: longQuestion,
      optionTexts: longOptions,
      hasExplanation: true,
    })).toEqual({
      questionClass: 'host-question-fit-tight',
      optionClass: 'host-option-fit-tight',
      explanationClass: 'host-explanation-fit-compact',
    })
  })

  it('uses a reveal-safe question treatment for long revealed questions', () => {
    expect(getHostQuestionFit({
      stage: 'reveal',
      questionText: 'Which regulatory body oversees the Indian securities and stock market and protects investor interests across exchanges?',
      optionTexts: [
        'Securities and Exchange Board of India (SEBI), the statutory regulator for securities',
        'Reserve Bank of India (RBI)',
        'Ministry of Finance, Government of India',
        'Planning Commission of India and NITI Aayog jointly oversee market regulation',
      ],
      hasExplanation: true,
    })).toEqual({
      questionClass: 'host-question-fit-reveal',
      optionClass: 'host-option-fit-tight',
      explanationClass: 'host-explanation-fit-compact',
    })
  })

  it('keeps short revealed questions in the large presenter treatment', () => {
    expect(getHostQuestionFit({
      stage: 'reveal',
      questionText: 'Which planet is closest to the Sun?',
      optionTexts: ['Mercury', 'Venus', 'Earth', 'Mars'],
      hasExplanation: true,
    })).toEqual({
      questionClass: 'host-question-fit-large',
      optionClass: 'host-option-fit-large',
      explanationClass: 'host-explanation-fit-roomy',
    })
  })

  it('tightens long reveal options without shrinking a short revealed question', () => {
    expect(getHostQuestionFit({
      stage: 'reveal',
      questionText: 'Who regulates securities markets in India?',
      optionTexts: [
        'Securities and Exchange Board of India, usually abbreviated as SEBI',
        'Reserve Bank of India with support from the Ministry of Finance',
        'National Stock Exchange and Bombay Stock Exchange acting together',
        'NITI Aayog and the Planning Commission acting as market supervisors',
      ],
      hasExplanation: true,
    })).toEqual({
      questionClass: 'host-question-fit-large',
      optionClass: 'host-option-fit-tight',
      explanationClass: 'host-explanation-fit-compact',
    })
  })
})
