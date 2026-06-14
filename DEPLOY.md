# Bravo Music — Production Deployment Runbook

This is the canonical guide for deploying Bravo Music to
production after applying batches 1–16. Read top to bottom
before each deploy; the order matters.

For the rollback procedure, see `ROLLBACK.md`.

---

## Pre-deploy checklist

Before running the deploy:

- [ ] All 16 batches applied to the working branch
- [ ] Code merged to `main` (or your deploy branch)
- [ ] Smoke tests passed locally (see batch 15 INTEGRATION.md)
- [ ] Database backup taken (production Mongo dump)
- [ ] Maintenance window communicated to users (if downtime expected)
- [ ] PagerDuty / on-call notified
- [ ] Rollback target identified (last known-good commit)

---

## Environment validation

Run on the production server BEFORE starting the new code:

```bash
cd /var/www/bravo-music/backend
NODE_ENV=production node scripts/checkProductionReady.js --check-db
```

Expected output:
```
✓ NODE_ENV=production
✓ MONGO_URI is set
✓ JWT_SECRET is set
... (all green checks)
✓ MongoDB reachable
READY FOR PRODUCTION
```

**If anything fails**: fix it before continuing. Common issues:
- `JWT_SECRET` looks like the placeholder from `.env.example`
- `ALLOWED_ORIGINS` includes localhost
- `STATIC_UPLOADS_PATH` doesn't exist or isn't writable
- `PAWAPAY_WEBHOOK_SECRET` is missing

The check script's exit code reflects the result:
- `0` — all green, proceed
- `1` — criticals; do NOT proceed
- `2` — warnings; review and decide

---

## Backend deploy

### 1. Pull + install

```bash
cd /var/www/bravo-music/backend
git fetch --all
git checkout main
git pull
npm ci --omit=dev          # production install
```

`npm ci` is preferred over `npm install` — it respects the
lockfile exactly and refuses to install if the lockfile is
out of sync with package.json.

### 2. Apply backend patches (from batches 6, 7, 15)

These are one-time additions to existing files. Skip any that
have already been applied in a previous deploy:

```bash
# Batch 6 — adminController SystemSettings handler
# (see batch-6/_adminController.systemSettings.patch.js for the additions)

# Batch 7 — Subscription model listener_premium plan
# (see batch-7/_Subscription.model.patch.js)

# Batch 15 — userController getMyLiked + route
# (see batch-15/_userController.getMyLiked.patch.js and _userRoutes.patch.js)

# Batch 16 — middleware/securityHeaders.js + middleware/logRedactor.js
cp batch-16/_middleware-securityHeaders.js src/middleware/securityHeaders.js
cp batch-16/_middleware-logRedactor.js     src/middleware/logRedactor.js
cp batch-16/_config-validateEnv.js         src/config/validateEnv.js
cp batch-16/_scripts-syncIndexes.js        scripts/syncIndexes.js
cp batch-16/_scripts-checkProductionReady.js scripts/checkProductionReady.js
cp batch-16/server.js                      server.js
cp batch-16/.env.example                   .env.example
```

### 3. Database migrations (run before starting the new server)

```bash
# Genre canonicalization (batch 15) — run once
node scripts/migration-genres.js --dry-run
# Review output; if it looks right:
node scripts/migration-genres.js

# Index sync (batch 16) — run on every deploy
node scripts/syncIndexes.js --dry-run
# Review output; if expected:
node scripts/syncIndexes.js
```

### 4. Restart with zero downtime

If running PM2:
```bash
pm2 reload ecosystem.config.js
```

The new process boots, validateEnv runs, the HTTP server
starts on a new instance, PM2 swaps traffic over, the old
process gracefully shuts down (SIGTERM is handled in batch 16's
server.js — 15s grace period, then force exit).

If running systemd:
```bash
sudo systemctl restart bravo-music
sudo systemctl status bravo-music
```

### 5. Verify

```bash
# Health check
curl -s https://api.bravomusics.com/api/health | jq

# Should return:
#   {
#     "status": "ok",
#     "db": "connected",
#     "uptime": 5,
#     "version": "...",
#     "env": "production"
#   }
```

Tail the logs for ~60 seconds and watch for errors:
```bash
pm2 logs bravo-api
# or
journalctl -u bravo-music -f
```

You should see:
```
[env] Validated (env=production, 4 required + 4 prod-required)
[server] Bravo Music API listening on :1000
[server] env=production, allowed-origins=3
```

