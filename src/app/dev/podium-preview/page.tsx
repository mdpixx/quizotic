'use client'

/**
 * Dev-only preview: the final Podium rendered inside the real participant
 * final-screen container, so its mobile alignment can be checked at narrow
 * viewport widths (320 / 360 / 390px) without driving a live socket session.
 * No auth, no socket, no DB — static sample leaderboard, skipIntro so it lands
 * straight in the final 'rest' state.
 * URL: http://localhost:4000/dev/podium-preview
 */

import { Podium } from '@/components/Podium'

const LEADERBOARD = [
  { name: 'Priyadarshini', archetype: 'The Strategist', score: 8420 },
  { name: 'Vikram', archetype: 'The Challenger', score: 7310 },
  { name: 'Meenakshi', archetype: 'The Explorer', score: 6890 },
  { name: 'Rohit', archetype: 'The Analyst', score: 5120 },
  { name: 'Aisha', archetype: 'The Maverick', score: 4770 },
  { name: 'Kabir', archetype: 'The Sprinter', score: 3980 },
]

// Mirrors join/page.tsx:2507 — the real participant final-screen wrapper.
function FinalScreen({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ background: '#0F1B3D' }}>
      <p className="text-xs font-bold text-center text-yellow-300 pt-2">{label}</p>
      <div className="min-h-screen px-3 sm:px-4 pt-8 sm:pt-6 pb-4 max-w-md mx-auto relative overflow-x-hidden">
        {children}
      </div>
    </div>
  )
}

export default function PodiumPreviewPage() {
  return (
    <main style={{ background: '#0F1B3D' }}>
      <FinalScreen label="Top 3 — standard">
        <Podium leaderboard={LEADERBOARD} sessionMode="competitive" highlightName="Meenakshi" skipIntro showRest />
      </FinalScreen>
      <FinalScreen label="Top 3 — finale variant">
        <Podium leaderboard={LEADERBOARD} sessionMode="competitive" highlightName="Vikram" skipIntro showRest variant="finale" />
      </FinalScreen>
      <FinalScreen label="Two finishers">
        <Podium leaderboard={LEADERBOARD.slice(0, 2)} sessionMode="competitive" skipIntro />
      </FinalScreen>
      <FinalScreen label="Single winner">
        <Podium leaderboard={LEADERBOARD.slice(0, 1)} sessionMode="competitive" skipIntro />
      </FinalScreen>
    </main>
  )
}
