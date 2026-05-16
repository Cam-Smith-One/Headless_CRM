## Summary

<!-- What does this PR do? Why? One or two sentences. -->

## Changes

<!-- Bullet list of the main things changed. -->

- 

## Testing

<!-- How did you verify this? -->

- [ ] Ran `npm run dev` locally and exercised the affected paths
- [ ] Ran `npx turbo build` — no type errors
- [ ] Ran `npx turbo test` — all tests pass
- [ ] Updated README / CHANGELOG if this changes behaviour or adds a feature

## Related issues

<!-- Closes #... or N/A -->

## DB changes

<!-- If you added or changed a schema, run `npm run db:generate` and include the migration. -->

- [ ] No schema changes
- [ ] Migration generated and included

## Checklist

- [ ] My changes follow the project's code style (TypeScript strict, Zod validation, events emitted for mutations)
- [ ] I have not hardcoded secrets or credentials
- [ ] New entities/endpoints are tenant-scoped and RBAC-gated
