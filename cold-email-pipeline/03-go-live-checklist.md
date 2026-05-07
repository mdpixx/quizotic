# Go-Live Checklist — Quizotic Cold Email Pipeline v1

Both workflows are **deployed and validated** in your n8n instance, currently **inactive**. This checklist takes you from "deployed" to "first send" safely.

| Workflow | n8n ID | Status |
|---|---|---|
| Quizotic Cold Send v1 | `27F93liS7IAEXLwZ` | inactive (pending review) |
| Quizotic Reply Watch v1 | `lSihl9c9OxPB1wjM` | inactive (pending review) |

n8n URLs:
- Cold Send: https://n8n-production-d1a9.up.railway.app/workflow/27F93liS7IAEXLwZ
- Reply Watch: https://n8n-production-d1a9.up.railway.app/workflow/lSihl9c9OxPB1wjM

---

## Stage 0 — Prerequisites (do once, ~15 min)

### 0.1. Google Sheet — ALREADY DONE ✅
- Provisioned via `gws sheets spreadsheets create`
- Sheet ID: `18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw`
- URL: https://docs.google.com/spreadsheets/d/18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw/edit
- All 6 tabs, headers, frozen row 1, dropdowns — all configured
- Already wired into both n8n workflows

### 0.2. Generate one Google App Password for info@quizotic.live (replaces OAuth)
After hitting OAuth consent-screen issues, the pipeline now uses SMTP + IMAP with a Google App Password (no OAuth needed).
- In an **incognito** window, sign in to https://myaccount.google.com/apppasswords as `info@quizotic.live`
- Prerequisite: 2-Step Verification ON. Enable at https://myaccount.google.com/security if needed.
- App name: "n8n Quizotic" → **Create** → copy the 16-char password
- Workspace caveat: if "App passwords aren't available" appears, your Workspace admin (you, since quizotic.live is your domain) has blocked them. Fix at admin.google.com → Security → 2-Step Verification → allow App Passwords.

### 0.3. Create the two n8n credentials
In n8n → Credentials → New, create:

**Credential 1: `Gmail Quizotic SMTP`** (type: SMTP)
- User: `info@quizotic.live`
- Password: <16-char App Password>
- Host: `smtp.gmail.com`
- Port: `587`
- SSL/TLS: OFF (uses STARTTLS automatically)

**Credential 2: `Gmail Quizotic IMAP`** (type: IMAP)
- User: `info@quizotic.live`
- Password: <same 16-char App Password>
- Host: `imap.gmail.com`
- Port: `993`
- SSL/TLS: ON
- Allow self-signed certs: OFF

### 0.3. Verify existing credentials work
The workflows already reference these existing credential IDs:
| Credential | ID | Used for |
|---|---|---|
| Google Sheets account | `bInl0B94VLYhpItp` | reading/writing the Quizotic Leads sheet |
| Gemini | `PAlx2yyu6vyOAeck` | personalization openers (httpQueryAuth) |
| Telegram account | `RP8I5dms44SYX3AW` | reply alerts to chat 8227225676 |

If your Gemini credential's API key has changed since 2026-01, regenerate at https://aistudio.google.com/apikey and update it in n8n.

---

## Stage 1 — Wire up the workflows (~5 min)

Sheet ID is already bound in both workflows (`18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw`). The only manual step: bind the Gmail credential.

### 1.1. Cold Send v1
- **Send Email** node → Credential → select `Gmail Quizotic` → Save

### 1.2. Reply Watch v1
- **Gmail Trigger (every 15m)** node → Credential → select `Gmail Quizotic` → Save

---

## Stage 2 — Smoke test (~30 min, send to yourself)

### 2.1. Add 3 test rows to Send_Queue
| id | school_name | city | board | principal_name | email | sequence_step | scheduled_for | status | variant | subject |
|---|---|---|---|---|---|---|---|---|---|---|
| TEST-1 | Test School A | Mumbai | CBSE | Mahesh | dhiman.mahesh@gmail.com | 0 | 2026-05-03 | pending | A | S4 |
| TEST-2 | Test School B | Delhi | ICSE | Mahesh | dhiman.mahesh@gmail.com | 0 | 2026-05-03 | pending | B | S1 |
| TEST-3 | Test School C | Bangalore | CBSE | Mahesh | dhiman.mahesh@gmail.com | 0 | 2026-05-03 | pending | C | S3 |

