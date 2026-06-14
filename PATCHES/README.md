# PATCHES — additions to existing files

Five patches that need to be applied by hand because they ADD
to existing files rather than replace them. Each patch file is
self-documenting — open it for full context.

## 1. `Subscription.model.patch.js` (from batch 7)

**Target:** `backend/src/models/Subscription.js`

Adds the `listener_premium` plan to the planId enum. Without
this, listeners can't subscribe (the validator rejects the
planId).

How to apply: open the target file. Find the `planId` field
in the schema. Replace its enum array with the one in the
patch. Re-run `npm test` if you have model tests.

## 2. `adminController.systemSettings.patch.js` (from batch 6)

**Target:** `backend/src/controllers/adminController.js`

Adds `getSystemSettings` and `updateSystemSettings` handlers
for the SystemSettings model (new in batch 6). Without this,
the `AdminSettingsPage` (batch 13) shows hardcoded defaults
instead of real values from the DB.

How to apply: append the exported functions to
`adminController.js`. Then in `adminRoutes.js`, add:

```js
router.get('/settings',  requireRole(['admin']), getSystemSettings);
router.put('/settings',  requireRole(['admin']), updateSystemSettings);
```

(adminRoutes.js is shipped in this zip; if you're using ours,
those routes are already wired.)

## 3. `userController.getMyLiked.patch.js` (from batch 15)

**Target:** `backend/src/controllers/userController.js`

Adds a new controller method `getMyLiked` that backs the new
`/api/users/me/liked` paginated endpoint. The new `LikedPage`
on the frontend depends on it.

How to apply: append the exported function to `userController.js`.
Move the `import Like from '../models/Like.js'` import to the
top of the file if it's not already there.

## 4. `userRoutes.patch.js` (from batch 15)

**Target:** `backend/src/routes/userRoutes.js`

Wires `GET /me/liked` to the new `getMyLiked` handler.

**IMPORTANT:** The route must come BEFORE the catch-all
`/:id` route. Otherwise Express interprets 'me' as a user ID
and tries `User.findById('me')`.

How to apply: import `getMyLiked` at the top alongside the
other named imports, then add the route before any `/:id` line.

## 5. `api-user.getLikedSongs.patch.js` (from batch 15)

**Target:** `frontend/public/js/api/user.js`

Replaces the existing `getLikedSongs()` method (already added
in batch 12 but without pagination params) with a version that
accepts `(page, limit)`.

How to apply: find the existing `async getLikedSongs()` method
in `frontend/public/js/api/user.js` and replace it with the
version in the patch file.

## 6. `upgradeToArtist.patch.js` (NEW — for UpgradePage)

**Target:** `backend/src/controllers/userController.js` + `backend/src/routes/userRoutes.js`

Adds the new endpoint `POST /api/users/me/upgrade-to-artist`
that backs the UpgradePage. Without this patch, clicking
"Submit Application" on UpgradePage returns 404.

How to apply: open the patch file — it has the full code to
paste into userController.js plus the one-line route to add to
userRoutes.js.

## Order

These can be applied in any order. The five touch different
files. None depends on another being applied first.

## Verifying

After applying:

1. Restart the backend
2. Hit `GET /api/users/me/liked?page=1&limit=20` with an
   authenticated `Authorization: Bearer <token>` header
3. Should return `{ songs, total, page, totalPages, limit }`
4. Hit `GET /api/admin/settings` as admin — should return the
   SystemSettings doc
5. Hit `POST /api/subscriptions/subscribe` with planId
   "listener_premium" — should be accepted (PawaPay flow
   starts)

If any of these return 404 or "validator failed" errors, the
relevant patch was applied incorrectly. Re-read the patch file's
header comment for guidance.