Notably you should NOT see:
- Mongo connection errors
- "MISSING ..." env validation lines
- Crashes
- The leaked credentials log from the original server.js
  (admin@bravomusic.com etc.) — gone in batch 16

---

## Frontend deploy

### 1. Build (if applicable)

The frontend is plain JS — no build step. But cache busting
matters:

```bash
# Update the ?v= suffix in index.html
sed -i 's/?v=20260611/?v='"$(date +%Y%m%d)"'/g' frontend/public/index.html
```

### 2. Sync to web server

If serving from the same nginx box:
```bash
rsync -av --delete frontend/public/ /var/www/bravo-music-public/
```

If serving from CloudFront / S3:
```bash
aws s3 sync frontend/public/ s3://bravo-music-public/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

### 3. Verify the new bundle is live

Hard refresh `https://bravomusics.com` in an incognito window:
- Check Network tab: every `*.js` should have the new `?v=...` suffix
- Check Console: no 404s or syntax errors
- Run through the smoke test from batch 15's INTEGRATION.md

---

## Post-deploy smoke test

Run all 10 steps in order. If ANY fails, follow ROLLBACK.md.

| # | Step | Expected |
|---|------|----------|
| 1 | Sign in as a listener | Token issued, home loads |
| 2 | Upload a song (as artist) | 200, song appears as 'pending' |
| 3 | Play a premium song without subscription | Premium overlay shown |
| 4 | Search for an artist | Results within 250ms |
| 5 | Open Liked Songs (fresh tab) | Shows server-side likes |
| 6 | Request a withdrawal (as artist) | Approval modal works |
| 7 | Approve a withdrawal (as admin) | Reason gets saved |
| 8 | Top up wallet | PawaPay modal polls correctly |
| 9 | Subscribe to a plan | Subscription appears immediately |
| 10 | Open payment history | All above transactions visible |

If all 10 pass: deploy is successful.

---

## Monitoring (next 24h)

Watch for:

- **Error rate**: should be flat or lower than before deploy
- **p95 latency**: should be in the same band (±20%)
- **5xx rate on `/api/webhooks/pawapay`**: any sustained spike
  here means webhook signature verification is broken
- **Mongo connection pool usage**: should NOT be saturated
- **Memory growth**: heap should plateau, not climb
- **Auth failures**: a sudden spike in 401s could mean a
  JWT secret rotation issue

Set up alerts (Datadog / PagerDuty / etc.) on:
- 5xx error rate > 1% sustained over 5min
- p95 latency > 2s sustained over 5min
- Mongo down or replica lag > 30s
- Backend process restarts > 3 in 1h

---

## Common issues + fixes

### "[env] MISSING ALLOWED_ORIGINS" — server won't start

Set the env var:
```bash
export ALLOWED_ORIGINS="https://bravomusics.com,https://www.bravomusics.com,https://api.bravomusics.com"
```
Or add to `.env` and restart.

### "Failed to start: connect ECONNREFUSED" on Mongo

Mongo isn't reachable. Check:
- Mongo is running (`systemctl status mongod`)
- Network reachable (`nc -zv <mongo-host> 27017`)
- `MONGO_URI` is correct
- IP allowlist includes the new server

### Webhook signature verification failing in logs

Check that the `PAWAPAY_WEBHOOK_SECRET` value in production
matches the one configured in the PawaPay dashboard. If you
rotated it, restart the API process.

### Static files 404

Check `STATIC_UPLOADS_PATH`, `STATIC_MUSIC_PATH`,
`STATIC_IMAGES_PATH` env vars. The check script verifies
these exist and are writable.

### Mongo `syncIndexes` dropped indexes it shouldn't have

Manually-created indexes (those not in the Mongoose schema)
get dropped. Re-create with:
```js
db.songs.createIndex({ ... });
```

(In general, ALL indexes should be defined in the model
schemas. If you find yourself adding them manually, fix the
schema instead.)

---

## Frequency

- **Hotfix deploy**: as needed (single backend file, no
  migrations, no schema changes)
- **Normal deploy**: weekly
- **Major release**: monthly, with full smoke test + 24h
  monitoring

---

## Rollback trigger

If ANY of these happen post-deploy, execute ROLLBACK.md:
- Error rate > 5% for > 5 minutes
- Health check returns 503 for > 2 minutes
- Smoke test step 3 (auth), 8 (payment), or 9 (subscription)
  fails
- Webhook signature verification consistently failing
- Database reports widespread index-build errors
