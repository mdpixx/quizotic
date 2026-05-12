// 03-dedupe.js
// Merge CBSE + ICSE raw outputs, normalize, and dedupe.
// Output: output/merged.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify, cleanDomain } from './lib/domain-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CBSE = path.join(__dirname, 'output', 'cbse-raw.json');
const ICSE = path.join(__dirname, 'output', 'icse-raw.json');
const OUT = path.join(__dirname, 'output', 'merged.json');

function load(p) {
  if (!fs.existsSync(p)) {
    console.warn(`[03-dedupe] Missing ${p} — skipping`);
    return [];
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function normalize(rec) {
  const name = (rec.name || '').replace(/\s+/g, ' ').trim();
  const domain = cleanDomain(rec.website);
  return {
    ...rec,
    name,
    nameSlug: slugify(name),
    cleanWebsite: domain ? `https://${domain}` : '',
    cleanDomain: domain || '',
    rating: rec.rating || null,
    reviewCount: Number.isFinite(rec.reviewCount) ? rec.reviewCount : 0,
    address: (rec.address || '').replace(/\s+/g, ' ').trim(),
    phone: (rec.phone || '').replace(/\s+/g, ' ').trim()
  };
}

function dedupe(records) {
  // Key by (slug + city) — same school in two boards or two queries collapses.
  const map = new Map();
  for (const r of records) {
    if (!r.name || !r.nameSlug) continue;
    const key = `${r.nameSlug}|${(r.city || '').toLowerCase()}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, r); continue; }
    // Prefer record with website + higher review count.
    const better = (r.cleanDomain && !prev.cleanDomain) ||
                   (r.reviewCount > prev.reviewCount && r.cleanDomain === prev.cleanDomain);
    if (better) map.set(key, r);
  }
  return Array.from(map.values());
}

function main() {
  const cbse = load(CBSE);
  const icse = load(ICSE);
  console.log(`[03-dedupe] Loaded ${cbse.length} CBSE + ${icse.length} ICSE = ${cbse.length + icse.length} raw`);

  const all = [...cbse, ...icse].map(normalize);
  const deduped = dedupe(all);

  const withWeb = deduped.filter((r) => r.cleanDomain).length;
  const withRating = deduped.filter((r) => r.rating).length;
  console.log(`[03-dedupe] Deduped → ${deduped.length}; with website: ${withWeb}; with rating: ${withRating}`);

  fs.writeFileSync(OUT, JSON.stringify(deduped, null, 2));
  console.log(`[03-dedupe] Wrote → ${OUT}`);
}

main();
