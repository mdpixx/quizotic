// 08-build-manual-send.js
// Render subject + body for each of the 500 enriched leads using the
// templates from 02-email-templates.md, then append them to the
// `Manual_Send` tab so the Apps Script "Quizotic Send" menu can fire them.
//
// Manual_Send columns (verified live):
//   row_num, priority, city, school_name, principal_name, to_email,
//   email_confidence, subject, body, status, notes
//
// Important: Manual_Send already has rows 2-3 (manual test sends).
// We append starting at the next free row, with row_num continuing the
// sequence in the spreadsheet.
//
// Usage:
//   node 08-build-manual-send.js              # dry-run, writes manual-send.csv only
//   node 08-build-manual-send.js --confirm    # appends to Manual_Send via gws

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createObjectCsvWriter } from 'csv-writer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'with-emails.json');
const OUT_CSV = path.join(__dirname, 'output', 'manual-send.csv');
const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const TAB = 'Manual_Send';

const DRY_RUN = !process.argv.includes('--confirm');

const HEADERS = [
  'row_num', 'priority', 'city', 'school_name', 'principal_name',
  'to_email', 'email_confidence', 'subject', 'body', 'status', 'notes'
];

// --- Subject templates (round-robin, weighted toward S4) ---
const SUBJECTS = {
  S1: (s) => `Quick one for ${s.name}'s teachers`,
  S2: () => `Free Kahoot alternative built for Indian classrooms`,
  S3: (s) => `${s.firstName} — 30-second look at Quizotic?`,
  S4: (s) => `Saw ${s.name} on the ${s.board}/ICSE directory — worth your 30 seconds`
};
const SUBJECT_ROTATION = ['S4', 'S1', 'S4', 'S2', 'S4', 'S3']; // S4 hits 3/6 = 50%

// --- Variant body templates ---
const VARIANTS = {
  A: (s) => `Hi ${s.firstName},

${s.opener}

I'm Mahesh — building Quizotic.live, a Kahoot/Mentimeter alternative for Indian classrooms. Free for the first 50 students per session (Kahoot caps at 40 — and your classes are bigger than that).

Live quizzes, spaced retrieval for revision, AI-generated questions in English & Hindi, Bloom's taxonomy tagging. No app install — runs in any browser.

If a teacher at ${s.name} wants to try it for one unit test or revision class, I'll set them up free and personally help.

Quick look: https://www.quizotic.live

Worth a forward to one teacher?

${SIGNATURE}`,

  B: (s) => `Hi ${s.firstName},

${s.opener}

Quick context — I run L&D at India's largest oil company by day, and I've been frustrated that Indian teachers are stuck using American quiz tools at American prices. Kahoot's free tier maxes at 40 kids; Mentimeter Pro is around 2000 rupees per teacher per month. A typical Indian class is 50-60 students.

So I built Quizotic.live — same live-quiz mechanic, same spaced retrieval, AI-generated questions in English/Hindi, but free for the first 50 participants. Forever.

I'm not VC-funded, not selling subscriptions hard, and not running a sales team. I just want Indian teachers to have a tool built for their classrooms.

If ${s.name} is interested, I'll personally onboard one or two teachers free — no card, no contract, no follow-up calls.

Site: https://www.quizotic.live

Genuinely curious what you'd want a tool like this to do — even if you don't try it, your honest feedback would mean a lot.

${SIGNATURE}`,

  C: (s) => `Hi ${s.firstName},

${s.opener}

A few teachers in ${s.city} have started using Quizotic.live for weekly revision tests. One put it like this: "Kahoot is fun for fresher batches, but for serious revision I needed spaced retrieval. Quizotic does both, and my 50-student batch fits in the free tier."

Quizotic is a Kahoot/Mentimeter alternative built for Indian classrooms. AI-generated quizzes, Bloom's tagging, English+Hindi, 50 free participants per session. No install, no subscription to evaluate.

If ${s.name} wants me to set up one teacher free for a unit test or term revision, I'll handle the onboarding myself.

10-second look: https://www.quizotic.live

${SIGNATURE}`
};
const VARIANT_ROTATION = ['A', 'A', 'B', 'A', 'C', 'A']; // A 4/6, B 1/6, C 1/6

const SIGNATURE = `Mahesh Dhiman
Founder, Quizotic
linkedin.com/in/mdpixx
www.quizotic.live

You can reply STOP to opt out — no follow-ups will be sent.`;

