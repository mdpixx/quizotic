'use client'
import { ReactNode, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  maxHeight?: string
  children: ReactNode
  footer?: ReactNode
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  maxHeight = '80vh',
  children,
  footer,
}: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(15,27,61,0.5)' }}
          onClick={e => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            className="rounded-t-2xl overflow-hidden flex flex-col w-full"
            style={{ background: '#fff', maxHeight }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {(title || subtitle) && (
              <div
                className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                style={{ borderColor: '#E2E8F0' }}
              >
                <div>
                  {title && (
                    <span className="font-black text-base block" style={{ color: '#0F1B3D' }}>
                      {title}
                    </span>
                  )}
                  {subtitle && (
                    <span className="text-xs" style={{ color: '#94A3B8' }}>
                      {subtitle}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F1F5F9' }}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#374151' }}>
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div
                className="flex-shrink-0 border-t px-4 py-3 safe-bottom"
                style={{ borderColor: '#E2E8F0' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
