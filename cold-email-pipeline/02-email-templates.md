# Email Templates + Subject Lines + Gemini Personalization Prompt

These templates power the cold-send workflow. The Code node inside the workflow picks a `variant` (A/B/C) and a `subject` (1-4) per row, substitutes the Gemini-generated `opener`, and produces the final email body.

Editing tips:
- Keep `<<placeholders>>` exact — the Code node does string replace on these tokens
- Don't add tracking pixels to v1 (hurts deliverability)
- Don't add URL shorteners (Gmail flags `bit.ly` etc as spam)
- Keep total body length 180–280 words — Indian B2B sweet spot

---

## Subject Lines (4 — round-robin)

```
S1: Quick one for <<school_name>>'s teachers
S2: Free Kahoot alternative built for Indian classrooms
S3: <<first_name>> — 30-second look at Quizotic?
S4: Saw <<school_name>> on UDISE — worth your 30 seconds
```

S4 historically tops cold B2B replies for Indian schools — references the source they trust.

`first_name` falls back to "there" if `principal_name` is blank.

---

## Variant A — Short utility pitch (200 words)

```
Hi <<first_name>>,

<<gemini_opener>>

I'm Mahesh — building Quizotic.live, a Kahoot/Mentimeter alternative
for Indian classrooms. Free for the first 50 students per session
(Kahoot caps at 40 — and your classes are bigger than that).

Live quizzes, spaced retrieval for revision, AI-generated questions
in English & Hindi, Bloom's taxonomy tagging. No app install — runs
in any browser.

If a teacher at <<school_name>> wants to try it for one unit test or
revision class, I'll set them up free and personally help.

Quick look: https://www.quizotic.live
30-sec demo: https://www.quizotic.live/demo

Worth a forward to one teacher?

Mahesh Dhiman
Founder, Quizotic
+91 — <<your phone>>
linkedin.com/in/mdpixx
```

---

## Variant B — Peer-founder narrative (240 words)

```
Hi <<first_name>>,

<<gemini_opener>>

Quick context — I run L&D at India's largest oil company by day, and
I've been frustrated that Indian teachers are stuck using American
quiz tools at American prices. Kahoot's free tier maxes at 40 kids;
Mentimeter's "Pro" is ₹2,000/month per teacher. Your typical class
is 50–60 students.

So I built Quizotic.live — same live-quiz mechanic, same spaced
retrieval, AI-generated questions in English/Hindi, but free for the
first 50 participants. Forever.

I'm not VC-funded, I'm not selling subscriptions hard, and I'm not
running a sales team. I just want Indian teachers to have a tool
built for their classrooms.

If <<school_name>> is interested, I'll personally onboard one or two
teachers free — no card, no contract, no follow-up calls.

Site: https://www.quizotic.live

Genuinely curious what you'd want a tool like this to do — even if
you don't try it, your honest feedback would mean a lot.

Mahesh Dhiman
Founder, Quizotic
linkedin.com/in/mdpixx
```

---

## Variant C — Case-study-format (220 words)

```
Hi <<first_name>>,

<<gemini_opener>>

A few coaching-institute teachers in <<city>> have started using
Quizotic.live for weekly revision tests. One of them put it like this:
"Kahoot is fun for fresher batches, but for serious revision I needed
spaced retrieval. Quizotic does both, and my 50-student batch fits in
the free tier."

Quizotic is a Kahoot/Mentimeter alternative I built for Indian
classrooms. AI-generated quizzes, Bloom's tagging, English+Hindi,
50 free participants per session. No install, no subscription
to evaluate.

If <<school_name>> wants me to set up one teacher free for a unit
test or term revision, I'll handle the onboarding myself.

10-second look: https://www.quizotic.live

Mahesh Dhiman
Founder, Quizotic
linkedin.com/in/mdpixx
```

---

## Gemini Personalization Prompt

This prompt runs once per lead inside the cold-send workflow's HTTP Request → Gemini node. Output replaces `<<gemini_opener>>` in whichever variant is chosen.

Model: `gemini-2.5-flash` (free tier — 1500 calls/day)

```text
You are writing the OPENING SENTENCE of a personalized cold email
to a school principal in India.

INPUT:
- Principal name: {{ $json.principal_name }}
- School name: {{ $json.school_name }}
- City: {{ $json.city }}
- Board: {{ $json.board }}
- About the school: {{ $json.about_text }}
- Recent news (if any): {{ $json.recent_news }}

WRITE ONE SENTENCE (max 22 words) that proves the sender did genuine
research. The sentence will be the SECOND line of the email — right
after "Hi <Name>,".

RULES:
- Don't compliment ("impressive school", "great work")
- Don't open with "I came across..." or "I noticed..."
- Don't be salesy
- Don't mention Quizotic or any product
- Reference ONE specific, verifiable detail (a board, a city,
  a recent achievement, an "About" detail). If nothing specific is
  available, write a neutral peer-to-peer line that references the
  city or the board.
- Sound like a peer educator writing to another educator
- No emojis, no exclamation marks
- One sentence only. No greeting, no period missing, no quotes around
  the output

OUTPUT FORMAT:
Just the sentence itself. Nothing else. No quotes, no labels,
no preamble.

EXAMPLES (good):
- "Saw <<school_name>> is one of the few CBSE schools in <<city>>
   running a structured spaced-revision program — rare in this region."
- "<<board>> schools in <<city>> are absorbing way more board-prep
   load this year than the curriculum was sized for."
- "Coming up to term-end revision season — wanted to reach you while
   <<school_name>>'s teachers still have planning bandwidth."

EXAMPLES (bad — do not output):
- "I came across <<school_name>>..." [banned phrase]
- "Your school is doing impressive work..." [compliment]
- "Quizotic is a..." [product mention]
- "Hi <<name>>, I noticed..." [includes greeting]
```

If Gemini returns anything that looks like a banned phrase or a multi-sentence response, the Code node falls back to a safe default:

```
Term-end revision season is around the corner — wanted to reach you
before <<school_name>>'s teachers get fully booked with planning.
```

---

## Email signature (replace `<<your phone>>` once)

The Code node will use this signature at the bottom of every email:

```
Mahesh Dhiman
Founder, Quizotic
+91 <<your phone>>
linkedin.com/in/mdpixx
www.quizotic.live

You can reply STOP to opt out — no follow-ups will be sent.
```

The "reply STOP" line is your DPDP-compliant unsubscribe until the proper `/api/unsubscribe` route ships in stage 2. The reply-watch workflow looks for the word "STOP" (case-insensitive) and auto-adds the lead to the Suppression tab.
