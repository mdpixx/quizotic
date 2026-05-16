// 13-reframe-pending.js
// Overwrites subject (col H) and body (col I) of every "ready" row in
// Manual_Send with the v2 pitch ("tired of foreign quiz platforms").
//
// Leaves "sent" and "skipped" rows completely untouched.
// Status (col J) stays "ready" so Apps Script fires normally.
// Col K (notes) is updated to record the reframe for audit trail.
//
// Usage:
//   node 13-reframe-pending.js              # dry-run, prints distribution + sample
//   node 13-reframe-pending.js --confirm    # writes to sheet via gws batchUpdate

import { spawnSync } from 'node:child_process';
import { SUBJECTS_V2, BODY_V2 } from './lib/templates-v2.js';

const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const TAB = 'Manual_Send';
const STATUS_RANGE = `${TAB}!J2:J600`;  // col J = status
const DRY_RUN = !process.argv.includes('--confirm');
const REFRAME_DATE = '2026-05-12';
const CHUNK = 100;

function gwsGet(range) {
  const params = JSON.stringify({ spreadsheetId: SHEET_ID, range });
  const args = ['sheets', 'spreadsheets', 'values', 'get', '--params', params];
  const res = spawnSync('gws', args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`gws get failed: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

function gwsBatchUpdate(data) {
  const params = JSON.stringify({ spreadsheetId: SHEET_ID });
  const body = JSON.stringify({ data, valueInputOption: 'USER_ENTERED' });
  const args = ['sheets', 'spreadsheets', 'values', 'batchUpdate',
    '--params', params, '--json', body];
  const res = spawnSync('gws', args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`gws batchUpdate failed (status ${res.status})`);
}

function main() {
  // 1. Read status column to find ready rows.
  const result = gwsGet(STATUS_RANGE);
  const statuses = result.values || [];  // array of [value] or [] for blank cells

  const readySheetRows = [];
  for (let i = 0; i < statuses.length; i++) {
    const val = (statuses[i][0] || '').trim().toLowerCase();
    if (val === 'ready') {
      readySheetRows.push(i + 2);  // +1 for header row, +1 for 1-based index
    }
  }

  console.log(`[13-reframe] Status column read: ${statuses.length} rows scanned`);
  console.log(`[13-reframe] Found ${readySheetRows.length} ready rows`);

  if (readySheetRows.length === 0) {
    console.log('[13-reframe] Nothing to do.');
    return;
  }

  // 2. Build subject distribution stats.
  const subjectDist = {};
  SUBJECTS_V2.forEach((_, i) => { subjectDist[`S${i + 1}`] = 0; });

  // 3. Build batchUpdate payload.
  const batchData = readySheetRows.map((sheetRow, pos) => {
    const subjectIdx = pos % SUBJECTS_V2.length;
    const subject = SUBJECTS_V2[subjectIdx];
    const subjectKey = `S${subjectIdx + 1}`;
    subjectDist[subjectKey]++;
    return {
      range: `${TAB}!H${sheetRow}:K${sheetRow}`,
      values: [[subject, BODY_V2, 'ready', `reframed=${REFRAME_DATE} v2 subject=${subjectKey}`]]
    };
  });

  // 4. Print stats + sample.
  console.log('[13-reframe] Subject distribution:', JSON.stringify(subjectDist));
  console.log('\n[13-reframe] Sample — first ready row (sheet row', readySheetRows[0], '):');
  console.log('  Subject:', batchData[0].values[0][0]);
  console.log('  Body (first 3 lines):');
  BODY_V2.split('\n').slice(0, 3).forEach((l) => console.log('   ', l));

  if (DRY_RUN) {
    console.log(`\n[13-reframe] DRY-RUN — would update ${batchData.length} rows (H+I+K only; J stays "ready")`);
    console.log('[13-reframe] Re-run with --confirm to apply.');
    return;
  }

  // 5. Write in 100-row chunks.
  for (let i = 0; i < batchData.length; i += CHUNK) {
    const slice = batchData.slice(i, i + CHUNK);
    console.log(`[13-reframe] Sending batch ${Math.floor(i / CHUNK) + 1} (${slice.length} ranges)...`);
    gwsBatchUpdate(slice);
  }
  console.log(`\n[13-reframe] Done. ${batchData.length} rows reframed in ${TAB}.`);
  console.log('[13-reframe] Apps Script will fire the new body next time you click "Send next 10 ready".');
}

main();
