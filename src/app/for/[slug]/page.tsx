import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { UseCasePageLayout } from '@/components/seo/UseCasePageLayout'
import { USE_CASES, USE_CASE_SLUGS } from '@/content/for'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return USE_CASE_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const content = USE_CASES[slug]
  if (!content) return {}
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: `/for/${slug}` },
    keywords: content.keywords,
  }
}

export default async function UseCasePage({ params }: PageProps) {
  const { slug } = await params
  const content = USE_CASES[slug]
  if (!content) notFound()

  return (
    <UseCasePageLayout
      slug={slug}
      persona={content.persona}
      h1={content.h1}
      tagline={content.tagline}
      intro={content.intro}
      scenarios={content.scenarios}
      keyFeatures={content.keyFeatures}
      faqs={content.faqs}
      related={content.related}
    />
  )
}