(Use your own email — don't paste real lead emails until warmup is done.)

### 2.2. Manually execute Cold Send v1
- Open the workflow → click **Execute Workflow** (top right)
- Watch each node turn green
- Check `dhiman.mahesh@gmail.com` inbox for 3 emails
- Verify each email has:
  - Different subject (S4, S1, S3)
  - Different body (variants A, B, C)
  - Distinct opener line (Gemini-generated, peer-toned)
  - Signature with "reply STOP" line

### 2.3. Verify Sheet updates
- `Sent_Log` should now have 3 rows with thread_ids and message_ids
- `Send_Queue` rows should show status=`sent`

### 2.4. Smoke-test Reply Watch
- From your phone, reply to one of the test emails (any text)
- Wait up to 15 min (or manually execute Reply Watch v1)
- Check:
  - Telegram chat 8227225676 receives the alert
  - `Replies` tab has a new row
  - `Sent_Log` row for that thread shows status=`replied`
- Then reply to another test email with **just "STOP"**
- Verify:
  - `Suppression` tab gets a new row with reason=unsub
  - Telegram alert shows the ⚠️ STOP indicator

### 2.5. If anything fails
Don't activate. Fix the failing node, re-execute manually, repeat until clean. Common gotchas:
- Wrong Sheet ID → sheets nodes throw 404
- Wrong credential bound to Gmail node → 401
- Sheet header row mismatch → "column not found"
- Gemini quota hit (1500/day) → opener fallback kicks in (still sends, just less personalized)

---

## Stage 3 — Warmup (Days 1-14, NO REAL LEADS YET)

A new Gmail account sending 50 cold emails Day 1 = instant spam-folder placement, forever.

### 3.1. Pick warmup approach (choose A or B):

**Option A — Free warmup tools (stack 2× 7-day trials)**
- Mailwarm.io: 7-day free trial → connect info@quizotic.live → leave running
- Warmy.io: 7-day free trial → connect after Mailwarm trial expires
- Total cost: ₹0
- Result: ~14 days of automated send/receive/reply traffic that conditions Google's reputation algorithm

**Option B — Manual warmup**
- Day 1-3: send 5 emails/day from info@quizotic.live to friends + your personal Gmail. Ask each to REPLY.
- Day 4-7: 10/day, mix of replies + label-as-important
- Day 8-14: 20/day, include a few external contacts who'll reply

### 3.2. Validate deliverability before going live
On Day 14, send a test email from info@quizotic.live to:
- mail-tester.com (paste their unique address, then visit the site)
- Target: **9/10 or better**
- If <9: fix SPF/DKIM/DMARC at Wix DNS first; do NOT proceed

---

## Stage 4 — First real sends (Day 15-30)

### 4.1. Start small (Day 15)
- Activate Reply Watch v1 (toggle "Active" in n8n)
- Add **5 real leads** to Send_Queue with status=pending, scheduled_for=tomorrow
- Activate Cold Send v1
- Tomorrow 9 AM IST it'll fire automatically

### 4.2. Daily ramp
| Day | Daily sends | Notes |
|---|---|---|
| 15 | 5 | First real leads. Watch open rates in Gmail's Sent folder Read receipts. |
| 16-17 | 10 | If <30% open or any spam complaints, STOP and diagnose |
| 18-21 | 15-20 | Continuing ramp |
| 22-30 | 25-50 | Full pace |

### 4.3. To pace the ramp, just control how many rows you put in Send_Queue per day.
The workflow caps at 50/day automatically (`Filter Pending + Cap 50` node).

---

## Stage 5 — Day 30 health check

| Metric | Target | Where to find |
|---|---|---|
| Open rate | >35% | (proxy) Gmail Sent folder + reply tracking |
| Reply rate | >2% | `Replies` tab row count / `Sent_Log` row count |
| Bounce rate | <5% | Bounces show up in info@quizotic.live inbox |
| Spam complaints | 0 | Postmaster Tools (postmaster.google.com) |
| Demos booked | 1-2/week | manual count from Replies tab |

**If bounce rate >5%:** stop sending immediately. Re-validate emails via Hunter/Apollo before resuming.

**If reply rate <2%:** the personalization is generic. Tweak the Gemini prompt in the `Build Gemini Prompt` Code node — make it more specific to your data sources.

**If open rate <30%:** the issue is subject lines OR sender reputation. Try S2/S3 subjects, then check mail-tester.com again.

---

## Stage 6 — What's still missing (deferred to v2)

The following are NOT in v1 — track in your roadmap:

1. **Lead enrichment workflow** — needs Hunter.io / Apollo.io credentials in n8n
2. **Follow-up workflow** (Day 4 + Day 9 bumps) — runs against `Sent_Log` rows where `sequence_step < 2` and `status != replied`
3. **`/api/unsubscribe` route** in Quizotic codebase (Next.js) — for one-click unsub link instead of "reply STOP" only
4. **Suppression check before send** — currently the workflow does NOT check Suppression before sending. For now, manually delete suppressed rows from Send_Queue. v2 will auto-skip.
5. **A/B reporting** — Sheet formula or BI tool to compare reply rates across variants A/B/C and subjects S1-S4
6. **Inbound bounce handling** — currently bounces just sit in the inbox. v2 will parse + auto-add bouncing emails to Suppression.

When you're ready for v2, hand me this checklist and I'll build them.

---

## Daily Operating Procedure (post Day-30)

Every morning, ~5 min:
1. Check Telegram for overnight reply alerts → respond within 4 hrs
2. Quick scan of `Replies` tab → mark `handled=yes` after responding
3. Move 30-50 enriched leads from `Leads_Enriched` → `Send_Queue` (status=pending, scheduled_for=today)
4. Workflow fires at 9 AM IST automatically

Every Sunday, ~30 min:
1. Pull more raw leads from UDISE+ / Apify Maps → `Leads_Raw`
2. Manually enrich (or run Stage 2 enrichment workflow once built)
3. Review week's metrics: opens, replies, bounces, demos

---

## Emergency Stop

If something goes wrong (mass bounce, spam complaint, wrong leads imported):
1. Open n8n → Cold Send v1 → toggle **Active OFF** (top right)
2. Sends stop within 60 sec; in-progress batch finishes
3. Diagnose and fix before re-activating
