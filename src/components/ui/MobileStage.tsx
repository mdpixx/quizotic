'use client'
import { ReactNode } from 'react'

interface MobileStageProps {
  /** Sticky top bar (logo, session code, timer) */
  topBar?: ReactNode
  /** Main content area — scrollable */
  stage: ReactNode
  /** Optional secondary info row between stage and toolbar */
  meta?: ReactNode
  /** Fixed bottom action toolbar */
  toolbar: ReactNode
  background?: string
  className?: string
}

/**
 * Single-column shell for host live-control screens on mobile.
 * Desktop layout is rendered separately and switched by useIsMobile().
 * Uses min-h-svh so the layout fills the small viewport height (excludes
 * the browser address bar on mobile, preventing the classic "short page" bug).
 */
export function MobileStage({
  topBar,
  stage,
  meta,
  toolbar,
  background = '#0F1B3D',
  className = '',
}: MobileStageProps) {
  return (
    <div
      className={`flex flex-col min-h-svh w-full ${className}`}
      style={{ background }}
    >
      {topBar && <div className="flex-shrink-0 safe-top">{topBar}</div>}
      <div className="flex-1 overflow-y-auto flex flex-col">{stage}</div>
      {meta && <div className="flex-shrink-0">{meta}</div>}
      <div className="flex-shrink-0 safe-bottom">{toolbar}</div>
    </div>
  )
}
