// 12-update-manual-send.js
// After running 11-firecrawl-extract.js, this script updates the live
// Manual_Send sheet (rows 66-565) with the real published emails:
//   - Replaces col F (to_email)        with extracted best_email
//   - Replaces col G (email_confidence) with the new confidence score
//   - Sets col J (status) = "skipped"  for schools where no email was found
//   - Sets col K (notes) to record the source ("firecrawl" / "skipped:no-email")
//
// Usage:
//   node 12-update-manual-send.js              # dry-run, prints distribution
//   node 12-update-manual-send.js --confirm    # writes via gws batchUpdate

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WITH_EMAILS = path.join(__dirname, 'output', 'with-emails.json');
const EXTRACTED = path.join(__dirname, 'output', 'extracted-emails.json');
const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const TAB = 'Manual_Send';
const FIRST_ROW = 66; // sheet row of with-emails.json[0]
const DRY_RUN = !process.argv.includes('--confirm');

function load() {
  const records = JSON.parse(fs.readFileSync(WITH_EMAILS, 'utf8'));
  const extracted = JSON.parse(fs.readFileSync(EXTRACTED, 'utf8'));
  const byIdx = new Map(extracted.map((e) => [e.idx, e]));
  return { records, byIdx };
}

function buildBatchData() {
  const { records, byIdx } = load();
  const data = [];
  const stats = { kept: 0, skipped: 0, no_data: 0 };

  records.forEach((rec, i) => {
    const sheetRow = FIRST_ROW + i;
    const ext = byIdx.get(i);
    if (!ext) {
      stats.no_data += 1;
      // No extraction data — leave row alone but mark notes for clarity.
      return;
    }
    if (!ext.best_email) {
      stats.skipped += 1;
      data.push({
        range: `${TAB}!F${sheetRow}:K${sheetRow}`,
        values: [[ext.pattern_email, 0, '', '', 'skipped', 'no-email-found']]
      });
      return;
    }
    stats.kept += 1;
    data.push({
      range: `${TAB}!F${sheetRow}:G${sheetRow}`,
      values: [[ext.best_email, ext.confidence]]
    });
    data.push({
      range: `${TAB}!K${sheetRow}`,
      values: [[`firecrawl conf=${ext.confidence}${ext.best_email_on_domain ? ' on-domain' : ''}`]]
    });
  });

  return { data, stats };
}

function callGws(slice) {
  const params = JSON.stringify({ spreadsheetId: SHEET_ID });
  const json = JSON.stringify({ data: slice, valueInputOption: 'USER_ENTERED' });
  const args = ['sheets', 'spreadsheets', 'values', 'batchUpdate', '--params', params, '--json', json];
  const res = spawnSync('gws', args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`gws batchUpdate failed (status ${res.status})`);
}

function main() {
  if (!fs.existsSync(EXTRACTED)) {
    console.error('Missing output/extracted-emails.json. Run 11-firecrawl-extract.js first.');
    process.exit(1);
  }
  const { data, stats } = buildBatchData();
  console.log('[12-update] Rows to update:', data.length);
  console.log('[12-update] Distribution:', JSON.stringify(stats, null, 2));

  if (DRY_RUN) {
    console.log('[12-update] DRY-RUN — first 3 ranges:');
    data.slice(0, 3).forEach((d) => console.log(' ', d.range, '→', JSON.stringify(d.values[0])));
    console.log('\nRe-run with --confirm to apply.');
    return;
  }

  const CHUNK = 200;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    console.log(`[12-update] Sending batch ${Math.floor(i / CHUNK) + 1} (${slice.length} ranges)...`);
    callGws(slice);
  }
  console.log('\n[12-update] Done. Manual_Send updated with verified emails.');
  console.log('[12-update] Skipped rows will not fire — Apps Script ignores status≠ready.');
}

main();
