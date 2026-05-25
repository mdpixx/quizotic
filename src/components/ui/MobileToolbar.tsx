'use client'
import { ReactNode } from 'react'

interface MobileToolbarProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function MobileToolbar({ children, className = '', style }: MobileToolbarProps) {
  return (
    <div
      className={`safe-bottom flex-shrink-0 border-t flex items-center gap-2 px-3 py-2.5 ${className}`}
      style={{ borderColor: '#E2E8F0', background: '#F8FAFC', ...style }}
    >
      {children}
    </div>
  )
}
