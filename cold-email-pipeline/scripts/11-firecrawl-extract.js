// 11-firecrawl-extract.js
// Scrape every school's website with Firecrawl + extract real published emails.
// Replaces the pattern-guessed emails for the full lead set.
//
// Strategy per school:
//   1. Visit homepage → extract emails
//   2. If best email score < 50, also visit /contact (1 extra credit)
//   3. Pick highest-scoring email across all visits
//   4. If nothing found → mark for skip
//
// Usage:
//   node 11-firecrawl-extract.js                    # all 500 schools (~700 credits)
//   node 11-firecrawl-extract.js --limit 50         # first 50 only (smoke test scale)
//   node 11-firecrawl-extract.js --resume           # skip schools already in output
//
// Output: output/extracted-emails.json (one entry per school)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrape, extractEmails, scoreAndRankEmails, confidenceFromScore } from './lib/firecrawl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'with-emails.json');
const OUT = path.join(__dirname, 'output', 'extracted-emails.json');

const RESUME = process.argv.includes('--resume');
const LIMIT_FLAG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG > -1 ? parseInt(process.argv[LIMIT_FLAG + 1], 10) : Infinity;

// Each path costs 1 credit. Order matters — homepage first, fallbacks only if needed.
const FALLBACK_PATHS = ['/contact', '/contact-us', '/admissions'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findEmailsForSchool(rec, idx) {
  const base = rec.cleanWebsite.replace(/\/+$/, '');
  const visits = [];
  let allEmails = [];

  // 1) Homepage first
  const home = await scrape(base, { timeoutMs: 35000 });
  visits.push({ url: base, ok: home.ok, error: home.ok ? null : home.error });
  if (home.ok) {
    allEmails = allEmails.concat(extractEmails(home.markdown, rec.cleanDomain));
  }

  // 2) If homepage didn't yield a strong on-domain email, try /contact
  let ranked = scoreAndRankEmails(allEmails, { schoolDomain: rec.cleanDomain });
  const homepageBest = ranked[0];
  const needFallback = !homepageBest || homepageBest.score < 50;

  if (needFallback) {
    for (const subpath of FALLBACK_PATHS) {
      const url = base + subpath;
      const r = await scrape(url, { timeoutMs: 35000 });
      visits.push({ url, ok: r.ok, error: r.ok ? null : r.error });
      if (r.ok) {
        allEmails = allEmails.concat(extractEmails(r.markdown, rec.cleanDomain));
        ranked = scoreAndRankEmails(allEmails, { schoolDomain: rec.cleanDomain });
        if (ranked[0] && ranked[0].score >= 50) break; // good enough, stop
      }
      await sleep(400); // mild courtesy delay
    }
  }

  ranked = scoreAndRankEmails(allEmails, { schoolDomain: rec.cleanDomain });
  const best = ranked[0] || null;
  return {
    idx,
    school: rec.name,
    city: rec.city,
    state: rec.state,
    board: rec.board,
    domain: rec.cleanDomain,
    pattern_email: rec.email,
    best_email: best?.email || null,
    best_email_score: best?.score || 0,
    best_email_on_domain: best?.isOnSchoolDomain || false,
    confidence: confidenceFromScore(best),
    all_emails: ranked.slice(0, 5).map((r) => ({ email: r.email, score: r.score, on_domain: r.isOnSchoolDomain })),
    visits: visits.length,
    visit_log: visits
  };
}

function loadExisting() {
  if (!RESUME || !fs.existsSync(OUT)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    return [];
  }
}

async function main() {
  const records = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const existing = loadExisting();
  const doneIdx = new Set(existing.map((e) => e.idx));

  const targets = records
    .map((r, i) => ({ ...r, _idx: i }))
    .filter((r) => r.cleanWebsite && r.cleanDomain)
    .filter((r) => !doneIdx.has(r._idx))
    .slice(0, LIMIT);

  console.log(`[11-firecrawl] Targets: ${targets.length} schools`);
  console.log(`[11-firecrawl] Resuming: ${existing.length} previously processed`);
  console.log(`[11-firecrawl] Estimated credit usage: ~${Math.ceil(targets.length * 1.4)} (homepage + ~40% needing /contact)`);
  console.log('');

  const results = [...existing];
  let credits = 0;

  for (let i = 0; i < targets.length; i++) {
    const rec = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${rec.name.slice(0, 40)} ... `);
    try {
      const r = await findEmailsForSchool(rec, rec._idx);
      results.push(r);
      credits += r.visits;
      console.log(`${r.best_email || '(none)'} conf=${r.confidence} (${r.visits} visits)`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ idx: rec._idx, school: rec.name, error: err.message, confidence: 0, best_email: null });
    }

    // Persist every 10 schools so a crash doesn't lose progress
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    }
    await sleep(300);
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

  // Summary
  const found = results.filter((r) => r.best_email);
  const onDomain = results.filter((r) => r.best_email_on_domain);
  const high = results.filter((r) => r.confidence >= 80);
  const medium = results.filter((r) => r.confidence >= 65 && r.confidence < 80);
  const skip = results.filter((r) => !r.best_email);
  console.log('\n=== EXTRACTION SUMMARY ===');
  console.log(`Total schools processed: ${results.length}`);
  console.log(`Found email:             ${found.length} (${Math.round(found.length / results.length * 100)}%)`);
  console.log(`On school domain:        ${onDomain.length}`);
  console.log(`Confidence ≥80 (high):   ${high.length}`);
  console.log(`Confidence 65-79 (med):  ${medium.length}`);
  console.log(`No email found (skip):   ${skip.length}`);
  console.log(`Estimated credits used:  ~${credits}`);
  console.log(`\nWrote → ${OUT}`);
}

main().catch((err) => {
  console.error('[11-firecrawl] Fatal:', err);
  process.exit(1);
});
