# Apps Script Automation — Quizotic Cold Email Sending

**Status:** Replaces the n8n send pipeline (which was blocked by Railway's SMTP firewall + Wix DNS limits). Apps Script runs inside Google's infrastructure, sends as `info@quizotic.live` natively, and adds a custom menu to the `Manual_Send` tab so sending becomes a 1-click operation.

- **Sheet:** [Quizotic Leads](https://docs.google.com/spreadsheets/d/18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw/edit)
- **Tab:** `Manual_Send` (gid=7)
- **Daily quota:** 1,500 emails/day via Workspace (well above the 50/day target)
- **Setup time:** ~5 minutes, one-time

---

## The Apps Script code (paste verbatim)

```javascript
/**
 * Quizotic Manual_Send automation.
 * Custom menu in the spreadsheet → click → emails fire from
 * the signed-in Google account (must be info@quizotic.live).
 *
 * Sheet: Manual_Send
 * Columns: A=row_num B=priority C=city D=school_name E=principal_name
 *          F=to_email G=email_confidence H=subject I=body J=status K=notes
 */

const SHEET_NAME = 'Manual_Send';
const COL = {
  TO_EMAIL: 6,         // F
  EMAIL_CONFIDENCE: 7, // G
  SUBJECT: 8,          // H
  BODY: 9,             // I
  STATUS: 10,          // J
  NOTES: 11,           // K
};
const THROTTLE_MS = 2000;       // 2s between sends
const SENDER_NAME = 'Mahesh Dhiman';
const REPLY_TO = 'info@quizotic.live';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Quizotic Send')
    .addItem('🧪 Test send (row 2 only)', 'testSend')
    .addItem('📨 Send next 10 ready', 'sendNext10')
    .addItem('📬 Send all ready', 'sendAllReady')
    .addSeparator()
    .addItem('⏭ Mark selected row as skipped', 'markSkipped')
    .addItem('📊 Show send stats', 'showStats')
    .addToUi();
}

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found.`);
  return sheet;
}

function sendOne_(sheet, rowIndex) {
  const row = sheet.getRange(rowIndex, 1, 1, COL.NOTES).getValues()[0];
  const to = String(row[COL.TO_EMAIL - 1] || '').trim();
  const subject = String(row[COL.SUBJECT - 1] || '').trim();
  const body = String(row[COL.BODY - 1] || '').trim();

  if (!to || !subject || !body) {
    sheet.getRange(rowIndex, COL.STATUS).setValue('skipped');
    sheet.getRange(rowIndex, COL.NOTES).setValue('Missing to/subject/body');
    return { ok: false, skipped: true };
  }

  try {
    GmailApp.sendEmail(to, subject, body, {
      name: SENDER_NAME,
      replyTo: REPLY_TO,
    });
    sheet.getRange(rowIndex, COL.STATUS).setValue('sent');
    sheet.getRange(rowIndex, COL.NOTES).setValue(
      'Sent ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm')
    );
    return { ok: true };
  } catch (e) {
    sheet.getRange(rowIndex, COL.STATUS).setValue('failed');
    sheet.getRange(rowIndex, COL.NOTES).setValue('Error: ' + e.message);
    return { ok: false, error: e.message };
  }
}

function findReadyRows_(sheet, limit) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const statuses = sheet.getRange(2, COL.STATUS, lastRow - 1, 1).getValues();
  const out = [];
  for (let i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0]).toLowerCase().trim() === 'ready') {
      out.push(i + 2); // sheet row index (1-based, +1 for header)
      if (limit && out.length >= limit) break;
    }
  }
  return out;
}

function sendBatch_(limit) {
  const sheet = getSheet_();
  const rows = findReadyRows_(sheet, limit);
  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('No rows with status="ready" found.');
    return;
  }
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Confirm send',
    `About to send ${rows.length} email${rows.length > 1 ? 's' : ''} as ` +
    `${Session.getActiveUser().getEmail()}. Continue?`,
    ui.ButtonSet.OK_CANCEL
  );
  if (confirm !== ui.Button.OK) return;

  let sent = 0, failed = 0, skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const result = sendOne_(sheet, rows[i]);
    if (result.ok) sent++;
    else if (result.skipped) skipped++;
    else failed++;
    if (i < rows.length - 1) Utilities.sleep(THROTTLE_MS);
  }
  ui.alert(`Done. Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}`);
}

function testSend() {
  const sheet = getSheet_();
  const result = sendOne_(sheet, 2);
  SpreadsheetApp.getUi().alert(
    result.ok ? 'Test sent — check inbox.' :
    result.skipped ? 'Skipped: missing fields.' :
    'Failed: ' + result.error
  );
}

function sendNext10() { sendBatch_(10); }
function sendAllReady() { sendBatch_(null); }

function markSkipped() {
  const sheet = getSheet_();
  const row = sheet.getActiveCell().getRow();
  if (row < 2) return SpreadsheetApp.getUi().alert('Select a data row first.');
  sheet.getRange(row, COL.STATUS).setValue('skipped');
  sheet.getRange(row, COL.NOTES).setValue('Manually skipped');
}

