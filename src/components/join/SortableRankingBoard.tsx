'use client'

// Drag-to-rank list for the participant page (live quiz ranking questions and
// presenter ranking slides). Extracted from join/page.tsx so @dnd-kit
// (core + sortable + utilities) loads only when a ranking item actually
// renders — the participant page's initial bundle has a <100KB budget and
// most quizzes contain no ranking question.

import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Whole-bar drag: listeners are on the bar div so the participant can grab
// anywhere. TouchSensor delay:200ms lets quick swipes still scroll the page
// (fixes the earlier sideways-slide regression on touch devices).
function SortableRankingItem({ id, index, label, color }: { id: string; index: number; label: string; color: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const base = CSS.Transform.toString(transform)
  const style: React.CSSProperties = {
    transform: isDragging && base ? `${base} scale(1.03)` : base,
    transition,
    background: color,
    opacity: isDragging ? 0.95 : 1,
    touchAction: 'manipulation',
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.35)' : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="w-full py-4 rounded-2xl text-left px-5 text-base font-bold text-white flex items-center gap-3 select-none">
      <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm font-black"
        style={{ background: 'rgba(255,255,255,0.2)' }}>{index + 1}</span>
      <span className="flex-1">{label}</span>
      <span
        aria-hidden="true"
        className="opacity-80 text-xl leading-none px-2 py-1 -mr-2 rounded-md"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >⋮⋮</span>
    </div>
  )
}

export interface SortableRankingBoardProps {
  /** Current display order as ORIGINAL option indices. */
  order: number[]
  /** Label per original option index (falls back to "Option N"). */
  labels: string[]
  /** Colour palette, indexed by original option index (modulo length). */
  colors: string[]
  /** Keeps drag ids unique across the quiz/presenter flows. */
  idPrefix: string
  disabled?: boolean
  onReorder: (next: number[]) => void
  itemSpacing?: string
}

export function SortableRankingBoard({ order, labels, colors, idPrefix, disabled, onReorder, itemSpacing = 'space-y-2' }: SortableRankingBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = order.map(i => `${idPrefix}-${i}`)
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => {
      if (disabled) return
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      onReorder(arrayMove(order, oldIndex, newIndex))
    }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={itemSpacing}>
          {order.map((origIdx, pos) => (
            <SortableRankingItem
              key={`${idPrefix}-${origIdx}`}
              id={`${idPrefix}-${origIdx}`}
              index={pos}
              label={labels[origIdx] || `Option ${origIdx + 1}`}
              color={colors[origIdx % colors.length] ?? '#0F1B3D'}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
