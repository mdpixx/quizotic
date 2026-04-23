'use client'

// Shared bounded frame for a slide's `contentImageUrl`. Keeps the image at a
// consistent 16:9 size across both the builder preview and the live host view
// so what the creator sees in the builder matches the projected output.

import { SlideImage } from './SlideImage'

interface SlideImageFrameProps {
  url?: string
  className?: string
  heightClassName?: string
}

export function SlideImageFrame({ url, className = '', heightClassName = 'max-h-[38%]' }: SlideImageFrameProps) {
  if (!url) return null
  return (
    <div
      className={`mx-auto flex items-center justify-center rounded-2xl overflow-hidden flex-shrink-0 ${heightClassName} ${className}`}
      style={{
        width: '75%',
        aspectRatio: '16 / 9',
        background: 'rgba(15,27,61,0.04)',
        border: '1px solid rgba(15,27,61,0.08)',
      }}
    >
      <SlideImage
        src={url}
        className="max-w-full max-h-full object-contain"
        tone="light"
      />
    </div>
  )
}
