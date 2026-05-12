// Google Maps scraper using Puppeteer.
// Queries the public Maps search endpoint and extracts result cards from the
// left-rail feed without hitting the paid Maps Platform API.

import { newStealthPage, jitter, withRetry, sleep } from './puppeteer-helper.js';

const MAPS_BASE = 'https://www.google.com/maps/search/';

function buildSearchUrl(query) {
  return MAPS_BASE + encodeURIComponent(query) + '?hl=en';
}

// Scroll the results feed until it reports "You've reached the end of the list"
// or until we hit maxScrolls / maxResults.
async function scrollFeed(page, { maxScrolls = 12, maxResults = 80 } = {}) {
  let lastCount = 0;
  let stableLoops = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const reached = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return { count: 0, end: true };
      feed.scrollTop = feed.scrollHeight;
      const cards = feed.querySelectorAll('a[href*="/maps/place/"]');
      const endMarker = document.body.innerText.includes("You've reached the end of the list");
      return { count: cards.length, end: endMarker };
    });
    if (reached.end) break;
    if (reached.count >= maxResults) break;
    if (reached.count === lastCount) {
      stableLoops += 1;
      if (stableLoops >= 2) break;
    } else {
      stableLoops = 0;
    }
    lastCount = reached.count;
    await sleep(1500 + Math.floor(Math.random() * 800));
  }
}

// Extract structured fields from each result card on the search feed.
async function extractCards(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const links = document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (seen.has(href)) continue;
      seen.add(href);

      // Card root is the closest ancestor that contains the visible text rows.
      let card = link.closest('div[jsaction]') || link.parentElement;
      const name = link.getAttribute('aria-label') || link.querySelector('div')?.textContent?.trim() || '';
      const text = card?.innerText || '';

      // Rating: prefer aria-label on the rating span (e.g. "4.5 stars"); fall back to text regex.
      let rating = null;
      let reviewCount = 0;
      const ratingEl = card?.querySelector('[aria-label*="star" i], [aria-label*="rating" i]');
      if (ratingEl) {
        const al = ratingEl.getAttribute('aria-label') || '';
        const m = al.match(/(\d(?:\.\d)?)/);
        if (m) rating = parseFloat(m[1]);
      }
      if (rating === null) {
        const m = text.match(/(?:^|\s)(\d\.\d)\s*(?:\(|stars)/);
        if (m) rating = parseFloat(m[1]);
      }
      // Review count is in parens after the rating in visible text.
      const rcMatch = text.match(/\(\s*([\d,]{1,8})\s*\)/);
      if (rcMatch) reviewCount = parseInt(rcMatch[1].replace(/,/g, ''), 10);

      // Phone: Indian numbers, allow +91 / 0 prefix, 10 digits clustered
      const phoneMatch = text.match(/(?:\+?91[-\s]?)?(?:0)?\s*\d{2,5}[-\s]?\d{3,5}[-\s]?\d{3,5}/);
      const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : '';

      // Address heuristic: line containing a comma + words, but NOT a category prefix line.
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      let address = '';
      for (const line of lines) {
        if (/\d\.\d/.test(line)) continue;
        if (/^Open\b|^Closed\b|^Closes\b|^Opens\b/.test(line)) continue;
        if (line === name) continue;
        // Skip category-prefix line (looks like "School · CBSE School ·  · …")
        const stripped = line.replace(/^[^·]+·\s*[^·]*·\s*/, '');
        const candidate = stripped !== line ? stripped : line;
        if (candidate.split(',').length >= 2 && candidate.length > 12) { address = candidate; break; }
      }

      // Website: card sometimes has an external "Website" anchor — capture if present.
      let website = '';
      const a = card?.querySelectorAll('a');
      if (a) {
        for (const x of a) {
          const h = x.getAttribute('href') || '';
          if (h.startsWith('http') && !h.includes('google.com') && !h.includes('googleusercontent')) {
            website = h; break;
          }
        }
      }

      // placeUrl: href is already an absolute URL from Maps; use as-is.
      const placeUrl = href.startsWith('http') ? href.split('?')[0] : 'https://www.google.com' + href.split('?')[0];

      out.push({
        name: name.trim(),
        rating,
        reviewCount,
        address,
        phone,
        website,
        placeUrl
      });
    }
    return out;
  });
}

// One city + board query → array of school records.
async function searchOne(browser, query, ctx) {
  const page = await newStealthPage(browser);
  try {
    const url = buildSearchUrl(query);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Maps may redirect through consent screen for first-time UAs — accept if present.
    try {
      const consentBtn = await page.$('button[aria-label*="Accept" i], button[aria-label*="Agree" i]');
      if (consentBtn) await consentBtn.click().catch(() => {});
    } catch {}
    await page.waitForSelector('div[role="feed"]', { timeout: 30000 });
    await scrollFeed(page, { maxScrolls: 10, maxResults: 70 });
    const cards = await extractCards(page);
    return cards.map((c) => ({
      ...c,
      city: ctx.city,
      state: ctx.state,
      board: ctx.board,
      source: 'Maps',
      query
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

export async function scrapeMaps(browser, queries, { onProgress } = {}) {
  const all = [];
  let i = 0;
  for (const q of queries) {
    i += 1;
    const label = `${i}/${queries.length} ${q.board} ${q.city}`;
    try {
      const results = await withRetry(() => searchOne(browser, q.query, q), { label });
      all.push(...results);
      if (onProgress) onProgress({ done: i, total: queries.length, city: q.city, board: q.board, found: results.length });
    } catch (err) {
      console.warn(`[fail] ${label}: ${err.message}`);
      if (onProgress) onProgress({ done: i, total: queries.length, city: q.city, board: q.board, found: 0, error: err.message });
    }
    await jitter(2200, 1200);
  }
  return all;
}
