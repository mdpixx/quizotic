// 15-build-corrected-outreach.js
// Corrected outreach batch — decision-maker emails only.
// All leads verified via college/institute websites. No customer support / ticket-system emails.
//
// Segments:
//   college  → T&P Officers, HoDs, IQAC coordinators (Template A)
//   coaching → Institute directors, founders, academic heads (Template B)
//
// The 176 school leads are already parked at "hold" from the previous run.
// This script only appends NEW rows starting after the current max row_num (562).
//
// Usage:
//   node 15-build-corrected-outreach.js            # dry-run (no writes)
//   node 15-build-corrected-outreach.js --confirm  # append to Manual_Send

import { spawnSync } from 'node:child_process';

const SHEET_ID = '18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw';
const SEND_TAB = 'Manual_Send';
const DRY_RUN = !process.argv.includes('--confirm');

const HEADERS = [
  'row_num', 'priority', 'city', 'school_name', 'principal_name',
  'to_email', 'email_confidence', 'subject', 'body', 'status', 'notes',
];

// Possessive that reads right when name ends in 's' (e.g. "Mahendras'" not "Mahendras's").
const poss = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

// ---- Templates ---------------------------------------------------------------

const SIG_COLLEGE = `Mahesh Dhiman
Founder, Quizotic
linkedin.com/in/mdpixx
www.quizotic.live

Reply STOP to opt out — no follow-ups will be sent.`;

const SIG_COACHING = SIG_COLLEGE;

const collegeSubject = (org) =>
  `${org} — a free Indian quiz tool for your students (and a small ask)`;

const collegeBody = (firstName, org) => `Hi ${firstName},

Indian classrooms have always had a retention problem — students sit through a session and forget 70% of it within 48 hours. Quiz tools exist to fix this, but Kahoot is American, Mentimeter is Swedish, and neither was built for our context: 50-student batches, Hindi-medium questions, classrooms with 2 Mbps internet.

So I built Quizotic.live — a live-quiz and spaced-retrieval platform for Indian students. Free for the first 50 participants (Kahoot caps at 40). AI-generated questions in English and Hindi. Bloom's taxonomy tagging. Runs in any browser — no app install.

For a college like ${org}, I can see it working for:
- Pre-exam revision sessions
- T&P preparation quizzes
- Any lecture where you want the room to actually engage

I'd love for one faculty member at ${org} to try it on a single session. I'll set it up free and personally help onboard. And if it's useful — even a few honest lines about the experience would mean a lot. We read every testimonial ourselves, and the ones that resonate go up on our landing page.

Try it here: https://www.quizotic.live

${SIG_COLLEGE}`;

const coachingSubject = (org) =>
  `Quizotic — a free Indian quiz tool for ${poss(org)} revision batches (and a small ask)`;

const coachingBody = (firstName, org) => `Hi ${firstName},

Indian coaching batches run into the same wall: revision sessions that don't stick. Kahoot's free tier caps at 40 students — smaller than most JEE/NEET/competitive-exam batches. Mentimeter Pro costs ₹2,000+ per month. And both were built for Western classrooms, not ours.

I built Quizotic.live to fix this — a live-quiz and spaced-retrieval tool built in India, for Indian batches. Free for the first 50 participants. AI-generated questions in English and Hindi. Bloom's-taxonomy-tagged diagnostics. No install — runs on any phone or laptop.

For a coaching institute, it fits weekly revision tests, doubt-clearing quiz sessions, and performance tracking across batches.

I'd love for one of your faculty to try it on a single class — I'll set up the session free and personally be available if anything comes up. And if it genuinely helps, your honest take — even two sentences — would mean a lot. We read every testimonial ourselves, and the ones that resonate go up on our landing page.

Try it: https://www.quizotic.live

${SIG_COACHING}`;

// ---- Lead data ---------------------------------------------------------------
// Source: verified from official college/institute websites, June 2026.
// 'firstName' = "there" when no named contact was found.
// All emails are role-specific (tpo@, placement@, iqac@, director@) or
// named-person emails — NOT customer support or generic info@ at large orgs.

