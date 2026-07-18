// Shared video-URL → embed-URL resolver for the presentation `video` slide.
//
// Extracted from the host stage renderer (formerly inlined in
// `src/app/host/present/session/page.tsx`) so both the host projector and the
// participant phone mirror the same embed. Supports YouTube (watch / youtu.be /
// Shorts), Vimeo, and falls back to a best-effort `embed/` swap for other
// providers. On any parse failure the original URL is returned unchanged so
// direct embed links still work.

export function getVideoEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    const ytId = u.searchParams.get('v')
      || (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null)
      || (u.pathname.includes('/shorts/') ? u.pathname.split('/shorts/')[1] : null)
    if (ytId) return `https://www.youtube.com/embed/${ytId.split('?')[0]}`
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video${u.pathname}`
    return url.replace('watch?v=', 'embed/')
  } catch {
    return url
  }
}
