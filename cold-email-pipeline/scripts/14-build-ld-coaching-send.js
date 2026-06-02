// 14-build-ld-coaching-send.js
// Streamline the new Corporate/PSU L&D + Coaching Institute leads (added to the
// `Quizotic Outreach Leads` tab) into the send-ready `Manual_Send` tab so the
// existing "Quizotic Send" Apps Script menu can fire them.
//
// Two phases (only run with --confirm):
//   A) Park the existing OLD school rows at status="ready" -> "hold"
//      so only this new batch is "ready" and sends first. Reversible.
//   B) Build subject+body per emailable new lead (2 segment-tailored templates),
//      append to Manual_Send with status="ready".
//
// Only leads with a real email (Official Email contains "@") are queued.
// Send logic reads F=to_email, H=subject, I=body, J=status. D/E/C/G are cosmetic.
//
// Usage:
//   node 14-build-ld-coaching-send.js            # dry-run (no writes)
//   node 14-build-ld-coaching-send.js --confirm  # park + append

import { spawnSync } from 'node:child_process';

const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const SEND_TAB = 'Manual_Send';
const LEADS_TAB = 'Quizotic Outreach Leads';
const DRY_RUN = !process.argv.includes('--confirm');

const HEADERS = [
  'row_num', 'priority', 'city', 'school_name', 'principal_name',
  'to_email', 'email_confidence', 'subject', 'body', 'status', 'notes',
];

const SIGNATURE_COACHING = `Mahesh Dhiman
Founder, Quizotic
linkedin.com/in/mdpixx
www.quizotic.live

Reply STOP to opt out — no follow-ups will be sent.`;

const SIGNATURE_LD = `Mahesh Dhiman
Founder, Quizotic | Senior Manager, L&D
linkedin.com/in/mdpixx
www.quizotic.live

Reply STOP to opt out — no follow-ups will be sent.`;

// Possessive that reads right for names ending in "s" (Asian Paints' not Paints's).
const poss = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

const coachingSubject = (org) =>
  `Free live-quiz tool for ${poss(org)} revision batches — and a small ask`;

const coachingBody = (org) => `Hi ${org} team,

I'm Mahesh — I built Quizotic.live, a live-quiz and revision tool made for Indian classrooms and coaching batches. Think Kahoot/Mentimeter, but free for the first 50 participants per session, with spaced-retrieval revision, AI-generated questions in English & Hindi, and Bloom's-tagged diagnostics. No app install — it runs in any browser.

For a test-prep institute like yours it fits weekly revision tests, live doubt-quiz events, and batch-level performance reports.

I'd genuinely love for one of your faculty to try it on a single revision class — I'll set it up free and help personally. And if it's useful, your honest feedback, or a short testimonial, would mean a lot. We read every single one, and the best ones go up on our landing page.

Try it: https://www.quizotic.live

${SIGNATURE_COACHING}`;

const ldSubject = (org) =>
  `A free quiz & assessment tool for ${poss(org)} L&D team — and a small ask`;

const ldBody = (org) => `Hi ${org} team,

I'm Mahesh — I run Learning & Development at India's largest oil company by day, and I built Quizotic.live to fix something that's bugged me for years: Indian trainers stuck using expensive American tools for live quizzes and assessments.

Quizotic is a Kahoot/Mentimeter alternative — free for the first 50 participants per session, with live quizzes, instant leaderboards, AI-generated questions in English & Hindi, and exportable session reports. It runs in any browser, no install. For corporate L&D it fits induction quizzes, post-training assessments, and gamified sessions that actually hold a room.

I'd love for your team to try it on one session — I'll help set it up free. And if it works for you, your honest feedback, or a short testimonial, would mean a lot. We read every one and feature the best on our landing page.

Try it: https://www.quizotic.live

${SIGNATURE_LD}`;

// --- gws helpers -----------------------------------------------------------

function gws(args, { allowFail = false } = {}) {
  const res = spawnSync('gws', args, { encoding: 'utf8' });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`gws ${args.slice(0, 4).join(' ')} failed (status ${res.status})\n${res.stderr || res.stdout}`);
  }
  return res.stdout || '';
}

