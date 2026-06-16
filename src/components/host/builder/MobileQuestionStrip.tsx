'use client'

/**
 * MobileQuestionStrip — slim horizontal chip bar shown at the top of the
 * mobile quiz editor. Shows one numbered chip per question (tapping jumps
 * to that card) plus a trailing "+" chip to add a new question.
 *
 * Keeps the active chip scrolled into view automatically.
 */

import React, { useEffect, useRef } from 'react'

interface MobileQuestionStripProps {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
}

export function MobileQuestionStrip({ count, activeIndex, onSelect, onAdd }: MobileQuestionStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const activeChipRef = useRef<HTMLButtonElement>(null)

  // Scroll the active chip into view whenever it changes
  useEffect(() => {
    if (activeChipRef.current && stripRef.current) {
      activeChipRef.current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

  return (
    <div
      ref={stripRef}
      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto border-b"
      style={{
        borderColor: '#E5E7EB',
        background: '#fff',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        // Hide scrollbar on webkit
        msOverflowStyle: 'none',
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === activeIndex
        return (
          <button
            key={i}
            ref={isActive ? activeChipRef : undefined}
            type="button"
            onClick={() => onSelect(i)}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-colors"
            style={
              isActive
                ? { background: '#0F1B3D', color: '#F5E642' }
                : { background: '#F3F4F6', color: '#6B7280' }
            }
            aria-label={`Question ${i + 1}`}
            aria-current={isActive ? 'true' : undefined}
          >
            {i + 1}
          </button>
        )
      })}

      {/* + chip to add a new question */}
      <button
        type="button"
        onClick={onAdd}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition-colors"
        style={{ background: '#F0FDF4', color: '#16A34A', border: '1.5px dashed #86EFAC' }}
        aria-label="Add question"
        title="Add question"
      >
        +
      </button>
    </div>
  )
}
