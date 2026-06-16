'use client'

/**
 * QuestionSettingsPopover — gear-icon popover for advanced per-question settings.
 * Replaces the permanent right inspector panel from the legacy builder.
 *
 * Sections: Image · Learning goal (Bloom's) · Explanation/Debrief · Quality checklist
 * Scenario fields (case type only).
 *
 * Ported from QuestionEditor right-panel sections (host/create/page.tsx:1075-1148).
 */

import React from 'react'
import type { Question, BloomsLevel } from '@/lib/quiz-types'
import { isScoredQuestion } from '@/lib/quiz-types'
import { ImageUpload } from '@/components/ImageUpload'
import { hasCorrectAnswer, needsCorrectAnswer } from '@/lib/quiz-builder-logic'

const BLOOMS_OPTIONS: { value: BloomsLevel | ''; label: string; color: string }[] = [
  { value: '', label: 'None', color: '#94A3B8' },
  { value: 'remember', label: 'Remember', color: '#2563EB' },
  { value: 'understand', label: 'Understand', color: '#0891B2' },
  { value: 'apply', label: 'Apply', color: '#16A34A' },
  { value: 'analyse', label: 'Analyse', color: '#D97706' },
  { value: 'evaluate', label: 'Evaluate', color: '#DC2626' },
  { value: 'create', label: 'Create', color: '#7C3AED' },
]

export interface QuestionSettingsPopoverProps {
  question: Question
  onChange: (partial: Partial<Question>) => void
  onClose: () => void
}

export function QuestionSettingsPopover({ question, onChange, onClose }: QuestionSettingsPopoverProps) {
  // Quality checklist — derived read-only indicators
  const hasAnswer = needsCorrectAnswer(question.type) ? hasCorrectAnswer(question.type, question) : true
  const hasExplanation = !!(question.explanation?.trim())
  const hasBloom = !!question.bloomsLevel
  const hasImage = !!question.imageUrl
  const checkItems = [
    { ok: hasAnswer, label: needsCorrectAnswer(question.type) ? (question.type === 'multiselect' ? 'Correct options selected' : 'Correct answer marked') : 'No answer needed' },
    { ok: hasExplanation, label: question.type === 'case' ? 'Debrief written' : 'Explanation written' },
    { ok: hasBloom, label: 'Learning goal set' },
    { ok: hasImage, label: 'Image attached (optional)', optional: true },
  ]
  const completedCount = checkItems.filter(c => !c.optional && c.ok).length
  const requiredCount = checkItems.filter(c => !c.optional).length

  return (
    <>
      {/* Scrim — mobile only, dismisses on tap */}
      <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} />
      {/*
        Mobile: fixed bottom sheet (escapes overflow-y-auto clip on the card)
        Desktop: classic absolute dropdown below the gear button
      */}
      <div
        className="fixed left-2 right-2 bottom-20 z-50 rounded-2xl shadow-2xl border bg-white overflow-y-auto md:absolute md:left-auto md:right-0 md:bottom-auto md:top-full md:mt-1 md:w-80"
        style={{ maxHeight: 'calc(100vh - 140px)', borderColor: '#E5E7EB' }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-8 h-1 rounded-full bg-gray-300" />
        </div>
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 pt-4 pb-3 border-b" style={{ borderColor: '#F3F4F6' }}>
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#0F1B3D' }}>Question Settings</p>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="px-4 py-3 space-y-5">

        {/* Quality checklist */}
        <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#94A3B8' }}>Quality checklist</p>
            <span
              className="text-[10px] font-bold"
              style={{ color: completedCount === requiredCount ? '#16A34A' : '#94A3B8' }}
            >
              {completedCount} / {requiredCount}
            </span>
          </div>
          <div className="space-y-1.5">
            {checkItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: item.ok ? '#16A34A' : item.optional ? '#E5E7EB' : '#FEF3C7', border: `1.5px solid ${item.ok ? '#16A34A' : item.optional ? '#D1D5DB' : '#FCD34D'}` }}
                >
                  {item.ok ? (
                    <svg viewBox="0 0 16 16" className="w-2.5 h-2.5" fill="none">
                      <path d="M3.5 8l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.optional ? '#9CA3AF' : '#F59E0B' }} />
                  )}
                </span>
                <span className="text-[11px] font-medium" style={{ color: item.ok ? '#374151' : item.optional ? '#9CA3AF' : '#92400E' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scenario fields (case type only) */}
        {question.type === 'case' && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Scenario Block</p>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">Scenario Narrative</label>
              <textarea
                value={question.scenarioText ?? ''}
                onChange={e => onChange({ scenarioText: e.target.value || undefined })}
                placeholder="Describe the situation the participant faces..."
                rows={3}
                maxLength={600}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">Supporting Detail <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={question.supportingDetail ?? ''}
                onChange={e => onChange({ supportingDetail: e.target.value || undefined })}
                placeholder="e.g., '72% of employees face this...'"
                maxLength={200}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        )}

        {/* Image */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Image</p>
          <ImageUpload
            imageUrl={question.imageUrl}
            onUpload={url => onChange({ imageUrl: url })}
            onRemove={() => onChange({ imageUrl: undefined })}
            variant="question"
          />
        </div>

        {/* Learning goal (Bloom's) */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#9CA3AF' }}>
            Learning goal
            <span className="ml-1.5 text-purple-400">●</span>
          </p>
          <p className="text-[11px] text-gray-400 mb-2">What cognitive skill does this question test?</p>
          <div className="flex flex-wrap gap-1.5">
            {BLOOMS_OPTIONS.map(b => {
              const active = (question.bloomsLevel ?? '') === b.value
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => onChange({ bloomsLevel: (b.value as BloomsLevel) || undefined })}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={
                    active
                      ? { background: b.color, color: '#fff', border: `1.5px solid ${b.color}` }
                      : { background: '#fff', color: b.color, border: `1.5px solid ${b.color}40` }
                  }
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Explanation / Debrief */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#9CA3AF' }}>
            {question.type === 'case' ? 'Debrief' : 'Explanation'}
          </p>
          <p className="text-[11px] text-gray-400 mb-2">Shown after participants answer.</p>
          <textarea
            value={question.explanation ?? ''}
            onChange={e => onChange({ explanation: e.target.value || undefined })}
            placeholder={
              question.type === 'case'
                ? "Expert reasoning — what's the right call and why?"
                : 'Why is this the correct answer?'
            }
            rows={3}
            maxLength={500}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none hover:border-blue-200 hover:bg-white transition-colors"
          />
        </div>
      </div>
      </div>
    </>
  )
}
