// Extract clean domain from a school website URL or generate a slug fallback.

export function cleanDomain(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const u = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    if (host.startsWith('m.')) host = host.slice(2);
    // Reject obvious non-school domains; we'll fall back to skip-and-flag.
    const blocklist = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com',
      'youtube.com', 'linkedin.com', 'wa.me', 'whatsapp.com', 'sites.google.com',
      'wixsite.com', 'wordpress.com', 'blogspot.com', 'justdial.com', 'sulekha.com',
      'indiamart.com', 'tradeindia.com', 'maps.google.com', 'goo.gl'];
    if (blocklist.some((b) => host.endsWith(b))) return null;
    return host;
  } catch {
    return null;
  }
}

// Pattern-generate emails. principal@ is highest priority for K-12 outreach.
export function patternEmails(domain) {
  if (!domain) return [];
  return [
    `principal@${domain}`,
    `info@${domain}`,
    `office@${domain}`,
    `contact@${domain}`,
    `admin@${domain}`
  ];
}

// Slugify school name as a last-resort identifier (no email use).
export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
