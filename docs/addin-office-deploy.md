# Office Add-in deployment (PowerPoint)

The Quizotic PowerPoint add-in is an **Office web add-in** (manifest +
HTTPS-hosted taskpane). All the runtime code lives in this repo — there's no
separate add-in project to maintain. This doc covers packaging, sideloading
for testing, and submitting to Microsoft AppSource.

## What's where

| Artifact | Path | Purpose |
|---|---|---|
| Manifest | `public/manifest.xml` | Office add-in manifest (XML). Served at `https://www.quizotic.live/manifest.xml`. |
| Taskpane | `src/app/embed/taskpane/page.tsx` + `src/components/embed/TaskpaneApp.tsx` | Host control surface Office loads in its taskpane iframe. |
| On-slide live view | `src/app/embed/session/[code]/page.tsx` + `src/components/embed/EmbedLiveView.tsx` | Audience-facing view iframed onto a slide during present mode. |
| CSP carve-out | `next.config.ts` (the `/embed/:path*` rule) | Permits Office/Google origins to frame the embed routes. |

## Manifest essentials

`public/manifest.xml` declares:

- `<Id>` — a fixed UUID. **Do not change** once published; Office keys
  installations off this id.
- `<Version>` — semver; bump with each release.
- `<SourceLocation>` — `https://www.quizotic.live/embed/taskpane`.
- `<Permissions>ReadWriteDocument</Permissions>` — required so the taskpane
  can store the active `gameCode` in `Office.context.document.settings`
  (mirrors how Mentimeter stores its slide link identifier).
- `<Hosts><Host Name="Presentation" />` — PowerPoint only. Add `Workbook`
  / `Document` later if we extend to Excel/Word.
- `<AppDomains>` — must list `https://www.quizotic.live` so Office lets the
  taskpane navigate within our origin.

## Sideload for local testing

Office add-ins can be sideloaded from a network-accessible HTTPS URL —
`quizotic.live` is already HTTPS, so once the feature is on `main` you can
sideload against production without a local tunnel.

1. Sign in to [office.com](https://office.com) or open PowerPoint Desktop.
2. **Insert → Add-ins → Manage My Add-ins → Upload My Add-in** (Desktop) or
   **Admin Managed → Upload** (if your tenant allows).
3. Upload `public/manifest.xml` (or point Office at
   `https://www.quizotic.live/manifest.xml`).
4. Open a deck. The **Home → Quizotic → Open Quizotic** button launches the
   taskpane.

### Dev iteration against localhost

Office requires HTTPS for the taskpane origin. For local dev:

1. `npm run dev` (serves on `http://localhost:4000`).
2. Expose it over HTTPS with a tunnel — `npx localtunnel --port 4000` or
   `ngrok http 4000`.
3. Edit a copy of `manifest.xml` to point `<SourceLocation>` and the
   `Taskpane.Url` resource at your tunnel URL.
4. Sideload the local manifest.

The dev CSP already allows `https://localhost:44300` (Office's default dev
taskpane port) for the `/embed/*` routes.

## Submitting to Microsoft AppSource

1. **Validate the manifest** with the
   [Office Add-in validator](https://learn.microsoft.com/office/dev/store/add-in-validation):
   ```
   npx office-addin-manifest-info manifest.xml
   npx office-addin-lint manifest.xml
   ```
2. **Partner Center**: register at
   [partner.microsoft.com](https://partner.microsoft.com) if not already,
   create a new Office add-in offer.
3. **Upload** `public/manifest.xml` + screenshots + a privacy policy URL
   (`https://www.quizotic.live/privacy`).
4. **AppSource review** typically takes 1–2 weeks. Common rejections:
   - Manifest `<Version>` not bumped.
   - Taskpane fails to load (CORS / CSP — verify the `/embed/*` rule is live).
   - Missing `<SupportUrl>` or `<AppDomains>` entry.
5. **Update flow**: bump `<Version>`, push to `main`, re-upload the manifest
   in Partner Center. Existing installations auto-update on next launch.

## Operating notes

- The taskpane stores the user's API key in `localStorage` keyed by the
  embed origin (`quizotic.live`). It survives reloads; users clear it via
  "Sign out". The key is the same one issued at `/host/settings`.
- The on-slide live view (`/embed/session/:code`) is a public, unauthenticated
  page — it renders whatever phase the session is in without revealing
  correct answers or PII. Safe for the audience to see projected.
- During slideshow, the taskpane writes the active `gameCode` to
  `Office.context.document.settings` so a re-open of the deck re-derives the
  embed URL without a server round-trip.
