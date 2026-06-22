# Deploy to Railway (actionsteam.xyz)

## 1. Create the GitHub repo

This folder is its own git repository (`actionsteam-web`). Push it to GitHub (see root README).

## 2. Railway project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select **`actionsteam-web`** (or your fork)
3. Railway detects Next.js via `railway.toml`

## 3. Add PostgreSQL (required)

1. In the project → **+ New** → **Database** → **PostgreSQL**
2. Click your **web service** (actionsteam-web), not the database
3. **Variables** tab → **+ New Variable** → **Add Reference**
4. Select the **Postgres** service → pick **`DATABASE_URL`** → Add

Without this, deploy fails with `DATABASE_URL is not set` or pre-deploy errors.

## 4. Environment variables

Set on the **web service** (not Postgres):

| Variable | Example | Notes |
|----------|---------|--------|
| `DATABASE_URL` | *(reference Postgres)* | Required |
| `APP_URL` | `https://actionsteam.xyz` | Used in invite links |
| `NODE_ENV` | `production` | |
| `SEED_ADMIN_EMAIL` | `you@example.com` | First deploy only |
| `SEED_ADMIN_USERNAME` | `admin` | Optional |
| `SEED_ADMIN_PASSWORD` | *(strong password)* | Optional; omit to force reset |

After first successful deploy, run seed **once** (Railway shell or local with prod `DATABASE_URL`):

```bash
npm run db:seed
```

Or use Railway **Settings → Deploy → One-off command**: `npm run db:seed`

Remove or rotate `SEED_ADMIN_PASSWORD` after seeding.

## 5. Custom domain

1. Web service → **Settings** → **Networking** → **Custom Domain**
2. Add `actionsteam.xyz` and `www.actionsteam.xyz`
3. Railway shows DNS records — add them at your domain registrar (or Cloudflare)
4. Update `APP_URL` to `https://actionsteam.xyz`
5. Redeploy

## 6. Nightly backups (optional)

Add a **Cron** service in the same project:

- Schedule: `0 3 * * *` (03:00 UTC — adjust for Europe/London)
- Command: `npm run backup:run`
- Same env as web service (needs `DATABASE_URL`)

For production, extend `scripts/nightly-backup.ts` to upload to S3/R2.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails (Node 18 / EBUSY) | Repo includes `.node-version` (20) and `nixpacks.toml`; redeploy after pulling latest |
| Pre-deploy / prisma failed | Fixed: schema runs at **start** now. Ensure `DATABASE_URL` is referenced on the **web** service |
| `DATABASE_URL is not set` | Web service → Variables → Add Reference → Postgres → `DATABASE_URL` |
| 502 on start | Check **Deploy logs** (not build); confirm Postgres is linked |
| Invite links show localhost | Set `APP_URL` to your public URL |
| CSRF errors | `APP_URL` must match the browser origin (include `https://`) |