function showStats() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const statuses = sheet.getRange(2, COL.STATUS, lastRow - 1, 1).getValues();
  const counts = { ready: 0, sent: 0, failed: 0, skipped: 0, replied: 0, bounced: 0, other: 0 };
  statuses.forEach(([s]) => {
    const k = String(s).toLowerCase().trim();
    counts[k] !== undefined ? counts[k]++ : counts.other++;
  });
  SpreadsheetApp.getUi().alert(
    `Manual_Send stats:\n\n` +
    `Ready: ${counts.ready}\n` +
    `Sent: ${counts.sent}\n` +
    `Failed: ${counts.failed}\n` +
    `Skipped: ${counts.skipped}\n` +
    `Replied: ${counts.replied}\n` +
    `Bounced: ${counts.bounced}\n` +
    `Other: ${counts.other}`
  );
}
```

---

## Setup steps (one-time, ~5 minutes)

### Step 1 — Share the Sheet with info@quizotic.live (30 sec)
- Open the [Quizotic Leads sheet](https://docs.google.com/spreadsheets/d/18_xGgJRavjMt_voG9TbIsjLf0fC_sD8Ag3-YhZxe2Lw/edit)
- Click **Share** (top-right) → add `info@quizotic.live` → role: **Editor** → Send

### Step 2 — Sign into Google as info@quizotic.live (30 sec)
- Open https://accounts.google.com → if your personal Gmail is signed in, click profile photo → **Add another account** → sign in as info@quizotic.live
- Switch active account to info@quizotic.live

### Step 3 — Open the Sheet from info@quizotic.live (15 sec)
- Open the Sheet URL again. Top-right account chip should show info@quizotic.live (NOT dhiman.mahesh@gmail.com).

### Step 4 — Open Apps Script editor (15 sec)
- In the Sheet menu: **Extensions** → **Apps Script**. A new tab opens with `Code.gs`.

### Step 5 — Paste the code + save (1 min)
- Delete the empty `function myFunction()` boilerplate
- Paste the entire code block above
- Top-right → name the project **Quizotic Send**
- Press **Cmd+S** (Mac) / **Ctrl+S** (Win) to save

### Step 6 — Authorize (30 sec, one-time)
- In Apps Script editor: select function `testSend` from the dropdown → click **Run**
- Google asks for permission to "Send email as you" + "View/edit your spreadsheets"
- Click **Review permissions** → choose info@quizotic.live → click **Advanced** → **Go to Quizotic Send (unsafe)** → **Allow**
- Authorization completes; testSend runs immediately. ⚠️ See safety note below before clicking Run.

⚠️ **Before clicking Run on testSend:** row 2's `to_email` is currently a real school address (Podar International School). To avoid a real send during testing, edit cell **F2** to `dhiman.mahesh@gmail.com` first. Restore the real email after the test succeeds, or just delete row 2 and re-add the lead later.

### Step 7 — Verify smoke test landed (1 min)
- Check `dhiman.mahesh@gmail.com` inbox — one new email from `info@quizotic.live` with subject S4 ("Saw Podar International School on the CBSE/ICSE directory…").

### Step 8 — Reload the Sheet (10 sec)
- Refresh the spreadsheet tab. **"Quizotic Send"** menu now appears between Help and Extensions.

### Step 9 — Daily use
- Add new ready rows to `Manual_Send` (status=ready)
- Click **Quizotic Send** → **Send next 10 ready**
- Confirm dialog → click OK
- Wait ~25 seconds for batch of 10
- Status column shows `sent`; notes column shows timestamp
- Done

---

## Daily operating procedure

| Action | Click |
|---|---|
| Send 10 emails | Quizotic Send → 📨 Send next 10 ready |
| Send everything queued | Quizotic Send → 📬 Send all ready |
| Skip a row I don't want to send | Click the row → Quizotic Send → ⏭ Mark selected row as skipped |
| Check counts (ready/sent/failed) | Quizotic Send → 📊 Show send stats |

Pacing recommendation:
- **Week 1:** 5-10 sends/day (warming up info@quizotic.live's reputation)
- **Week 2:** 20-30 sends/day
- **Week 3+:** 50/day comfortable

Don't burst all 30 in one day from a fresh Workspace inbox — Gmail's spam filter penalises sudden volume spikes.

---

## Caveats

- **Reply detection NOT in v1.** Manually monitor info@quizotic.live's inbox. v2 will add a `checkReplies()` function with a 30-min time trigger that auto-flips status to `replied` and pings Telegram.
- **Bounce handling NOT in v1.** Hard bounces arrive as `mailer-daemon@googlemail.com` messages. v2 will parse these and auto-suppress.
- **Per-script 6-min execution limit.** "Send all ready" with 200+ rows will time out. Use "Send next 10" multiple times instead.
- **From-name is hardcoded** to "Mahesh Dhiman" in the constant `SENDER_NAME`. Edit the script if you want a different sender display.

---

## Decommissioning the n8n send workflow

The n8n workflow `Quizotic Cold Send v1` (ID `27F93liS7IAEXLwZ`) stays inactive — don't delete it. We may repurpose it for:
- Sourcing leads from external APIs (Apify, Hunter.io)
- Reply-watching via IMAP (still works — Railway doesn't block port 993 inbound)
- Future Telegram alerts

The SMTP credential (`E8F7d8tVAfWdwR3J` / Gmail Quizotic SMTP) and IMAP credential (`DHCTPatOvQ29jiil` / Gmail Quizotic IMAP) also stay. They use the App Password which still works inside Google's network — just not from Railway.
