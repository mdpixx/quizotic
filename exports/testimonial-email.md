# Quizotic Testimonial Re-engagement Email

**From:** Mahesh Dhiman, Quizotic &lt;info@quizotic.live&gt;
**Subject (primary):** Set a quiz live, then walk away — plus a small ask
**Subject (alt):** A quick update from Quizotic, and one honest favour

---

## Plain-text version

```
Hi {{name}},

It's Mahesh, the founder of Quizotic. I noticed you had explored the platform a while 
back, and I just wanted to personally say thank you — early hosts like you are the reason 
it keeps getting better.

The big thing we've shipped since you last visited: Scheduled Quizzes.

You can now set a quiz to open at any date and time, share the link in advance, and let 
people take it on their own schedule — without you needing to be online or host it live. 
Think classroom assignments, training windows before a workshop, or selection rounds for 
events. Set it. Share it. Walk away.

[screenshot here in the HTML version]

If you've been away for a bit, this is a good moment to come back and try it. Most hosts 
tell us Quizotic feels quicker and less fussy than the usual tools — and the core features 
stay free, no paywalls in your way.

→ Log in and try Scheduled Quizzes: https://www.quizotic.live/host

---

One genuine ask.

If Quizotic has been useful to you in any way, would you share a short testimonial? We're 
building out our website and we'd love to feature real hosts — teachers, trainers, 
managers — in their own words. Chosen testimonials go on the Quizotic homepage.

If you're open to it, just reply to this email with:
  • A line or two about your experience with Quizotic
  • A photo of yourself (any clear, recent one)
  • Your name + designation and organization
    (Students: "Student at [your college/university]")

That's it. No forms, no surveys. Just a reply.

Your feedback also shapes what we build next — so even if a testimonial doesn't feel right, 
feel free to hit reply and tell us what you'd like to see improved. We read every message.

Thank you for being part of the Quizotic story from early on.

Warmly,
Mahesh Dhiman
Founder, Quizotic
info@quizotic.live
https://www.quizotic.live
```

---

## HTML version (template — screenshots inserted as inline images)

See `testimonial-email-preview.html` for the rendered version.

---

## Notes for campaign

- Replace `{{name}}` with user's first name. If `name` column is blank, use "there".
- First name extraction: take everything before the first space in the `name` column.
- Screenshots: embed as `cid:scheduled-create` and `cid:scheduled-list` (files in `exports/screenshots/`).
- For the mass-send campaign: host the screenshots on R2/quizotic.live CDN and switch to `<img src="https://...">`.
- Test send goes to `dhiman.mahesh@gmail.com` first — approve before wider send.
- Sender must be `info@quizotic.live` via Gmail API OAuth (GMAIL_API_* env vars on Railway).
