'use client'

// Web Audio API sound effects — no external files needed
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

// Cached HTMLAudioElement instances for MP3-backed effects. First access
// triggers preload; subsequent plays reuse the same element (rewound). If the
// file is missing, playback silently fails and synth sounds carry the moment.
const mp3Cache = new Map<string, HTMLAudioElement>()
function getMp3(path: string, volume = 0.9): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  let el = mp3Cache.get(path)
  if (!el) {
    el = new Audio(path)
    el.preload = 'auto'
    el.volume = volume
    mp3Cache.set(path, el)
  }
  return el
}
function playMp3(path: string, volume = 0.9): Promise<void> {
  const el = getMp3(path, volume)
  if (!el) return Promise.resolve()
  try {
    el.currentTime = 0
    const p = el.play()
    return p instanceof Promise ? p.catch(() => {}) : Promise.resolve()
  } catch {
    return Promise.resolve()
  }
}
function stopMp3(path: string) {
  const el = mp3Cache.get(path)
  if (!el) return
  try { el.pause(); el.currentTime = 0 } catch {}
}

// Preload MP3 assets — call once when the ended phase is about to start so
// there's no audible latency on the winner reveal.
export function preloadCelebrationSounds(): void {
  getMp3('/sounds/cheer.mp3')
  getMp3('/sounds/drumroll.mp3')
}

export function playTick() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 880
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.1)
}

export function playCorrect() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.25, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  // Rising two-tone chime
  osc.frequency.setValueAtTime(523, ctx.currentTime)       // C5
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15) // G5
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.4)
}

export function playWrong() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.value = 200
  gain.gain.setValueAtTime(0.2, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
}

export function playStreak() {
  const ctx = getCtx()
  // Rapid ascending arpeggio
  const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = ctx.currentTime + i * 0.08
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.start(t)
    osc.stop(t + 0.15)
  })
}

// Real crowd cheer MP3 (~74KB). Layered with synth fanfare on winner reveal.
export function playCheer(): Promise<void> {
  return playMp3('/sounds/cheer.mp3', 0.85)
}
export function stopCheer(): void {
  stopMp3('/sounds/cheer.mp3')
}

// Rising snare drumroll MP3. Looped naturally by its own tail; stop when the
// winner is revealed.
export function playDrumroll(): Promise<void> {
  return playMp3('/sounds/drumroll.mp3', 0.8)
}
export function stopDrumroll(): void {
  stopMp3('/sounds/drumroll.mp3')
}

// Celebratory winner sting — pairs with the winner slam-in. Replaces the
// previous deep 120→40 Hz sub-bass drop that read as ominous. Now layers:
//   - soft timpani thump (80→60 Hz, 220ms) for weight without dread
//   - major triad C5–E5–G5 on triangle wave for a triumphant resolve
//   - high shimmer chime (C6) tail for a polished finish
// Total duration ~550ms. Export name kept for backward compatibility.
export function playBassBoom() {
  const ctx = getCtx()
  const t0 = ctx.currentTime

  // 1) Soft timpani thump — gives rhythmic weight, not a horror drop
  {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, t0)
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.22)
    gain.gain.setValueAtTime(0.28, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28)
    osc.start(t0)
    osc.stop(t0 + 0.3)
  }

  // 2) Major triad C5 / E5 / G5 — resolves major, feels celebratory
  const triad = [523.25, 659.25, 783.99]
  triad.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.value = freq
    const start = t0 + 0.04 + i * 0.02
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45)
    osc.start(start)
    osc.stop(start + 0.5)
  })

  // 3) Shimmer tail — C6 on sine, short and bright
  {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 1046.5
    const start = t0 + 0.18
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
    osc.start(start)
    osc.stop(start + 0.4)
  }
}

// Short leaderboard reveal jingle — played when post-question standings
// refresh. Distinct from playCorrect/playWrong (per-answer feedback) and
// playCelebration (end-of-quiz fanfare). Brief (~600ms) ascending triad with
// triangle tone so it punctuates the reveal without stretching the pacing
// between questions.
export function playLeaderboardJingle() {
  const ctx = getCtx()
  const notes = [
    { freq: 523, delay: 0, dur: 0.16 },    // C5
    { freq: 659, delay: 0.12, dur: 0.16 }, // E5
    { freq: 784, delay: 0.24, dur: 0.18 }, // G5
    { freq: 1047, delay: 0.36, dur: 0.28 },// C6 held
  ]
  notes.forEach(({ freq, delay, dur }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime + delay
    gain.gain.setValueAtTime(0.14, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t)
    osc.stop(t + dur)
  })
}

export function playCelebration() {
  const ctx = getCtx()
  // Triumphant fanfare: C5 → E5 → G5 → C6 (sustained, with harmonics)
  const notes = [
    { freq: 523, delay: 0, dur: 0.25 },     // C5
    { freq: 659, delay: 0.2, dur: 0.25 },    // E5
    { freq: 784, delay: 0.4, dur: 0.25 },    // G5
    { freq: 1047, delay: 0.6, dur: 0.6 },    // C6 (sustained)
    { freq: 784, delay: 0.9, dur: 0.3 },     // G5
    { freq: 1047, delay: 1.1, dur: 0.8 },    // C6 (final hold)
  ]
  notes.forEach(({ freq, delay, dur }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime + delay
    gain.gain.setValueAtTime(0.18, t)
    gain.gain.setValueAtTime(0.18, t + dur * 0.7)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t)
    osc.stop(t + dur)
  })
}
