'use client'

/**
 * QuestionList — the narrow left rail in the Slido-style builder.
 *
 * Contains ONLY:
 *   1. Scrollable list of sortable question cards (number badge + type pill + truncated text)
 *   2. A single "+ Add" button that opens AddInteractionPicker
 *
 * Eliminates both the ActiveQuestionTypeSwitcher (top heavy block) and the
 * "New Question" type grid (bottom heavy block) from the legacy builder —
 * those were the source of duplication and the middle-list squeeze.
 */

import React, { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Question, QuestionType } from '@/lib/quiz-types'
import { getTypePill, validateQuizQuestions } from '@/lib/quiz-builder-logic'
import { getTypeIcon } from '@/lib/quiz-type-icons'
import { AddInteractionPicker } from './AddInteractionPicker'

// ── Sortable question card ────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  isActive,
  invalid,
  onSelect,
  onDuplicate,
  onDelete,
  canDelete,
  selectMode,
  selected,
  onToggleSelected,
}: {
  question: Question
  index: number
  isActive: boolean
  invalid: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  canDelete: boolean
  selectMode: boolean
  selected: boolean
  onToggleSelected: () => void
}) {
  const pill = getTypePill(question.type)
  const [menuOpen, setMenuOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id, disabled: selectMode })

  const highlighted = (selectMode && selected) || (isActive && !selectMode)

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      {/* Grab anywhere on the card to reorder: dnd-kit listeners live on the card
          root, and the PointerSensor's 5px activation constraint lets a plain
          click fall through to select. Interactive children (checkbox, ···)
          stop pointer-down so a press on them never starts a drag. */}
      <div
        onClick={selectMode ? onToggleSelected : onSelect}
        className={`relative group flex flex-col justify-center gap-1 px-3 py-2.5 min-h-[76px] rounded-[10px] border cursor-grab active:cursor-grabbing select-none transition-[background-color,border-color] duration-150 ${
          highlighted
            ? 'bg-[#F7F8FC] border-[#D5D9E6]'
            : 'bg-white border-[#E8EAED] hover:border-[#D8DCE2] hover:bg-[#FAFBFC]'
        } ${isDragging ? 'shadow-xl' : ''}`}
        {...attributes}
        {...listeners}
      >
        {/* Active accent pill — absolute so every state shares identical box metrics */}
        {highlighted && (
          <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-[#6366F1]" />
        )}

        {/* Meta row: number · type icon · type label · incomplete dot */}
        <div className={`flex items-center gap-1.5 w-full ${selectMode ? 'pr-6' : ''}`}>
          <span className="text-[10px] font-semibold leading-none text-gray-400 tabular-nums">{index + 1}</span>
          <span className="flex items-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{getTypeIcon(question.type)}</span>
          <span className="text-[10px] font-semibold tracking-wide uppercase text-gray-500 truncate">{pill.label}</span>
          {/* Validation warning dot (hidden while ··· hover-menu shows) */}
          {invalid && !selectMode && (
            <span
              className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 group-hover:opacity-0 transition-opacity"
              style={{ background: '#F59E0B' }}
              title="This slide is incomplete"
              aria-label="Slide incomplete"
            />
          )}
        </div>

        {/* Question text preview */}
        <p className={`w-full text-left text-xs leading-snug line-clamp-2 ${question.text.trim() ? 'font-medium text-gray-800' : 'italic text-gray-400'}`}>
          {question.text.trim() || 'Untitled question'}
        </p>

        {/* Select-mode checkbox — top-right */}
        {selectMode && (
          <span
            aria-hidden
            onPointerDown={e => e.stopPropagation()}
            className="absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-extrabold"
            style={selected ? { background: '#6366F1', color: '#fff' } : { background: '#E5E7EB', color: '#9CA3AF' }}
          >
            {selected ? '✓' : ''}
          </span>
        )}

        {/* ··· context menu trigger — top-right on hover */}
        {!selectMode && (
        <div className="absolute top-0.5 right-0.5">
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 hover:bg-white/90 text-sm font-bold"
            aria-label={`Question ${index + 1} actions`}
          >
            &#8230;
          </button>
          {menuOpen && (
            <>
              {/* backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-0.5 z-50 rounded-[10px] border bg-white py-1 overflow-hidden"
                style={{ width: 140, borderColor: '#E8EAED', boxShadow: '0 1px 2px rgba(15,27,61,0.04), 0 8px 24px rgba(15,27,61,0.06)' }}
              >
                <button
                  type="button"
                  onClick={() => { onDuplicate(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Duplicate
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => { onDelete(); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

// ── QuestionList ──────────────────────────────────────────────────────────────

export interface QuestionListProps {
  questions: Question[]
  activeIndex: number
  onSelect: (index: number) => void
  onAdd: (type: QuestionType) => void
  onDuplicate: (index: number) => void
  onDelete: (index: number) => void
  onBulkDelete?: (indices: number[]) => void
  onBulkDuplicate?: (indices: number[]) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onGenerateAI: () => void
}

export function QuestionList({
  questions,
  activeIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onBulkDelete,
  onBulkDuplicate,
  onReorder,
  onGenerateAI,
}: QuestionListProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  // Multi-select: keyed by question id (stable across drag-reorder).
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkEnabled = !!(onBulkDelete && onBulkDuplicate)

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectedIndices(): number[] {
    return questions.reduce<number[]>((acc, q, i) => {
      if (selectedIds.has(q.id)) acc.push(i)
      return acc
    }, [])
  }

  // 5px activation distance: a plain pointer-down/up without movement reads as a
  // click (select), only movement past the threshold starts a reorder. This lets
  // the whole card be the drag surface while staying clickable.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Per-slide validation → orange "incomplete" dot. Reuses the same rules as
  // save-time validation so the panel and Save agree on what's incomplete.
  const invalidIds = useMemo(() => {
    const ids = new Set<string>()
    for (const issue of validateQuizQuestions(questions)) {
      if (issue.severity === 'error') {
        const q = questions[issue.questionIndex]
        if (q) ids.add(q.id)
      }
    }
    return ids
  }, [questions])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = questions.findIndex(q => q.id === active.id)
    const toIndex = questions.findIndex(q => q.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) onReorder(fromIndex, toIndex)
  }

  return (
    <div className="flex flex-col h-full" style={{ borderRight: '1px solid #F3F4F6' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between border-b" style={{ borderColor: '#F3F4F6' }}>
        <span className="text-xs font-bold text-gray-500">
          {selectMode
            ? `${selectedIds.size} selected`
            : `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`}
        </span>
        {bulkEnabled && questions.length > 1 && (
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className="text-[11px] font-bold px-2 py-1 rounded-md transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-indigo-400"
            style={{ color: selectMode ? '#6366F1' : '#6B7280' }}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: '#F3F4F6', background: '#F8FAFF' }}>
          <button
            type="button"
            onClick={() => { onBulkDuplicate?.(selectedIndices()); exitSelectMode() }}
            className="flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-colors hover:brightness-95"
            style={{ background: '#EEF2FF', color: '#4338CA' }}
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={selectedIds.size >= questions.length}
            onClick={() => { onBulkDelete?.(selectedIndices()); exitSelectMode() }}
            className="flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-colors hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#FEE2E2', color: '#B91C1C' }}
            title={selectedIds.size >= questions.length ? 'Keep at least one question' : undefined}
          >
            Delete
          </button>
        </div>
      )}

      {/* Scrollable question list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 min-h-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                isActive={i === activeIndex}
                invalid={invalidIds.has(q.id)}
                onSelect={() => onSelect(i)}
                onDuplicate={() => onDuplicate(i)}
                onDelete={() => onDelete(i)}
                canDelete={questions.length > 1}
                selectMode={selectMode}
                selected={selectedIds.has(q.id)}
                onToggleSelected={() => toggleSelected(q.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* + Add button */}
      <div className="flex-shrink-0 px-3 py-3 border-t" style={{ borderColor: '#F3F4F6' }}>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.99]"
          style={{ background: '#0F1B3D', color: '#FBD13B', boxShadow: '0 1px 2px rgba(15,27,61,0.25)' }}
        >
          <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Add
        </button>
      </div>

      {/* AddInteractionPicker overlay */}
      {pickerOpen && (
        <AddInteractionPicker
          onAdd={type => { onAdd(type); setPickerOpen(false) }}
          onGenerateAI={() => { onGenerateAI(); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
