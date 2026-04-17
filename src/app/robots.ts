import { MetadataRoute } from 'next'

const DISALLOW = ['/host/', '/api/', '/auth/']

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