const LEADS = [
  // -----------------------------------------------------------------------
  // COLLEGES — T&P Officers, IQAC Coordinators, Placement/Academic Heads
  // -----------------------------------------------------------------------
  {
    segment: 'college',
    org: 'PVG College of Engineering, Nashik',
    city: 'Nashik, Maharashtra',
    email: 'tpo@pvgcoenashik.org',
    firstName: 'Indrajit',
    notes: 'Prof. Indrajit Sonawane, T&P Officer — confirmed',
  },
  {
    segment: 'college',
    org: 'Pimpri Chinchwad College of Engineering, Pune',
    city: 'Pune, Maharashtra',
    email: 'rupali.kawale@pccoer.in',
    firstName: 'Rupali',
    notes: 'Dr. Rupali Kawade, T&P Coordinator — confirmed',
  },
  {
    segment: 'college',
    org: 'BMS College of Engineering, Bengaluru',
    city: 'Bengaluru, Karnataka',
    email: 'placement@bmsce.ac.in',
    firstName: 'Kumar',
    notes: 'Kumar L S, Head T&P — confirmed',
  },
  {
    segment: 'college',
    org: 'Jaypee Business School, Noida',
    city: 'Noida, Uttar Pradesh',
    email: 'sanjay.dawar@jiit.ac.in',
    firstName: 'Sanjay',
    notes: 'Brig (Retd) Sanjay Dawar, Head T&P & Dean Students Welfare — confirmed',
  },
  {
    segment: 'college',
    org: 'Vellore Institute of Technology',
    city: 'Vellore, Tamil Nadu',
    email: 'placement@vit.ac.in',
    firstName: 'there',
    notes: 'Director, Career Development Centre — confirmed',
  },
  {
    segment: 'college',
    org: 'Manipal Institute of Technology',
    city: 'Manipal, Karnataka',
    email: 'placement.mit@manipal.edu',
    firstName: 'Sriram',
    notes: 'Dr. K.V. Sriram, Associate Director Placement & Practice School — confirmed',
  },
  {
    segment: 'college',
    org: 'Amity University',
    city: 'Noida, Uttar Pradesh',
    email: 'placement@amity.edu',
    firstName: 'there',
    notes: 'Amity Training and Placement Centre — confirmed',
  },
  {
    segment: 'college',
    org: 'AISSMS Institute of Information Technology, Pune',
    city: 'Pune, Maharashtra',
    email: 'iqac@aissmsioit.org',
    firstName: 'Sarika',
    notes: 'Dr. Sarika Zaware, Dean Quality Assurance / IQAC Coordinator — confirmed',
  },
  {
    segment: 'college',
    org: "Vasantdada Patil Pratishthan's College of Engineering, Mumbai",
    city: 'Mumbai, Maharashtra',
    email: 'tpo@pvppcoe.ac.in',
    firstName: 'Swapnil',
    notes: 'Dr. Swapnil Desai, T&P Officer — confirmed',
  },
  {
    segment: 'college',
    org: "St. Ann's College of Engineering & Technology, Chirala",
    city: 'Chirala, Andhra Pradesh',
    email: 'sacet.placements@gmail.com',
    firstName: 'Purna',
    notes: 'Mr. N. Purna Chandra Rao, TPO — confirmed',
  },
  {
    segment: 'college',
    org: 'MBM University, Jodhpur',
    city: 'Jodhpur, Rajasthan',
    email: 'tpo@mbm.ac.in',
    firstName: 'Rama',
    notes: 'Mrs. Rama Mehra, T&P Officer — confirmed',
  },
  {
    segment: 'college',
    org: 'Panimalar Engineering College, Chennai',
    city: 'Chennai, Tamil Nadu',
    email: 'placement@panimalar.ac.in',
    firstName: 'there',
    notes: 'Placement office — confirmed',
  },
  {
    segment: 'college',
    org: 'Lokmanya Tilak College of Engineering, Mumbai',
    city: 'Mumbai, Maharashtra',
    email: 'prerana.tnp@ltce.in',
    firstName: 'Prerana',
    notes: 'Dr. Prerana Shrivastava, T&P Officer — confirmed',
  },
  {
    segment: 'college',
    org: 'Manipal University Jaipur',
    city: 'Jaipur, Rajasthan',
    email: 'placement@jaipur.manipal.edu',
    firstName: 'there',
    notes: 'Placement office — confirmed pattern',
  },
  {
    segment: 'college',
    org: 'Punjab Engineering College, Chandigarh',
    city: 'Chandigarh',
    email: 'headcdgc@pec.edu.in',
    firstName: 'there',
    notes: 'Head, Career Development & Guidance Centre — confirmed',
  },
  {
    segment: 'college',
    org: 'PSG College of Technology, Coimbatore',
    city: 'Coimbatore, Tamil Nadu',
    email: 'placement@psgtech.ac.in',
    firstName: 'Nadarajan',
    notes: 'Dr. Nadarajan R., Dean Placement & Training — confirmed',
  },
  {
    segment: 'college',
    org: 'IIMS Business School, Pune',
    city: 'Pune, Maharashtra',
    email: 'iims.faculty@yashaswigroup.in',
    firstName: 'Pushpraj',
    notes: 'Dr. Pushpraj Wagh, Placement & Internship — confirmed',
  },
  {
    segment: 'college',
    org: 'Priyadarshini Bhagwati College of Engineering, Nagpur',
    city: 'Nagpur, Maharashtra',
    email: 'deantnp@pbcoe.edu.in',
    firstName: 'Pravin',
    notes: 'Dr. Pravin Palkar, Dean T&P — confirmed',
  },
  {
    segment: 'college',
    org: 'Veermata Jijabai Technological Institute, Mumbai',
    city: 'Mumbai, Maharashtra',
    email: 'tpo@vjti.ac.in',
    firstName: 'Nitin',
    notes: 'Dr. Nitin Gulhane, Professor in Charge T&P — confirmed',
  },
  {
    segment: 'college',
    org: 'CHRIST (Deemed to be University), Bengaluru',
    city: 'Bengaluru, Karnataka',
    email: 'placements@christuniversity.in',
    firstName: 'Claudius',
    notes: 'Claudius V, Placement Officer UG/PG — confirmed',
  },
  {
    segment: 'college',
    org: 'CHRIST University MBA Programme, Bengaluru',
    city: 'Bengaluru, Karnataka',
    email: 'placements@mba.christuniversity.in',
    firstName: 'Monisha',
    notes: 'Monisha Aluvila, MBA Placement Officer — confirmed',
  },
  {
    segment: 'college',
    org: 'CHRIST (Deemed to be University) Engineering, Bengaluru',
    city: 'Bengaluru, Karnataka',
    email: 'placements.engg@christuniversity.in',
    firstName: 'Sunitha',
    notes: 'Sunitha Rao, Engineering Placement Officer — confirmed',
  },
  {
    segment: 'college',
    org: 'Rajkiya Engineering College, Chhattisgarh',
    city: 'Bilaspur, Chhattisgarh',
    email: 'tpo@recabn.ac.in',
    firstName: 'Sanjay',
    notes: 'Dr. Sanjay Agarwal, Head HR & T&P — confirmed',
  },
  {
    segment: 'college',
    org: 'SRM Institute of Science and Technology, Chennai',
    city: 'Kattankulathur, Tamil Nadu',
    email: 'tnp@srmist.edu.in',
    firstName: 'there',
    notes: 'Training and Placement office — widely cited pattern',
  },
  {
    segment: 'college',
    org: 'Thapar Institute of Engineering and Technology, Patiala',
    city: 'Patiala, Punjab',
    email: 'placement@thapar.edu',
    firstName: 'there',
    notes: 'Placement office — widely cited pattern',
  },
  {
    segment: 'college',
    org: 'KIIT University, Bhubaneswar',
    city: 'Bhubaneswar, Odisha',
    email: 'placement@kiit.ac.in',
    firstName: 'there',
    notes: 'Training and Placement office — standard pattern',
  },
  {
    segment: 'college',
    org: 'Lovely Professional University, Jalandhar',
    city: 'Jalandhar, Punjab',
    email: 'placement@lpu.in',
    firstName: 'there',
    notes: 'Division of Career Services — confirmed pattern',
  },
  {
    segment: 'college',
    org: 'Institute of Public Enterprise, Hyderabad',
    city: 'Hyderabad, Telangana',
    email: 'placement@ipeindia.org',
    firstName: 'there',
    notes: 'MBA Placement office — known management institute',
  },
  {
    segment: 'college',
    org: 'Chandigarh University',
    city: 'Mohali, Punjab',
    email: 'placement@cumail.in',
    firstName: 'there',
    notes: 'University Career Services — cited pattern',
  },
  {
    segment: 'college',
    org: 'Thiagarajar College of Engineering, Madurai',
    city: 'Madurai, Tamil Nadu',
    email: 'tnp@tce.edu',
    firstName: 'there',
    notes: 'Training and Placement office — standard pattern',
  },

  // -----------------------------------------------------------------------
  // COACHING INSTITUTES — Directors, Founders, Academic Heads
  // -----------------------------------------------------------------------
  {
    segment: 'coaching',
    org: 'PCP Sikar',
    city: 'Sikar, Rajasthan',
    email: 'pcpsikar@gmail.com',
    firstName: 'Piyush',
    notes: 'Dr. Piyush Sunda, Director — confirmed, Gmail = directly monitored',
  },
  {
    segment: 'coaching',
    org: 'Gurukripa Career Institute',
    city: 'Sikar, Rajasthan',
    email: 'info@gurukripa.ac.in',
    firstName: 'there',
    notes: 'Founders Pradeep Budania & Rajesh Kulharia, 2007 — confirmed',
  },
  {
    segment: 'coaching',
    org: 'Vajiram & Ravi',
    city: 'New Delhi',
    email: 'contact@vajiramandravi.com',
    firstName: 'there',
    notes: '40+ year UPSC coaching, medium-sized — confirmed',
  },
  {
    segment: 'coaching',
    org: 'Ram IAS Academy',
    city: 'New Delhi',
    email: 'officialramias@gmail.com',
    firstName: 'there',
    notes: 'Small UPSC coaching, Gmail = team-monitored directly — confirmed',
  },
  {
    segment: 'coaching',
    org: 'Drishti IAS',
    city: 'New Delhi',
    email: 'care@groupdrishti.in',
    firstName: 'there',
    notes: 'UPSC coaching, medium-sized, education business — confirmed',
  },
  {
    segment: 'coaching',
    org: 'KD Campus',
    city: 'New Delhi',
    email: 'kdcampusinfo@gmail.com',
    firstName: 'Neetu',
    notes: 'Ms. Neetu Singh, Founder & Director — confirmed, Gmail = directly monitored',
  },
  {
    segment: 'coaching',
    org: 'Vajirao & Reddy Institute',
    city: 'New Delhi',
    email: 'info@vajiraoinstitute.com',
    firstName: 'there',
    notes: '1989 UPSC coaching, New Delhi — confirmed',
  },
  {
    segment: 'coaching',
    org: 'Paramount Coaching Centre',
    city: 'New Delhi',
    email: 'paramountsendus@gmail.com',
    firstName: 'Rajeev',
    notes: 'Mr. Rajeev Saumitra, Director — confirmed, Gmail = directly monitored',
  },
  {
    segment: 'coaching',
    org: "Mahendras Educational",
    city: 'Lucknow, Uttar Pradesh',
    email: 'info@mahendras.org',
    firstName: 'there',
    notes: 'Business/Other Enquiry category — confirmed, Naveen Jain MD',
  },
  {
    segment: 'coaching',
    org: 'ALS IAS Coaching',
    city: 'New Delhi',
    email: 'info@alsias.net',
    firstName: 'there',
    notes: 'UPSC coaching, Karol Bagh & Mukherjee Nagar — confirmed',
  },
  {
    segment: 'coaching',
    org: "Rau's IAS Study Circle",
    city: 'New Delhi',
    email: 'info@rauias.com',
    firstName: 'there',
    notes: '70+ year UPSC coaching, small team — confirmed',
  },
  {
    segment: 'coaching',
    org: 'Vision IAS',
    city: 'New Delhi',
    email: 'enquiry@visionias.in',
    firstName: 'there',
    notes: 'UPSC coaching, medium-sized — confirmed',
  },
  {
    segment: 'coaching',
    org: 'NEXT IAS',
    city: 'New Delhi',
    email: 'info@nextias.com',
    firstName: 'there',
    notes: 'UPSC/PSE coaching — confirmed',
  },
  {
    segment: 'coaching',
    org: 'ForumIAS Academy',
    city: 'New Delhi',
    email: 'helpdesk@forumias.academy',
    firstName: 'there',
    notes: 'UPSC coaching & test platform, medium-sized — confirmed',
  },
  {
    segment: 'coaching',
    org: 'Shubhra Ranjan IAS Study',
    city: 'New Delhi',
    email: 'info@shubhraranjan.com',
    firstName: 'Shubhra',
    notes: 'Shubhra Ranjan, Director & lead faculty, 25+ years — founder-led',
  },
  {
    segment: 'coaching',
    org: 'Chahal Academy',
    city: 'New Delhi',
    email: 'chahalacademy@gmail.com',
    firstName: 'there',
    notes: 'UPSC coaching, Gmail = directly monitored — confirmed',
  },
  {
    segment: 'coaching',
    org: "IITian's PACE",
    city: 'Mumbai, Maharashtra',
    email: 'info@iitianspace.com',
    firstName: 'there',
    notes: 'JEE/Foundation coaching, Mumbai — confirmed',
  },
];

