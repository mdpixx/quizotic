import { describe, expect, it } from 'vitest'
import {
  buildLeaderboardStageRows,
  getPostQuestionAction,
} from '../lib/host-stage'

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
