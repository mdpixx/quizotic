'use client'

/**
 * Device frames for the builder preview.
 *
 * The preview's whole job is to be HONEST about what the room and the phone
 * will show. Hand-tuned "mini" versions of each surface drift from the real
 * thing immediately (the first version rendered the participant's answers as a
 * 2×2 grid when the phone actually stacks full-width bars, and its phone frame
 * was a 280×380 box — a tablet aspect, not a phone).
 *
 * So instead of miniature styling, each pane renders its surface at TRUE device
 * pixels — 1440×810 for the projected host stage, 390×844 for the phone — and
 * CSS-scales the finished result down into the pane. Layout, wrapping, tile
 * geometry and font ratios are then whatever the real device produces, because
 * they ARE what the real device produces.
 *
 * Caveat that shapes the CSS: `vw`/`vh` units and width/height media queries
 * inside a scaled frame still resolve against the REAL browser viewport, not
 * the frame. The live stylesheet leans on both, so `.qz-preview-stage` in
 * globals.css pins those viewport-relative values to what a 1440×810 stage
 * renders. Anything measured geometrically (useFitText's --opt-fit-size) needs
 * no pinning — it measures inside the frame and self-corrects.
 */

import { useLayoutEffect, useRef, useState } from 'react'

/** Projected host stage: 16:9, sized like a laptop mirrored to a projector. */
export const STAGE_WIDTH = 1440
export const STAGE_HEIGHT = 810

/** Participant phone: iPhone 14/15 logical viewport. */
export const PHONE_WIDTH = 390
export const PHONE_HEIGHT = 844

export interface ScaledDeviceProps {
  deviceWidth: number
  deviceHeight: number
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

/**
 * Renders `children` in a box of exactly `deviceWidth` × `deviceHeight` CSS
 * pixels, then scales that box down to the width this component is given.
 * The outer box carries the device aspect ratio, so the pane's height follows
 * from its width — a phone stays phone-shaped at any pane size.
 */
export function ScaledDevice({ deviceWidth, deviceHeight, children, className = '', style }: ScaledDeviceProps) {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    // Re-applying the same scale writes the same transform, so the observer
    // settles after one pass instead of feeding itself.
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / deviceWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [deviceWidth])

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ ...style, position: 'relative', overflow: 'hidden', aspectRatio: `${deviceWidth} / ${deviceHeight}` }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: deviceWidth,
          height: deviceHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Before the first measurement a scale of 0 would flash a collapsed
          // frame; hide until the pane width is known.
          visibility: scale > 0 ? undefined : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Phone bezel + notch around a true-size participant screen. */
export function PhoneShell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div className="mx-auto" style={{ width }}>
      <div
        className="relative rounded-[30px]"
        style={{
          background: '#0B1226',
          padding: 7,
          boxShadow: '0 18px 40px -14px rgba(15,27,61,0.45), inset 0 0 0 1px rgba(255,255,255,0.10)',
        }}
      >
        <ScaledDevice
          deviceWidth={PHONE_WIDTH}
          deviceHeight={PHONE_HEIGHT}
          className="rounded-[23px]"
          style={{ background: '#FFFFFF' }}
        >
          {children}
        </ScaledDevice>
        {/* Speaker slit — reads as "phone", sits over the screen's safe-area padding. */}
        <div
          aria-hidden
          className="absolute left-1/2 rounded-full"
          style={{ top: 11, width: 46, height: 5, marginLeft: -23, background: 'rgba(255,255,255,0.22)' }}
        />
      </div>
      <p className="mt-1.5 text-center text-[10px] font-semibold tabular-nums" style={{ color: '#9CA3AF' }}>
        {PHONE_WIDTH} × {PHONE_HEIGHT} phone
      </p>
    </div>
  )
}

/** Thin screen frame around a true-size 16:9 host stage. */
export function ProjectorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div
        className="overflow-hidden rounded-xl"
        style={{ boxShadow: '0 18px 40px -16px rgba(15,27,61,0.40)', border: '1px solid rgba(15,27,61,0.16)' }}
      >
        <ScaledDevice deviceWidth={STAGE_WIDTH} deviceHeight={STAGE_HEIGHT}>
          {children}
        </ScaledDevice>
      </div>
      <p className="mt-1.5 text-center text-[10px] font-semibold tabular-nums" style={{ color: '#9CA3AF' }}>
        {STAGE_WIDTH} × {STAGE_HEIGHT} projected stage
      </p>
    </div>
  )
}