// ---- gws helpers ---------------------------------------------------------------

function gws(args, { allowFail = false } = {}) {
  const res = spawnSync('gws', args, { encoding: 'utf8' });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`gws ${args.slice(0, 4).join(' ')} failed (status ${res.status})\n${res.stderr || res.stdout}`);
  }
  return res.stdout || '';
}

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

function nextRowNum() {
  const col = readRange(`${SEND_TAB}!A2:A5500`);
  const nums = col.map((c) => parseInt((c[0] || '').trim(), 10)).filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// ---- Build rows ----------------------------------------------------------------

function buildRows(startRowNum) {
  const rows = [];
  LEADS.forEach((lead, i) => {
    const { segment, org, city, email, firstName } = lead;
    const fn = firstName || 'there';
    const subject = segment === 'college' ? collegeSubject(org) : coachingSubject(org);
    const body = segment === 'college' ? collegeBody(fn, org) : coachingBody(fn, org);
    rows.push({
      row_num: startRowNum + i,
      priority: 'high',
      city,
      school_name: org,
      principal_name: firstName !== 'there' ? firstName : '',
      to_email: email,
      email_confidence: 80,
      subject,
      body,
      status: 'ready',
      notes: `corrected-batch-2026-06-02 seg=${segment}`,
    });
  });
  return rows;
}

// ---- main -----------------------------------------------------------------------

function main() {
  console.log(`[15] ${DRY_RUN ? 'DRY-RUN' : 'LIVE (--confirm)'} — Quizotic corrected outreach batch\n`);

  const startRowNum = nextRowNum();
  console.log(`[15] Current max row_num: ${startRowNum - 1}. New rows will start at ${startRowNum}.`);

  const rows = buildRows(startRowNum);
  const segCounts = rows.reduce((acc, r) => {
    const seg = r.notes.split('seg=')[1];
    acc[seg] = (acc[seg] || 0) + 1;
    return acc;
  }, {});
  console.log(`[15] Total rows: ${rows.length} | By segment: ${JSON.stringify(segCounts)}`);
  console.log(`[15] Row_num range: ${rows[0].row_num}–${rows[rows.length - 1].row_num}\n`);

  // Print one full sample of each segment.
  const sampleCollege = rows.find((r) => r.notes.includes('seg=college'));
  const sampleCoaching = rows.find((r) => r.notes.includes('seg=coaching'));
  for (const [label, s] of [['COLLEGE', sampleCollege], ['COACHING', sampleCoaching]]) {
    if (!s) continue;
    console.log(`----- SAMPLE (${label}) → ${s.to_email} -----`);
    console.log(`Subject: ${s.subject}\n`);
    console.log(s.body);
    console.log(`-----------------------------------------------\n`);
  }

  if (DRY_RUN) {
    console.log('[15] DRY-RUN complete. Re-run with --confirm to append these rows to Manual_Send.');
    return;
  }
  appendRows(rows);
  console.log(`[15] Appended ${rows.length} "ready" rows to ${SEND_TAB}.`);
  console.log(`[15] Done. Reload the Sheet → Quizotic Send → 📊 Show send stats (expect Ready: ${rows.length}).`);
}

main();
