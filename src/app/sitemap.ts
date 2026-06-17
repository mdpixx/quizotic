import { MetadataRoute } from 'next'
import { ALTERNATIVE_SLUGS } from '@/content/alternatives'
import { VS_SLUGS } from '@/content/vs'
import { USE_CASE_SLUGS } from '@/content/for'
import { LEARN_ARTICLES } from '@/content/learn'
import { TEMPLATES } from '@/content/templates'

const SITE = 'https://www.quizotic.live'

// Bump this date when static page copy changes.
const STATIC_LAST_MODIFIED = '2026-05-15'

// India-education pages that get priority boosts (exact path match).
const INDIA_EDU_PRIORITY_BOOST: Record<string, number> = {
  '/ncert-quiz-generator': 1.0,
  '/for/coaching-institutes': 0.9,
  '/for/teachers': 0.9,
  '/learn/best-quiz-app-jee-neet-coaching-institutes': 0.9,
  '/learn/mentimeter-vs-slido-vs-quizotic': 0.9,
  '/learn/slido-alternatives-india-2026': 0.9,
  '/learn/audience-polling-tool-comparison': 0.9,
  '/vs/slido': 0.9,
  '/learn/how-to-run-a-live-quiz-cbse-classroom': 0.9,
  '/learn/cbse-class-10-free-quiz-questions': 0.9,
}

// Global head-term pages with low domain authority — pull crawl budget back.
const GLOBAL_HEAD_TERM_DEPRIORITISE: Record<string, number> = {
  '/quiz-maker': 0.6,
  '/live-polling': 0.6,
  '/alternatives/slido': 0.7,
  '/alternatives/kahoot': 0.6,
  '/alternatives/mentimeter': 0.6,
  '/alternatives/quizizz': 0.6,
  '/alternatives/ahaslides': 0.6,
  '/alternatives/poll-everywhere': 0.6,
}

function resolvedPriority(path: string, defaultPriority: number): number {
  if (INDIA_EDU_PRIORITY_BOOST[path] !== undefined) return INDIA_EDU_PRIORITY_BOOST[path]
  if (GLOBAL_HEAD_TERM_DEPRIORITISE[path] !== undefined) return GLOBAL_HEAD_TERM_DEPRIORITISE[path]
  return defaultPriority
}

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
  { path: '/vs', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/for', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/alternatives', changeFrequency: 'monthly', priority: 0.8 },
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
    priority: resolvedPriority(entry.path, entry.priority),
  }))
}
