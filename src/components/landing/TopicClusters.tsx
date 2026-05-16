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
    title: 'AI Quiz Tools',
    links: [
      { label: 'AI Quiz Generator', href: '/ai-quiz-generator' },
      { label: 'Online Quiz Maker', href: '/quiz-maker' },
      { label: 'PDF to Quiz', href: '/pdf-to-quiz' },
      { label: 'NCERT Quiz Generator', href: '/ncert-quiz-generator' },
    ],
  },
  {
    title: 'For Indian Classrooms',
    links: [
      { label: 'NCERT Quiz Generator', href: '/ncert-quiz-generator' },
      { label: 'For Teachers', href: '/for/teachers' },
      { label: 'For Schools', href: '/for/schools' },
      { label: 'For Coaching Institutes', href: '/for/coaching-institutes' },
      { label: 'CBSE Quiz Questions', href: '/learn/cbse-class-10-free-quiz-questions' },
    ],
  },
  {
    title: 'Kahoot, Quizizz & Slido Alternatives',
    links: [
      { label: 'Quizotic vs Kahoot', href: '/vs/kahoot' },
      { label: 'Quizotic vs Quizizz', href: '/vs/quizizz' },
      { label: 'Quizotic vs Slido', href: '/vs/slido' },
      { label: 'Kahoot Alternatives', href: '/alternatives/kahoot' },
      { label: 'Slido Alternatives India 2026', href: '/learn/slido-alternatives-india-2026' },
    ],
  },
  {
    title: 'Live Polling & Presentations',
    links: [
      { label: 'Live Quiz', href: '/live-quiz' },
      { label: 'Interactive Presentation', href: '/interactive-presentation' },
      { label: 'Live Polling', href: '/live-polling' },
      { label: 'Gamified Learning', href: '/gamified-learning' },
    ],
  },
  {
    title: 'Corporate Training',
    links: [
      { label: 'For Corporate Trainers', href: '/for/corporate-trainers' },
      { label: 'Corporate Training Quizzes', href: '/learn/compliance-training-quiz-tool-india' },
      { label: 'Interactive Presentations', href: '/interactive-presentation' },
      { label: 'Templates Gallery', href: '/templates#audience-corporate-trainers' },
    ],
  },
  {
    title: 'Browse Templates',
    links: [
      { label: 'School Teacher Templates', href: '/templates#audience-school-teachers' },
      { label: 'Coaching Institute Templates', href: '/templates#audience-coaching-institutes' },
      { label: 'Corporate Templates', href: '/templates#audience-corporate-trainers' },
      { label: 'College Templates', href: '/templates#audience-colleges' },
      { label: 'All Templates', href: '/templates' },
    ],
  },
]

export function TopicClusters() {
  return (
    <section style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '64px 24px' }}>
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
          Guides, comparisons, and ready-made templates for every use case.
        </p>
        <div
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
      </div>
    </section>
  )
}
