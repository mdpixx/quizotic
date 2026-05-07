# Google Sheet Schema — Quizotic Leads

**Status:** ✅ Provisioned via `gws sheets spreadsheets create`.

- **Sheet ID:** `18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw`
- **URL:** https://docs.google.com/spreadsheets/d/18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw/edit
- **Owner:** dhiman.mahesh@gmail.com (the Google account behind n8n credential `bInl0B94VLYhpItp`)
- **All 6 tabs created** with headers, frozen row 1, bold + grey-highlighted header row, and dropdown validations on status/variant/subject/handled/reason columns.
- **Both n8n workflows already point at this Sheet ID** — no manual paste needed.

---

## Tab 1 — `Leads_Raw`
Lands directly from Apify / UDISE+ scrapers. Minimal validation.

Paste this row 1 verbatim:
```
id	school_name	city	state	board	address	phone	website	google_rating	review_count	source	date_added	status
```

Defaults / formulas:
- `id`: `=ROW()-1` (auto-row index) or generate UUID via Apps Script if scaling
- `status`: leave blank on import; enrich workflow flips to "raw" → "enriched" → "needs-manual"
- `source`: text — UDISE / Maps / Justdial / Manual

Manual import workflow: paste CSV exports from each scraper directly into this tab.

---

## Tab 2 — `Leads_Enriched`
Output of the enrichment workflow (stage 2). Manual rows can also be pasted here directly if you skip enrichment.

Headers:
```
id	school_name	city	state	board	principal_name	email	email_confidence	email_source	phone	website	about_text	recent_news	enriched_at	status
```

- `email_confidence`: 0–100 (Hunter returns this; pattern guesses default to 50)
- `email_source`: hunter / apollo / pattern / manual
- `about_text`: first 200 chars from website meta description
- `recent_news`: 1 headline if SerpAPI / Google News returned anything in last 90 days
- `status`: enriched / needs-manual / suppressed

---

## Tab 3 — `Send_Queue`
The hot tab the cold-send workflow reads from every weekday at 9 AM IST.

Headers:
```
id	school_name	city	state	board	principal_name	email	about_text	recent_news	variant	subject	sequence_step	scheduled_for	status
```

- `variant`: A / B / C (round-robin or manual)
- `subject`: chosen from the 4 templates (or auto-rotate)
- `sequence_step`: 0 = intro, 1 = bump, 2 = breakup
- `scheduled_for`: YYYY-MM-DD (workflow only sends rows where `scheduled_for <= today`)
- `status`: pending / sent / skipped / failed

Move rows here from `Leads_Enriched` once you're ready to send.

---

## Tab 4 — `Sent_Log`
Append-only log of every email sent. Cold-send workflow writes here after each successful Gmail API send.

Headers:
```
log_id	lead_id	email	thread_id	message_id	sent_at	variant	subject	sequence_step	status	gmail_label
```

- `thread_id`: Gmail thread ID — needed for follow-ups + reply detection
- `message_id`: Gmail message ID
- `sent_at`: ISO timestamp (UTC)
- `status`: sent / bounced / replied / closed
- `gmail_label`: name of label applied (e.g. `Quizotic-Cold/Sent`)

Reply-watch workflow flips `status` to `replied` when a thread gets a new inbound message.

---

## Tab 5 — `Replies`
Warm leads who replied. Reply-watch workflow appends here.

Headers:
```
reply_id	lead_id	email	school_name	thread_id	replied_at	reply_snippet	handled	notes
```

- `handled`: yes / no — flip to yes after you respond manually
- `reply_snippet`: first 200 chars of the reply body
- `notes`: free-text after you've talked to them

---

## Tab 6 — `Suppression`
Do-not-contact list. Cold-send workflow checks this before every send and skips matches.

Headers:
```
email	school_name	reason	date_added
```

- `reason`: unsub / bounce / complaint / manual
- Once `/api/unsubscribe` is built (deferred to stage 2), it'll auto-append here.

---

## Setup checklist

- [ ] Create Sheet titled "Quizotic Leads" in Google Drive
- [ ] Add 6 tabs with the exact names above (case-sensitive)
- [ ] Paste each tab's header row verbatim into row 1
- [ ] Freeze row 1 (View → Freeze → 1 row) on each tab
- [ ] Bold row 1 (visual aid only)
- [ ] Apply data validation on `status` columns (Data → Data validation → List of items)
  - Leads_Raw.status: `raw, enriched, needs-manual, suppressed`
  - Send_Queue.status: `pending, sent, skipped, failed`
  - Sent_Log.status: `sent, bounced, replied, closed`
- [ ] Copy Sheet URL — extract the long string between `/d/` and `/edit` — that's your `documentId`
- [ ] Share Sheet with the Google account behind n8n credential `bInl0B94VLYhpItp` (already done if it's your own account)
- [ ] Paste 5 test rows into `Send_Queue` (your own email, status=pending) for a dry-run before going live
