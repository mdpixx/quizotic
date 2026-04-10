'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar } from '@/components/Avatar'
import { Podium } from '@/components/Podium'
import { CircularTimer } from '@/components/CircularTimer'
import { playTick, playCorrect, playWrong, playStreak } from '@/lib/sounds'

const DEMO_LEADERBOARD = [
  { name: 'Mahesh', archetype: 'Mystic Owl', score: 4200 },
  { name: 'Priya', archetype: 'Electric Fox', score: 3800 },
  { name: 'Arjun', archetype: 'Cosmic Tiger', score: 3100 },
  { name: 'Sneha', archetype: 'Neon Falcon', score: 2600 },
  { name: 'Ravi', archetype: 'Thunder Wolf', score: 2100 },
]

const ARCHETYPES = [
  'Mystic Owl', 'Electric Fox', 'Cosmic Tiger', 'Neon Falcon',
  'Thunder Wolf', 'Crystal Panda', 'Storm Eagle', 'Shadow Lynx',
  'Blaze Phoenix', 'Frost Bear', 'Lunar Deer', 'Solar Hawk',
]

const TEAM_COLORS = [
  { name: 'Red', color: '#EF4444' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Green', color: '#16A34A' },
  { name: 'Yellow', color: '#EAB308' },
]

export default function DemoPage() {
  const [section, setSection] = useState<string>('avatars')

  const sections = [
    { id: 'avatars', label: 'Avatars' },
    { id: 'podium', label: 'Podium' },
    { id: 'countdown', label: 'Countdown' },
    { id: 'reactions', label: 'Reactions' },
    { id: 'teams', label: 'Teams' },
    { id: 'wave', label: 'Wave' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-black mb-2" style={{ color: '#0F1B3D' }}>Gamification Demo</h1>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  section === s.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={section === s.id ? { background: '#0F1B3D' } : undefined}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {section === 'avatars' && <AvatarsDemo />}
        {section === 'podium' && <PodiumDemo />}
        {section === 'countdown' && <CountdownDemo />}
        {section === 'reactions' && <ReactionsDemo />}
        {section === 'teams' && <TeamsDemo />}
        {section === 'wave' && <WaveDemo />}
      </div>
    </div>
  )
}

// ─── Avatars Demo ──────────────────────────────────────────────────────────────
function AvatarsDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1" style={{ color: '#0F1B3D' }}>DiceBear Fun-Emoji Avatars</h2>
        <p className="text-gray-500 text-sm mb-4">Every participant gets a unique avatar from their archetype name. Bundled locally — no external API calls.</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {ARCHETYPES.map(arch => (
          <div key={arch} className="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-gray-200">
            <div className="ring-2 rounded-full" style={{ '--tw-ring-color': 'rgba(15,27,61,0.1)' } as React.CSSProperties}>
              <Avatar archetype={arch} size={72} />
            </div>
            <p className="text-xs font-bold text-center" style={{ color: '#0F1B3D' }}>{arch}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgba(15,27,61,0.05)', border: '1px solid rgba(15,27,61,0.1)' }}>
        <p className="text-sm" style={{ color: '#0F1B3D' }}>
          <span className="font-bold">How it works:</span> Each archetype string is used as a seed for DiceBear&apos;s fun-emoji style.
          Same name always produces the same avatar. All SVGs are generated at runtime from the npm package — no network calls.
        </p>
      </div>
    </div>
  )
}

// ─── Podium Demo ───────────────────────────────────────────────────────────────
function PodiumDemo() {
  const [key, setKey] = useState(0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Animated Podium</h2>
          <p className="text-gray-500 text-sm">Bars grow with staggered timing. Winner gets crown + confetti.</p>
        </div>
        <button
          onClick={() => setKey(k => k + 1)}
          className="px-4 py-2 rounded-xl font-bold text-sm text-white"
          style={{ background: '#0F1B3D' }}
        >
          Replay
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <Podium key={key} leaderboard={DEMO_LEADERBOARD} sessionMode="competitive" highlightName="Mahesh" />
      </div>
    </div>
  )
}

// ─── Countdown Demo ────────────────────────────────────────────────────────────
function CountdownDemo() {
  const [timeLeft, setTimeLeft] = useState(10)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    setTimeLeft(10)
    setRunning(true)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setRunning(false)
          return 0
        }
        if (prev <= 6 && prev > 1) playTick()
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Countdown Timer + Tick Sound</h2>
        <p className="text-gray-500 text-sm">Tick sound plays during the last 5 seconds. Progress bar turns red.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-center gap-8">
          <CircularTimer timeLeft={timeLeft} total={10} />
          <div className="text-center">
            <p className="text-6xl font-black tabular-nums" style={{ color: timeLeft <= 5 ? '#EF4444' : '#0F1B3D' }}>{timeLeft}</p>
            <p className="text-gray-400 text-sm">seconds</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(15,27,61,0.1)' }}>
          <div
            className={`h-full rounded-full transition-all duration-1000`}
            style={{ background: timeLeft <= 5 ? '#DC2626' : '#0F1B3D', width: `${(timeLeft / 10) * 100}%` }}
          />
        </div>

        <button
          onClick={start}
          disabled={running}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-all"
          style={{ background: '#0F1B3D' }}
        >
          {running ? 'Running...' : 'Start 10s Countdown'}
        </button>
      </div>
    </div>
  )
}

// ─── Reactions Demo ────────────────────────────────────────────────────────────
function ReactionsDemo() {
  const [showConfetti, setShowConfetti] = useState(false)
  const [showRedFlash, setShowRedFlash] = useState(false)
  const [streak, setStreak] = useState(0)
  const [lastAction, setLastAction] = useState<string | null>(null)

  function triggerCorrect() {
    const newStreak = streak + 1
    setStreak(newStreak)
    setShowConfetti(true)
    setLastAction('correct')
    if (newStreak >= 3) playStreak()
    else playCorrect()
    setTimeout(() => setShowConfetti(false), 2000)
  }

  function triggerWrong() {
    setStreak(0)
    setShowRedFlash(true)
    setLastAction('wrong')
    playWrong()
    setTimeout(() => setShowRedFlash(false), 600)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Reaction Bursts + Streak</h2>
        <p className="text-gray-500 text-sm">Confetti on correct, red flash on wrong. Streak escalates sounds at 3+.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 relative overflow-hidden" style={{ minHeight: 300 }}>
        {/* Red flash */}
        {showRedFlash && (
          <div className="absolute inset-0 pointer-events-none z-20" style={{
            background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0) 70%)',
            animation: 'redFlash 0.6s ease-out forwards',
          }} />
        )}

        {/* Confetti */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="absolute w-3 h-3 rounded-sm" style={{
                left: `${10 + Math.random() * 80}%`,
                top: '60%',
                background: ['#0F1B3D', '#F5E642', '#FF8A47', '#16A34A', '#2D3A8C', '#5BC0EB'][i % 6],
                animation: `confettiBurst ${0.8 + Math.random() * 0.8}s ease-out ${Math.random() * 0.2}s forwards`,
              }} />
            ))}
          </div>
        )}

        {/* Result display */}
        <div className="flex flex-col items-center gap-3 relative z-10">
          {lastAction === 'correct' && (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl bg-green-50 border-2 border-green-300"
              style={{ animation: 'correctPop 0.4s ease-out' }}>
              ✓
            </div>
          )}
          {lastAction === 'wrong' && (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl bg-red-50 border-2 border-red-300"
              style={{ animation: 'wrongShake 0.4s ease-out' }}>
              ✗
            </div>
          )}
          {!lastAction && (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl bg-gray-50 border-2 border-gray-200">
              ?
            </div>
          )}

          {lastAction === 'correct' && (
            <p className="font-black text-2xl text-green-600" style={{ animation: 'correctPop 0.4s ease-out' }}>Correct!</p>
          )}
          {lastAction === 'wrong' && (
            <p className="font-black text-2xl text-red-500">Wrong!</p>
          )}

          {/* Streak badge */}
          {streak >= 2 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{
              background: streak >= 5 ? 'linear-gradient(135deg, #F5E642, #FF8A47)' : '#0F1B3D',
              animation: 'correctPop 0.4s ease-out',
            }}>
              <span className="text-white font-black text-lg">{streak} Streak!</span>
            </div>
          )}

          <p className="text-gray-400 text-sm">Current streak: {streak}</p>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <button onClick={triggerCorrect}
            className="py-4 rounded-xl font-bold text-white text-lg bg-green-500 hover:bg-green-600 transition-colors">
            Correct Answer
          </button>
          <button onClick={triggerWrong}
            className="py-4 rounded-xl font-bold text-white text-lg bg-red-500 hover:bg-red-600 transition-colors">
            Wrong Answer
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confettiBurst {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) translateX(${Math.random() > 0.5 ? '' : '-'}60px) rotate(720deg) scale(0); opacity: 0; }
        }
        @keyframes redFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes correctPop {
          0% { transform: scale(0.5); }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes wrongShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}