// --- Opener templates (replace the Gemini-generated line; 6 variants) ---
function pickOpener(s, idx) {
  const openers = [
    `${s.city}'s ${s.board} schools have been absorbing more board-prep load this year than the curriculum was sized for.`,
    `End-of-term revision season hits ${s.board} schools in ${s.city} especially hard given how packed the calendar gets.`,
    `Most ${s.board} teachers I speak with in ${s.city} are juggling 50+ students per class against tools that were built for 30.`,
    `Term-end revision season is around the corner — wanted to reach you before ${s.name}'s teachers get fully booked with planning.`,
    `${s.city} has one of the steepest jumps in classroom tech adoption among ${s.board} schools this year — felt worth a quick note.`,
    `Quiz-based revision is starting to outperform textbook revision in ${s.board} classrooms — but most schools in ${s.city} are stuck on tools that cap at 40 students.`
  ];
  return openers[idx % openers.length];
}

function priorityFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function firstNameOf(rec) {
  if (!rec.principal_name) return 'there';
  const parts = String(rec.principal_name).trim().split(/\s+/);
  return parts[0] || 'there';
}

function build(records, startRowNum = 4) {
  return records.map((rec, i) => {
    const s = {
      name: rec.name,
      firstName: firstNameOf(rec),
      city: rec.city,
      board: rec.board || 'CBSE',
      opener: pickOpener({ city: rec.city, board: rec.board, name: rec.name }, i)
    };
    const subjectKey = SUBJECT_ROTATION[i % SUBJECT_ROTATION.length];
    const variantKey = VARIANT_ROTATION[i % VARIANT_ROTATION.length];
    const subject = SUBJECTS[subjectKey](s);
    const body = VARIANTS[variantKey](s);
    return {
      row_num: startRowNum + i,
      priority: priorityFromScore(rec._score),
      city: rec.city,
      school_name: rec.name,
      principal_name: '', // unknown — Apps Script template uses "there" fallback
      to_email: rec.email,
      email_confidence: rec.email_confidence ?? 50,
      subject,
      body,
      status: 'ready',
      notes: `variant=${variantKey} subject=${subjectKey}`
    };
  });
}

async function writeCsv(rows) {
  const writer = createObjectCsvWriter({
    path: OUT_CSV,
    header: HEADERS.map((id) => ({ id, title: id }))
  });
  await writer.writeRecords(rows);
  console.log(`[08-manual] Wrote ${rows.length} rows → ${OUT_CSV}`);
}

function appendToSheet(rows) {
  const values = rows.map((r) => HEADERS.map((h) => String(r[h] ?? '')));
  const params = JSON.stringify({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS'
  });
  const body = JSON.stringify({ values, majorDimension: 'ROWS' });
  const args = ['sheets', 'spreadsheets', 'values', 'append', '--params', params, '--json', body];

  if (DRY_RUN) {
    console.log('[08-manual] DRY-RUN — would append', rows.length, 'rows to', TAB);
    console.log('[08-manual] First row sample:', JSON.stringify(rows[0], null, 2).slice(0, 800));
    return;
  }
  console.log(`[08-manual] LIVE: appending ${rows.length} rows to ${TAB}...`);
  const res = spawnSync('gws', args, { encoding: 'utf8', stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`gws append failed (status ${res.status}). If auth-related, run: gws auth login`);
  }
  console.log(`[08-manual] Appended ${rows.length} rows to ${TAB}.`);
}

async function main() {
  const records = JSON.parse(fs.readFileSync(IN, 'utf8'));
  console.log(`[08-manual] Building Manual_Send rows for ${records.length} leads`);
  const rows = build(records);
  await writeCsv(rows);

  // Distribution sanity check
  const dist = { variant: {}, subject: {}, priority: {} };
  for (const r of rows) {
    const m = r.notes.match(/variant=(\w) subject=(\w+)/);
    if (m) {
      dist.variant[m[1]] = (dist.variant[m[1]] || 0) + 1;
      dist.subject[m[2]] = (dist.subject[m[2]] || 0) + 1;
    }
    dist.priority[r.priority] = (dist.priority[r.priority] || 0) + 1;
  }
  console.log('[08-manual] Distribution:', JSON.stringify(dist, null, 2));

  appendToSheet(rows);

  if (DRY_RUN) {
    console.log('\n[08-manual] DRY-RUN complete. Re-run with --confirm to actually append.');
  } else {
    console.log(`\n[08-manual] Done. Reload the Sheet → click Quizotic Send → Send next 10 ready.`);
  }
}

main().catch((err) => {
  console.error('[08-manual] Fatal:', err);
  process.exit(1);
});
