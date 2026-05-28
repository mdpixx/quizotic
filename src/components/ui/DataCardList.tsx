'use client'
import { ReactNode } from 'react'

export interface DataCardField {
  label: string
  value: ReactNode
  /** Span 2 columns (full-width row) */
  wide?: boolean
  className?: string
}

export interface DataCardItem {
  id: string
  fields: DataCardField[]
  actions?: ReactNode
  onClick?: () => void
}

interface DataCardListProps {
  items: DataCardItem[]
  emptyState?: ReactNode
}

export function DataCardList({ items, emptyState }: DataCardListProps) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: '#9CA3AF' }}>
        {emptyState ?? 'No items found.'}
      </div>
    )
  }

  return (
    <div className="space-y-2 px-4 py-3">
      {items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border bg-white p-4 shadow-sm active:scale-[0.99] transition-transform"
          style={{ borderColor: '#E7E2D4', cursor: item.onClick ? 'pointer' : undefined }}
          onClick={item.onClick}
          role={item.onClick ? 'button' : undefined}
          tabIndex={item.onClick ? 0 : undefined}
          onKeyDown={item.onClick ? e => { if (e.key === 'Enter' || e.key === ' ') item.onClick!() } : undefined}
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {item.fields.map((field, i) => (
              <div
                key={i}
                className={`min-w-0 ${field.wide ? 'col-span-2' : ''} ${field.className ?? ''}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                  {field.label}
                </p>
                <div className="text-sm font-semibold mt-0.5 truncate" style={{ color: '#0F1B3D' }}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
          {item.actions && (
            <div
              className="mt-3 pt-3 border-t flex items-center gap-2"
              style={{ borderColor: '#E7E2D4' }}
            >
              {item.actions}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
