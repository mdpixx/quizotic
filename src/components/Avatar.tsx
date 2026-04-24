'use client'
// DiceBear SVGs are generated locally from a string seed — no network call, no user-controlled HTML.
// dangerouslySetInnerHTML is safe here: DiceBear output is a sanitized SVG element.
// Style: `thumbs` — clean, friendly mascot characters. Fixes off-putting
// `fun-emoji` outputs (thermometer / sick / scared faces).
import { createAvatar } from '@dicebear/core'
import { create, meta, schema } from '@dicebear/thumbs'

// Brand palette for avatar backgrounds — keeps avatars on-brand across both
// light and dark surfaces.
const BG = ['0F1B3D', 'F5E642', 'FF8A47', '16A34A', '2D3A8C', '7C3AED']

export function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const seed = archetype.replace(/\s/g, '')
  const svg = createAvatar(
    { create, meta, schema },
    { seed, size, backgroundColor: BG, radius: 50 },
  ).toString()
  return (
    <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
