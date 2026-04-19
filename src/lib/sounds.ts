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

// Deep bass impact — pairs with the winner slam-in. 80 Hz sine with fast
// decay, same Web Audio style as playCorrect/playWrong above.
export function playBassBoom() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5)
  gain.gain.setValueAtTime(0.6, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.6)
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
