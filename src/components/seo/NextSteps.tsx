import Link from 'next/link'

interface NextStep {
  label: string
  title: string
  description: string
  href: string
}

interface NextStepsProps {
  steps: [NextStep, NextStep, NextStep]
}

export function NextSteps({ steps }: NextStepsProps) {
  return (
    <section className="mb-14">
      <h2 className="text-xl font-bold mb-5" style={{ color: '#0F1B3D' }}>
        What&apos;s next
      </h2>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {steps.map(step => (
          <Link
            key={step.href}
            href={step.href}
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              padding: '20px',
              textDecoration: 'none',
              display: 'block',
            }}
          >
            <p
              className="text-xs uppercase tracking-wider font-bold mb-2"
              style={{ color: '#6B7280' }}
            >
              {step.label}
            </p>
            <h3 className="font-bold text-sm mb-1" style={{ color: '#0F1B3D' }}>
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
              {step.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
