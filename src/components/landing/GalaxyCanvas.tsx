'use client'

import { useEffect, useRef } from 'react'

// Draws a proper spiral galaxy using HTML5 Canvas 2D with additive blending.
// Two arms, glowing core, nebula dust — slow rotation.

function drawGalaxy(ctx: CanvasRenderingContext2D, w: number, h: number, angle: number) {
  ctx.clearRect(0, 0, w, h)

  const cx = w * 0.5
  const cy = h * 0.48
  const scale = Math.min(w, h) * 0.38

  // ── Core glow ──────────────────────────────────────────────────────────────
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.22)
  coreGrad.addColorStop(0, 'rgba(255,245,220,0.95)')
  coreGrad.addColorStop(0.15, 'rgba(255,220,150,0.6)')
  coreGrad.addColorStop(0.4, 'rgba(180,150,255,0.18)')
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = coreGrad
  ctx.beginPath()
  ctx.arc(cx, cy, scale * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // ── Disk glow (outer halo) ─────────────────────────────────────────────────
  const diskGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.1)
  diskGrad.addColorStop(0, 'rgba(100,80,200,0.12)')
  diskGrad.addColorStop(0.5, 'rgba(80,60,180,0.06)')
  diskGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = diskGrad
  ctx.beginPath()
  ctx.ellipse(cx, cy, scale * 1.1, scale * 0.35, -0.25, 0, Math.PI * 2)
  ctx.fill()

  // ── Spiral arm particles ───────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'lighter'

  const ARMS = 2
  const PARTICLES = 2800
  const ARM_SPREAD = 0.55
  const WIND = 3.8  // how tightly wound the spiral is

  for (let i = 0; i < PARTICLES; i++) {
    const t = i / PARTICLES                  // 0→1 along arm
    const arm = i % ARMS
    const baseAngle = angle + (arm / ARMS) * Math.PI * 2
    const theta = baseAngle + t * WIND * Math.PI
    const r = t * scale * (0.85 + Math.random() * 0.25)
    const spread = (Math.random() - 0.5) * ARM_SPREAD * r * (0.3 + t * 0.7)

    const x = cx + Math.cos(theta) * r + Math.cos(theta + Math.PI / 2) * spread
    const y = cy + Math.sin(theta) * r * 0.38 + Math.sin(theta + Math.PI / 2) * spread * 0.38

    // Color: hot white in core, blue/purple in mid, pink/red at tips
    const hot = Math.max(0, 1 - t * 2.5)
    const mid = Math.sin(t * Math.PI) * 0.8
    const tip = Math.max(0, t * 1.5 - 0.5)
    const rr = Math.round(180 * hot + 140 * mid + 220 * tip)
    const gg = Math.round(200 * hot + 120 * mid + 80 * tip)
    const bb = Math.round(220 * hot + 255 * mid + 120 * tip)
    const alpha = (0.7 - t * 0.5) * (0.4 + Math.random() * 0.6)

    const radius = Math.random() < 0.03 ? 2.5 : Math.random() * 1.2 + 0.3

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(2)})`
    ctx.fill()
  }

  // ── Nebula dust patches ────────────────────────────────────────────────────
  const PATCHES = [
    { ox: 0.3, oy: -0.08, rx: 0.25, ry: 0.07, color: 'rgba(160,100,255,0.06)', rot: 0.5 },
    { ox: -0.35, oy: 0.06, rx: 0.22, ry: 0.06, color: 'rgba(80,140,255,0.05)', rot: -0.4 },
    { ox: 0.1, oy: 0.12, rx: 0.18, ry: 0.05, color: 'rgba(255,160,80,0.04)', rot: 0.2 },
    { ox: -0.2, oy: -0.1, rx: 0.2, ry: 0.06, color: 'rgba(200,100,255,0.05)', rot: -0.3 },
  ]
  ctx.globalCompositeOperation = 'lighter'
  for (const p of PATCHES) {
    const px = cx + p.ox * scale * 2
    const py = cy + p.oy * scale * 2
    const patchGrad = ctx.createRadialGradient(px, py, 0, px, py, p.rx * scale * 2)
    patchGrad.addColorStop(0, p.color)
    patchGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = patchGrad
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(p.rot + angle * 0.3)
    ctx.scale(1, p.ry / p.rx)
    ctx.beginPath()
    ctx.arc(0, 0, p.rx * scale * 2, 0, Math.PI * 2)
    ctx.restore()
    ctx.fill()
  }

  // ── Bright star sparkles ───────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'lighter'
  const SPARKLES = [
    { ox: 0.28, oy: -0.06, s: 3, color: 'rgba(255,240,200,0.9)' },
    { ox: -0.32, oy: 0.05, s: 2.5, color: 'rgba(200,220,255,0.85)' },
    { ox: 0.08, oy: 0.18, s: 2, color: 'rgba(255,200,150,0.8)' },
    { ox: -0.15, oy: -0.14, s: 2, color: 'rgba(200,180,255,0.75)' },
    { ox: 0.42, oy: 0.03, s: 1.8, color: 'rgba(255,230,180,0.7)' },
  ]
  for (const sp of SPARKLES) {
    const sx = cx + sp.ox * scale * 2 * Math.cos(angle * 0.5) - sp.oy * scale * 2 * Math.sin(angle * 0.5)
    const sy = cy + (sp.ox * scale * 2 * Math.sin(angle * 0.5) + sp.oy * scale * 2 * Math.cos(angle * 0.5)) * 0.38
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.s * 6)
    sg.addColorStop(0, sp.color)
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(sx, sy, sp.s * 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = sp.color
    ctx.beginPath()
    ctx.arc(sx, sy, sp.s * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalCompositeOperation = 'source-over'
}

export default function GalaxyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)
  const angleRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      angleRef.current += 0.0008  // very slow rotation
      drawGalaxy(ctx, canvas.offsetWidth, canvas.offsetHeight, angleRef.current)
      animRef.current = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      window.removeEventListener('resize', resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
