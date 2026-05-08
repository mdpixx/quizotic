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

interface PostQuestionActionInput {
  sessionMode: string
  isScored: boolean
  questionEnded: boolean
  correctRevealed: boolean
  isLastQuestion: boolean
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
}: PostQuestionActionInput): PostQuestionAction {
  if (!questionEnded) return 'waiting'
  if (isLastQuestion) {
    if (sessionMode === 'competitive' && isScored && !correctRevealed) return 'reveal'
    return 'end'
  }
  if (sessionMode === 'competitive' && isScored) {
    return correctRevealed ? 'standings' : 'reveal'
  }
  return 'next'
}
