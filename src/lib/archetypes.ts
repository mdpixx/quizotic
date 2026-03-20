// SYNC: keep in sync with archetypes.mjs

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

// 20 × 15 = 300 unique archetypes
export const ARCHETYPES: string[] = ELEMENTS.flatMap(e => TYPES.map(t => `${e} ${t}`))

export function assignArchetype(): string {
  return ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]
}
