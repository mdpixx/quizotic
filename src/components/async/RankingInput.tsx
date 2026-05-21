'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ANSWER_COLORS } from '@/lib/answer-colors'
import type { AsyncInputProps } from './types'
import { optText } from './types'

function SortableItem({ id, index, label, colorHex }: {
  id: string; index: number; label: string; colorHex: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: colorHex,
        opacity: isDragging ? 0.85 : 1,
        touchAction: 'manipulation',
      }}
      {...attributes}
      className="w-full py-4 rounded-2xl px-4 text-white flex items-center gap-3 select-none"
    >
      <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm font-black shrink-0"
        style={{ background: 'rgba(255,255,255,0.2)' }}>
        {index + 1}
      </span>
      <span className="flex-1 text-sm font-bold leading-snug">{label}</span>
      <span
        {...listeners}
        role="button"
        aria-label="Drag to reorder"
        tabIndex={0}
        className="opacity-80 text-xl leading-none px-2 py-1 -mr-1 rounded-md"
        style={{ touchAction: 'none', cursor: 'grab', background: 'rgba(255,255,255,0.1)' }}
      >
        ⋮⋮
      </span>
    </div>
  )
}

export function RankingInput({ question, disabled, onSubmit }: AsyncInputProps) {
  const opts = question.options ?? []
  const [order, setOrder] = useState<number[]>(() => opts.map((_, i) => i))
  const [submitted, setSubmitted] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const oldIdx = prev.indexOf(Number(active.id))
      const newIdx = prev.indexOf(Number(over.id))
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onSubmit(order)
  }

  if (opts.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
        Drag to rank
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((optIdx, pos) => {
              const color = ANSWER_COLORS[optIdx % ANSWER_COLORS.length]
              return (
                <SortableItem
                  key={optIdx}
                  id={String(optIdx)}
                  index={pos}
                  label={optText(opts[optIdx])}
                  colorHex={color.hex}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button
        onClick={handleSubmit}
        disabled={disabled || submitted}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-default"
        style={{ background: '#6366F1', color: '#fff' }}
      >
        {submitted ? 'Submitted ✓' : 'Submit Ranking'}
      </button>
    </div>
  )
}
