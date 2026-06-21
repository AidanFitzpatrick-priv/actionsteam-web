# Actions Spreadsheet — Web App

Production-oriented web port of the Google Sheets + Apps Script workflow.

## Roles

| Capability | member | sub_lead | lead | aux | adm | management |
|------------|--------|----------|------|-----|-----|------------|
| Edit schedule + tracker | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Action Stats | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own goal scores | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create invite links | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invite dashboard | ✗ | own | own | all | all | all |
| Full admin (months, users, data, tools) | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Hard delete months | ✗ | ✗ | ✗ | ✓* | ✓* | ✓* |
| Restore production backup | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

\*Hard delete requires confirmation + audit reason.

Hierarchy: `member` < `sub_lead` < `lead` < `aux` < `adm` < `management`

## Deploy (Railway + actionsteam.xyz)

Full steps: **[RAILWAY.md](./RAILWAY.md)**

1. Push this repo to GitHub (`actionsteam-web`)
2. Railway → Deploy from GitHub → add **PostgreSQL**
3. Set `APP_URL`, `SEED_ADMIN_*`, reference `DATABASE_URL`
4. Run `npm run db:seed` once after first deploy
5. Attach custom domain in Railway → point DNS for **actionsteam.xyz**

## Local setup (without Docker)

Use [Neon](https://neon.tech) / [Supabase](https://supabase.com) free Postgres, or install PostgreSQL locally, or Docker:

```bash
cp .env.example .env
# Set SEED_ADMIN_EMAIL and DATABASE_URL

npm install
npm run db:push
npm run db:seed
npm run dev
```

With Docker: `docker compose up -d` then use the default `DATABASE_URL` in `.env.example`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Management user + sample types/gangs |
| `npm test` | RBAC, invite status, stats (gang attendance) |
| `npm run backup:run` | Nightly backup job (local `backups/` + DB row) |

## Security

- Passwords: Argon2id
- Invite tokens: SHA-256 hash; raw token shown once
- Sessions: HTTP-only cookies
- Login rate limit: 5 / 15 min / IP
- CSRF: Origin check on mutations; SameSite=Lax cookies
- CSP + HSTS (production) via middleware

## Apps Script mapping

| Apps Script | Web service |
|-------------|-------------|
| `ScheduleTrackerSync.js` | `services/schedule-sync.ts` |
| `SchedulePaint.js` | `services/schedule.ts` (type colours) |
| `ActionStats.js` | `services/stats.ts` |
| `Points.js` | `services/points.ts` |
| `TrackerFormat.js` | `services/points.ts` (`applyWinnerSideEffects`) |
| `ActiveMonth.js` | `services/months.ts` + `app_settings` |

## Team sign-up guide

See [TEAM_GUIDE.md](./TEAM_GUIDE.md).

## Backup restore runbook

1. **List backups:** Admin → Backups (aux+).
2. **Manual backup:** Click “Run manual backup” or `npm run backup:run`.
3. **Restore:** Management only → Restore on a backup row. Confirm in modal.
4. **Production cron:** Schedule `npm run backup:run` at 03:00 Europe/London; point storage to S3/R2 in a future deploy hook.

Files land in `web/backups/` locally; metadata in `backups` table.

## Deploy (staging)

1. Provision Postgres + set `DATABASE_URL`, `APP_URL`, `SEED_ADMIN_*`.
2. `npm run build && npm run db:push && npm run db:seed`.
3. Configure HTTPS reverse proxy; set `NODE_ENV=production`.
