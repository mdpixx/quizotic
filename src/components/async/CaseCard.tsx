'use client'

import { OptionGrid } from './OptionGrid'
import type { AsyncInputProps } from './types'

export function CaseCard({ question, disabled, onSubmit }: AsyncInputProps) {
  return (
    <div className="space-y-4">
      {(question.scenarioText || question.supportingDetail) && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {question.scenarioText && (
            <p className="text-sm font-semibold leading-relaxed" style={{ color: '#E2E8F0' }}>
              {question.scenarioText}
            </p>
          )}
          {question.supportingDetail && (
            <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
              {question.supportingDetail}
            </p>
          )}
        </div>
      )}
      <OptionGrid question={question} disabled={disabled} onSubmit={onSubmit} />
    </div>
  )
}
