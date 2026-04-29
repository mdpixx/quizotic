import { MetadataRoute } from 'next'
import { ALTERNATIVE_SLUGS } from '@/content/alternatives'
import { VS_SLUGS } from '@/content/vs'
import { USE_CASE_SLUGS } from '@/content/for'
import { LEARN_SLUGS } from '@/content/learn'
import { TEMPLATE_SLUGS } from '@/content/templates'

const SITE = 'https://www.quizotic.live'

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

interface Entry {
  path: string
  changeFrequency: ChangeFreq
  priority: number
}

// Static routes that exist today.
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

// Extension point for Waves 2-5. Each wave returns a list of Entry; merge them
// into the sitemap below.
function solutionRoutes(): Entry[] {
  const slugs = [
    'live-quiz',
    'interactive-presentation',
    'ai-quiz-generator',
    'gamified-learning',
    'live-polling',
    'quiz-maker',
    'pdf-to-quiz',
    'ncert-quiz-generator',
  ]
  return slugs.map(slug => ({
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
  return LEARN_SLUGS.map(slug => ({
    path: `/learn/${slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.7,
  }))
}

function templateRoutes(): Entry[] {
  return TEMPLATE_SLUGS.map(slug => ({
    path: `/templates/${slug}`,
    changeFrequency: 'monthly' as ChangeFreq,
    priority: 0.7,
  }))
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
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
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}
