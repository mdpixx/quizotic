<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Production Source of Truth

- `mdpixx/quizotic` is the canonical repository; Railway deploys its `main` branch.
- Work on a branch, run the relevant checks, and merge through a GitHub pull request.
- Never rsync or copy a monorepo snapshot over this repository.
- Run `npm run predeploy` for the local critical-path E2E gate before merging.
