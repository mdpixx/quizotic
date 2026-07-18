'use client'

/**
 * AddInteractionPicker — Slido-style type picker shown when the host clicks "+ Add".
 *
 * Each question type is shown as a large illustrated card (Slido-inspired):
 *   - Top: a mini SVG illustration visually previewing what the type looks like
 *   - Bottom: type name (bold, accent color) + one-line description
 *
 * Has a "✨ Generate with AI" box at the top that routes to the bulk AI flow.
 */

import React from 'react'
import type { QuestionType } from '@/lib/quiz-types'
import { TYPE_PILLS, QUESTION_TYPE_GROUPS } from '@/lib/quiz-builder-logic'
import { getTypeIcon, getTypeIllustration } from '@/lib/quiz-type-icons'
import { SparkleIcon } from './SparkleIcon'

export interface AddInteractionPickerProps {
  onAdd: (type: QuestionType) => void
  onGenerateAI: () => void
  onClose: () => void
}

export function AddInteractionPicker({ onAdd, onGenerateAI, onClose }: AddInteractionPickerProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />

      {/* Panel — wider to fit the larger illustrated cards */}
      <div
        className="fixed z-50 rounded-[20px] border bg-white overflow-y-auto"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(680px, 94vw)',
          maxHeight: '82vh',
          borderColor: '#E8EAED',
          boxShadow: '0 24px 64px rgba(15,27,61,0.22)',
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
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[14px] text-left transition-shadow duration-150 hover:shadow-[0_8px_24px_rgba(124,58,237,0.12)]"
            style={{
              background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
              border: '1px solid #E4DEFA',
            }}
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#7C3AED', color: '#fff' }}>
              <SparkleIcon className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-black" style={{ color: '#5B21B6' }}>Generate with AI</p>
              <p className="text-[11px] font-medium" style={{ color: '#7C3AED' }}>Create questions from a topic, document, or URL</p>
            </div>
            <span className="ml-auto text-purple-400 text-lg">&#8250;</span>
          </button>

          {/* Illustrated type cards, grouped by category */}
          {QUESTION_TYPE_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-3" style={{ color: '#9CA3AF' }}>{group.label}</p>
              <div className="grid grid-cols-2 gap-3">
                {group.types.map(type => {
                  const p = TYPE_PILLS.find(t => t.value === type)
                  if (!p) return null
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onAdd(type)}
                      className="flex flex-col rounded-[14px] overflow-hidden text-left border border-[#E8EAED] transition-[border-color,box-shadow,transform] duration-150 hover:border-[#D5D9E0] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,27,61,0.10)]"
                    >
                      {/* Illustration */}
                      <div
                        className="w-full flex items-center justify-center overflow-hidden"
                        style={{ background: p.bg, height: 108 }}
                      >
                        {getTypeIllustration(type)}
                      </div>
                      {/* Label + description — neutral title; the accent lives in
                          the icon and illustration */}
                      <div className="px-3.5 py-3 bg-white border-t" style={{ borderColor: '#F1F2F4' }}>
                        <p className="flex items-center gap-1.5 text-sm font-bold leading-tight" style={{ color: '#111827' }}>
                          <span className="flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">{getTypeIcon(type)}</span>
                          {p.label}
                        </p>
                        <p className="text-[11px] mt-1 leading-snug" style={{ color: '#64748B' }}>{p.tooltip}</p>
                      </div>
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
