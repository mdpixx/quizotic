import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TemplatePageLayout } from '@/components/seo/TemplatePageLayout'
import { TEMPLATES, TEMPLATE_SLUGS } from '@/content/templates'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return TEMPLATE_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const template = TEMPLATES[slug]
  if (!template) return {}
  return {
    title: template.metaTitle,
    description: template.metaDescription,
    keywords: template.tags,
    alternates: { canonical: `/templates/${slug}` },
    openGraph: {
      title: template.metaTitle,
      description: template.metaDescription,
      url: `/templates/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: template.metaTitle,
      description: template.metaDescription,
    },
  }
}

export default async function TemplatePage({ params }: PageProps) {
  const { slug } = await params
  const template = TEMPLATES[slug]
  if (!template) notFound()
  return <TemplatePageLayout template={template} />
}
