# Bravo Music — Hardened Build

This zip contains every file rewritten across the 16-batch
audit, organized into the exact repo structure so you can
copy them in directly.

**156 files of audited code + 5 backend patches + operational
documentation.**

## Quickstart

If you just want to apply everything and go:

```bash
# 1. Backup your repo first
cd /path/to/bravo-music
git status        # commit or stash any local changes
git checkout -b hardening-batches

# 2. Extract this zip on top of the repo
cd /path/to/bravo-music
unzip -o /path/to/bravo-music-hardened.zip

# Files copy in. They don't touch your config, your secrets,
# your build artifacts, or your tests.

# 3. Apply the patches (see PATCHES/README.md inside)
# These are additions to existing files — can't be done via
# straight copy. Manual but small.

# 4. Install any new backend dependency
cd backend
npm install morgan

# 5. Run the preflight + index sync + migrations
node scripts/checkProductionReady.js          # exit 0 = ready
node scripts/syncIndexes.js --dry-run         # preview index changes
node scripts/syncIndexes.js                   # apply
node scripts/migration-genres.js --dry-run    # preview genre fixes
node scripts/migration-genres.js              # apply

# 6. Delete dead code (see DELETE_LIST.md)
bash scripts/apply-deletes.sh

# 7. Restart backend, hard-refresh frontend
```

## Directory layout

```
bravo-music-hardened/
├── APPLY.md              <- this file
├── DEPLOY.md             <- production deployment runbook
├── ROLLBACK.md           <- rollback procedure
├── INTEGRATION.md        <- index.html script order + router cases
├── AUDIT.md              <- the final security audit report
├── DELETE_LIST.md        <- 32 dead files queued for removal
│
├── backend/
│   ├── server.js                       <- entry (batch 16, production-hardened)
│   ├── .env.example                    <- canonical env reference
│   ├── src/
│   │   ├── config/
│   │   │   └── validateEnv.js          <- fail-fast env validation
│   │   ├── controllers/                <- 17 audited controllers
│   │   ├── middleware/                 <- auth, rateLimiter, webhook,
│   │   │                                  securityHeaders, logRedactor
│   │   ├── models/                     <- 20 hardened models
│   │   ├── routes/                     <- 17 hardened route files
│   │   ├── services/                   <- 8 audited services (the 12
│   │   │                                  dead ones are in DELETE_LIST)
│   │   └── utils/                      <- apiResponse, genres, streamRange
│   └── scripts/
│       ├── checkProductionReady.js     <- pre-deploy preflight
│       ├── syncIndexes.js              <- Mongoose index sync
│       ├── migration-genres.js         <- one-time DB migration
│       └── apply-deletes.sh            <- safe-delete script
│
├── frontend/
│   └── public/
│       └── js/
│           ├── config.js               <- canonical genres + sub plans
│           ├── app.js                  <- rewritten boot/router
│           ├── api/                    <- 12 API clients
│           ├── components/             <- 11 canonical components
│           ├── pages/                  <- 32 page classes
│           ├── services/
│           │   └── authService.js      <- the auth singleton
│           └── utils/
│               └── validators.js
│
├── PATCHES/                            <- additions to existing files
│   ├── README.md
│   ├── Subscription.model.patch.js
│   ├── adminController.systemSettings.patch.js
│   ├── userController.getMyLiked.patch.js
│   ├── userRoutes.patch.js
│   └── api-user.getLikedSongs.patch.js
│
└── docs/
    └── batch-readmes/                  <- per-batch detailed READMEs
        ├── batch-1.md  (security)
        ├── batch-2.md  (albums/songs/etc.)
        ├── ...
        └── batch-16.md (production hardening)
```

## What gets touched, what doesn't

### Files this zip OVERWRITES (155 total):

- All files in `backend/src/{controllers,models,routes,services,middleware,config,utils,validators}/`
- `backend/server.js`
- All files in `frontend/public/js/{api,components,pages,services,utils}/`
- `frontend/public/js/config.js`
- `frontend/public/js/app.js`

### Files this zip ADDS:

- `backend/scripts/` (4 new scripts)
- `backend/.env.example`
- `PATCHES/` folder
- Top-level docs

### Files this zip DOES NOT TOUCH:

- Your `.env` (real secrets)
- Your `package.json` / `package-lock.json` (you choose when to add morgan)
- Your `.git/`
- Your tests
- Your CSS files
- `frontend/public/index.html` — see INTEGRATION.md for the changes needed
- The 32 dead files queued for deletion — see DELETE_LIST.md

## Order of operations

The full deployment runbook is in `DEPLOY.md`. The
`INTEGRATION.md` file is the script-order reference for
`index.html`. Read both before deploying.

For applying to an existing repo (not deploying):

1. **Copy files** — extract this zip into your repo root.
   Existing files in matching paths are overwritten.

2. **Apply patches** — see `PATCHES/README.md` inside the
   PATCHES folder. Each patch file documents which existing
   file it adds to and where.

3. **Update `frontend/public/index.html`** — script load order
   per `INTEGRATION.md`. Several scripts move; three are
   deleted; five are new.

4. **Install dependencies** — `cd backend && npm install morgan`
   (the only new backend dep).

5. **Smoke test locally** — use the 10-point checklist at the
   bottom of `INTEGRATION.md`.

6. **Run preflight** — `node backend/scripts/checkProductionReady.js`
   should report READY before you deploy.

7. **Take a Mongo backup**.

8. **Run migrations** — genres + indexes.

9. **Apply deletes** — `bash backend/scripts/apply-deletes.sh`.
   This is safe (stashes copies before deleting).

10. **Deploy** — follow `DEPLOY.md`.

## If something breaks

`ROLLBACK.md` has the procedure. The short version:

- Backend issue → `git revert` the patch commit, restart
- Frontend issue → revert the `frontend/public/` directory
- DB migration issue → restore from the Mongo backup you took
  in step 7

The migrations (genre canonicalization + index sync) ARE
reversible **only with a backup**. Don't skip step 7.

## Project totals

| Stat | Value |
|------|-------|
| Files rewritten / new | 156 |
| Lines audited | ~35,945 |
| Dead files queued for deletion | 32 |
| Bug categories fixed (audit) | 10/10 pass |
| Batches | 16 |

Read the per-batch READMEs in `docs/batch-readmes/` for
detailed change logs.

## Questions

If a file doesn't look right after extracting, check:

1. The patches in `PATCHES/` haven't been applied yet —
   they're additions, not replacements
2. Your `index.html` script order (per `INTEGRATION.md`)
3. The console errors during boot (which class is undefined?)

The per-batch READMEs document exactly what each file fixes
and why. If you're debugging a specific page's behavior, find
the batch that owns it and read that README.