// ─── Teams Demo ────────────────────────────────────────────────────────────────
function TeamsDemo() {
  const teamAssignments = ARCHETYPES.slice(0, 8).map((arch, i) => ({
    name: ['Mahesh', 'Priya', 'Arjun', 'Sneha', 'Ravi', 'Anita', 'Vikram', 'Kavita'][i],
    archetype: arch,
    team: TEAM_COLORS[i % TEAM_COLORS.length],
  }))

  const teamScores = TEAM_COLORS.map(t => ({
    ...t,
    score: Math.floor(2000 + Math.random() * 6000),
    members: teamAssignments.filter(a => a.team.name === t.name).length,
  })).sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Team Mode</h2>
        <p className="text-gray-500 text-sm">Participants are auto-assigned to teams (round-robin). Team scores aggregate individual scores.</p>
      </div>

      {/* Team Leaderboard */}
      <div className="space-y-3">
        <h3 className="text-lg font-black" style={{ color: '#0F1B3D' }}>Team Standings</h3>
        {teamScores.map((team, i) => (
          <div key={team.name} className="flex items-center gap-3 rounded-xl p-4 bg-white border border-gray-200">
            <span className="text-2xl font-black w-8 text-center" style={{ color: team.color }}>
              {i === 0 ? '🏆' : i + 1}
            </span>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: team.color }}>
              {team.name[0]}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg" style={{ color: '#1E1B4B' }}>Team {team.name}</p>
              <p className="text-sm text-gray-500">{team.members} members</p>
            </div>
            <span className="text-xl font-black tabular-nums" style={{ color: team.color }}>{team.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Participant Grid with Team Badges */}
      <div>
        <h3 className="text-lg font-black mb-3" style={{ color: '#0F1B3D' }}>Lobby View</h3>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex flex-wrap gap-4">
            {teamAssignments.map(p => (
              <div key={p.name} className="flex flex-col items-center gap-1">
                <div className="ring-2 rounded-full overflow-hidden" style={{ borderColor: p.team.color }}>
                  <Avatar archetype={p.archetype} size={56} />
                </div>
                <p className="text-sm text-gray-700 font-semibold max-w-[72px] truncate text-center">{p.name}</p>
                <span className="text-white text-xs rounded-full px-2 py-0.5 font-bold" style={{ background: p.team.color }}>
                  {p.team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Participant question header preview */}
      <div>
        <h3 className="text-lg font-black mb-3" style={{ color: '#0F1B3D' }}>Participant Header (during question)</h3>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Avatar archetype="Mystic Owl" size={40} />
            <span className="text-gray-500 text-base">Mystic Owl</span>
            <span className="text-white text-xs rounded-full px-2 py-0.5 font-bold" style={{ background: '#3B82F6' }}>Blue</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Wave Demo ─────────────────────────────────────────────────────────────────
function WaveDemo() {
  const [showWave, setShowWave] = useState(false)

  function triggerWave() {
    setShowWave(true)
    setTimeout(() => setShowWave(false), 2500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black" style={{ color: '#0F1B3D' }}>Audience Wave</h2>
        <p className="text-gray-500 text-sm">Triggers when 80%+ of participants agree on the same option (min 5 votes).</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden" style={{ minHeight: 250 }}>
        {showWave && (
          <>
            <div className="absolute inset-0 pointer-events-none z-20" style={{
              background: 'linear-gradient(90deg, transparent, rgba(15,27,61,0.1), rgba(245,230,66,0.15), transparent)',
              animation: 'waveSweep 2s ease-in-out forwards',
            }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <p className="text-4xl font-black text-center whitespace-nowrap" style={{
                color: '#0F1B3D',
                textShadow: '0 2px 20px rgba(15,27,61,0.3)',
                animation: 'waveSweep 2s ease-in-out forwards',
              }}>
                Audience Wave!
              </p>
            </div>
          </>
        )}

        {/* Simulated vote bar */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Simulated Poll: Favorite framework?</p>
          {[
            { label: 'React', pct: 85, color: '#3B82F6' },
            { label: 'Vue', pct: 8, color: '#16A34A' },
            { label: 'Angular', pct: 5, color: '#EF4444' },
            { label: 'Svelte', pct: 2, color: '#F59E0B' },
          ].map(opt => (
            <div key={opt.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">{opt.label}</span>
                <span className="text-gray-400">{opt.pct}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${opt.pct}%`, background: opt.color }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">17/20 voted for React (85%) — wave triggered!</p>
        </div>

        <button onClick={triggerWave} disabled={showWave}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-all"
          style={{ background: '#0F1B3D' }}>
          {showWave ? 'Waving...' : 'Trigger Audience Wave'}
        </button>
      </div>

      <style>{`
        @keyframes waveSweep {
          0% { transform: translateX(-100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
