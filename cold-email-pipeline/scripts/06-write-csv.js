// 06-write-csv.js
// Convert ranked + email-tagged records into the two CSV files matching
// the Google Sheet schema verbatim.
// Outputs:
//   output/leads-raw.csv      → 13 columns, paste into Leads_Raw tab
//   output/leads-enriched.csv → 15 columns, paste into Leads_Enriched tab

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createObjectCsvWriter } from 'csv-writer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'with-emails.json');
const OUT_RAW = path.join(__dirname, 'output', 'leads-raw.csv');
const OUT_ENR = path.join(__dirname, 'output', 'leads-enriched.csv');

const RAW_HEADERS = [
  'id', 'school_name', 'city', 'state', 'board', 'address', 'phone',
  'website', 'google_rating', 'review_count', 'source', 'date_added', 'status'
];

const ENRICHED_HEADERS = [
  'id', 'school_name', 'city', 'state', 'board', 'principal_name', 'email',
  'email_confidence', 'email_source', 'phone', 'website', 'about_text',
  'recent_news', 'enriched_at', 'status'
];

const today = new Date().toISOString().slice(0, 10);
const nowIso = new Date().toISOString();

async function main() {
  const records = JSON.parse(fs.readFileSync(IN, 'utf8'));

  const rawRows = records.map((r, i) => ({
    id: i + 1,
    school_name: r.name,
    city: r.city,
    state: r.state,
    board: r.board,
    address: r.address || '',
    phone: r.phone || '',
    website: r.cleanWebsite || '',
    google_rating: r.rating ?? '',
    review_count: r.reviewCount ?? '',
    source: r.source || 'Maps',
    date_added: today,
    status: ''
  }));

  const enrichedRows = records.map((r, i) => ({
    id: i + 1,
    school_name: r.name,
    city: r.city,
    state: r.state,
    board: r.board,
    principal_name: '',
    email: r.email || '',
    email_confidence: r.email_confidence ?? 0,
    email_source: r.email_source || 'pattern',
    phone: r.phone || '',
    website: r.cleanWebsite || '',
    about_text: '',
    recent_news: '',
    enriched_at: nowIso,
    status: r.email ? 'enriched' : 'needs-manual'
  }));

  const rawWriter = createObjectCsvWriter({
    path: OUT_RAW,
    header: RAW_HEADERS.map((id) => ({ id, title: id }))
  });
  const enrWriter = createObjectCsvWriter({
    path: OUT_ENR,
    header: ENRICHED_HEADERS.map((id) => ({ id, title: id }))
  });

  await rawWriter.writeRecords(rawRows);
  await enrWriter.writeRecords(enrichedRows);

  console.log(`[06-csv] Wrote ${rawRows.length} rows → ${OUT_RAW}`);
  console.log(`[06-csv] Wrote ${enrichedRows.length} rows → ${OUT_ENR}`);

  // Verify headers exactly match the schema doc — fail loud on drift.
  const rawHead = fs.readFileSync(OUT_RAW, 'utf8').split('\n')[0];
  const enrHead = fs.readFileSync(OUT_ENR, 'utf8').split('\n')[0];
  if (rawHead !== RAW_HEADERS.join(',')) throw new Error(`Raw header drift: ${rawHead}`);
  if (enrHead !== ENRICHED_HEADERS.join(',')) throw new Error(`Enriched header drift: ${enrHead}`);
  console.log('[06-csv] Header parity check: OK');
}

main().catch((err) => {
  console.error('[06-csv] Fatal:', err);
  process.exit(1);
});
