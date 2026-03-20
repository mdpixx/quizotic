'use client'
// DiceBear SVGs are generated locally from a string seed — no network call, no user-controlled HTML.
// dangerouslySetInnerHTML is safe here: DiceBear output is a sanitized SVG element.
import { createAvatar } from '@dicebear/core'
import { create, meta, schema } from '@dicebear/pixel-art'

export function Avatar({ archetype, size = 48 }: { archetype: string; size?: number }) {
  const svg = createAvatar({ create, meta, schema }, { seed: archetype.replace(/\s/g, ''), size }).toString()
  return (
    <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
