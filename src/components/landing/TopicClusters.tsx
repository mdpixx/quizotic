import Link from 'next/link'

interface ClusterLink {
  label: string
  href: string
}

interface Cluster {
  title: string
  links: ClusterLink[]
}

const CLUSTERS: Cluster[] = [
  {
    title: 'India Education Guides',
    links: [
      { label: 'Best quiz app for JEE/NEET coaching — India', href: '/learn/best-quiz-app-jee-neet-coaching-institutes' },
      { label: 'Mentimeter vs Slido vs Quizotic — India 2026', href: '/learn/mentimeter-vs-slido-vs-quizotic' },
      { label: '5 Slido alternatives for India (INR & UPI)', href: '/learn/slido-alternatives-india-2026' },
      { label: 'Audience polling tools for India — compared', href: '/learn/audience-polling-tool-comparison' },
      { label: 'Quizotic vs Slido — India feature comparison', href: '/vs/slido' },
      { label: 'NCERT Quiz Generator — CBSE Classes 6–12', href: '/ncert-quiz-generator' },
    ],
  },
  {
    title: 'For CBSE, NCERT & Coaching Institutes',
    links: [
      { label: 'Who uses Quizotic?', href: '/for' },
      { label: 'NCERT Quiz Generator', href: '/ncert-quiz-generator' },
      { label: 'For Teachers (CBSE & State Boards)', href: '/for/teachers' },
      { label: 'For Schools', href: '/for/schools' },
      { label: 'For JEE/NEET Coaching Institutes', href: '/for/coaching-institutes' },
      { label: 'CBSE Class 10 Quiz Questions', href: '/learn/cbse-class-10-free-quiz-questions' },
    ],
  },
  {
    title: 'Kahoot, Quizizz & Slido Alternatives',
    links: [
      { label: 'All comparisons & alternatives', href: '/vs' },
      { label: 'Kahoot alternative for India', href: '/alternatives/kahoot' },
      { label: 'Quizotic vs Slido — India', href: '/vs/slido' },
      { label: 'Quizotic vs Kahoot', href: '/vs/kahoot' },
      { label: 'Quizotic vs Quizizz', href: '/vs/quizizz' },
      { label: 'Slido Alternatives India 2026', href: '/learn/slido-alternatives-india-2026' },
    ],
  },
  {
    title: 'AI Quiz Tools',
    links: [
      { label: 'AI Quiz Generator', href: '/ai-quiz-generator' },
      { label: 'PDF to Quiz', href: '/pdf-to-quiz' },
      { label: 'NCERT Quiz Generator', href: '/ncert-quiz-generator' },
      { label: 'Online Quiz Maker', href: '/quiz-maker' },
    ],
  },
  {
    title: 'Corporate Training',
    links: [
      { label: 'For Corporate Trainers', href: '/for/corporate-trainers' },
      { label: 'Corporate Training Quizzes', href: '/learn/compliance-training-quiz-tool-india' },
      { label: 'Interactive Presentations', href: '/interactive-presentation' },
      { label: 'Mentimeter vs Slido vs Quizotic', href: '/learn/mentimeter-vs-slido-vs-quizotic' },
      { label: 'Templates Gallery', href: '/templates#audience-corporate-trainers' },
    ],
  },
  {
    title: 'Browse Templates',
    links: [
      { label: 'CBSE / NCERT Templates', href: '/templates#audience-school-teachers' },
      { label: 'Coaching Institute Templates', href: '/templates#audience-coaching-institutes' },
      { label: 'Corporate Templates', href: '/templates#audience-corporate-trainers' },
      { label: 'College Templates', href: '/templates#audience-colleges' },
      { label: 'All Templates', href: '/templates' },
    ],
  },
]

export function TopicClusters() {
  return (
    <section style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: 'clamp(40px, 8vw, 64px) 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 24,
            fontWeight: 800,
            color: '#0F1B3D',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Explore Quizotic
        </h2>
        <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 40 }}>
          India-first guides, CBSE/NCERT/JEE/NEET resources, tool comparisons, and ready-made templates.
        </p>
        {/* Mobile: collapsed accordion to save scroll. Desktop: always-open grid
            (summary hidden, grid forced visible via .tc-* rules in globals.css).
            Native <details> — no JS, and every link stays in the DOM for SEO. */}
        <details className="tc-details">
          <summary className="tc-summary">Browse all topics &amp; guides</summary>
          <div
            className="tc-grid"
            style={{
              display: 'grid',
              gap: 24,
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              marginTop: 24,
            }}
          >
            {CLUSTERS.map(cluster => (
              <div
                key={cluster.title}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  padding: '20px 24px',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-space-grotesk)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#0F1B3D',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 12,
                  }}
                >
                  {cluster.title}
                </h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cluster.links.map(link => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        style={{
                          fontSize: 14,
                          color: '#2563EB',
                          textDecoration: 'none',
                          lineHeight: 1.4,
                        }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  )
}
