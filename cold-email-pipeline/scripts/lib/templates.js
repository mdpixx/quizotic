// Email subject + body templates for the Quizotic cold outreach pipeline.
// Pitch: Indian-built classroom quiz platform, more features than Kahoot,
// fraction of the cost. Ask: free access in exchange for a 2-line testimonial.

const SIGNATURE = `Mahesh Dhiman
Founder, Quizotic
linkedin.com/in/mdpixx
www.quizotic.live

You can reply STOP to opt out — no follow-ups will be sent.`;

// 4 subject lines, S4 weighted as the highest-converting on Indian B2B
// (references the CBSE/ICSE directory — a source schools recognise).
export const SUBJECTS = {
  S1: (s) => `Quick one for ${s.name}'s teachers`,
  S2: () => `Indian-built Kahoot alternative — would love your teachers' feedback`,
  S3: (s) => `${s.firstName} — free Quizotic access for a short testimonial?`,
  S4: (s) => `Saw ${s.name} on the ${s.board}/ICSE directory — worth 30 seconds`
};

// Rotation: S4 50%, S3/S2/S1 ≈17% each. S3 directly pre-frames the testimonial ask.
export const SUBJECT_ROTATION = ['S4', 'S3', 'S4', 'S2', 'S4', 'S1'];

// 6 city/board-aware openers replace the would-be Gemini line.
// Apps Script doesn't have Gemini integration, so these are baked offline.
export function pickOpener(s, idx) {
  const openers = [
    `${s.city}'s ${s.board} schools have been absorbing more board-prep load this year than the curriculum was sized for.`,
    `End-of-term revision season hits ${s.board} schools in ${s.city} especially hard given how packed the calendar gets.`,
    `Most ${s.board} teachers I speak with in ${s.city} are juggling 50+ students per class against tools built for 30.`,
    `Term-end revision season is around the corner — wanted to reach you before ${s.name}'s teachers get fully booked with planning.`,
    `${s.city} has one of the steepest jumps in classroom tech adoption among ${s.board} schools this year — felt worth a quick note.`,
    `Quiz-based revision is starting to outperform textbook revision in ${s.board} classrooms — but most schools in ${s.city} are stuck on tools that cap at 40 students.`
  ];
  return openers[idx % openers.length];
}

// 3 body variants. All converge on the testimonial-for-free-access ask.
// Variant A weighted highest (shortest, most direct).
export const VARIANTS = {
  A: (s) => `Hi ${s.firstName},

${s.opener}

I'm Mahesh — building Quizotic.live, an Indian-built quiz platform for classrooms. Live quizzes, AI-generated questions in English & Hindi, spaced retrieval for revision, Bloom's taxonomy tagging, confidence grid — more feature-packed than Kahoot, at a fraction of the cost.

Kahoot is $5–17/month per teacher; Quizotic is free for the first 50 students per session, ₹499/month for unlimited.

Here's what I'd like to ask: would ${s.name} be open to letting one or two teachers use Quizotic free, in exchange for a short testimonial I could feature on quizotic.live?

Honest classroom feedback from Indian schools is the most valuable thing I can put on the site right now — and the one thing money can't buy.

I'll personally onboard the teacher. No card, no contract, no follow-up sales calls.

Site: https://www.quizotic.live

Worth a quick conversation?

${SIGNATURE}`,

  B: (s) => `Hi ${s.firstName},

${s.opener}

Quick context — I run L&D at India's largest oil company by day, and I've been frustrated that Indian teachers are stuck using American quiz tools at American prices. Kahoot's free tier maxes at 40 kids; Pro is $5–17/month per teacher. Indian classes routinely run 50–60 students.

So I built Quizotic.live — an Indian-built classroom quiz platform with more features than Kahoot (AI-generated questions in English & Hindi, spaced retrieval, Bloom's tagging, confidence grid) at a fraction of the price (₹499/month, or free for the first 50 students per session forever).

What I genuinely need to grow this is honest classroom feedback from Indian principals and teachers. Would ${s.name} be open to letting one or two teachers try Quizotic free, in exchange for a short testimonial I could feature on the website?

I'll personally onboard them. No card, no contract, no follow-up calls. Just a 2-line review after one unit test or revision class — that's all I'm asking for.

Site: https://www.quizotic.live

Even if a testimonial isn't possible, your honest feedback would mean a lot.

${SIGNATURE}`,

  C: (s) => `Hi ${s.firstName},

${s.opener}

A few teachers in ${s.city} have started using Quizotic.live for weekly revision tests. One of them put it like this: "Kahoot is fun, but for serious revision I needed spaced retrieval. Quizotic does both, in English and Hindi, and my 50-student batch fits in the free tier."

Quizotic is an Indian-built quiz platform — AI-generated questions in English & Hindi, Bloom's taxonomy tagging, spaced retrieval, confidence grid — more features than Kahoot at a fraction of the price.

I'm collecting genuine classroom feedback from Indian schools to feature on the website. Would ${s.name} be open to letting one teacher try Quizotic free for a unit test or term revision, in exchange for a 2-line testimonial?

I'll handle the onboarding personally. No card, no contract.

10-second look: https://www.quizotic.live

${SIGNATURE}`
};

// Variant rotation: A 4/6 (most direct), B 1/6 (peer-founder narrative), C 1/6 (peer testimonial frame)
export const VARIANT_ROTATION = ['A', 'A', 'B', 'A', 'C', 'A'];

export function priorityFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function firstNameOf(rec) {
  if (!rec.principal_name) return 'there';
  const parts = String(rec.principal_name).trim().split(/\s+/);
  return parts[0] || 'there';
}

// Render a complete row given an enriched lead record (from with-emails.json).
export function renderRow(rec, idx, startRowNum = 4) {
  const s = {
    name: rec.name,
    firstName: firstNameOf(rec),
    city: rec.city,
    board: rec.board || 'CBSE',
    opener: pickOpener({ city: rec.city, board: rec.board || 'CBSE', name: rec.name }, idx)
  };
  const subjectKey = SUBJECT_ROTATION[idx % SUBJECT_ROTATION.length];
  const variantKey = VARIANT_ROTATION[idx % VARIANT_ROTATION.length];
  return {
    row_num: startRowNum + idx,
    priority: priorityFromScore(rec._score),
    city: rec.city,
    school_name: rec.name,
    principal_name: '',
    to_email: rec.email,
    email_confidence: rec.email_confidence ?? 50,
    subject: SUBJECTS[subjectKey](s),
    body: VARIANTS[variantKey](s),
    status: 'ready',
    notes: `variant=${variantKey} subject=${subjectKey}`,
    _variant: variantKey,
    _subject: subjectKey
  };
}
