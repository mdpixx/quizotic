# Releasing & Deploying Quizotic

This is the single source of truth for how code reaches production, how versions
are tracked, how to roll back, and how the local backup stays in sync.

## The one rule

**GitHub `mdpixx/quizotic` `main` is the only source of truth.** Every change lands
on GitHub first; Railway auto-deploys from `main`. There are no side doors — no
rsync-from-monorepo, no `railway up`, no direct edits on the server.

```
 branch ──► Pull Request ──► CI (build + tests) ──► merge to main
                                                        │
                          ┌─────────────────────────────┼───────────────────────────┐
                          ▼                             ▼                             ▼
                 Railway auto-deploy          release-please Release PR        local backup auto-pull
                 (waits for CI checks)        (version bump + CHANGELOG)        (sync-from-github.sh)
```

## Day-to-day workflow

1. Branch off `main`: `git switch -c feat/my-change`.
2. Make changes. Commit using **Conventional Commits** (see grammar below).
3. Push and open a PR: `git push -u origin HEAD` then open the PR.
4. **CI** runs automatically (`.github/workflows/ci.yml`). Wait for it green.
5. Merge to `main`. Railway deploys; release-please updates the pending Release PR.

> Optional local pre-push smoke test: `npm run predeploy` boots the dev server and
> runs the Playwright E2E suite. E2E is **not** in CI (kept fast); run it locally
> before big changes.

## CI gate (`.github/workflows/ci.yml`)

Runs on every PR and every push to `main`:

| Step | Blocking? |
|------|-----------|
| `npm ci` + `npx prisma generate` | yes |
| **Lint** (`npm run lint`) | **yes** — errors block; warnings don't |
| Brand assets check (`npm run brand:assets:check`) | yes |
| Unit + regression tests (`npm test`) | yes |
| Production build (`npm run build`) | yes |

Lint became a hard gate in July 2026 once the eslint error backlog was cleared.
Keep it at 0 errors — new errors fail every PR.

## Versioning + CHANGELOG (release-please)

Versioning is automatic — no manual tagging.

- `.github/workflows/release-please.yml` runs on every push to `main`.
- It reads Conventional Commits and maintains a **Release PR** that bumps the
  `version` in `package.json` and regenerates `CHANGELOG.md`.
- **Merging the Release PR** creates the git tag `vX.Y.Z` and a **GitHub Release**.
- Config: `release-please-config.json`; current version state:
  `.release-please-manifest.json`.

Because the project is pre-1.0 (`0.x`), bumps are conservative:
`fix:` → patch, `feat:` → patch, breaking change → minor.

### Conventional Commit grammar
```
<type>(optional scope): <description>

[optional body]
[optional footer, e.g. "BREAKING CHANGE: ..."]
```
Common types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`.
Only `feat` and `fix` (and breaking changes) move the version; the rest are
recorded but don't bump. Example: `fix(host): close scheduled sessions by id`.

## Rolling back

Two layers, fastest first:

1. **Railway instant rollback (no rebuild).** Railway dashboard → the Quizotic
   service → **Deployments** → pick the last-good deployment → **Redeploy/Rollback**.
   Production reverts in seconds. Use this first when a deploy breaks prod.
2. **Durable git revert (clean history).**
   `git revert <bad-sha> && git push` on a branch → PR → merge. CI re-runs and
   Railway redeploys the corrected `main`. Preferred for a permanent fix.
3. **Redeploy a known-good version.** Every release is tagged, so any prior version
   is addressable: `git checkout v0.1.0` to inspect, or branch from the tag and PR.

## Local backup auto-sync

The local clone at `projects/Quizotic/` is a **backup that pulls from GitHub** — it
never pushes on its own.

- Script: `scripts/sync-from-github.sh` — fetches and **fast-forwards `main` only**.
  It refuses to run when the tree has tracked changes or local commits are ahead, so
  it can never clobber in-progress work. Logs to `~/.cache/quizotic-sync.log`.
- Scheduler: `~/Library/LaunchAgents/live.quizotic.sync.plist` runs it every 30 min.
  - Load:   `launchctl load ~/Library/LaunchAgents/live.quizotic.sync.plist`
  - Unload: `launchctl unload ~/Library/LaunchAgents/live.quizotic.sync.plist`
  - Run once now: `bash scripts/sync-from-github.sh && tail ~/.cache/quizotic-sync.log`

## One-time manual setup (GitHub + Railway dashboards)

These cannot be scripted from the repo — do them once in the web UIs:

1. **GitHub → Settings → Actions → General → Workflow permissions:** enable
   *"Allow GitHub Actions to create and approve pull requests"* (lets release-please
   open its Release PR) and set *Read and write permissions*.
2. **GitHub → Settings → Branches → Branch protection for `main`:** require a PR,
   require the **CI** status check to pass, and disallow direct pushes. This is what
   enforces "land on GitHub first, green only."
3. **Railway → Quizotic service → Settings:** confirm it watches only `main` of
   `mdpixx/quizotic`, and enable **"Wait for CI"** (check suites must pass) so a
   deploy only fires on green CI.

## Recovery references (reconciliation of 2026-06-20)

When the local clone was reconciled to GitHub, the prior divergent local state was
preserved (in case anything needs to be recovered):
- git tags: `backup/local-main-pre-reconcile-20260620`, `backup/local-dirty-20260620`
- full tarball: `~/quizotic-pre-reconcile-20260620.tgz`
