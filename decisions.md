# Quizotic — Decisions

_Project-level decisions. For major decisions, also log in `../../decisions/log.md`._

---

## 2026-06-20 — Standardized release system: GitHub as single source of truth

**Decision:** `mdpixx/quizotic` GitHub `main` is the single source of truth for all
code. Every change lands on GitHub first (PR → CI → merge). Railway auto-deploys from
`main` on green CI. No side doors: old rsync deploy script, `npm run deploy`, and
`railway up` are all retired.

**Release automation:** release-please reads Conventional Commits and auto-opens a
Release PR that bumps `package.json` version and regenerates `CHANGELOG.md`. Merging
the Release PR creates a `vX.Y.Z` git tag and GitHub Release.

**Local backup:** the local clone at `projects/Quizotic/` auto-pulls from GitHub every
30 min via `scripts/sync-from-github.sh` + launchd (`live.quizotic.sync.plist`). Sync
is pull-only and safe: it never runs if the tree is dirty or local is ahead.

**CI gate:** build + unit tests are hard blocking. Lint is advisory (`continue-on-error`)
until the existing eslint backlog is cleared, then it becomes a hard gate.

**Rollback path:** Railway one-click rollback (instant) or `git revert` (durable). Every
merged release is tagged by release-please so any past version is addressable.

**Context:** Prior "multiple modes" (rsync script + direct push + `railway up`) caused a
June 2026 incident where a stale monorepo snapshot stripped `<StickyNav/>` from SEO
pages, dropping signups to zero while traffic looked healthy. See also
`src/__tests__/deployment-safety.test.ts` (prevents deploy-script return) and
`src/__tests__/seo-signup-path.test.ts` (protects the signup path).
