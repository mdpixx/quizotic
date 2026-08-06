import { MetadataRoute } from 'next'

// `/dev/` holds component preview harnesses (slide-preview, scheduled-preview).
// They render real components with static sample data and have no product
// value to a searcher — keep them out of the index.
const DISALLOW = ['/host/', '/api/', '/auth/', '/dev/']

const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
  'Bytespider',
  'Meta-ExternalAgent',
  'Applebot-Extended',
  'Amazonbot',
  'DuckAssistBot',
  'cohere-ai',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      ...AI_CRAWLERS.map(userAgent => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://www.quizotic.live/sitemap.xml',
    host: 'https://www.quizotic.live',
  }
}
