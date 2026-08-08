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
  /** Question.longText — the slide opted into 10x character caps. */
  longText?: boolean
}

/**
 * How the stage splits its height between the question card and the answer
 * grid, and how many columns the grid uses.
 *
 * `host-stage-standard` is the no-op: it carries no CSS of its own, so a normal
 * slide keeps the base 34% question cap and the 2-column grid exactly as before.
 * The three long variants only ever apply to a longText slide, and they exist
 * because shrinking the font is not the only lever — giving the long side more
 * of the stage, and letting a long answer span the full width instead of half
 * of it, buys back roughly a font step at the same area.
 */
export type HostStageClass =
  | 'host-stage-standard'
  | 'host-stage-long-question'
  | 'host-stage-long-balanced'
  | 'host-stage-long-options'

export interface HostQuestionFit {
  questionClass: 'host-question-fit-large' | 'host-question-fit-comfy' | 'host-question-fit-tight' | 'host-question-fit-reveal'
  optionClass: 'host-option-fit-large' | 'host-option-fit-comfy' | 'host-option-fit-tight'
  explanationClass: 'host-explanation-fit-roomy' | 'host-explanation-fit-compact'
  stageClass: HostStageClass
  /** 1 forces a single full-width column; 2 keeps the standard 2x2 grid. */
  optionColumns: 1 | 2
}

/**
 * Where a long-text slide's pressure actually sits, so the stage can hand the
 * height to whichever side needs it. Returns the standard no-op for any slide
 * that has not opted in.
 */
function getStageSplit(
  longText: boolean,
  questionLength: number,
  longestOptionLength: number,
): { stageClass: HostStageClass; optionColumns: 1 | 2 } {
  if (!longText) return { stageClass: 'host-stage-standard', optionColumns: 2 }

  // A full-width tile fits roughly twice the characters per line, which is
  // worth more than any further font reduction once answers get this long.
  const optionColumns: 1 | 2 = longestOptionLength >= 160 ? 1 : 2

  if (longestOptionLength >= 300) return { stageClass: 'host-stage-long-options', optionColumns }
  if (questionLength >= 400 && longestOptionLength < 160) {
    return { stageClass: 'host-stage-long-question', optionColumns }
  }
  return { stageClass: 'host-stage-long-balanced', optionColumns }
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
  longText = false,
}: HostQuestionFitInput): HostQuestionFit {
  const questionLength = questionText.trim().length
  const longestOptionLength = optionTexts.reduce((max, option) => Math.max(max, option.trim().length), 0)
  const totalOptionLength = optionTexts.reduce((sum, option) => sum + option.trim().length, 0)
  const pressureScore =
    questionLength +
    longestOptionLength * 1.3 +
    totalOptionLength * 0.45 +
    (hasExplanation ? 70 : 0)

  const split = getStageSplit(longText, questionLength, longestOptionLength)

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
      ...split,
      questionClass,
      optionClass,
      explanationClass: hasExplanation && (questionClass !== 'host-question-fit-large' || optionClass !== 'host-option-fit-large')
        ? 'host-explanation-fit-compact'
        : 'host-explanation-fit-roomy',
    }
  }

  if (pressureScore >= 420 || questionLength >= 140 || longestOptionLength >= 115) {
    return {
      ...split,
      questionClass: 'host-question-fit-tight',
      optionClass: 'host-option-fit-tight',
      explanationClass: 'host-explanation-fit-compact',
    }
  }

  if (pressureScore >= 250 || questionLength >= 80 || longestOptionLength >= 64) {
    return {
      ...split,
      questionClass: 'host-question-fit-comfy',
      optionClass: 'host-option-fit-comfy',
      explanationClass: hasExplanation ? 'host-explanation-fit-compact' : 'host-explanation-fit-roomy',
    }
  }

  return {
    ...split,
    questionClass: 'host-question-fit-large',
    optionClass: 'host-option-fit-large',
    explanationClass: 'host-explanation-fit-roomy',
  }
}

/**
 * What the reveal tip bar should display — or null for NO bar at all.
 *
 * The bar chrome must never render without text: a live classroom session
 * (participants connected, host authored no tip) used to show an empty bar
 * with a lone 💡 on every reveal. Whitespace-only tips count as empty. The
 * "nobody answered" notice is real content, but only when the room is
 * actually empty — with participants present, silence means "no tip".
 */
export function getHostTipText({
  explanation,
  connectedCount,
}: {
  explanation: string | null | undefined
  connectedCount: number
}): string | null {
  const tip = explanation?.trim()
  if (tip) return tip
  return connectedCount === 0 ? 'No participants answered this question.' : null
}
