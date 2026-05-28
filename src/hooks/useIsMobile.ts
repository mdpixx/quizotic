'use client'
import { useEffect, useState } from 'react'

const TABLET_BP = 1024  // lg — desktop starts here
const MOBILE_BP = 768   // md — tablet starts here

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`)
    setIsMobile(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

export function useViewport(): 'mobile' | 'tablet' | 'desktop' {
  const [vp, setVp] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    const mqMobile = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`)
    const mqTablet = window.matchMedia(`(min-width: ${MOBILE_BP}px) and (max-width: ${TABLET_BP - 1}px)`)

    function update() {
      if (mqMobile.matches) setVp('mobile')
      else if (mqTablet.matches) setVp('tablet')
      else setVp('desktop')
    }
    update()

    mqMobile.addEventListener('change', update)
    mqTablet.addEventListener('change', update)
    return () => {
      mqMobile.removeEventListener('change', update)
      mqTablet.removeEventListener('change', update)
    }
  }, [])

  return vp
}
