import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ComparisonPageLayout } from '@/components/seo/ComparisonPageLayout'
import { ALTERNATIVES, ALTERNATIVE_SLUGS } from '@/content/alternatives'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return ALTERNATIVE_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const content = ALTERNATIVES[slug]
  if (!content) return {}
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: `/alternatives/${slug}` },
    keywords: content.keywords,
  }
}

export default async function AlternativePage({ params }: PageProps) {
  const { slug } = await params
  const content = ALTERNATIVES[slug]
  if (!content) notFound()

  return (
    <ComparisonPageLayout
      kind="alternatives"
      slug={slug}
      competitor={content.competitor}
      h1={content.h1}
      tagline={content.tagline}
      intro={content.intro}
      rows={content.rows}
      honestNote={content.honestNote}
      faqs={content.faqs}
      related={content.related}
    />
  )
}
