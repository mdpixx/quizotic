'use client'
import { ReactNode, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  widthClass?: string
  background?: string
}

export function MobileDrawer({
  open,
  onClose,
  children,
  widthClass = 'w-72',
  background = '#fff',
}: MobileDrawerProps) {
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
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed inset-y-0 left-0 z-50 ${widthClass} flex flex-col`}
            style={{ background }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-colors z-10"
              style={{ color: '#9CA3AF' }}
              aria-label="Close menu"
            >
              <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
