'use client'

import { useEffect, useRef, useState } from 'react'

const BLOOM_BARS = [
  { label: 'Remember', color: '#DC2626', pct: 100 },
  { label: 'Understand', color: '#EA580C', pct: 87 },
  { label: 'Apply', color: '#CA8A04', pct: 74 },
  { label: 'Analyse', color: '#16A34A', pct: 60 },
  { label: 'Evaluate', color: '#2563EB', pct: 46 },
  { label: 'Create', color: '#7C3AED', pct: 33 },
]

const BLOOM_DESCS = [
  'Recall, list, identify',
  'Explain, summarize, classify',
  'Use, execute, implement',
  'Compare, organize, deconstruct',
  'Judge, critique, justify',
  'Design, construct, produce',
]

function BloomsVisual({ animate }: { animate: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {BLOOM_BARS.map((b, i) => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 36, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, right: 'auto',
              width: animate ? `${b.pct}%` : '0%',
              background: b.color,
              borderRadius: 6,
              transition: `width 0.8s ease-out ${i * 0.1}s`,
              display: 'flex', alignItems: 'center', paddingLeft: 12,
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#fff' }}>{b.label}</span>
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.55)', width: 160, flexShrink: 0 }}>{BLOOM_DESCS[i]}</span>
        </div>
      ))}
    </div>
  )
}

