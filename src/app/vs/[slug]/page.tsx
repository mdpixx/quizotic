import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ComparisonPageLayout } from '@/components/seo/ComparisonPageLayout'
import { VS, VS_SLUGS } from '@/content/vs'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return VS_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const content = VS[slug]
  if (!content) return {}
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: `/vs/${slug}` },
    keywords: content.keywords,
  }
}

export default async function VsPage({ params }: PageProps) {
  const { slug } = await params
  const content = VS[slug]
  if (!content) notFound()

  return (
    <ComparisonPageLayout
      kind="vs"
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
