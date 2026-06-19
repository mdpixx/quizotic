import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

// Every SEO landing layout is an entry point for organic (Google / ChatGPT)
// traffic. If one loses the StickyNav, visitors land on a page with no header,
// no Sign in, and no Sign up — they cannot reach the signup path and bounce.
// This silently happened once when a stale monorepo deploy-sync reverted the
// 06-18 fix (StickyNav was stripped from SolutionPageLayout), dropping signups
// to zero while traffic looked healthy. This test fails the build if any SEO
// landing layout ships without a signup path, so a revert can never go
// unnoticed again.
const SEO_LANDING_LAYOUTS = [
  'src/components/seo/SolutionPageLayout.tsx',
  'src/components/seo/ComparisonPageLayout.tsx',
  'src/components/seo/UseCasePageLayout.tsx',
  'src/components/seo/TemplatePageLayout.tsx',
  'src/components/seo/LearnArticleLayout.tsx',
]

// Hub/index pages render their own markup instead of a shared layout, so they
// need StickyNav wired up directly. They are indexed and linked from search,
// so a missing nav here is the same dead-end leak as on the detail pages.
const SEO_HUB_PAGES = [
  'src/app/learn/page.tsx',
  'src/app/for/page.tsx',
  'src/app/vs/page.tsx',
  'src/app/templates/page.tsx',
  'src/app/alternatives/page.tsx',
]

describe('SEO landing pages keep a signup path', () => {
  it.each(SEO_LANDING_LAYOUTS)('%s imports and renders StickyNav', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8')

    expect(source).toContain("import { StickyNav } from '@/components/landing/StickyNav'")
    expect(source).toContain('<StickyNav />')
  })

  it.each(SEO_HUB_PAGES)('%s imports and renders StickyNav', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8')

    expect(source).toContain("import { StickyNav } from '@/components/landing/StickyNav'")
    expect(source).toContain('<StickyNav />')
  })

  it('StickyNav exposes a first-time signup path', () => {
    const nav = readFileSync(join(ROOT, 'src/components/landing/StickyNav.tsx'), 'utf8')

    expect(nav).toContain('/auth/signin?intent=signup')
  })
})
