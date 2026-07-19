'use client'
// DiceBear SVGs are generated locally from a string seed — no network call, no user-controlled HTML.
// dangerouslySetInnerHTML is safe here: DiceBear output is a sanitized SVG element.
// Style: `thumbs` — clean, friendly mascot characters. Fixes off-putting
// `fun-emoji` outputs (thermometer / sick / scared faces).
import { createAvatar } from '@dicebear/core'
import { create, meta, schema } from '@dicebear/thumbs'
import { memo } from 'react'

// Brand palette for avatar backgrounds — keeps avatars on-brand across both
// light and dark surfaces.
const BG = ['0F1B3D', 'FBD13B', 'FF8A47', '16A34A', '2D3A8C', '7C3AED']

// Per-(seed,size) SVG cache. The same archetype always produces the same SVG,
// so generating it once and memoizing the string eliminates ~99% of the
// createAvatar cost in a 500-participant roster (one SVG per unique archetype,
// reused across every render). Module-level so the cache survives re-renders
// of the parent host/participant components.
const svgCache = new Map<string, string>()

function renderAvatarSvg(archetype: string, size: number): string {
  const seed = archetype.replace(/\s/g, '')
  const key = `${seed}:${size}`
  const cached = svgCache.get(key)
  if (cached) return cached
  const svg = createAvatar(
    { create, meta, schema },
    { seed, size, backgroundColor: BG, radius: 50 },
  ).toString()
  svgCache.set(key, svg)
  return svg
}

export const Avatar = memo(function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const svg = renderAvatarSvg(archetype, size)
  return (
    <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
})
