import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LearnArticleLayout } from '@/components/seo/LearnArticleLayout'
import { LEARN_ARTICLES, LEARN_SLUGS } from '@/content/learn'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return LEARN_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = LEARN_ARTICLES[slug]
  if (!article) return {}
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    keywords: article.keywords,
    alternates: { canonical: `/learn/${slug}` },
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      url: `/learn/${slug}`,
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDescription,
    },
  }
}

export default async function LearnArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = LEARN_ARTICLES[slug]
  if (!article) notFound()
  return <LearnArticleLayout article={article} />
}
