// Firecrawl client for scraping school websites + extracting emails.
// Reads FIRECRAWL_API_KEY from secrets/env/firecrawl.env (no env-var dance).

import fs from 'node:fs';
import path from 'node:path';

const FIRECRAWL_ENV = '/Users/mahesh/Claude/claude-zector/secrets/env/firecrawl.env';
const API_BASE = 'https://api.firecrawl.dev/v1';

function loadKey() {
  const raw = fs.readFileSync(FIRECRAWL_ENV, 'utf8');
  const m = raw.match(/^FIRECRAWL_API_KEY="?([^"\n]+)"?/m);
  if (!m) throw new Error('FIRECRAWL_API_KEY not found in firecrawl.env');
  return m[1].trim();
}

const KEY = loadKey();

// Scrape a single URL and return its markdown body.
// On failure returns { ok: false, error, status }
export async function scrape(url, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: false,
        timeout: 25000
      }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: txt.slice(0, 200) };
    }
    const json = await res.json();
    return {
      ok: true,
      markdown: json?.data?.markdown || '',
      metadata: json?.data?.metadata || {},
      sourceURL: json?.data?.metadata?.sourceURL || url
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    clearTimeout(t);
  }
}

// Extract email addresses from markdown text.
// Returns array of { email, domain, isOnSchoolDomain, score }.
export function extractEmails(markdown, schoolDomain) {
  if (!markdown) return [];
  const re = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const found = new Map();
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const email = m[1].toLowerCase();
    if (found.has(email)) continue;
    // Drop obvious noise: mailer-daemon, no-reply, postmaster, sentry, image hosts.
    if (/^(no[-]?reply|noreply|postmaster|mailer-daemon|abuse|webmaster@example|root@|admin@example|test@)/.test(email)) continue;
    if (/\.(png|jpg|gif|svg|webp)$/i.test(email)) continue;
    const emailDomain = email.split('@')[1];
    const isOnSchoolDomain = !!schoolDomain && (emailDomain === schoolDomain || emailDomain.endsWith('.' + schoolDomain));
    found.set(email, { email, domain: emailDomain, isOnSchoolDomain });
  }
  return Array.from(found.values());
}

// Rank discovered emails by likely usefulness for cold outreach.
// Higher score = better.
export function scoreAndRankEmails(emails, { schoolDomain }) {
  const PRIORITY_LOCAL = ['principal', 'director', 'admissions', 'admission', 'office', 'info', 'contact', 'admin', 'school', 'reception', 'enquiry', 'enquiries'];
  return emails.map((e) => {
    const local = e.email.split('@')[0];
    let s = 0;
    // 50% — domain match
    if (e.isOnSchoolDomain) s += 50;
    else if (schoolDomain) s += 5; // off-domain emails are mostly noise
    // 35% — role in local part
    const idx = PRIORITY_LOCAL.findIndex((p) => local === p || local.startsWith(p));
    if (idx >= 0) s += 35 - idx * 2;
    else if (local.includes('school') || local.includes('edu')) s += 20;
    else s += 5; // personal-looking email like firstname.lastname@
    // 15% — penalty for known noise patterns
    if (/student|teacher|alumni|webmaster|hr@/.test(local)) s -= 15;
    return { ...e, score: s, local };
  }).sort((a, b) => b.score - a.score);
}

// Confidence label.
// Key insight: an off-domain email FOUND on the school's own website
// (e.g. `school@gmail.com`) is the school's published official email —
// it's monitored. Pattern guesses are not. So off-domain ≠ untrusted.
export function confidenceFromScore(best) {
  if (!best) return 0;
  if (best.isOnSchoolDomain && best.score >= 75) return 95; // role-based on school domain
  if (best.isOnSchoolDomain && best.score >= 50) return 88; // any on school domain
  if (best.isOnSchoolDomain) return 80;
  // Off-domain but published — typically Gmail/Yahoo addresses the school uses.
  if (best.score >= 25) return 75;
  return 65; // any email found at all is better than a pattern guess
}
