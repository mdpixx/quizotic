'use client'

/**
 * AddInteractionPicker — Slido-style type picker shown when the host clicks "+ Add".
 *
 * Question type is chosen here, ONCE — eliminating the three duplicate type pickers
 * that existed in the legacy builder (left-top switcher + left-bottom grid + right panel).
 *
 * Has a "✨ Generate with AI" box at the top that routes to the bulk AI flow.
 */

import React from 'react'
import type { QuestionType } from '@/lib/quiz-types'
import { TYPE_PILLS, QUESTION_TYPE_GROUPS } from '@/lib/quiz-builder-logic'
import { getTypeIcon } from '@/lib/quiz-type-icons'

export interface AddInteractionPickerProps {
  onAdd: (type: QuestionType) => void
  onGenerateAI: () => void
  onClose: () => void
}

export function AddInteractionPicker({ onAdd, onGenerateAI, onClose }: AddInteractionPickerProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-50 rounded-2xl shadow-2xl border bg-white overflow-y-auto"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(480px, 95vw)',
          maxHeight: '80vh',
          borderColor: '#E5E7EB',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b" style={{ borderColor: '#F3F4F6' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#7C3AED' }}>Add interaction</p>
            <h2 className="text-lg font-black mt-0.5" style={{ color: '#0F1B3D' }}>What type do you want?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ✨ Generate with AI box */}
          <button
            type="button"
            onClick={onGenerateAI}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all hover:brightness-97"
            style={{
              background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
              border: '1.5px solid #DDD6FE',
            }}
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#7C3AED', color: '#fff' }}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                <path d="M8 1l1.5 4H14l-3.5 2.5L12 12 8 9.5 4 12l1.5-4.5L2 5h4.5z" fillOpacity="0.9"/>
              </svg>
            </span>
            <div>
              <p className="text-sm font-black" style={{ color: '#5B21B6' }}>Generate with AI</p>
              <p className="text-[11px] font-medium" style={{ color: '#7C3AED' }}>Create questions from a topic, document, or URL</p>
            </div>
            <span className="ml-auto text-purple-400 text-lg">&#8250;</span>
          </button>

          {/* Manual type grid grouped by category */}
          {QUESTION_TYPE_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-2.5" style={{ color: '#9CA3AF' }}>{group.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {group.types.map(type => {
                  const p = TYPE_PILLS.find(t => t.value === type)
                  if (!p) return null
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onAdd(type)}
                      className="flex flex-col items-start gap-2 p-3.5 rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-md group"
                      style={{ background: p.bg, border: `1px solid ${p.color}22` }}
                      title={p.tooltip}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}18`, border: `1.5px solid ${p.color}33` }}>
                        {getTypeIcon(type)}
                      </span>
                      <span className="text-[11px] font-black leading-tight" style={{ color: p.color }}>
                        {p.label}
                      </span>
                      <span className="text-[10px] leading-snug opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: p.color }}>
                        {p.tooltip}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
