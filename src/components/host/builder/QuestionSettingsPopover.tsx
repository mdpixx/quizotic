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
import type { Question, BloomsLevel, OpenEndedInputMode } from '@/lib/quiz-types'
import { ImageUpload } from '@/components/ImageUpload'
import { hasCorrectAnswer, needsCorrectAnswer } from '@/lib/quiz-builder-logic'
import { normalizeInputMode } from '@/lib/openended-input.mjs'

// Open-ended answer-shape presets. 'any' is the historical behaviour and stays
// the default, so no existing question changes meaning.
const INPUT_MODE_OPTIONS: { value: OpenEndedInputMode; label: string; help: string }[] = [
  { value: 'any', label: 'Anything', help: 'Free text — no restrictions.' },
  { value: 'text', label: 'Letters only', help: 'Blocks digits and symbols. Good for names.' },
  { value: 'number', label: 'Numbers only', help: 'Opens the numeric keypad on phones. Good for roll numbers.' },
  { value: 'alphanumeric', label: 'Letters + numbers', help: 'Blocks symbols. Good for employee codes.' },
]

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
  const currentInputMode = normalizeInputMode(question.inputMode) as OpenEndedInputMode

  return (
    <>
      {/* Scrim — mobile only, dismisses on tap */}
      <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} />
      {/*
        Mobile: fixed bottom sheet (escapes overflow-y-auto clip on the card)
        Desktop: classic absolute dropdown below the gear button
      */}
      <div
        className="fixed left-2 right-2 bottom-20 z-50 rounded-2xl border bg-white overflow-y-auto md:absolute md:left-auto md:right-0 md:bottom-auto md:top-full md:mt-1 md:w-80"
        style={{ maxHeight: 'calc(100vh - 140px)', borderColor: '#E8EAED', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 16px 40px rgba(15,27,61,0.14)' }}
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

        {/* Answer format (open-ended only) — lets a host collect roll numbers
            and employee codes as clean, uniform values instead of spending the
            evening reconciling "42", "Roll 42" and "no.42" by hand. */}
        {question.type === 'openended' && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Answer Format</p>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">Participants can enter</label>
              <div className="grid grid-cols-2 gap-1.5">
                {INPUT_MODE_OPTIONS.map(opt => {
                  const active = currentInputMode === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChange({ inputMode: opt.value === 'any' ? undefined : opt.value })}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors"
                      style={{
                        background: active ? '#0F1B3D' : '#F8FAFC',
                        color: active ? '#fff' : '#475569',
                        border: `1px solid ${active ? '#0F1B3D' : '#E2E8F0'}`,
                      }}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug" style={{ color: '#94A3B8' }}>
                {INPUT_MODE_OPTIONS.find(o => o.value === currentInputMode)?.help}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600">
                <input
                  type="checkbox"
                  checked={question.lengthMode === 'exact'}
                  onChange={e => onChange(
                    e.target.checked
                      ? { lengthMode: 'exact', exactLength: question.exactLength ?? 6 }
                      : { lengthMode: undefined, exactLength: undefined },
                  )}
                  className="w-3.5 h-3.5 accent-[#0F1B3D]"
                />
                Fixed length
              </label>
              {question.lengthMode === 'exact' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={question.exactLength ?? 6}
                    onChange={e => {
                      const n = parseInt(e.target.value, 10)
                      onChange({ exactLength: Number.isFinite(n) ? Math.min(64, Math.max(1, n)) : 6 })
                    }}
                    className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-[11px] text-gray-500">
                    {currentInputMode === 'number' ? 'digits' : 'characters'} exactly
                  </span>
                </div>
              )}
            </div>

            {currentInputMode !== 'number' && (
              <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600">
                <input
                  type="checkbox"
                  checked={question.transform === 'uppercase'}
                  onChange={e => onChange({ transform: e.target.checked ? 'uppercase' : undefined })}
                  className="w-3.5 h-3.5 accent-[#0F1B3D]"
                />
                Convert to UPPERCASE
                <span className="font-normal text-gray-400">— merges emp123 / EMP123</span>
              </label>
            )}

            <label className="flex items-start gap-2 text-[11px] font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={question.isNameCapture === true}
                onChange={e => onChange({ isNameCapture: e.target.checked ? true : undefined })}
                className="w-3.5 h-3.5 mt-0.5 accent-[#0F1B3D]"
              />
              <span>
                This slide collects identity
                <span className="block font-normal text-gray-400 leading-snug">
                  The answer appears under each participant&apos;s name in your report — use it to
                  match mistyped or duplicate join names to real people.
                </span>
              </span>
            </label>
          </div>
        )}

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
                      ? { background: b.color, color: '#fff', border: `1px solid ${b.color}` }
                      : { background: '#fff', color: b.color, border: `1px solid ${b.color}40` }
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