// gws prints a "Using keyring backend: keyring" banner before JSON — slice from first brace.
function parseJson(out) {
  const i = out.indexOf('{');
  if (i === -1) throw new Error(`No JSON in gws output:\n${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
}

function readRange(range) {
  const params = JSON.stringify({ spreadsheetId: SHEET_ID, range });
  const out = gws(['sheets', 'spreadsheets', 'values', 'get', '--params', params, '--format', 'json']);
  return parseJson(out).values || [];
}

function updateRange(range, values) {
  const params = JSON.stringify({ spreadsheetId: SHEET_ID, range, valueInputOption: 'USER_ENTERED' });
  const body = JSON.stringify({ range, majorDimension: 'ROWS', values });
  gws(['sheets', 'spreadsheets', 'values', 'update', '--params', params, '--json', body]);
}

function appendRows(rows) {
  const values = rows.map((r) => HEADERS.map((h) => String(r[h] ?? '')));
  const params = JSON.stringify({
    spreadsheetId: SHEET_ID,
    range: `${SEND_TAB}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
  });
  const body = JSON.stringify({ values, majorDimension: 'ROWS' });
  gws(['sheets', 'spreadsheets', 'values', 'append', '--params', params, '--json', body]);
}

// --- Phase A: park existing "ready" -> "hold" ------------------------------

function parkExistingReady() {
  const col = readRange(`${SEND_TAB}!J2:J5500`); // statuses, header excluded
  let parked = 0;
  const out = col.map((cell) => {
    const v = (cell[0] || '').trim();
    if (v.toLowerCase() === 'ready') { parked++; return ['hold']; }
    return [cell[0] ?? ''];
  });
  console.log(`[14] Phase A: ${parked} existing "ready" rows -> "hold"`);
  if (!DRY_RUN && parked > 0) {
    updateRange(`${SEND_TAB}!J2:J${out.length + 1}`, out);
    console.log('[14] Phase A: parked written.');
  }
  return parked;
}

// --- Phase B: build new rows ----------------------------------------------

function nextRowNum() {
  const col = readRange(`${SEND_TAB}!A2:A5500`);
  const nums = col.map((c) => parseInt((c[0] || '').trim(), 10)).filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

function buildRows() {
  // Leads columns: 0 Date,1 Segment,2 Organization,3 Category,4 City/State,
  // 5 Website,6 Official Email,7 Phone,...,12 Confidence,13 Fit,14 Status
  const leads = readRange(`${LEADS_TAB}!A2:O101`);
  let rowNum = nextRowNum();
  const rows = [];
  const counts = { Coaching: 0, LD: 0, skippedNoEmail: 0 };

  for (const r of leads) {
    const segment = (r[1] || '').trim();
    const org = (r[2] || '').trim();
    const city = (r[4] || '').trim();
    const email = (r[6] || '').trim();
    const confidence = (r[12] || '').trim();
    if (!email || !email.includes('@')) { counts.skippedNoEmail++; continue; }

    const isCoaching = /coaching/i.test(segment);
    const subject = isCoaching ? coachingSubject(org) : ldSubject(org);
    const body = isCoaching ? coachingBody(org) : ldBody(org);
    if (isCoaching) counts.Coaching++; else counts.LD++;

    rows.push({
      row_num: rowNum++,
      priority: /high/i.test(confidence) ? 'high' : 'medium',
      city,
      school_name: org,
      principal_name: '',
      to_email: email,
      email_confidence: 70,
      subject,
      body,
      status: 'ready',
      notes: `LD/coaching batch 2026-06-01 seg=${segment}`,
    });
  }
  return { rows, counts };
}

// --- main ------------------------------------------------------------------

function main() {
  console.log(`[14] ${DRY_RUN ? 'DRY-RUN' : 'LIVE (--confirm)'} — Quizotic L&D + Coaching batch\n`);

  // Phase A first so only the new batch is "ready" after Phase B.
  parkExistingReady();

  const { rows, counts } = buildRows();
  console.log(`\n[14] Phase B: ${rows.length} emailable leads ` +
    `(Coaching: ${counts.Coaching}, Corporate L&D: ${counts.LD}; ` +
    `skipped no-email: ${counts.skippedNoEmail})`);
  if (rows.length) {
    console.log(`[14] row_num range: ${rows[0].row_num}–${rows[rows.length - 1].row_num}`);
  }

  // Print one full sample of each template.
  const sampleC = rows.find((r) => /revision batches/.test(r.subject));
  const sampleL = rows.find((r) => /L&D team/.test(r.subject));
  for (const [label, s] of [['COACHING', sampleC], ['CORPORATE L&D', sampleL]]) {
    if (!s) continue;
    console.log(`\n----- SAMPLE (${label}) -> ${s.to_email} -----`);
    console.log(`Subject: ${s.subject}\n`);
    console.log(s.body);
    console.log('-----------------------------------------------');
  }

  if (DRY_RUN) {
    console.log('\n[14] DRY-RUN complete. Re-run with --confirm to park old rows + append these.');
    return;
  }
  if (rows.length) {
    appendRows(rows);
    console.log(`\n[14] Appended ${rows.length} "ready" rows to ${SEND_TAB}.`);
    console.log('[14] Done. Reload the Sheet → Quizotic Send → 📊 Show send stats (expect Ready: ' + rows.length + ').');
  }
}

main();
