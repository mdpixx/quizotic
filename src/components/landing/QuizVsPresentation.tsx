'use client'

const QUIZ_FEATURES = [
  'MCQ, True/False, Word Cloud, Open-ended & more',
  'Live leaderboard with real-time scoring',
  'Timer-based engagement for active recall',
  'Instant response heatmaps',
  'Confidence tracking per question',
]

const PRESENT_FEATURES = [
  '19 interactive slide types',
  'Embed live polls inside presentations',
  'Audience reactions in real time',
  'Branching slides based on responses',
  'Export & share session recordings',
]

const PILL_COLORS = ['#2D3A8C', '#FF8A47', '#5BC0EB', '#E07A5F']

export function QuizVsPresentation() {
  return (
    <section id="features" style={{ padding: '120px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Heading */}
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 48px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          Two superpowers.{' '}
          <span style={{ background: '#F5E642', padding: '2px 8px', borderRadius: 6 }}>One platform.</span>
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 600, margin: '0 auto 56px', lineHeight: 1.6 }}>
          Quizotic gives you live quiz engagement AND interactive presentation power — use them together or independently.
        </p>

        {/* Cards grid — subgrid so both cards share row tracks, guaranteeing preview alignment */}
        <div className="two-powers-grid">

          {/* ── Quiz Mode card ── */}
          <div className="qvp-card quiz-card">

            {/* Row 1: Badge */}
            <div style={{ padding: '36px 32px 0' }}>
              <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#2D3A8C', letterSpacing: '0.1em', border: '2px solid #2D3A8C', borderRadius: 20, padding: '5px 14px', textTransform: 'uppercase' }}>
                Quiz Mode
              </div>
            </div>

            {/* Row 2: Features */}
            <ul style={{ listStyle: 'none', padding: '0 32px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12, alignContent: 'start' }}>
              {QUIZ_FEATURES.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: '#374151', lineHeight: 1.5 }}>
                  <span style={{ color: '#2D3A8C', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Row 3: Preview */}
            <div style={{ padding: '0 32px 36px' }}>
              <div style={{ background: '#F8F9FA', borderRadius: 12, padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#0F1B3D', marginBottom: 10 }}>
                  Which element has symbol &apos;Fe&apos;?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {['A · Iron', 'B · Gold', 'C · Silver', 'D · Zinc'].map((opt, i) => (
                    <span key={i} style={{ background: PILL_COLORS[i], color: '#fff', fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontWeight: 600, padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
                      {opt}
                    </span>
                  ))}
                </div>
                {/* Mini leaderboard */}
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 10 }}>
                  <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 6 }}>🏆 LEADERBOARD</div>
                  {[['Arjun S.', '1,420'], ['Priya K.', '1,280'], ['Riya M.', '1,150']].map(([name, score], i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', padding: '3px 0', color: '#374151' }}>
                      <span style={{ color: '#888' }}>{i + 1}. {name}</span>
                      <span style={{ fontWeight: 700, color: '#0F1B3D' }}>{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ── Present Mode card ── */}
          <div className="qvp-card present-card">

            {/* Row 1: Badge */}
            <div style={{ padding: '36px 32px 0' }}>
              <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#F5E642', letterSpacing: '0.1em', border: '2px solid rgba(245,230,66,0.6)', borderRadius: 20, padding: '5px 14px', textTransform: 'uppercase' }}>
                Present Mode
              </div>
            </div>

            {/* Row 2: Features */}
            <ul style={{ listStyle: 'none', padding: '0 32px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12, alignContent: 'start' }}>
              {PRESENT_FEATURES.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                  <span style={{ color: '#F5E642', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Row 3: Preview */}
            <div style={{ padding: '0 32px 36px' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Session header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 12, color: '#fff' }}>Digital Tools Onboarding</div>
                    <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Slide 6 of 14</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block', boxShadow: '0 0 4px #16A34A' }} />
                    <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, fontWeight: 600, color: '#16A34A' }}>34 live</span>
                  </div>
                </div>

                {/* Slide progress bar */}
                <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '43%', background: '#F5E642', borderRadius: 2 }} />
                </div>

                {/* Audience reactions */}
                <div>
                  <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Audience Reactions</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['👍', 18], ['❤️', 9], ['🤔', 6], ['😮', 4]].map(([emoji, count]) => (
                      <div key={emoji as string} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 9px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</div>
                        <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontSize: 10, fontWeight: 700, color: '#fff', marginTop: 3 }}>{count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Embedded poll result */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Embedded Poll · &ldquo;Rate your confidence&rdquo;</div>
                    <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, fontWeight: 600, color: '#F5E642', border: '1px solid rgba(245,230,66,0.35)', borderRadius: 8, padding: '1px 6px' }}>28 voted</span>
                  </div>
                  {[[5,'#16A34A',11],[4,'#4ADE80',9],[3,'#CA8A04',5],[2,'#EA580C',2],[1,'#DC2626',1]].map(([star, color, count]) => (
                    <div key={star as number} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, color: 'rgba(255,255,255,0.45)', width: 10, flexShrink: 0 }}>{star}</div>
                      <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(count as number) / 11 * 100}%`, background: color as string, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, color: 'rgba(255,255,255,0.4)', width: 12, textAlign: 'right' }}>{count}</div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        /* Parent grid: 3 shared row tracks */
        .two-powers-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          column-gap: 28px;
          row-gap: 20px;
        }
        /* Each card spans all 3 rows and mirrors parent tracks via subgrid */
        .qvp-card {
          grid-row: span 3;
          display: grid;
          grid-template-rows: subgrid;
          border-radius: 20px;
          overflow: hidden;
        }
        .quiz-card    { border: 2px solid #E5E7EB; background: #fff; }
        .present-card { border: 2px solid #0F1B3D; background: #0F1B3D; }
        /* Mobile: single column, revert to flex */
        @media (max-width: 768px) {
          .two-powers-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
            row-gap: 28px;
          }
          .qvp-card {
            grid-row: auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .qvp-card > div:first-child { padding-bottom: 0; }
        }
      `}</style>
    </section>
  )
}
