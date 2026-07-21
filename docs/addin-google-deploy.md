# Google Slides Add-on deployment

The Quizotic Google Slides add-on is an **Apps Script** project (separate
tiny codebase under `addons/google-slides/`) that talks to the Quizotic HTTP
control surface. Apps Script can't speak Socket.IO or carry the NextAuth
cookie, so it's polling-only.

## What's where

| Artifact | Path | Purpose |
|---|---|---|
| Manifest | `addons/google-slides/appsscript.json` | Apps Script manifest with Slides scopes + URL fetch whitelist. |
| Server logic | `addons/google-slides/Code.gs` | `onOpen` menu + sidebar RPCs. |
| Sidebar UI | `addons/google-slides/Sidebar.html` | Host control surface HTML (loaded via `HtmlService`). |
| README | `addons/google-slides/README.md` | Developer setup with `clasp`. |

The add-on talks to:

- `POST   /api/v1/sessions/create`
- `GET    /api/v1/sessions/:code/snapshot`
- `POST   /api/v1/sessions/:code/control`

Auth: the host pastes their Quizotic API key in the sidebar; it's stored in
`PropertiesService.getUserProperties()` (per-user) and sent as a Bearer token
on every fetch.

## Developer setup

1. Install `clasp`: `npm install -g @google/clasp`
2. `clasp login` with the Google account that will own the project.
3. From `addons/google-slides/`:
   ```
   clasp create --type slides --title "Quizotic for Google Slides" --root .
   ```
   This writes a `.clasp.json` with the `scriptId`. **Do not commit it** —
   it's per-developer. Add it to `.gitignore`.
4. `clasp push` to upload `Code.gs`, `Sidebar.html`, and `appsscript.json`.
5. Open a Google Slides doc. The **Quizotic** menu appears under
   `Extensions → Quizotic → Open sidebar`.

### Testing changes

`clasp push` on every save; reload the Slides doc to pick up the new version.
For rapid iteration, `clasp open` jumps to the Apps Script editor where you
can run `onOpen` against a chosen deck.

## Publishing to the Google Workspace Marketplace

Apps Script add-ons ship via the
[Google Workspace Marketplace SDK](https://developers.google.com/workspace/marketplace),
not the Apps Script editor directly.

1. **Enable the SDK** in the Google Cloud project tied to your Apps Script
   project (APIs & Services → Google Workspace Marketplace SDK → Enable).
2. **Configure the SDK** in the Cloud Console:
   - App name: "Quizotic for Google Slides"
   - Description, icon, screenshots
   - **OAuth consent screen** — submit for verification. The scopes in
     `appsscript.json` are the minimum (presentations.currentonly,
     script.container.ui, script.scriptapp, userinfo.email). Verification
     typically takes a few days.
   - **Install URL** — point at the Apps Script project's deploy-as-add-on
     URL.
3. **Enable installability** for your domain (private) or submit for public
   listing.
4. Users install via the Marketplace "Install" button; the add-on then
   appears under the Slides `Extensions` menu in every doc they open.

## URL fetch whitelist

`appsscript.json` declares:

```json
"urlFetchWhitelist": ["https://www.quizotic.live/"]
```

Apps Script gates every `UrlFetchApp.fetch` against this list. Keep it
scoped to `quizotic.live` — widening it would let a future code change phone
home anywhere. If the production domain changes, update both this and the
hardcoded `BASE_URL` in `Code.gs`.

## UX limitation (be honest in marketing)

Unlike the PowerPoint add-in — which can swap a live web view onto a slide
during present mode — Google Slides Apps Script has no "slideshow active"
lifecycle hook and can't embed a live iframe on a slide surface. The add-on
runs from a **manually-advanced sidebar**:

- The audience joins from their phones via the QR + game code printed on the
  on-slide placeholder.
- The host sees live counts and drives phases (start / next / reveal /
  standings / end) from the sidebar.
- The sidebar polls the snapshot endpoint every 2s.

If on-slide live rendering becomes a must for Google, the alternative is a
**Docs add-on that loads a sidebar iframe** pointing at
`/embed/session/:code` (the same view Office uses). That's a future option;
Phase 3 ships the polling sidebar as the simpler v1.
