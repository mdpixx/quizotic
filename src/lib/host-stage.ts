export interface LeaderboardStageEntry {
  name: string
  score: number
  archetype?: string
}

export interface LeaderboardStageRow extends LeaderboardStageEntry {
  id: string
  rank: number
  previousRank: number | null
  rankDelta: number
  scoreDelta: number
}

export type PostQuestionAction = 'waiting' | 'reveal' | 'standings' | 'next' | 'end'

export interface HostQuestionFitInput {
  stage?: 'live' | 'reveal'
  questionText: string
  optionTexts: string[]
  hasExplanation: boolean
}

export interface HostQuestionFit {
  questionClass: 'host-question-fit-large' | 'host-question-fit-comfy' | 'host-question-fit-tight' | 'host-question-fit-reveal'
  optionClass: 'host-option-fit-large' | 'host-option-fit-comfy' | 'host-option-fit-tight'
  explanationClass: 'host-explanation-fit-roomy' | 'host-explanation-fit-compact'
}

interface PostQuestionActionInput {
  sessionMode: string
  isScored: boolean
  questionEnded: boolean
  correctRevealed: boolean
  isLastQuestion: boolean
  answered?: number
  connectedCount?: number
}

function entryId(entry: LeaderboardStageEntry): string {
  return `${entry.archetype || ''}:${entry.name}`
}

function sortLeaderboard(entries: LeaderboardStageEntry[]): LeaderboardStageEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export function buildLeaderboardStageRows(
  current: LeaderboardStageEntry[],
  previous: LeaderboardStageEntry[] = [],
  topN = 10,
): LeaderboardStageRow[] {
  const previousRanks = new Map<string, { rank: number; score: number }>()
  sortLeaderboard(previous).forEach((entry, index) => {
    previousRanks.set(entryId(entry), { rank: index + 1, score: entry.score })
  })

  return sortLeaderboard(current).slice(0, topN).map((entry, index) => {
    const id = entryId(entry)
    const rank = index + 1
    const previousState = previousRanks.get(id)
    const previousRank = previousState?.rank ?? null
    return {
      ...entry,
      id,
      rank,
      previousRank,
      rankDelta: previousRank === null ? 0 : previousRank - rank,
      scoreDelta: entry.score - (previousState?.score ?? 0),
    }
  })
}

export function getPostQuestionAction({
  sessionMode,
  isScored,
  questionEnded,
  correctRevealed,
  isLastQuestion,
  answered = 0,
  connectedCount = 0,
}: PostQuestionActionInput): PostQuestionAction {
  const everyoneAnswered = connectedCount > 0 && answered >= connectedCount
  if (!questionEnded && !everyoneAnswered) return 'waiting'
  if (isLastQuestion) {
    if (sessionMode === 'competitive' && isScored && !correctRevealed) return 'reveal'
    return 'end'
  }
  if (sessionMode === 'competitive' && isScored) {
    return correctRevealed ? 'standings' : 'reveal'
  }
  return 'next'
}

export function getHostQuestionFit({
  stage = 'live',
  questionText,
  optionTexts,
  hasExplanation,
}: HostQuestionFitInput): HostQuestionFit {
  const questionLength = questionText.trim().length
  const longestOptionLength = optionTexts.reduce((max, option) => Math.max(max, option.trim().length), 0)
  const totalOptionLength = optionTexts.reduce((sum, option) => sum + option.trim().length, 0)
  const pressureScore =
    questionLength +
    longestOptionLength * 1.3 +
    totalOptionLength * 0.45 +
    (hasExplanation ? 70 : 0)

  if (stage === 'reveal') {
    const optionPressure = longestOptionLength * 1.4 + totalOptionLength * 0.45
    const questionClass =
      questionLength >= 80
        ? 'host-question-fit-reveal'
        : questionLength >= 56
          ? 'host-question-fit-comfy'
          : 'host-question-fit-large'
    const optionClass =
      optionPressure >= 220 || longestOptionLength >= 62
        ? 'host-option-fit-tight'
        : optionPressure >= 150 || longestOptionLength >= 44
          ? 'host-option-fit-comfy'
          : 'host-option-fit-large'

    return {
      questionClass,
      optionClass,
      explanationClass: hasExplanation && (questionClass !== 'host-question-fit-large' || optionClass !== 'host-option-fit-large')
        ? 'host-explanation-fit-compact'
        : 'host-explanation-fit-roomy',
    }
  }

  if (pressureScore >= 420 || questionLength >= 140 || longestOptionLength >= 115) {
    return {
      questionClass: 'host-question-fit-tight',
      optionClass: 'host-option-fit-tight',
      explanationClass: 'host-explanation-fit-compact',
    }
  }

  if (pressureScore >= 250 || questionLength >= 80 || longestOptionLength >= 64) {
    return {
      questionClass: 'host-question-fit-comfy',
      optionClass: 'host-option-fit-comfy',
      explanationClass: hasExplanation ? 'host-explanation-fit-compact' : 'host-explanation-fit-roomy',
    }
  }

  return {
    questionClass: 'host-question-fit-large',
    optionClass: 'host-option-fit-large',
    explanationClass: 'host-explanation-fit-roomy',
  }
}
