// 04-score-and-rank.js
// Apply hard filters + scoring formula + city quotas → top-N leads.
// Default N=500; override with TOP_N env var.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cityTier, CITY_QUOTAS } from './lib/city-tier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'merged.json');
const OUT = path.join(__dirname, 'output', 'top-ranked.json');
const TOP_N = parseInt(process.env.TOP_N || '500', 10);

const NAME_BLOCKLIST = [
  /\bgovt\b/i, /\bgovernment\b/i, /\bsarkari\b/i, /\bsainik\b/i,
  /\bzilla parishad\b/i, /\bmunicipal\b/i, /\bnagar nigam\b/i,
  /\bkendriya vidyalaya\b/i, /\bnavodaya\b/i, /\barmy\b/i, /\bair force\b/i,
  /\bnavy\b/i, /\bdistrict primary\b/i,
  /\bplaygroup\b/i, /\bplay\s*school\b/i, /\bpre[-\s]?school\b/i, /\bday\s*care\b/i,
  /\bnursery\b/i, /\bcreche\b/i, /\bkidzee\b/i, /\bbachpan\b/i, /\beuro\s*kids\b/i,
  /\btuition\b/i, /\bcoaching\b/i, /\bclasses\b/i, /\bacademy of\b/i
];

function passesNameFilter(name) {
  return !NAME_BLOCKLIST.some((re) => re.test(name));
}

function score(rec) {
  let s = 0;
  // 35%: rating ≥ 4.0
  if (rec.rating >= 4.5) s += 35;
  else if (rec.rating >= 4.0) s += 28;
  else if (rec.rating >= 3.8) s += 18;
  else if (rec.rating >= 3.5) s += 10;
  // 25%: domain quality
  if (rec.cleanDomain) {
    if (/\.(edu\.in|edu|ac\.in)$/.test(rec.cleanDomain)) s += 25;
    else if (/\.(org|in|com)$/.test(rec.cleanDomain)) s += 18;
    else s += 10;
  }
  // 20%: city tier
  const tier = cityTier(rec.city);
  if (tier === 1) s += 20;
  else if (tier === 2) s += 14;
  else if (tier === 3) s += 6;
  // 10%: review count
  if (rec.reviewCount >= 200) s += 10;
  else if (rec.reviewCount >= 50) s += 7;
  else if (rec.reviewCount >= 20) s += 4;
  else if (rec.reviewCount >= 5) s += 1;
  // 10%: board (CBSE preferred)
  if (rec.board === 'CBSE') s += 10;
  else if (rec.board === 'ICSE') s += 8;
  return s;
}

function applyHardFilters(records) {
  return records.filter((r) => {
    if (!r.name || r.name.length < 5) return false;
    if (!r.cleanDomain) return false; // no website → no pattern email
    if (r.rating !== null && r.rating < 3.5) return false;
    if (!passesNameFilter(r.name)) return false;
    return true;
  });
}

function applyCityQuotas(records, totalTarget) {
  // Sort by score desc, then fill per-city quotas with overflow into a global pool.
  const byCity = new Map();
  for (const r of records) {
    const key = (r.city || '').toLowerCase();
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key).push(r);
  }
  for (const arr of byCity.values()) arr.sort((a, b) => b._score - a._score);

  const picked = [];
  const overflow = [];
  for (const { city, quota } of CITY_QUOTAS) {
    const arr = byCity.get(city.toLowerCase()) || [];
    picked.push(...arr.slice(0, quota));
    overflow.push(...arr.slice(quota));
  }
  // Include any cities not in quota list as overflow.
  const quotaCities = new Set(CITY_QUOTAS.map((q) => q.city.toLowerCase()));
  for (const [city, arr] of byCity.entries()) {
    if (!quotaCities.has(city)) overflow.push(...arr);
  }

  // Fill remaining slots from overflow by score.
  overflow.sort((a, b) => b._score - a._score);
  while (picked.length < totalTarget && overflow.length > 0) {
    picked.push(overflow.shift());
  }
  // Final sort by score for output stability.
  picked.sort((a, b) => b._score - a._score);
  return picked.slice(0, totalTarget);
}

function main() {
  const all = JSON.parse(fs.readFileSync(IN, 'utf8'));
  console.log(`[04-rank] Loaded ${all.length} merged records`);

  const filtered = applyHardFilters(all);
  console.log(`[04-rank] After hard filters: ${filtered.length}`);

  for (const r of filtered) r._score = score(r);

  const top = applyCityQuotas(filtered, TOP_N);

  // Per-city distribution log
  const dist = {};
  for (const r of top) dist[r.city] = (dist[r.city] || 0) + 1;
  console.log(`[04-rank] Picked ${top.length} (target ${TOP_N})`);
  console.log('[04-rank] City distribution:', JSON.stringify(dist, null, 2));

  // Score band distribution
  const bands = { '70+': 0, '50-69': 0, '30-49': 0, '<30': 0 };
  for (const r of top) {
    if (r._score >= 70) bands['70+']++;
    else if (r._score >= 50) bands['50-69']++;
    else if (r._score >= 30) bands['30-49']++;
    else bands['<30']++;
  }
  console.log('[04-rank] Score bands:', bands);

  fs.writeFileSync(OUT, JSON.stringify(top, null, 2));
  console.log(`[04-rank] Wrote → ${OUT}`);
}

main();
