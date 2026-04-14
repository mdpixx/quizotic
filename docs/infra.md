# Infrastructure Notes

## Apex Domain Redirect

Apex domain: Cloudflare should proxy `quizotic.live` A record to the www origin; add a page rule that 308s `quizotic.live/*` → `https://www.quizotic.live/$1`. The Next.js `redirects()` is a belt-and-braces fallback for when traffic reaches the app server.
