'use client'

// Web Audio API sound effects — no external files needed
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
    // Autoplay policy: a context first created outside a user gesture starts
    // 'suspended' and stays silent — and most Quizotic cues are fired by socket
    // events (question countdown, finale firecracker), not clicks, so resume()
    // called from those handlers is ignored by the browser. Attach listeners on
    // first creation so the next pointerdown/keydown (the host always interacts
    // before sounds matter) resumes the context and keeps it running. Idempotent
    // and cheap; resume() is a no-op when already running.
    if (typeof window !== 'undefined') {
      const tryResume = () => {
        if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume()
      }
      window.addEventListener('pointerdown', tryResume, { passive: true })
      window.addEventListener('keydown', tryResume, { passive: true })
    }
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

// ─── Global mute ────────────────────────────────────────────────────────────
// One switch for everything: synth effects route through a master GainNode,
// MP3-backed effects flip the elements' muted flag. Persisted so the choice
// survives reloads (a teacher who muted once stays muted next session).
const MUTE_KEY = 'quizotic-audio-muted'
let muted = false
try {
  muted = typeof window !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
} catch { /* storage unavailable (private mode) — default unmuted */ }

let masterGain: GainNode | null = null
function getMaster(ctx: AudioContext): GainNode {
  if (!masterGain) {
    masterGain = ctx.createGain()
    masterGain.gain.value = muted ? 0 : 1
    masterGain.connect(ctx.destination)
  }
  return masterGain
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(m: boolean): void {
  muted = m
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* ignore */ }
  if (masterGain) masterGain.gain.value = m ? 0 : 1
  for (const el of mp3Cache.values()) el.muted = m
}

export function toggleMuted(): boolean {
  setMuted(!muted)
  return muted
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
  el.muted = muted
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

// Continuous background music for live quiz sessions. Host-only — plays in the
// presenter browser at low volume to keep the room lively between question
// reveals. The asset is a seamlessly-looping royalty-free instrumental at
// /sounds/bg-loop.mp3. If the file is missing, playback silently fails.
const BG_MUSIC_PATH = '/sounds/bg-loop.mp3'
const DEFAULT_BG_VOLUME = 0.15

export function playBackgroundMusic(volume: number = DEFAULT_BG_VOLUME): Promise<void> {
  const el = getMp3(BG_MUSIC_PATH, volume)
  if (!el) return Promise.resolve()
  try {
    el.loop = true
    el.volume = volume
    const p = el.play()
    return p instanceof Promise ? p.catch(() => {}) : Promise.resolve()
  } catch {
    return Promise.resolve()
  }
}

export function stopBackgroundMusic(): void {
  const el = mp3Cache.get(BG_MUSIC_PATH)
  if (!el) return
  try { el.pause(); el.currentTime = 0 } catch {}
}

export function setBackgroundMusicVolume(volume: number): void {
  const el = mp3Cache.get(BG_MUSIC_PATH)
  if (!el) return
  try { el.volume = Math.max(0, Math.min(1, volume)) } catch {}
}

export function playTick() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(getMaster(ctx))
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
  gain.connect(getMaster(ctx))
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
  gain.connect(getMaster(ctx))
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
    gain.connect(getMaster(ctx))
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
    osc.connect(gain); gain.connect(getMaster(ctx))
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
    osc.connect(gain); gain.connect(getMaster(ctx))
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
    osc.connect(gain); gain.connect(getMaster(ctx))
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
    gain.connect(getMaster(ctx))
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime + delay
    gain.gain.setValueAtTime(0.14, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.start(t)
    osc.stop(t + dur)
  })
}

// Firecracker / party-popper burst — a short launch whistle, a filtered-noise
// boom, then a scatter of tiny crackle pops. Pure Web Audio (no asset), routed
// through the master gain so the global mute applies. Played once when the
// end-of-session confetti first launches, for a celebratory "pop".
export function playFirecracker() {
  const ctx = getCtx()
  const t0 = ctx.currentTime

  // 1) Launch whistle — quick upward sweep
  {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(getMaster(ctx))
    osc.type = 'sine'
    osc.frequency.setValueAtTime(700, t0)
    osc.frequency.exponentialRampToValueAtTime(1700, t0 + 0.18)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
    osc.start(t0); osc.stop(t0 + 0.22)
  }

  // Helper: a short band-passed noise burst (boom / crackle pop)
  const burst = (start: number, dur: number, vol: number, freq: number) => {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      // white noise with a fast decay envelope
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.value = vol
    src.connect(bp); bp.connect(gain); gain.connect(getMaster(ctx))
    src.start(start); src.stop(start + dur)
  }

  // 2) Main boom
  burst(t0 + 0.2, 0.25, 0.4, 380)

  // 3) Crackle tail — a scatter of tiny high pops
  for (let i = 0; i < 8; i++) {
    burst(t0 + 0.28 + Math.random() * 0.5, 0.04, 0.14, 1600 + Math.random() * 2600)
  }
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
    gain.connect(getMaster(ctx))
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
