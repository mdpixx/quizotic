'use client'

import React from 'react'
import { useAutoShrinkText } from '@/lib/useAutoShrinkText'

// Drop-in replacement for a heading/paragraph that auto-shrinks its font size
// so long text fits inside its parent box without clipping. Use wherever slide
// text can be arbitrarily long (slide titles, questions, bullets heading).
//
// The parent element must have a fixed or flex-bounded height. If the parent
// has unbounded height the text will render at maxPx and never need shrinking.

interface AutoFitTextProps {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  minPx?: number
  maxPx?: number
}

export function AutoFitText({
  as = 'h2',
  children,
  className,
  style,
  minPx = 16,
  maxPx = 48,
}: AutoFitTextProps) {
  const ref = useAutoShrinkText<HTMLElement>({ minPx, maxPx })
  const Tag = as as keyof JSX.IntrinsicElements
  return (
    <Tag ref={ref as unknown as React.Ref<HTMLHeadingElement>} className={className} style={{ ...style, fontSize: `${maxPx}px` }}>
      {children}
    </Tag>
  )
}
