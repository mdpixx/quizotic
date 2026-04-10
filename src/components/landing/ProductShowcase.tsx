const SESSION_ROWS = [
  { date: 'Today', name: 'Physics Quiz #4', participants: 38, score: '78%' },
  { date: 'Apr 7', name: 'History Review', participants: 42, score: '65%' },
  { date: 'Apr 5', name: 'Bio Midterm Prep', participants: 35, score: '71%' },
  { date: 'Apr 3', name: 'Math Warm-up', participants: 29, score: '82%' },
]

const KPI = [
  { label: 'Total Sessions', value: '24', arrow: true },
  { label: 'Participants', value: '847' },
  { label: 'Avg Score', value: '72%' },
  { label: 'Completion', value: '91%' },
]

export function ProductShowcase() {
  return (
    <section id="dashboard" style={{ padding: '120px 24px', background: '#F8F9FA' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          Your classroom intelligence hub.
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 600, margin: '0 auto 56px', lineHeight: 1.6 }}>
          Every session generates actionable data. See where your learners excel, where they struggle, and what to teach next.
        </p>

        {/* Browser frame */}
        <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.1)', border: '2px solid #E2E8F0' }}>
          {/* Title bar */}
          <div style={{ background: '#1A1A2E', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>app.quizotic.live/dashboard</span>
          </div>

          {/* Dashboard content */}
          <div style={{ background: '#fff', padding: 32 }}>
            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }} className="kpi-grid">
              {KPI.map(k => (
                <div key={k.label} style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: '#888', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 32, color: '#0F1B3D' }}>
                    {k.value}
                    {k.arrow && <span style={{ fontSize: 16, color: '#16A34A', marginLeft: 4 }}>↑</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Body: table + radar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32 }} className="dash-body">
              {/* Session table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14 }}>
                  <thead style={{ background: '#F8F9FA' }}>
                    <tr>
                      {['Date', 'Session', 'Participants', 'Avg Score', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SESSION_ROWS.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                        <td style={{ padding: '12px', borderBottom: '1px solid #F1F1F1', whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #F1F1F1' }}>{r.name}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #F1F1F1', textAlign: 'center' }}>{r.participants}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #F1F1F1', textAlign: 'center' }}>{r.score}</td>
                        <td style={{ padding: '12px', borderBottom: '1px solid #F1F1F1', color: '#16A34A', fontWeight: 600, textAlign: 'center' }}>✓</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bloom's radar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg viewBox="0 0 260 210" width="260" style={{ maxWidth: '100%' }}>
                  {/* Outer hexagon */}
                  <polygon points="130,20 220,55 220,145 130,180 40,145 40,55" fill="none" stroke="#E2E8F0" strokeWidth="1"/>
                  {/* Mid hexagon */}
                  <polygon points="130,50 190,72 190,128 130,150 70,128 70,72" fill="none" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="3 3"/>
                  {/* Inner hexagon */}
                  <polygon points="130,80 160,91 160,109 130,120 100,109 100,91" fill="none" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="3 3"/>
                  {/* Axis lines */}
                  <line x1="130" y1="20" x2="130" y2="180" stroke="#E2E8F0" strokeWidth="0.5"/>
                  <line x1="40" y1="55" x2="220" y2="145" stroke="#E2E8F0" strokeWidth="0.5"/>
                  <line x1="40" y1="145" x2="220" y2="55" stroke="#E2E8F0" strokeWidth="0.5"/>
                  {/* Data polygon */}
                  <polygon points="130,28 210,62 195,138 130,165 55,130 52,60" fill="rgba(245,230,66,0.2)" stroke="#F5E642" strokeWidth="2"/>
                  {/* Recommended outline */}
                  <polygon points="130,40 195,65 195,135 130,160 65,135 65,65" fill="none" stroke="rgba(15,27,61,0.2)" strokeWidth="1" strokeDasharray="4 3"/>
                  {/* Axis labels */}
                  <text x="130" y="12" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#555" fontWeight="500">Remember</text>
                  <text x="230" y="55" textAnchor="start" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#555" fontWeight="500">Understand</text>
                  <text x="230" y="150" textAnchor="start" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#555" fontWeight="500">Apply</text>
                  <text x="130" y="196" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#555" fontWeight="500">Analyse</text>
                  <text x="28" y="150" textAnchor="end" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#555" fontWeight="500">Evaluate</text>
                  <text x="28" y="55" textAnchor="end" fontFamily="DM Sans, sans-serif" fontSize="11" fill="#555" fontWeight="500">Create</text>
                  {/* Data dots */}
                  {[[130,28],[210,62],[195,138],[130,165],[55,130],[52,60]].map(([cx,cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="4" fill="#F5E642" stroke="#0F1B3D" strokeWidth="1.5"/>
                  ))}
                </svg>
                <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8 }}>
                  Your Bloom&apos;s Coverage vs. Recommended
                </div>
              </div>
            </div>

            {/* At-risk strip */}
            <div style={{ marginTop: 24, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 20px', fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 14, color: '#991B1B' }}>
              ⚠ 3 participants scored below 60% in 2 consecutive sessions
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
