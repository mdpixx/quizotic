import { QuizoticLogo } from '@/components/QuizoticLogo'

const KPI_DATA = [
  { icon: '📋', value: '24', label: 'Total Sessions', sub: '↑ 4 this month', up: true },
  { icon: '👥', value: '847', label: 'Total Participants', sub: '↑ 12% vs last month', up: true },
  { icon: '🎯', value: '72%', label: 'Avg Class Score', sub: '↑ 6 pts vs prev', up: true },
  { icon: '⏱', value: '89%', label: 'Completion Rate', sub: '↓ 2% this week', up: false },
]

const SESSION_ROWS = [
  { name: 'Human Trafficking Awareness', type: 'Quiz', date: 'Apr 3, 2026', participants: 48, score: '78%', scorePct: 78, completion: '94%', status: 'Completed', statusColor: '#16A34A' },
  { name: 'Fire Safety Module 2025', type: 'Quiz', date: 'Mar 28, 2026', participants: 62, score: '61%', scorePct: 61, completion: '88%', status: 'Review', statusColor: '#EA580C' },
  { name: 'Digital Tools Onboarding', type: 'Presentation', date: 'Mar 22, 2026', participants: 34, score: 'N/A', scorePct: 0, completion: '100%', status: 'Completed', statusColor: '#16A34A' },
]

const TOP_PARTICIPANTS = [
  { initials: 'RA', color: '#DC2626', name: 'Ravi Anand', meta: '8 sessions · 3 quizzes', score: '91%', trend: '↑ +6%', trendColor: '#16A34A' },
  { initials: 'PM', color: '#2563EB', name: 'Priya Mehta', meta: '6 sessions · 4 quizzes', score: '87%', trend: '↑ +4%', trendColor: '#16A34A' },
  { initials: 'SK', color: '#0D9488', name: 'Suresh Kumar', meta: '7 sessions · 5 quizzes', score: '79%', trend: '↔ stable', trendColor: '#888' },
]

// Line chart: viewBox 0 0 460 115 — y range: 40% (bottom) to 100% (top)
// y = 105 - (value - 40) * 105/60
const yVal = (v: number) => 105 - (v - 40) * 105 / 60
const QUIZ_PTS = [63,67,73,75,78,73,62,76,81,78].map((v,i) => [30 + i*47, yVal(v)])
const PRES_PTS = [55,58,63,65,68,78,60,65,70,73].map((v,i) => [30 + i*47, yVal(v)])
const quizPath = `M${QUIZ_PTS.map(([x,y]) => `${x},${y.toFixed(1)}`).join(' L')}`
const presPath  = `M${PRES_PTS.map(([x,y]) => `${x},${y.toFixed(1)}`).join(' L')}`
const TARGET_Y  = yVal(73)

const NAV_MAIN  = ['Analytics','Sessions','Participants','Reports']
const NAV_CONTENT = ['My Quizzes','Presentations']

