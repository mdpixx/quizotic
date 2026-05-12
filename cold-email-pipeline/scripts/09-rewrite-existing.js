// 09-rewrite-existing.js
// Overwrite the subject (col H) and body (col I) of all 500 leads we
// previously appended to Manual_Send (sheet rows 66-565) using the
// updated testimonial-for-free-access templates.
//
// Also refreshes status to "ready" and notes to "variant=X subject=SY".
//
// Usage:
//   node 09-rewrite-existing.js              # dry-run, prints sample
//   node 09-rewrite-existing.js --confirm    # writes via gws batchUpdate

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderRow } from './lib/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'with-emails.json');
const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const TAB = 'Manual_Send';

// Our 500 rows landed at sheet rows 66 to 565.
const FIRST_ROW = 66;
const DRY_RUN = !process.argv.includes('--confirm');

function buildBatchUpdate(rendered) {
  // Update only columns H (subject), I (body), J (status), K (notes).
  // Keeps row_num/priority/city/school/email/confidence intact.
  const data = [];
  rendered.forEach((row, i) => {
    const sheetRow = FIRST_ROW + i;
    data.push({
      range: `${TAB}!H${sheetRow}:K${sheetRow}`,
      values: [[row.subject, row.body, row.status, row.notes]]
    });
  });
  return { data, valueInputOption: 'USER_ENTERED' };
}

function callGws(body) {
  const params = JSON.stringify({ spreadsheetId: SHEET_ID });
  const json = JSON.stringify(body);
  const args = ['sheets', 'spreadsheets', 'values', 'batchUpdate', '--params', params, '--json', json];
  const res = spawnSync('gws', args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`gws batchUpdate failed (status ${res.status})`);
}

function main() {
  const records = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const rendered = records.map((r, i) => renderRow(r, i, /* startRowNum= */ 4));

  // Stats
  const dist = { variant: {}, subject: {} };
  for (const r of rendered) {
    dist.variant[r._variant] = (dist.variant[r._variant] || 0) + 1;
    dist.subject[r._subject] = (dist.subject[r._subject] || 0) + 1;
  }
  console.log('[09-rewrite] Rendered', rendered.length, 'rows with new templates');
  console.log('[09-rewrite] Distribution:', JSON.stringify(dist, null, 2));
  console.log('[09-rewrite] Sample (row 66):');
  console.log('  Subject:', rendered[0].subject);
  console.log('  Body preview:', rendered[0].body.split('\n').slice(0, 4).join(' | '));

  const batch = buildBatchUpdate(rendered);

  if (DRY_RUN) {
    console.log(`\n[09-rewrite] DRY-RUN — would batchUpdate ${batch.data.length} ranges (H${FIRST_ROW}:K${FIRST_ROW + rendered.length - 1})`);
    console.log('[09-rewrite] Re-run with --confirm to apply.');
    return;
  }

  // Sheets API limits a single batchUpdate to a few thousand ranges; 500 is fine.
  // To keep payload size sane (~1.5MB), we still chunk into 100-row batches.
  const CHUNK = 100;
  for (let i = 0; i < batch.data.length; i += CHUNK) {
    const slice = batch.data.slice(i, i + CHUNK);
    console.log(`[09-rewrite] Sending batch ${i / CHUNK + 1} (${slice.length} ranges)...`);
    callGws({ data: slice, valueInputOption: 'USER_ENTERED' });
  }
  console.log(`\n[09-rewrite] Done. ${rendered.length} rows updated in ${TAB}.`);
  console.log('[09-rewrite] Reload the Sheet → Quizotic Send → Send next 10 ready.');
}

main();
