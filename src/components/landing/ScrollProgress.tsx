'use client'

import { useState, useEffect } from 'react'

export function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40 hidden lg:block" aria-hidden="true">
      {/* Track */}
      <div className="w-1 h-32 rounded-full relative" style={{ background: 'rgba(15,27,61,0.1)' }}>
        {/* Fill */}
        <div
          className="absolute top-0 left-0 w-full rounded-full transition-all duration-150"
          style={{
            height: `${progress}%`,
            background: 'linear-gradient(180deg, #0F1B3D, #FBD13B)',
          }}
        />
        {/* Current position dot */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md transition-all duration-150"
          style={{
            top: `calc(${progress}% - 6px)`,
            background: '#FBD13B',
          }}
        />
      </div>
    </div>
  )
}