function SidebarIcon({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

export function ProductShowcase() {
  return (
    <section id="dashboard" style={{ padding: 'clamp(56px, 11vw, 120px) 24px', background: '#F8F9FA' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 'clamp(28px, 3.5vw, 48px)', color: '#0F1B3D', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 16 }}>
          Your classroom intelligence hub.
        </h2>
        <p style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 18, color: '#555', textAlign: 'center', maxWidth: 600, margin: '0 auto clamp(28px, 7vw, 56px)', lineHeight: 1.6 }}>
          Every session generates actionable data. See where your learners excel, where they struggle, and what to teach next.
        </p>

        {/* Browser frame */}
        <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.12)', border: '2px solid #E2E8F0' }}>
          {/* Title bar */}
          <div style={{ background: '#1A1A2E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>quizotic.live/dashboard</span>
          </div>

          {/* Dashboard layout */}
          <div style={{ display: 'flex', background: '#F1F5F9', minHeight: 560 }}>

            {/* ── Sidebar ── */}
            <aside className="dash-sidebar" style={{ width: 188, background: '#0F1B3D', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
              {/* Logo */}
              <div style={{ padding: '0 14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <QuizoticLogo variant="onDark" className="text-sm" markSize={28} />
              </div>

              {/* MAIN */}
              <div style={{ padding: '0 14px 6px', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-body, "DM Sans", sans-serif)' }}>MAIN</div>
              {NAV_MAIN.map((item, i) => (
                <div key={item} style={{ padding: '8px 14px', margin: '1px 8px', borderRadius: 7, background: i === 0 ? '#4338CA' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}>
                  <span style={{ color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                    {i === 0 ? '▣' : i === 1 ? '◫' : i === 2 ? '◉' : '◈'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '#fff' : 'rgba(255,255,255,0.55)' }}>{item}</span>
                </div>
              ))}

              {/* CONTENT */}
              <div style={{ padding: '12px 14px 6px', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-body, "DM Sans", sans-serif)' }}>CONTENT</div>
              {NAV_CONTENT.map(item => (
                <div key={item} style={{ padding: '8px 14px', margin: '1px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{item === 'My Quizzes' ? '⊟' : '▤'}</span>
                  <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{item}</span>
                </div>
              ))}

              {/* Settings */}
              <div style={{ padding: '8px 14px', margin: '8px 8px 0', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>⚙</span>
                <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Settings</span>
              </div>

              {/* User */}
              <div style={{ marginTop: 'auto', padding: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0 }}>MH</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>Mahesh H.</div>
                  <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>L&amp;D Manager</div>
                </div>
              </div>
            </aside>

            {/* ── Main content ── */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ background: '#fff', padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 18, color: '#0F1B3D' }}>Analytics Dashboard</div>
                  <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 11, color: '#888' }}>Track performance across all your sessions and participants</div>
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, padding: '5px 9px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', color: '#555', fontFamily: 'var(--font-body, "DM Sans", sans-serif)', whiteSpace: 'nowrap' }}>All Quizzes &amp; Sessions ▾</div>
                  <div style={{ fontSize: 11, padding: '5px 9px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', color: '#555', fontFamily: 'var(--font-body, "DM Sans", sans-serif)' }}>Last 30 days ▾</div>
                  <div style={{ fontSize: 11, padding: '6px 12px', borderRadius: 6, background: '#4338CA', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-body, "DM Sans", sans-serif)', whiteSpace: 'nowrap' }}>+ New Session</div>
                </div>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto' }}>

                {/* KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="kpi-grid">
                  {KPI_DATA.map(k => (
                    <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{k.icon}</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 22, color: '#0F1B3D', lineHeight: 1.1 }}>{k.value}</div>
                        <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 11, color: '#888', marginBottom: 3 }}>{k.label}</div>
                        <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, fontWeight: 600, color: k.up ? '#16A34A' : '#DC2626' }}>{k.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 2: line chart + confidence grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12 }} className="dash-row2">
                  {/* Class Performance Trend */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#0F1B3D' }}>Class Performance Trend</div>
                        <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#888' }}>Avg score per session over last 10 sessions</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, padding: '3px 8px', borderRadius: 12, background: '#EEF2FF', color: '#4338CA', fontWeight: 600 }}>Quiz</span>
                        <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, padding: '3px 8px', borderRadius: 12, background: '#FFF7ED', color: '#EA580C', fontWeight: 600 }}>Presentation</span>
                        <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, padding: '3px 8px', borderRadius: 12, border: '1px solid #E5E7EB', color: '#555' }}>Last 10 ▾</span>
                      </div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      {[['#4338CA','Quiz Avg Score'],['#EA580C','Presentation Engagement'],['#FBD13B','Class Target']].map(([c,l]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 14, height: 2, background: c, borderRadius: 1, ...(l === 'Class Target' ? { borderTop: '2px dashed #CA8A04', background: 'transparent', height: 0 } : {}) }} />
                          <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, color: '#888' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    {/* SVG chart */}
                    <svg viewBox="0 0 460 115" width="100%" style={{ overflow: 'visible' }}>
                      {/* Grid lines */}
                      {[40,60,80,100].map(v => {
                        const y = yVal(v)
                        return (
                          <g key={v}>
                            <line x1="30" y1={y} x2="450" y2={y} stroke="#F1F5F9" strokeWidth="1"/>
                            <text x="22" y={y + 3} fontSize="8" fill="#aaa" textAnchor="end" fontFamily="DM Sans, sans-serif">{v}%</text>
                          </g>
                        )
                      })}
                      {/* X-axis labels */}
                      {[[30,'Mar 1'],[124,'Mar 10'],[218,'Mar 18'],[312,'Mar 28'],[406,'Apr 6'],[450,'Apr 10']].map(([x,l]) => (
                        <text key={l} x={x} y="113" fontSize="8" fill="#aaa" textAnchor="middle" fontFamily="DM Sans, sans-serif">{l}</text>
                      ))}
                      {/* Class target dashed */}
                      <line x1="30" y1={TARGET_Y} x2="450" y2={TARGET_Y} stroke="#CA8A04" strokeWidth="1.2" strokeDasharray="5 3"/>
                      {/* Presentation line */}
                      <path d={presPath} stroke="#EA580C" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
                      {/* Quiz line */}
                      <path d={quizPath} stroke="#4338CA" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      {/* Quiz dots */}
                      {QUIZ_PTS.map(([x,y],i) => (
                        <circle key={i} cx={x} cy={y} r="3" fill="#4338CA" stroke="#fff" strokeWidth="1.5"/>
                      ))}
                    </svg>
                    {/* X-axis date labels */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    </div>
                  </div>

                  {/* Confidence vs Accuracy */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#0F1B3D' }}>Confidence vs Accuracy</div>
                      <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, padding: '2px 8px', borderRadius: 12, background: '#EEF2FF', color: '#4338CA', fontWeight: 600 }}>This month</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, color: '#888', marginBottom: 8 }}>Aggregated across all sessions</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
                      {[
                        { v: '412', label: 'Sure · Correct', sub: 'Solid knowledge ✓', bg: '#F0FDF4', color: '#16A34A', border: '#86EFAC' },
                        { v: '89', label: 'Sure · Wrong', sub: '△ Misconceptions', bg: '#FFFBEB', color: '#CA8A04', border: '#FCD34D' },
                        { v: '156', label: 'Unsure · Correct', sub: 'Lucky / emerging', bg: '#F0FDFA', color: '#0D9488', border: '#5EEAD4' },
                        { v: '190', label: 'Unsure · Wrong', sub: 'Gap — ready to learn', bg: '#F5F3FF', color: '#7C3AED', border: '#C4B5FD' },
                      ].map(c => (
                        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '10px 10px' }}>
                          <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 800, fontSize: 20, color: c.color, lineHeight: 1 }}>{c.v}</div>
                          <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: c.color, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                          <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 9, color: '#888', marginTop: 2 }}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, padding: '7px 10px', fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#92400E', lineHeight: 1.4 }}>
                      <strong>⚠ 89 responses show confident misconceptions</strong><br/>Top topic: Fire Exit Procedures (Q3)
                    </div>
                  </div>
                </div>

                {/* Row 3: Session History + Top Participants */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12 }} className="dash-row3">
                  {/* Session History */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#0F1B3D' }}>Session History</div>
                        <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#888' }}>All your recent quizzes and presentations</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#4338CA', fontWeight: 600 }}>View all →</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body, "DM Sans", sans-serif)' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          {['SESSION NAME','DATE','PARTICIPANTS','AVG SCORE','COMPLETION','STATUS'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, color: '#888', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SESSION_ROWS.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px', fontSize: 11 }}>
                              <div style={{ fontWeight: 600, color: '#0F1B3D', marginBottom: 2 }}>{r.name}</div>
                              <span style={{ fontSize: 9, fontWeight: 600, color: r.type === 'Quiz' ? '#4338CA' : '#EA580C', background: r.type === 'Quiz' ? '#EEF2FF' : '#FFF7ED', padding: '1px 6px', borderRadius: 8 }}>{r.type}</span>
                            </td>
                            <td style={{ padding: '8px', fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>{r.date}</td>
                            <td style={{ padding: '8px', fontSize: 11, color: '#555', textAlign: 'center' }}>{r.participants}</td>
                            <td style={{ padding: '8px', fontSize: 11, textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ flex: 1, height: 4, background: '#F1F5F9', borderRadius: 2 }}>
                                  <div style={{ height: '100%', width: `${r.scorePct}%`, background: r.scorePct >= 70 ? '#16A34A' : '#EA580C', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: r.scorePct >= 70 ? '#16A34A' : '#EA580C', minWidth: 24 }}>{r.score}</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px', fontSize: 11, color: '#555', textAlign: 'center' }}>{r.completion}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: r.statusColor, background: r.statusColor + '15', padding: '2px 8px', borderRadius: 10, border: `1px solid ${r.statusColor}40` }}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Top Participants */}
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 13, color: '#0F1B3D' }}>Top Participants</div>
                      <span style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, padding: '2px 8px', border: '1px solid #E5E7EB', borderRadius: 6, color: '#555' }}>By Score ▾</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#888', marginBottom: 12 }}>Tracked across all sessions by name</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {TOP_PARTICIPANTS.map(p => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0 }}>{p.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 12, fontWeight: 600, color: '#0F1B3D' }}>{p.name}</div>
                            <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#888' }}>{p.meta}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)', fontWeight: 700, fontSize: 14, color: '#0F1B3D' }}>{p.score}</div>
                            <div style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, fontWeight: 600, color: p.trendColor }}>{p.trend}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 7, padding: '7px 10px', fontFamily: 'var(--font-body, "DM Sans", sans-serif)', fontSize: 10, color: '#92400E' }}>
                      ⚠ 3 participants scored below 60% twice in a row
                    </div>
                  </div>
                </div>

              </div>
            </main>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-row2, .dash-row3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .dash-sidebar { display: none !important; }
          .dash-row2 { display: none !important; }
          .dash-row3 { display: none !important; }
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
        }
      `}</style>
    </section>
  )
}
