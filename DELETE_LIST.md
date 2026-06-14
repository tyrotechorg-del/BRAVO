# Batch 15 — Dead Code Removal Manifest

Every file below was confirmed dead during the cleanup audit
(see batch 15 README for the methodology). Apply with the
included `apply-deletes.sh` script, or by hand.

## Frontend — dead pages (3 files)

| Path | Reason |
|------|--------|
| `frontend/public/js/pages/ForgotPassword.js` | Replaced by `ForgotPasswordPage.js` (batch 8). Both files coexisted; the old one was orphaned. |
| `frontend/public/js/pages/ResetPassword.js` | Replaced by `ResetPasswordPage.js` (batch 8). Same orphan situation. |
| `frontend/public/js/services/playerService.js` | Replaced by `components/AudioPlayer.js` (batch 10). No remaining consumers — verified via grep. |

## Frontend — entire legacy tree (16 files)

The `frontend/force/` directory is a pre-batch-1 legacy mirror
of the app — a separate HTML/JS implementation that has been
dead since the SPA rewrite. None of it is reachable from
`index.html`, the router, or any other code path.

```
frontend/force/admin-dashboard.html
frontend/force/artist-dashboard.html
frontend/force/browse.html
frontend/force/css/style.css
frontend/force/earnings.html
frontend/force/index.html
frontend/force/js/api.js
frontend/force/js/app.js
frontend/force/js/components.js
frontend/force/js/config.js
frontend/force/library.html
frontend/force/login.html
frontend/force/register.html
frontend/force/settings.html
frontend/force/trending.html
frontend/force/upload.html
```

Delete the entire directory: `rm -rf frontend/force/`.

## Backend — dead controllers (1 file)

| Path | Reason |
|------|--------|
| `backend/src/controllers/dashboardController.js` | Flagged dead in batch 3. Grep audit confirms zero consumers in `backend/src/`. Was a duplicate of admin analytics aggregations that already live in `adminController.getPlatformAnalytics`. |

## Backend — dead services (12 files)

All twelve were flagged in batch 7 and confirmed dead by the
batch 15 audit grep (zero imports outside their own file). The
backend has alternate paths for everything they did:

| Path | Replacement |
|------|-------------|
| `backend/src/services/advancedAnalyticsService.js` | adminController.getPlatformAnalytics + getRevenueAnalytics |
| `backend/src/services/analyticsService.js` | adminController inline aggregations |
| `backend/src/services/audioProcessorService.js` | audioService (kept, hardened in batch 7) |
| `backend/src/services/cacheService.js` | Never wired; backend uses Mongo `.lean()` + indexes for read perf |
| `backend/src/services/mobileMoneyService.js` | pawaPayService (kept, hardened in batch 7) |
| `backend/src/services/moderationService.js` | Manual admin review via AdminReportsPage |
| `backend/src/services/recommendationEngine.js` | songController.getRecommendations |
| `backend/src/services/recommendationService.js` | Same as above |
| `backend/src/services/reportingService.js` | adminController analytics endpoints |
| `backend/src/services/royaltyService.js` | paymentService computes royalties inline on webhook |
| `backend/src/services/searchService.js` | searchController (with ReDoS fixes from batch 3) |
| `backend/src/services/waveformService.js` | audioService.generateWaveform (kept) |

**Total: 32 files removed across frontend + backend.**

## Sanity checks before deleting

The `apply-deletes.sh` script runs these before any `rm`:

1. Confirms each file exists (skip if already gone)
2. Re-runs the grep audit for consumers (refuses to delete if any found)
3. Stashes everything to `.batch-15-deleted/<timestamp>/` first
4. Prints a summary; user confirms; only then actually removes

Recovery: if anything breaks after delete, the stashed copies
are at `.batch-15-deleted/<timestamp>/` and can be restored
with `cp -r .batch-15-deleted/<timestamp>/* ./`.

## NOT deleted (kept intentionally, despite earlier flags)

- **`backend/src/services/audioService.js`** — Used by uploadController for waveform generation. KEEP.
- **`backend/src/services/backupService.js`** — Used by adminController.triggerBackup. KEEP.
- **`backend/src/services/emailService.js`** — Used by authController, paymentController. KEEP.
- **`backend/src/services/notificationService.js`** — Used by likeController, commentController, paymentController. KEEP.
- **`backend/src/services/pawaPayService.js`** — Core of the payment system. KEEP.
- **`backend/src/services/paymentService.js`** — Wraps pawaPayService. KEEP.
- **`backend/src/services/storageService.js`** — Path-traversal-safe file storage. KEEP.
- **`backend/src/services/subscriptionService.js`** — Subscription lifecycle. KEEP.

These 8 services survived the audit. The original codebase had 20 services; after this batch, 8 remain.

- **`frontend/public/js/app.js` createSongCard method** — Still
  used by app.js internally (line 1078 — passed `songWithUrls`).
  External consumers (Home, Browse, ArtistDashboard, ArtistProfile)
  have all migrated to the `SongCard` component in their batch
  rewrites. App.js's internal usage is harmless and rewriting
  app.js is out of scope for this batch. Flagged for batch 16.
