// SYNC: keep in sync with archetypes.ts
// Pure ESM JS — imported by server.mjs (cannot import TypeScript)

const ELEMENTS = [
  'Fire', 'Ice', 'Storm', 'Shadow', 'Thunder',
  'Solar', 'Lunar', 'Cosmic', 'Iron', 'Crystal',
  'Void', 'Phoenix', 'Neon', 'Obsidian', 'Glacier',
  'Inferno', 'Titan', 'Mystic', 'Blood', 'Sakura',
]

const TYPES = [
  'Dragon', 'Tiger', 'Ninja', 'Samurai', 'Wizard',
  'Wolf', 'Eagle', 'Fox', 'Cobra', 'Knight',
  'Archer', 'Panther', 'Viper', 'Monk', 'Phoenix',
]

export const ARCHETYPES = ELEMENTS.flatMap(e => TYPES.map(t => `${e} ${t}`))

export function assignArchetype() {
  return ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]
}
