'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

// ─── Data ─────────────────────────────────────────────────────────────────────
const PARTICIPANTS = [
  { name: 'Aisha', pos: [1.2, 0.8, 0] as [number, number, number], score: 5, color: '#fde68a' },
  { name: 'Rohan', pos: [-0.5, 1.4, 0.3] as [number, number, number], score: 4, color: '#fde68a' },
  { name: 'Priya', pos: [-1.8, -0.2, 0.1] as [number, number, number], score: 3, color: '#c7d2fe' },
  { name: 'Sam', pos: [0.4, -1.2, -0.2] as [number, number, number], score: 2, color: '#a5b4fc' },
  { name: 'Dev', pos: [1.8, -0.6, 0.2] as [number, number, number], score: 4, color: '#fde68a' },
  { name: 'Mei', pos: [-0.9, -1.6, 0] as [number, number, number], score: 3, color: '#c7d2fe' },
]

const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 5], [5, 3]]

// Build a canvas-based circular sprite texture for point rendering
function makePointTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

// ─── Constellation lines ───────────────────────────────────────────────────────
function ConstellationLines({ lineProgress }: { lineProgress: number }) {
  const lines = useMemo(() => {
    return EDGES.map(([a, b]) => {
      const points = [
        new THREE.Vector3(...PARTICIPANTS[a].pos),
        new THREE.Vector3(...PARTICIPANTS[b].pos),
      ]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({
        color: '#a5b4fc', transparent: true, opacity: 0.5,
      })
      return new THREE.Line(geometry, material)
    })
  }, [])

  const visibleCount = Math.floor(lineProgress * lines.length)

  return (
    <group>
      {lines.slice(0, visibleCount).map((lineObj, i) => (
        <primitive key={i} object={lineObj} />
      ))}
    </group>
  )
}

// ─── Star point cloud — all participants visible at once ───────────────────────
function StarCloud() {
  const pointsRef = useRef<THREE.Points>(null)
  const texture = useMemo(() => makePointTexture(), [])

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICIPANTS.length * 3)
    const colors = new Float32Array(PARTICIPANTS.length * 3)
    const sizes = new Float32Array(PARTICIPANTS.length)
    PARTICIPANTS.forEach((p, i) => {
      positions[i * 3] = p.pos[0]
      positions[i * 3 + 1] = p.pos[1]
      positions[i * 3 + 2] = p.pos[2]
      const c = new THREE.Color(p.color)
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
      sizes[i] = 18 + p.score * 6
    })
    return { positions, colors, sizes }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [positions, colors, sizes])

  useFrame((state) => {
    if (!pointsRef.current) return
    // Gentle pulse on size
    const t = state.clock.elapsedTime
    const sizeAttr = pointsRef.current.geometry.getAttribute('size') as THREE.BufferAttribute
    PARTICIPANTS.forEach((p, i) => {
      const pulse = 1 + Math.sin(t * 1.5 + i * 1.1) * 0.2
      ;(sizeAttr.array as Float32Array)[i] = (18 + p.score * 6) * pulse
    })
    sizeAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        map={texture}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ─── Glow halos ───────────────────────────────────────────────────────────────
function StarHalos() {
  const texture = useMemo(() => makePointTexture(), [])
  const halosRef = useRef<THREE.Points>(null)

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICIPANTS.length * 3)
    const colors = new Float32Array(PARTICIPANTS.length * 3)
    const sizes = new Float32Array(PARTICIPANTS.length)
    PARTICIPANTS.forEach((p, i) => {
      positions[i * 3] = p.pos[0]
      positions[i * 3 + 1] = p.pos[1]
      positions[i * 3 + 2] = p.pos[2] - 0.01
      const c = new THREE.Color(p.color)
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
      sizes[i] = 60 + p.score * 12
    })
    return { positions, colors, sizes }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [positions, colors, sizes])

  useFrame((state) => {
    if (!halosRef.current) return
    const t = state.clock.elapsedTime
    const sizeAttr = halosRef.current.geometry.getAttribute('size') as THREE.BufferAttribute
    PARTICIPANTS.forEach((p, i) => {
      const pulse = 1 + Math.sin(t * 1.2 + i * 1.1) * 0.25
      ;(sizeAttr.array as Float32Array)[i] = (60 + p.score * 12) * pulse
    })
    sizeAttr.needsUpdate = true
  })

  return (
    <points ref={halosRef} geometry={geometry}>
      <pointsMaterial
        map={texture}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.12}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ─── Animated scene ────────────────────────────────────────────────────────────
function Scene() {
  const [lineProgress, setLineProgress] = useState(0)
  const groupRef = useRef<THREE.Group>(null)

  // Slow auto-rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.06
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.05
    }
  })

  // Lines draw in quickly, then loop
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let current = 0

    function drawLines() {
      current = 0
      setLineProgress(0)
      function step() {
        current += 1
        setLineProgress(current / EDGES.length)
        if (current < EDGES.length) {
          timer = setTimeout(step, 300)
        } else {
          // Pause then redraw
          timer = setTimeout(() => {
            setLineProgress(0)
            timer = setTimeout(drawLines, 500)
          }, 4000)
        }
      }
      timer = setTimeout(step, 200)
    }

    drawLines()
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Dense background starfield — visible immediately */}
      <Stars radius={18} depth={8} count={2000} factor={2.5} saturation={0.4} fade speed={0.5} />

      {/* Constellation group */}
      <group ref={groupRef}>
        <StarHalos />
        <StarCloud />
        <ConstellationLines lineProgress={lineProgress} />
      </group>

      <ambientLight intensity={0.1} />
    </>
  )
}

// ─── Default export ────────────────────────────────────────────────────────────
export default function ConstellationCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 55 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene />
    </Canvas>
  )
}
