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

import React, { useState } from 'react'
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
import { getTypePill } from '@/lib/quiz-builder-logic'
import { AddInteractionPicker } from './AddInteractionPicker'

// ── Sortable question card ────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  isActive,
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
      <div
        onClick={selectMode ? onToggleSelected : onSelect}
        className={`relative group flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all select-none ${
          isActive && !selectMode ? '' : 'hover:bg-gray-50'
        } ${isDragging ? 'shadow-xl' : ''}`}
        style={
          selectMode && selected
            ? { background: '#EEF2FF', border: '1.5px solid #6366F1' }
            : isActive && !selectMode
              ? { background: '#EEF2FF', border: '1.5px solid #6366F1' }
              : { border: '1.5px solid transparent' }
        }
      >
        {/* Select-mode checkbox OR drag handle + number */}
        {selectMode ? (
          <span
            aria-hidden
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-extrabold flex-shrink-0"
            style={selected ? { background: '#6366F1', color: '#fff' } : { background: '#E5E7EB', color: '#9CA3AF' }}
          >
            {selected ? '✓' : index + 1}
          </span>
        ) : (
        <button
          type="button"
          aria-label={`Drag question ${index + 1}`}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-indigo-400"
          style={isActive ? { background: '#6366F1', color: '#fff' } : { background: '#E5E7EB', color: '#6B7280' }}
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
        >
          {index + 1}
        </button>
        )}

        {/* Type pill + text */}
        <div className="flex-1 min-w-0">
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded inline-block mb-0.5"
            style={{ background: pill.bg, color: pill.color }}
          >
            {pill.label}
          </span>
          <p className="text-xs text-gray-600 truncate leading-tight">
            {question.text.slice(0, 48) || 'Untitled'}
          </p>
        </div>

        {/* ··· context menu trigger */}
        {!selectMode && (
        <div className="relative">
          <button
            type="button"
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
                className="absolute right-0 top-full mt-0.5 z-50 rounded-xl shadow-xl border bg-white py-1 overflow-hidden"
                style={{ width: 140, borderColor: '#E5E7EB' }}
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-95"
          style={{ background: '#0F1B3D', color: '#FBD13B' }}
        >
          <span className="text-base leading-none">+</span> Add
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
