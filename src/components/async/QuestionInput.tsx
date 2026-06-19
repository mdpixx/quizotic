'use client'

import dynamic from 'next/dynamic'
import { OptionGrid } from './OptionGrid'
import { MultiSelectGrid } from './MultiSelectGrid'
import { TextInput } from './TextInput'
import { RatingInput } from './RatingInput'
import { CaseCard } from './CaseCard'
import { MatchingInput } from './MatchingInput'
import type { AsyncInputProps } from './types'

const RankingInput = dynamic(() => import('./RankingInput').then(m => m.RankingInput), {
  loading: () => <div className="h-32 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />,
  ssr: false,
})

const DrawingInput = dynamic(() => import('./DrawingInput').then(m => m.DrawingInput), {
  loading: () => <div className="h-48 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />,
  ssr: false,
})

const INPUT_RENDERER: Record<string, (props: AsyncInputProps) => React.JSX.Element | null> = {
  mcq: p => <OptionGrid {...p} />,
  truefalse: p => <OptionGrid {...p} />,
  poll: p => <OptionGrid {...p} />,
  multiselect: p => <MultiSelectGrid {...p} />,
  openended: p => <TextInput {...p} />,
  wordcloud: p => <TextInput {...p} />,
  qa: p => <TextInput {...p} />,
  fillblank: p => <TextInput {...p} />,
  matching: p => <MatchingInput {...p} />,
  rating: p => <RatingInput {...p} />,
  ranking: p => <RankingInput {...p} />,
  drawing: p => <DrawingInput {...p} />,
  case: p => <CaseCard {...p} />,
}

export function QuestionInput(props: AsyncInputProps) {
  const renderer = INPUT_RENDERER[props.question.type]
  if (!renderer) return null
  return renderer(props)
}
