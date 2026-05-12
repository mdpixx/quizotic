// 10-firecrawl-test.js
// Pilot: scrape 5 sample school websites with Firecrawl + extract real emails.
// Goal: validate yield BEFORE committing 500+ Firecrawl credits.
// Spends ~5-15 credits.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrape, extractEmails, scoreAndRankEmails, confidenceFromScore } from './lib/firecrawl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'with-emails.json');
const OUT = path.join(__dirname, 'output', 'firecrawl-test.json');

// Pick 5 diverse schools by score (1 from top, 1 mid, etc.) to get a fair signal.
function pickSamples(records, n = 5) {
  // Filter to records with cleanWebsite
  const withWeb = records.filter((r) => r.cleanWebsite && r.cleanDomain);
  // Spread across the rank: pick at indices 0, 25, 100, 250, 400
  const picks = [0, 25, 100, 250, 400].slice(0, n).map((i) => withWeb[Math.min(i, withWeb.length - 1)]);
  return picks;
}

const PATHS_TO_TRY = ['', '/contact', '/contact-us', '/admissions', '/about', '/about-us'];

async function findEmailsForSchool(rec) {
  const base = rec.cleanWebsite.replace(/\/+$/, '');
  const visited = [];
  for (const subpath of PATHS_TO_TRY) {
    const url = base + subpath;
    process.stdout.write(`  → ${url} ... `);
    const res = await scrape(url, { timeoutMs: 35000 });
    if (!res.ok) {
      console.log(`FAIL (${res.status || ''} ${(res.error || '').slice(0, 60)})`);
      visited.push({ url, ok: false, error: res.error });
      continue;
    }
    const emails = extractEmails(res.markdown, rec.cleanDomain);
    const ranked = scoreAndRankEmails(emails, { schoolDomain: rec.cleanDomain });
    const onDomain = ranked.filter((r) => r.isOnSchoolDomain);
    console.log(`ok — ${ranked.length} email(s) (${onDomain.length} on-domain)`);
    visited.push({ url, ok: true, emails: ranked });
    if (onDomain.length > 0) break; // Stop early once we have a good email
  }
  // Pick best across all visits
  const all = visited.flatMap((v) => v.emails || []);
  const ranked = scoreAndRankEmails(all, { schoolDomain: rec.cleanDomain });
  const best = ranked[0] || null;
  return {
    school: rec.name,
    city: rec.city,
    domain: rec.cleanDomain,
    pattern_email: rec.email,
    visited_pages: visited.map((v) => ({ url: v.url, ok: v.ok, count: (v.emails || []).length })),
    best_email: best?.email || null,
    best_email_score: best?.score || 0,
    best_email_on_domain: best?.isOnSchoolDomain || false,
    confidence: confidenceFromScore(best),
    all_emails: ranked.slice(0, 5).map((r) => ({ email: r.email, score: r.score, on_domain: r.isOnSchoolDomain }))
  };
}

async function main() {
  const records = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const samples = pickSamples(records, 5);
  console.log(`\n[10-firecrawl] Testing on ${samples.length} schools:\n`);
  const results = [];
  for (const rec of samples) {
    console.log(`\n[${rec.name} (${rec.city}) — domain ${rec.cleanDomain}]`);
    const r = await findEmailsForSchool(rec);
    results.push(r);
  }

  console.log('\n--- SUMMARY ---');
  console.log('| # | School | Pattern email | Found best | On-domain | Confidence |');
  console.log('|---|--------|---------------|------------|-----------|------------|');
  results.forEach((r, i) => {
    console.log(`| ${i + 1} | ${r.school.slice(0, 35)} | ${r.pattern_email} | ${r.best_email || '(none)'} | ${r.best_email_on_domain ? 'yes' : 'no'} | ${r.confidence} |`);
  });

  const yieldOnDomain = results.filter((r) => r.best_email_on_domain).length;
  const yieldAny = results.filter((r) => r.best_email).length;
  console.log(`\nOn-domain yield: ${yieldOnDomain}/${results.length}`);
  console.log(`Any-email yield: ${yieldAny}/${results.length}`);
  console.log(`\nIf on-domain yield is >=3/5, greenlight full run.`);

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`\nWrote → ${OUT}`);
}

main().catch((err) => {
  console.error('[10-firecrawl] Fatal:', err);
  process.exit(1);
});
