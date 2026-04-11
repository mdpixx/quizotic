'use client'

// Web Audio API sound effects — no external files needed
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
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
