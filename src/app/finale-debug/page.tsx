'use client'

// TEMP debug harness (delete before commit). Auth-free, top-level route that
// renders the EXACT finale confetti components over the finale background, plus
// a firecracker button, so we can observe whether they actually render + play
// without running a full live session. Visit /finale-debug in dev.

import { useEffect, useState } from 'react'
import { LottieConfetti } from '@/components/LottieConfetti'
import { CelebrationConfetti } from '@/components/CelebrationConfetti'
import { playFirecracker, isMuted, _debugCtxState } from '@/lib/sounds'

export default function FinaleDebug() {
  const [muted, setMuted] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [lottieNodes, setLottieNodes] = useState(0)
  const [celSpans, setCelSpans] = useState(0)
  const [fired, setFired] = useState(false)
  const [err, setErr] = useState('')
  const [ctxState, setCtxState] = useState('n/a')

  useEffect(() => {
    setMuted(isMuted())
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const t = setInterval(() => {
      setLottieNodes(document.querySelectorAll('svg, canvas').length)
      setCelSpans(document.querySelectorAll('div[aria-hidden="true"] span').length)
      setCtxState(_debugCtxState())
    }, 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: 'linear-gradient(145deg,#071126 0%,#0F1B3D 58%,#111827 100%)' }}>
      <LottieConfetti layer="absolute" />
      <CelebrationConfetti active layer="absolute" />
      <div style={{ position: 'relative', zIndex: 10, color: '#fff', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Finale debug harness</h1>
        <p style={{ opacity: 0.8 }}>If you see confetti falling here, the components work — the live bug is the mode-gate or deploy.</p>
        <p>reduce-motion: <b>{String(reduced)}</b></p>
        <p>muted: <b>{String(muted)}</b></p>
        <p>lottie svg/canvas nodes: <b>{lottieNodes}</b></p>
        <p>celebration particle spans: <b>{celSpans}</b></p>
        <button
          onClick={() => { try { playFirecracker(); setFired(true); setErr('') } catch (e) { setFired(false); setErr(String(e)) } }}
          style={{ marginTop: 8, padding: '10px 18px', fontSize: 16, background: '#FBD13B', color: '#0F1B3D', border: 'none', borderRadius: 8, fontWeight: 700 }}
        >
          Fire firecracker
        </button>
        <p>fired (no throw): <b>{String(fired)}</b></p>
        <p>AudioContext state: <b>{ctxState}</b> (want: running)</p>
        {err && <p style={{ color: '#fca5a5' }}>error: {err}</p>}
      </div>
    </div>
  )
}
