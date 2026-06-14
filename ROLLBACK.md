# Bravo Music — Production Rollback Plan

When a deploy goes wrong, this is the procedure. Read it
top-to-bottom BEFORE you need it.

## When to rollback

Rollback if ANY of these are true after a deploy:

- **Smoke test step 3, 8, or 9 fails** (auth / payment /
  subscription — these are revenue-critical paths)
- **Error rate > 5% sustained over 5 minutes**
- **Health check returns 503 for > 2 minutes**
- **Webhook signature verification consistently failing** in
  logs (PawaPay can't deliver successful payments)
- **Database reports cascading errors** (index build failures,
  connection pool exhaustion)
- **Multiple customer reports of broken functionality** within
  10 minutes of deploy

When in doubt, **rollback**. The platform being down briefly
is better than data corruption or financial loss.

## Pre-rollback

Before rolling back, capture diagnostic info:

```bash
# Save a copy of the failing state for post-mortem
cd /var/www/bravo-music
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /tmp/rollback-$TIMESTAMP

# Logs
pm2 logs bravo-api --lines 1000 --nostream > /tmp/rollback-$TIMESTAMP/pm2-logs.txt
journalctl -u bravo-music --since "30 minutes ago" > /tmp/rollback-$TIMESTAMP/syslog.txt

# Current commit
git rev-parse HEAD > /tmp/rollback-$TIMESTAMP/current-commit.txt
git log --oneline -20 > /tmp/rollback-$TIMESTAMP/recent-commits.txt

# Health check + memory
curl -s https://api.bravomusics.com/api/health > /tmp/rollback-$TIMESTAMP/health.json
pm2 monit > /tmp/rollback-$TIMESTAMP/pm2-monit.txt
```

Without these, the post-mortem will struggle. Don't skip.

## Backend rollback

### Option A: Revert the deploy commit (preferred)

```bash
cd /var/www/bravo-music/backend
git log --oneline -5

# Identify the deploy commit hash (the merge from the last deploy)
DEPLOY_COMMIT=<hash>
GOOD_COMMIT=<hash of the last known-good state>

git checkout $GOOD_COMMIT
npm ci --omit=dev

# Reapply only the env (don't run migrations — see migrations note below)
pm2 reload ecosystem.config.js
```

Watch the boot logs. validateEnv should pass. The HTTP server
should accept connections within 5–10 seconds.

### Option B: PM2 revert (if you don't use git on the server)

```bash
pm2 reload <name> --restart-delay 1000
# If you snapshotted with `pm2 save` before the deploy:
pm2 resurrect
```

### Verify the rollback

```bash
curl -s https://api.bravomusics.com/api/health | jq

# Should return version of the rolled-back code, not the failed one.
```

Run smoke test steps 3, 8, 9 from DEPLOY.md.

## Frontend rollback

If the frontend is served from CloudFront / S3:

```bash
# Restore from the previous deploy's snapshot
aws s3 sync s3://bravo-music-public-backups/<previous-deploy>/ \
    s3://bravo-music-public/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
    --distribution-id <id> \
    --paths "/*"
```

If serving from nginx directly:

```bash
# Replace with the backup taken before the deploy
sudo rsync -av --delete \
    /var/www/bravo-music-public-backup-<timestamp>/ \
    /var/www/bravo-music-public/
```

Users may need to hard-refresh to get the old `?v=` query
suffix. CloudFront invalidations propagate over ~5 minutes.

## Migration rollbacks

This is the tricky part. Some migrations CAN be safely undone;
others can't.

### syncIndexes (batch 16) — REVERSIBLE

`syncIndexes` may have DROPPED indexes that weren't in the
new schema. To restore:

```bash
# If you took a backup before:
mongorestore --uri="$MONGO_URI" --gzip \
    /tmp/bravo-backup-pre-deploy/

# Or recreate from the OLD code:
git checkout <good-commit>
node scripts/syncIndexes.js
```

### Genre canonicalization (batch 15) — IRREVERSIBLE without backup

The migration overwrites the `genre` field on existing
records. To roll it back you NEED the Mongo backup taken
before:

```bash
# Stop the API (so it doesn't see partial data)
pm2 stop bravo-api

# Restore Songs / Albums / Artists collections
mongorestore --uri="$MONGO_URI" --gzip \
    --nsInclude='bravomusic.songs' \
    --nsInclude='bravomusic.albums' \
    --nsInclude='bravomusic.artists' \
    --drop \
    /tmp/bravo-backup-pre-deploy/

# Restart
pm2 start bravo-api
```

If you don't have a backup, you're stuck. This is why DEPLOY.md
mandates a backup before every deploy.

### Schema additions (batches 6, 7, 15)

Field additions are forward-compatible — old code ignores
unknown fields. Field removals or required-flag changes are
NOT. Check what the patches did before rolling back schema
changes.

## After rollback

1. Update status page: "Investigating elevated errors → resolved"
2. Confirm error rate is back to baseline (15-30 min)
3. Schedule post-mortem within 24h
4. Write up:
   - What was the deploy intended to do?
   - Why did it fail?
   - What evidence did we have? (use diagnostics captured above)
   - What would have prevented it?
   - Action items + owners

## Post-mortem checklist

For non-trivial rollbacks, write a 1-page post-mortem with:

- **Timeline** — deploy start, first error, rollback start, rollback complete
- **Impact** — # users affected, downtime, $$ revenue impact if measurable
- **Root cause** — what broke, why didn't tests / smoke checks catch it
- **Detection** — how did we find out (monitoring? customer report?)
- **Mitigation** — what we did to recover
- **Lessons** — what we'll change

Add the lessons to DEPLOY.md so we don't repeat them.

## Pre-deploy mitigations

To avoid needing this guide in the first place:

- ALWAYS take a Mongo backup before applying migrations
- ALWAYS run smoke test 1-10 from DEPLOY.md
- ALWAYS run `checkProductionReady.js --check-db`
- NEVER deploy on a Friday afternoon
- NEVER skip the dry-run pass on migrations
- ALWAYS have a teammate review the deploy diff
