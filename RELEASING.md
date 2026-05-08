# Releasing Headless CRM

Use this checklist before cutting a public release or tagging a release candidate.

## Pre-release checks

Run from a clean branch:

```bash
npm run oss:check
npm test
npm run build
```

For the local self-host path:

```bash
SEED_DEMO=0 npm run setup:sqlite
npm run selfhost:check
npm run test:selfhost
npm run test:e2e
```

## Release prep

1. Update [CHANGELOG.md](./CHANGELOG.md).
2. Review [ROADMAP.md](./ROADMAP.md) and remove anything that shipped.
3. Check [README.md](./README.md) for new env vars, features, or changed install steps.
4. Make sure docs still match the current product behavior.
5. Confirm `.env`, `.db`, and backup files are not tracked.

## Tagging and publishing

1. Merge the release branch.
2. Create a git tag that matches the changelog entry.
3. Publish release notes that call out:
   - breaking changes
   - upgrade steps
   - new required env vars
   - new operator or contributor docs

## After release

- Smoke test the local self-host path from a fresh clone.
- Watch incoming issues for install friction.
- Update the roadmap based on real user feedback rather than guesses.
