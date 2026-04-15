# Mentimeter Features — Raw Research Dump
_Collected: April 2026 | Source: Public pages only_

---

## Question / Interaction Types (Full List — 13 confirmed)

### Poll / Survey Types
1. **Multiple Choice** — single or multi-correct, graded or ungraded, layout options (bars, donut, etc.)
2. **Word Cloud** — 25-char limit per word, common words grow larger; moderation to remove words
3. **Open Ended** — free text, up to 250 chars; AI grouping of responses
4. **Scales** — Likert-style, 1–10 range, spider map variant available
5. **Ranking** — drag-to-rank ordering of items
6. **100 Points** — allocate 100 points across up to 20 options, 150-char limit per item; bar chart result
7. **2×2 Grid** — place items on X/Y axes against two competing values
8. **Pin on Image** — audience pins a blue dot on any part of a presenter-uploaded image
9. **Quick Form** — Pro-only; collects text, checkbox, date fields anonymously
10. **Who Will Win** — responses hidden until presenter reveals the winner (trophy reveal mechanic)
11. **Q&A** — audience submits questions anytime; upvote to surface popular questions

### Quiz Types (Competition Mode)
12. **Select Answer** — timed multiple choice; speed-based or accuracy-only scoring; 500–1000 pts
13. **Type Answer** — freetext quiz answer; case-insensitive matching; manual override by presenter

### Content (Non-interactive) Slides
- **Text Slide**
- **Image Slide**
- **Video Slide**
- **Instruction Slide**

---

## Slide Editor Capabilities

- Drag-and-drop presentation builder
- Import: .ppt, .pptx, .key, .pdf files (Basic plan and above)
- Embed PowerPoint decks within Mentimeter (Pro)
- Embed Google Slides within Mentimeter (Pro)
- PowerPoint Add-in available on Microsoft AppSource (create Menti slides inside PowerPoint)
- Up to 100 slides per presentation (performance cap)
- Mentimote: remote control from any device while presenting
- Reactions can be added to content slides

## Themes & Branding
- Default theme system
- Custom branding (logo, colors, fonts) — Pro and above
- Team templates — Pro and above
- Mentimeter slides auto-match PowerPoint theme when using the add-in

## Collaboration
- Shared workspaces (team sync)
- Co-creation / multi-user editing available
- Presence feature via Ably (users see who is editing)
- Collaboration features expanded on Pro/Enterprise

## AI Features (2024–2025 launches)
- **AI Menti Builder**: prompt → full interactive draft (polls, quizzes, slides)
- **AI Question Suggestions**: type topic → AI proposes question slides
- **AI Response Grouping**: clusters freetext open-ended answers into labeled groups with one click
- **AI Quiz Generator** (dedicated feature page): generates quiz from topic input
- Responsible AI policy published at mentimeter.com/ai-at-mentimeter

## Audience Join Flow
- menti.com + 6-digit code (confirmed from UX; code visible at top of presentation)
- QR code — unique to presentation, persistent (doesn't expire even if code changes)
- Direct link — share before or during session
- No app required; pure browser-based
- Anonymous by default; presenter can toggle "participant names required"
- Named mode: participants prompted for name before joining; name stored with responses
- Any device: phone, laptop, tablet

## Real-Time Engine
- **Ably** is the real-time infrastructure provider (confirmed by CTO Johan Bengtsson in Ably case study)
- Previous provider crashed at ~35,000 concurrent connections; migrated to Ably
- Current capacity: 70,000+ concurrent per event; target: 150,000+
- Presence feature (Ably) used for collaborative editing awareness
- Frontend: React
- Backend: Ruby + Node.js
- Analytics pipeline: AWS Kinesis
- Databases: PostgreSQL, Redis (Redis Cloud), Heroku Postgres
- Cloud: Heroku, AWS (CloudFront, S3, Lambda, SQS, SNS, Redshift)
- CDN: Amazon CloudFront, imgix
- DevOps: Kubernetes, GitHub
- Monitoring: Logentries, Librato
- Analytics/Marketing: Mixpanel, Customer.io, Intercom, Redux

## Quiz Competition Mode Details
- Two question types: Select Answer + Type Answer
- Scoring: speed mode (500–1000 pts based on time) or accuracy mode (1000 pts flat for correct)
- Wrong/no answer = 0 pts
- Countdown timer per question (configurable seconds)
- Leaderboard slide: top 10, can be inserted anywhere in deck
- Quiz music: multiple gameshow-style tracks
- Manual answer override during live session (presenter can correct mismatches)
- Excel export of all participant quiz results (Basic plan and above)

## Reports & Export
- Results analysis view (post-session)
- AI-powered response grouping in results
- Export to Excel/CSV (Basic plan and above for quiz results)
- PDF export of presentation
- Screenshot export
- Trend analysis and progress tracking
- PowerPoint export not confirmed explicitly

## Integrations (all require paid plan)
- Microsoft Teams
- Zoom
- PowerPoint (add-in)
- Google Slides (embed)
- Miro board embedding
- Moodle, Canvas, Blackboard (LMS — listed but noted as incomplete)
- Hopin (events platform)

## Async / Survey Mode
- Survey mode: participants move through slides at own pace (no live host needed)
- Share via link; responses collected asynchronously
- Results viewable as they arrive
- Embeddable in LMS documents

## API
- Developer portal: developer.mentimeter.com
- API reference exists; authentication method not publicly detailed in crawlable docs
- SCIM provisioning: Enterprise only (add/remove members via identity provider)
- API access tier: likely Basic+ or Enterprise; not explicitly confirmed in public docs

## Competitive Weaknesses (noted by Wooclap review)
- Annual billing only (no monthly); one-time event pricing starts at $350
- Free plan: 50 participants/month cap is severe
- Slide imports locked to paid plans
- Limited question variety vs. educational-first competitors
- No LMS integration on free tier
- Only 13 question types vs. competitors offering 21+
