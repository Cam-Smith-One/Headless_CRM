# Upgrading Headless CRM

Use this guide when moving an existing local or self-hosted deployment to a newer version.

## Before you upgrade

1. Read the latest entry in [CHANGELOG.md](./CHANGELOG.md).
2. Back up your database.
3. Make sure you can recreate your current environment variables.
4. Plan a short validation window after restart.

## SQLite upgrade path

```bash
npm run sqlite:backup
git pull
npm install
npm run build
npm run selfhost:check
```

Then restart the app:

```bash
npm run selfhost:sqlite
```

If the release includes schema changes, the startup or setup path should apply the matching migrations before normal use.

## PostgreSQL upgrade path

1. Take a database backup or snapshot through your hosting provider.
2. Pull the new code and install dependencies.
3. Run migrations.
4. Restart the app or redeploy the services.
5. Validate readiness and a basic CRUD path.

## Secret rotation

If you rotate `JWT_SECRET` or `BETTER_AUTH_SECRET`:

- existing sessions and agent JWTs may stop working
- humans should sign in again
- long-lived agent consumers may need a new token or key rotation

Rotate `ADMIN_API_KEY` if it has been shared beyond the people provisioning agents.

## Validation checklist after upgrade

Run:

```bash
npm run selfhost:check
npm run test:selfhost
```

And confirm:

- `/api/ready` returns 200
- humans can sign in
- at least one human CRUD flow works
- agent provisioning still works
- MCP discovery is public

## Rolling back

Rollback is easiest when you:

- keep a backup from immediately before the upgrade
- avoid destructive manual data edits during the validation window
- record which migration level and commit SHA were deployed

If you need to restore SQLite, use:

```bash
npm run sqlite:restore -- ./backups/your-backup.db
```
