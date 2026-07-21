# Quizotic for Google Slides

A Google Slides add-on that lets a presenter run a live Quizotic quiz from
inside a slide deck — no screen-switching. Polling-only (Apps Script can't
speak Socket.IO) so it talks to the Quizotic HTTP control surface:

- `POST   /api/v1/sessions/:code/control`  — drive (start / next / end …)
- `GET    /api/v1/sessions/:code/snapshot` — read phase / counts
- `POST   /api/v1/sessions/create`         — mint a live session

## Layout

```
addons/google-slides/
├── appsscript.json   # Manifest with Slides scopes + Quizotic URL whitelist
├── Code.gs           # Server-side RPC entrypoints (onOpen, sidebar handlers)
├── Sidebar.html      # Host control surface (connect, pick quiz, drive)
└── README.md         # This file
```

## Deploying (developer setup)

1. Install [`clasp`](https://github.com/google/clasp): `npm install -g @google/clasp`
2. `clasp login` (one-time, with the Google account that owns the project)
3. Create a new standalone Apps Script project tied to a Google Slides
   container, or use an existing one:
   ```
   clasp create --type slides --title "Quizotic for Google Slides" --root .
   ```
   This writes a local `.clasp.json` with the `scriptId`. Don't commit it —
   it's per-developer.
4. Push this directory's files:
   ```
   clasp push
   ```
5. Open the Slides doc, reload, and the **Quizotic** menu appears.
   `Extensions → Quizotic → Open sidebar` to run.

## Publishing to the Workspace Marketplace

See `docs/addin-google-deploy.md` in the repo root. The short version: the
add-on needs a Marketplace listing (SDK listing form, OAuth consent screen,
app verification). `urlFetchWhitelist` in `appsscript.json` is what lets
Apps Script call `quizotic.live` — keep it scoped to that host.

## UX limitation

Google Slides exposes no "slideshow active" lifecycle hook, so unlike the
PowerPoint add-in (which swaps a live iframe onto the slide during present
mode), this add-on runs from a **manually-advanced sidebar**. The audience
joins from their phones via the QR / game code printed on the on-slide
placeholder; the host sees live counts and drives phases from the sidebar.
