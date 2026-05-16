import { MetadataRoute } from 'next'
import { ALTERNATIVE_SLUGS } from '@/content/alternatives'
import { VS_SLUGS } from '@/content/vs'
import { USE_CASE_SLUGS } from '@/content/for'
import { LEARN_ARTICLES } from '@/content/learn'
import { TEMPLATES } from '@/content/templates'

const SITE = 'https://www.quizotic.live'

// Bump this date when static page copy changes.
const STATIC_LAST_MODIFIED = '2026-05-15'

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

interface Entry {
  path: string
  changeFrequency: ChangeFreq
  priority: number
  lastModified?: string
}

const STATIC_ROUTES: Entry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/learn', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/templates', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

const SOLUTION_SLUGS = [
  'live-quiz',
  'interactive-presentation',
  'ai-quiz-generator',
  'gamified-learning',
  'live-polling',
  'quiz-maker',
  'pdf-to-quiz',
  'ncert-quiz-generator',
]

function solutionRoutes(): Entry[] {
  return SOLUTION_SLUGS.map(slug => ({
    path: `/${slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.9,
  }))
}

function comparisonRoutes(): Entry[] {
  const alternatives = ALTERNATIVE_SLUGS.map(slug => ({
    path: `/alternatives/${slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.8,
  }))
  const vs = VS_SLUGS.map(slug => ({
    path: `/vs/${slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.8,
  }))
  return [...alternatives, ...vs]
}

function forSlugRoutes(): Entry[] {
  return USE_CASE_SLUGS.map(slug => ({
    path: `/for/${slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.8,
  }))
}

function learnRoutes(): Entry[] {
  return Object.values(LEARN_ARTICLES).map(article => ({
    path: `/learn/${article.slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.7,
    lastModified: article.updatedAt || article.publishedAt,
  }))
}

function templateRoutes(): Entry[] {
  return Object.values(TEMPLATES).map(template => ({
    path: `/templates/${template.slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.7,
    lastModified: template.publishedAt,
  }))
}

export default function sitemap(): MetadataRoute.Sitemap {
  const all = [
    ...STATIC_ROUTES,
    ...solutionRoutes(),
    ...comparisonRoutes(),
    ...forSlugRoutes(),
    ...learnRoutes(),
    ...templateRoutes(),
  ]
  return all.map(entry => ({
    url: `${SITE}${entry.path}`,
    lastModified: entry.lastModified ?? STATIC_LAST_MODIFIED,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}
