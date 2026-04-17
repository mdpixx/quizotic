import { MetadataRoute } from 'next'

const SITE = 'https://www.quizotic.live'

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

interface Entry {
  path: string
  changeFrequency: ChangeFreq
  priority: number
}

// Static routes that exist today. Waves 2-5 will extend this via the helpers
// below (solution pages, /for/*, /alternatives/*, /vs/*, /learn/*, /templates/*).
const STATIC_ROUTES: Entry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

// Extension point for Waves 2-5. Each wave returns a list of Entry; merge them
// into the sitemap below.
function solutionRoutes(): Entry[] {
  return []
}

function comparisonRoutes(): Entry[] {
  return []
}

function useCaseRoutes(): Entry[] {
  return []
}

function learnRoutes(): Entry[] {
  return []
}

function templateRoutes(): Entry[] {
  return []
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const all = [
    ...STATIC_ROUTES,
    ...solutionRoutes(),
    ...comparisonRoutes(),
    ...useCaseRoutes(),
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
