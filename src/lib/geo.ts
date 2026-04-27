// Best-effort geo + locale extraction from request headers. Order of
// preference: explicit country headers from the CDN, then fallback to
// nothing — we'd rather record null than guess. locale parses
// Accept-Language and returns the highest-priority tag.
//
// Country is only set on first sign-in. We don't update it later because a
// user travelling to Singapore for a week shouldn't appear to relocate.
//
// Header sources (in order):
//   - Cloudflare:   CF-IPCountry        (most accurate)
//   - Vercel:       x-vercel-ip-country
//   - Railway:      no native header — falls through to null
//   - Fastly:       fastly-geo-country
//
// Test fixtures live alongside the function in src/__tests__/geo.test.ts.

const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'fastly-geo-country',
  'x-country-code',
] as const

const ALPHA2_RE = /^[A-Z]{2}$/i

export function extractCountry(headers: Headers): string | null {
  for (const name of COUNTRY_HEADERS) {
    const v = headers.get(name)
    if (!v) continue
    const code = v.trim().toUpperCase()
    if (!ALPHA2_RE.test(code)) continue
    if (code === 'XX' || code === 'T1') continue // Cloudflare placeholders for unknown / Tor
    return code
  }
  return null
}

// Parse Accept-Language and return the highest-priority tag (BCP 47),
// e.g. "en-IN", "fr-FR", "hi". Filters anything unparseable. Returns null
// if no recognisable tag.
export function extractLocale(headers: Headers): string | null {
  const raw = headers.get('accept-language')
  if (!raw) return null
  const parts = raw
    .split(',')
    .map(seg => {
      const [tag, ...rest] = seg.split(';')
      const q = rest
        .map(p => p.trim())
        .find(p => p.startsWith('q='))
      const qVal = q ? Number(q.slice(2)) : 1
      return { tag: tag.trim(), q: Number.isFinite(qVal) ? qVal : 0 }
    })
    .filter(p => p.tag && p.tag !== '*')
    .sort((a, b) => b.q - a.q)
  if (parts.length === 0) return null
  // Reject anything that doesn't look like a BCP47 primary tag.
  const top = parts[0].tag
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(top)) return null
  return top
}

export function extractGeo(headers: Headers): { country: string | null; locale: string | null } {
  return {
    country: extractCountry(headers),
    locale: extractLocale(headers),
  }
}
