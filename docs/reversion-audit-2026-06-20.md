# Production Reversion Audit — June 20, 2026

## Incident

Railway deploys `mdpixx/quizotic` from `main`. On June 19, commit `76d5653`
ran the old monorepo sync workflow and copied snapshot `8745ae3` (June 13)
over the standalone repository with `rsync --delete`.

Because this was a filesystem replacement rather than a Git merge, Git could
not report conflicts with newer commits. The resulting deploy silently
replaced or deleted production changes made directly in the canonical repo.

## Direct GitHub Changes Audited

| Commit | Change | Effect of `76d5653` | Recovery |
| --- | --- | --- | --- |
| `13cc310` | Global SEO copy and signup paths | Reverted | Later restored or superseded by `c86d82d` and `442af90` |
| `6612ddf` | Topic/URL AI mode mapping | Reverted | Restored and hardened by `5088d3e` |
| `1afa422` | Prisma 7 adapter construction | Reverted | Restored in this recovery |
| `7cf1678` | PDF/OCR extraction resilience | Reverted | Restored in this recovery |
| `ac68e6f` | Expanded canonical language list | Reverted/deleted | Restored in this recovery |
| `448fb86` | Unified brand identity | Preserved | Generated asset drift repaired in this recovery |
| `d91fde3` | PostHog toolbar guard | Preserved | No recovery required |

## Preventive Controls

- The rsync deployment script and its package aliases are removed.
- GitHub `main` is the only Railway deployment source.
- Production changes are made on branches and merged after CI.
- CI verifies generated assets, regression tests, Prisma generation, and the
  production build.
- Regression tests protect the deployment policy, language list, Prisma
  construction, PDF failure behavior, SEO signup path, and AI mode mapping.

## Operational Rule

If code also exists in another repository or monorepo, port its commits into
`mdpixx/quizotic` and resolve differences through Git. Never copy a snapshot
over the canonical repository.
