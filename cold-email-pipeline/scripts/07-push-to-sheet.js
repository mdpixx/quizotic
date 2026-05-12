// 07-push-to-sheet.js
// Append leads-raw.csv and leads-enriched.csv into the Quizotic Leads sheet
// via the gws CLI's `+append` helper.
//
// Usage:
//   node 07-push-to-sheet.js --dry-run       (default: shows commands, no API call)
//   node 07-push-to-sheet.js --confirm       (actually appends)
//
// Important: the existing tabs already have a header in row 1. We append
// from row 2 onward, so we strip the first line of each CSV before passing
// rows to gws.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const RAW = path.join(__dirname, 'output', 'leads-raw.csv');
const ENR = path.join(__dirname, 'output', 'leads-enriched.csv');

const DRY_RUN = !process.argv.includes('--confirm');

function readBody(csvPath) {
  // Drop header row; sheet already has its own header.
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
  return lines.slice(1).filter(Boolean);
}

function parseCsvLine(line) {
  // Minimal CSV parser handling quoted fields with embedded commas.
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"' && cur === '') { inQ = true; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function appendOne(tabName, rows) {
  console.log(`\n[07-push] → ${tabName}: ${rows.length} rows`);
  if (rows.length === 0) return;

  const values = rows.map(parseCsvLine);

  // gws sheets spreadsheets values append uses the resource form:
  //   --params '{"spreadsheetId": "...", "range": "...", "valueInputOption": "...", "insertDataOption": "..."}'
  //   --json   '{"values": [...], "majorDimension": "ROWS"}'
  const params = JSON.stringify({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS'
  });
  const body = JSON.stringify({ values, majorDimension: 'ROWS' });

  const args = [
    'sheets', 'spreadsheets', 'values', 'append',
    '--params', params,
    '--json', body
  ];

  if (DRY_RUN) {
    console.log('[07-push] DRY-RUN gws args:', args.slice(0, 6).join(' '), `... (+${values.length} rows in body)`);
    console.log('[07-push] Sample first row:', values[0]);
    return;
  }

  const res = spawnSync('gws', args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`gws append failed for ${tabName} with status ${res.status}. If error mentions auth, run: gws auth login`);
  }
  console.log(`[07-push] Appended ${rows.length} rows to ${tabName}`);
}

function main() {
  if (!fs.existsSync(RAW) || !fs.existsSync(ENR)) {
    throw new Error('Missing CSV outputs. Run 06-write-csv.js first.');
  }

  const rawRows = readBody(RAW);
  const enrRows = readBody(ENR);

  console.log('[07-push] Sheet ID:', SHEET_ID);
  console.log('[07-push] Mode:', DRY_RUN ? 'DRY-RUN' : 'LIVE APPEND');
  console.log(`[07-push] Leads_Raw rows: ${rawRows.length}`);
  console.log(`[07-push] Leads_Enriched rows: ${enrRows.length}`);

  appendOne('Leads_Raw', rawRows);
  appendOne('Leads_Enriched', enrRows);

  if (DRY_RUN) {
    console.log('\n[07-push] DRY-RUN done. Re-run with --confirm to actually push to the sheet.');
  } else {
    console.log('\n[07-push] LIVE PUSH complete.');
  }
}

main();
