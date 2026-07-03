import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { QuizoticLogo, QuizoticMark } from '@/components/QuizoticLogo'

const ROOT = process.cwd()

describe('Quizotic brand identity', () => {
  it('renders a font-independent geometric mark with accessible defaults', () => {
    const markup = renderToStaticMarkup(createElement(QuizoticMark, { size: 32 }))

    expect(markup).toContain('aria-label="Quizotic"')
    expect(markup).toContain('viewBox="0 0 64 64"')
    expect(markup).toContain('fill="#FBD13B"')
    expect(markup).toContain('fill="#0F1B3D"')
    expect(markup).toContain('transform="rotate(45 32 32)"')
    expect(markup).not.toContain('<text')
  })

  it('renders a clean wordmark without the domain suffix', () => {
    const markup = renderToStaticMarkup(
      createElement(QuizoticLogo, { variant: 'onDark', markSize: 32 }),
    )

    expect(markup).toContain('Quizotic')
    expect(markup).not.toContain('.live')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('keeps every generated icon in sync with the master asset', () => {
    expect(() =>
      execFileSync('node', ['scripts/generate-brand-assets.mjs', '--check'], {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    ).not.toThrow()

    const iconSvg = readFileSync(join(ROOT, 'src/app/icon.svg'), 'utf8')
    expect(iconSvg).not.toContain('<text')
    expect(iconSvg).toContain('viewBox="0 0 64 64"')
  })

  it('uses the shared identity across core product and marketing surfaces', () => {
    const sharedLogoFiles = [
      'src/components/HostNav.tsx',
      'src/components/host/HostSidebar.tsx',
      'src/app/host/(dashboard)/layout.tsx',
      'src/components/landing/StickyNav.tsx',
      'src/components/landing/Footer.tsx',
      'src/app/auth/onboard/page.tsx',
      'src/app/auth/signin/SignInForm.tsx',
      'src/app/not-found.tsx',
      'src/components/landing/ProductShowcase.tsx',
    ]

    for (const path of sharedLogoFiles) {
      const source = readFileSync(join(ROOT, path), 'utf8')
      expect(source, path).toContain('QuizoticLogo')
      expect(source, path).not.toContain('animate-pulse" style={{ color: \'#22C55E\'')
      expect(source, path).not.toContain('linear-gradient(135deg, #4338CA, #7C3AED)')
    }

    const brand = readFileSync(join(ROOT, 'src/content/brand.ts'), 'utf8')
    expect(brand).toContain(
      "logo: 'https://www.quizotic.live/icons/icon-512.png'",
    )

    const hostSession = readFileSync(
      join(ROOT, 'src/app/host/session/page.tsx'),
      'utf8',
    )
    expect(hostSession).not.toContain('showDomain')

    const joinPage = readFileSync(join(ROOT, 'src/app/join/page.tsx'), 'utf8')
    expect(joinPage).toContain('QuizoticLogo')
    expect(joinPage).not.toContain(
      "<span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>.live</span>",
    )

    const openGraph = readFileSync(
      join(ROOT, 'src/app/opengraph-image.tsx'),
      'utf8',
    )
    expect(openGraph).toContain('QuizoticMark')
    expect(openGraph).not.toContain('fontSize: 40')

    const authEmail = readFileSync(join(ROOT, 'src/lib/auth.ts'), 'utf8')
    // Welcome + OTP emails use a wordmark-only header (no Q icon, which read
    // as "Q Quizotic"). icon-192 must not appear in any auth email.
    expect(authEmail).not.toContain(
      'https://www.quizotic.live/icons/icon-192.png',
    )
    expect(authEmail).not.toContain('>Q</td>')
  })
})
