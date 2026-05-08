# Extending Headless CRM

This is the quickest path for contributors who want to add new capabilities without reverse-engineering the whole repo.

## Common extension paths

### Add a new CRM entity

1. Add schema in `packages/db/src/schema`.
2. Export it through the schema index used by both database modes.
3. Add service logic in `packages/core/src/services`.
4. Wire the service into the CRM factory in `packages/core/src/crm.ts`.
5. Add REST routes in `apps/api/src/app.ts`.
6. Add MCP tool support in `packages/mcp-server/src/tools`.
7. Add dashboard list/detail/edit UI in `apps/web/src/app`.
8. Add seed data if the entity should exist in demos.
9. Add tests for service behavior and the happy-path API flow.

### Add a new MCP capability

1. Decide whether the capability should be a new tool or an extension of an existing CRM tool.
2. Keep the tool definition and role constraints together.
3. Reuse service-layer logic rather than putting business rules in the transport.
4. Update discovery or examples if the tool changes how agents should integrate.

### Add a new integration or webhook consumer

1. Subscribe from the event trail rather than duplicating write logic.
2. Keep signature verification and retry behavior close to the route.
3. Document new required environment variables in `README.md` and `SECURITY.md`.

## Design guardrails

- Reuse existing service patterns before inventing a new abstraction.
- Validate all incoming data with Zod.
- Emit an event for every state-changing operation.
- Keep tenant checks explicit.
- Prefer same-origin browser API calls over hard-coded public origins.
- Make SQLite behavior intentional when adding new queries or operators.

## What to test

At minimum, run:

```bash
npm test
npm run build
npm run oss:check
```

When touching self-host flows or auth:

```bash
npm run selfhost:check
npm run test:selfhost
npm run test:e2e
```

## Good first contributor tasks

- improve error states in existing forms
- add missing list/detail filters
- expand team and invite coverage
- add example integrations for common MCP clients
- improve operator docs for Postgres backups and upgrades
