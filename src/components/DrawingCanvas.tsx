'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
  onSubmit: (dataUrl: string) => void
  disabled?: boolean
  width?: number
  height?: number
}

export function DrawingCanvas({ onSubmit, disabled = false, width = 360, height = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [color, setColor] = useState('#0F1B3D')
  const [lineWidth, setLineWidth] = useState(4)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return null
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (disabled) return
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    if (!pos || !lastPos.current) return
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasStrokes(true)
  }

  function stopDraw() {
    drawing.current = false
    lastPos.current = null
  }

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }, [])

  function handleSubmit() {
    const canvas = canvasRef.current
    if (!canvas) return
    onSubmit(canvas.toDataURL('image/jpeg', 0.7))
  }

  const COLORS = ['#0F1B3D', '#EF4444', '#3B82F6', '#16A34A', '#FBD13B', '#FF8A47', '#7C3AED', '#ffffff']

  return (
    <div className="flex flex-col gap-3 items-center w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              background: c,
              borderColor: color === c ? '#7C3AED' : '#e5e7eb',
              transform: color === c ? 'scale(1.2)' : undefined,
            }}
          />
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {[2, 4, 8].map(w => (
          <button
            key={w}
            onClick={() => setLineWidth(w)}
            aria-label={`Line width ${w}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all"
            style={{ borderColor: lineWidth === w ? '#7C3AED' : '#e5e7eb' }}
          >
            <div className="rounded-full bg-gray-700" style={{ width: w + 4, height: w + 4 }} />
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-xl border-2 border-gray-200 w-full touch-none"
        style={{ cursor: disabled ? 'not-allowed' : 'crosshair', maxWidth: width, aspectRatio: `${width}/${height}` }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      {/* Actions */}
      <div className="flex gap-3 w-full">
        <button
          onClick={clearCanvas}
          disabled={disabled}
          className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 disabled:opacity-40"
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          disabled={disabled || !hasStrokes}
          className="flex-1 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
          style={{ background: hasStrokes && !disabled ? '#FBD13B' : '#e5e7eb', color: '#0D0D0D' }}
        >
          Submit Drawing
        </button>
      </div>
    </div>
  )
}