function ConfidenceGrid() {
  const axisLabel = { fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }
  const cellLabel = 'var(--font-body, "DM Sans", sans-serif)'
  const rows = [
    {
      row: 'SURE',
      cells: [
        { label: 'Sure + Correct', pct: '58%', desc: 'Solid knowledge', note: '✓ Truly understands', color: '#16A34A' },
        { label: 'Sure + Wrong', pct: '12%', desc: 'Dangerous gap', note: '⚠ WATCH — Won\'t seek help', color: '#DC2626' },
      ],
    },
    {
      row: 'UNSURE',
      cells: [
        { label: 'Unsure + Correct', pct: '15%', desc: 'Lucky guess', note: 'Needs reinforcement', color: '#CA8A04' },
        { label: 'Unsure + Wrong', pct: '15%', desc: 'Knows the gap', note: 'Easiest to help', color: '#2563EB' },
      ],
    },
  ]
  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div />
        <div style={{ ...axisLabel, textAlign: 'center' }}>CORRECT</div>
        <div style={{ ...axisLabel, textAlign: 'center' }}>WRONG</div>
      </div>
      {/* Rows */}
      {rows.map((r, ri) => (
        <div key={r.row} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr', gap: 8, marginBottom: ri === 0 ? 8 : 0 }}>
          {/* Row label — horizontal, centred vertically */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
            <span style={{ ...axisLabel, fontSize: 11 }}>{r.row}</span>
          </div>
          {r.cells.map(c => (
            <div key={c.label} style={{ border: `2px solid ${c.color}`, borderRadius: 10, padding: '14px', background: `${c.color}22` }}>
              <div style={{ fontFamily: cellLabel, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 32, color: '#fff', lineHeight: 1, marginBottom: 4 }}>{c.pct}</div>
              <div style={{ fontFamily: cellLabel, fontSize: 13, color: '#fff', fontWeight: 700, marginBottom: 4 }}>{c.desc}</div>
              <div style={{ fontFamily: cellLabel, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{c.note}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ForgettingCurve({ animate }: { animate: boolean }) {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <svg viewBox="0 0 400 230" width="100%" style={{ overflow: 'visible' }}>
        {/* Axes */}
        <line x1="50" y1="10" x2="50" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <line x1="50" y1="190" x2="380" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        {/* Y-axis labels */}
        {[['0%', 190], ['25%', 145], ['50%', 100], ['75%', 55], ['100%', 16]].map(([l, y]) => (
          <text key={l} x="42" y={y as number} fill="rgba(255,255,255,0.5)" fontFamily="DM Sans, sans-serif" fontSize="10" textAnchor="end">{l}</text>
        ))}
        {/* X-axis labels */}
        <text x="60" y="206" fill="rgba(255,255,255,0.5)" fontFamily="DM Sans, sans-serif" fontSize="11">Day 1</text>
        <text x="190" y="206" fill="rgba(255,255,255,0.5)" fontFamily="DM Sans, sans-serif" fontSize="11">Day 7</text>
        <text x="335" y="206" fill="rgba(255,255,255,0.5)" fontFamily="DM Sans, sans-serif" fontSize="11">Day 30</text>
        {/* Grid lines */}
        <line x1="50" y1="145" x2="380" y2="145" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
        <line x1="50" y1="100" x2="380" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
        <line x1="50" y1="55" x2="380" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
        {/* Fill area */}
        <path d="M60,15 Q90,40 120,120 Q140,155 160,160 L160,80 Q180,50 200,45 Q220,60 240,100 Q260,120 280,125 L280,55 Q300,35 340,32 L380,30 L380,190 L60,190 Z" fill="rgba(93,176,235,0.1)"/>
        {/* Forgetting without practice (faint dashed) */}
        <path d="M60,15 Q100,60 160,155 Q220,175 380,180" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" strokeDasharray="4 4"/>
        {/* Main curve */}
        <path d="M60,15 Q90,40 120,120 Q140,155 160,160 L160,80 Q180,50 200,45 Q220,60 240,100 Q260,120 280,125 L280,55 Q300,35 340,32 L370,30"
          stroke="#5BC0EB" strokeWidth="2.5" fill="none" strokeLinecap="round"
          style={animate ? { strokeDasharray: 600, strokeDashoffset: 0, transition: 'stroke-dashoffset 2s ease-out' } : { strokeDasharray: 600, strokeDashoffset: 600 }}
        />
        {/* Long-term memory plateau */}
        <line x1="280" y1="35" x2="380" y2="32" stroke="#16A34A" strokeWidth="2" strokeDasharray="6 4"/>
        <text x="310" y="24" fill="#16A34A" fontFamily="DM Sans, sans-serif" fontSize="9" fontWeight="500">Long-term memory</text>
        {/* Practice dots */}
        <circle cx="60" cy="15" r="6" fill="#F5E642"/>
        <text x="68" y="28" fill="#F5E642" fontFamily="DM Sans, sans-serif" fontSize="9" fontWeight="500">Session 1</text>
        <circle cx="160" cy="80" r="6" fill="#F5E642"/>
        <text x="168" y="76" fill="#F5E642" fontFamily="DM Sans, sans-serif" fontSize="9" fontWeight="500">Session 2</text>
        <circle cx="280" cy="55" r="6" fill="#F5E642"/>
        <text x="288" y="52" fill="#F5E642" fontFamily="DM Sans, sans-serif" fontSize="9" fontWeight="500">Session 3</text>
        {/* Legend */}
        <line x1="60" y1="218" x2="80" y2="218" stroke="#5BC0EB" strokeWidth="2"/>
        <text x="84" y="221" fill="rgba(255,255,255,0.5)" fontFamily="DM Sans, sans-serif" fontSize="9">Retention with practice</text>
        <circle cx="190" cy="218" r="4" fill="#F5E642"/>
        <text x="198" y="221" fill="rgba(255,255,255,0.5)" fontFamily="DM Sans, sans-serif" fontSize="9">Practice session</text>
      </svg>
    </div>
  )
}

function UspCard({ children, reverse = false }: { children: React.ReactNode; reverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', padding: 'clamp(32px, 6vw, 64px) 0', borderBottom: '1px solid rgba(255,255,255,0.08)', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }} className={`usp-card${reverse ? ' usp-reverse' : ''}`}>
      {children}
    </div>
  )
}

function UspText({ num, title, subtitle, body, citation, tags }: { num: string; title: string; subtitle: string; body: string; citation: string; tags: string[] }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 48, color: '#F5E642', marginBottom: 8 }}>{num}</div>
      <h3 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 28, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</h3>
      <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, fontSize: 16, color: '#F5E642', marginBottom: 16 }}>{subtitle}</p>
      <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 16 }}>{body}</p>
      <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>📖 {citation}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tags.map(t => (
          <span key={t} style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, fontWeight: 600, color: '#F5E642', border: '1px solid rgba(245,230,66,0.4)', borderRadius: 20, padding: '4px 12px' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export function LearningScience() {
  const bloomRef = useRef<HTMLDivElement>(null)
  const [bloomAnimate, setBloomAnimate] = useState(false)
  const curveRef = useRef<HTMLDivElement>(null)
  const [curveAnimate, setCurveAnimate] = useState(false)

  useEffect(() => {
    const bloomEl = bloomRef.current
    if (bloomEl) {
      const obs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { setBloomAnimate(true); obs.disconnect() }
      }, { threshold: 0.3 })
      obs.observe(bloomEl)
      return () => obs.disconnect()
    }
  }, [])

  useEffect(() => {
    const curveEl = curveRef.current
    if (curveEl) {
      const obs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { setCurveAnimate(true); obs.disconnect() }
      }, { threshold: 0.3 })
      obs.observe(curveEl)
      return () => obs.disconnect()
    }
  }, [])

  return (
    <section id="methodology" style={{ padding: 'clamp(56px, 11vw, 120px) 24px', background: '#0F1B3D' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#fff', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          Built on <span style={{ color: '#F5E642' }}>learning science,</span> not guesswork.
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 600, margin: '0 auto 24px', lineHeight: 1.6 }}>
          Every feature in Quizotic is grounded in peer-reviewed research. Three evidence-based frameworks power every session.
        </p>

        {/* USP 1: Bloom's */}
        <UspCard>
          <UspText
            num="01"
            title="Bloom's Taxonomy"
            subtitle="Mapping every question to deeper thinking"
            body="Tag each question to one of six cognitive levels — from basic recall to creative synthesis. This ensures your sessions don't just test memory; they build understanding."
            citation="Anderson & Krathwohl, 2001 — Revised Bloom's Framework · Used in 150+ countries"
            tags={["Coverage radar chart", "Per-question tagging"]}
          />
          <div ref={bloomRef}>
            <BloomsVisual animate={bloomAnimate} />
          </div>
        </UspCard>

        {/* USP 2: Confidence Grid */}
        <UspCard reverse>
          <div style={{ order: 1 }} className="usp-visual-first">
            <ConfidenceGrid />
          </div>
          <UspText
            num="02"
            title="Confidence Grid"
            subtitle="See what learners know vs. what they think they know"
            body="Traditional quizzes only show right or wrong. The Confidence Grid adds a second dimension — how sure the learner was. This reveals dangerous gaps (confident but wrong) and lucky guesses (right but unsure)."
            citation="Dunlosky et al., 2013 — Psychological Science in the Public Interest"
            tags={["Metacognition", "Per-question tracking"]}
          />
        </UspCard>

        {/* USP 3: Spaced Retrieval */}
        <UspCard>
          <UspText
            num="03"
            title="Spaced Retrieval"
            subtitle="The science behind remembering longer"
            body="Without revision, most learners forget 70% of new knowledge within a week. After every session, Quizotic generates 3 ready-to-share follow-up quizzes — timed at Day 1, Day 7, and Day 30 — so you can reinforce what was taught at the intervals that matter most."
            citation="Ebbinghaus Forgetting Curve, 1885 — replicated in 100+ modern studies"
            tags={["Follow-up quizzes", "Spaced practice"]}
          />
          <div ref={curveRef} style={{ display: 'flex', justifyContent: 'center' }}>
            <ForgettingCurve animate={curveAnimate} />
          </div>
        </UspCard>
      </div>

      <style>{`
        .usp-card { }
        .usp-reverse .usp-visual-first { order: -1; }
        @media (max-width: 768px) {
          .usp-card { grid-template-columns: 1fr !important; gap: 32px !important; }
          /* Stack text first, visual below — consistent with USP 1 & 3.
             (Visual is first in the DOM for the desktop reverse layout.) */
          .usp-reverse .usp-visual-first { order: 1 !important; }
        }
      `}</style>
    </section>
  )
}
