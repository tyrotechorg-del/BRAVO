# Batch 15 — Integration Manifest

Master reference for what's in the repo after applying batches
1–15 in order. Pulls together the index.html script load order,
the app.js router cases, and the backend patches that need to
land before everything works end-to-end.

## index.html — full script load order

Replace the entire `<head>` script section (or however the
project loads JS) with this canonical order. Order matters
because later scripts depend on earlier ones (e.g., SongCard
must load before any page that uses it).

```html
<!-- ==================== CORE CONFIG ==================== -->
<script src="js/config.js?v=20260611"></script>

<!-- ==================== AUTH (batch 8) ==================== -->
<script src="js/api/auth.js?v=20260611"></script>
<script src="js/services/authService.js?v=20260611"></script>

<!-- ==================== API CLIENTS ==================== -->
<script src="js/api/user.js?v=20260611"></script>
<script src="js/api/songs.js?v=20260611"></script>
<script src="js/api/artists.js?v=20260611"></script>
<script src="js/api/albums.js?v=20260611"></script>
<script src="js/api/playlists.js?v=20260611"></script>
<script src="js/api/search.js?v=20260611"></script>
<script src="js/api/upload.js?v=20260611"></script>
<script src="js/api/admin.js?v=20260611"></script>          <!-- batch 13 -->
<script src="js/api/wallet.js?v=20260611"></script>         <!-- batch 14 -->
<script src="js/api/payments.js?v=20260611"></script>       <!-- batch 14 -->
<script src="js/api/subscriptions.js?v=20260611"></script>  <!-- batch 14 -->

<!-- ==================== COMPONENTS ==================== -->
<script src="js/components/Toast.js?v=20260611"></script>
<script src="js/components/Modal.js?v=20260611"></script>
<script src="js/components/Notification.js?v=20260611"></script>
<script src="js/components/Waveform.js?v=20260611"></script>
<script src="js/components/AudioPlayer.js?v=20260611"></script>       <!-- batch 10 -->
<script src="js/components/DownloadManager.js?v=20260611"></script>
<script src="js/components/SongCard.js?v=20260611"></script>          <!-- batch 11 (canonical) -->
<script src="js/components/PlaylistCard.js?v=20260611"></script>      <!-- batch 11 -->
<script src="js/components/CommentSection.js?v=20260611"></script>    <!-- batch 11 -->
<script src="js/components/ShareModal.js?v=20260611"></script>
<script src="js/components/UploadForm.js?v=20260611"></script>        <!-- batch 9 -->
<script src="js/components/PaymentFlowModal.js?v=20260611"></script>  <!-- batch 14 NEW -->
<script src="js/components/PurchaseFlow.js?v=20260611"></script>      <!-- batch 14 NEW -->
<script src="js/components/Navbar.js?v=20260611"></script>            <!-- batch 12 -->
<script src="js/components/Sidebar.js?v=20260611"></script>           <!-- batch 12 -->

<!-- ==================== PAGES ==================== -->
<!-- Auth flow (batch 8) -->
<script src="js/pages/Login.js?v=20260611"></script>
<script src="js/pages/Register.js?v=20260611"></script>
<script src="js/pages/ForgotPasswordPage.js?v=20260611"></script>
<script src="js/pages/ResetPasswordPage.js?v=20260611"></script>
<script src="js/pages/VerifyEmail.js?v=20260611"></script>

<!-- Discovery (batch 11) -->
<script src="js/pages/Home.js?v=20260611"></script>
<script src="js/pages/Browse.js?v=20260611"></script>
<script src="js/pages/TrendingPage.js?v=20260611"></script>
<script src="js/pages/SearchPage.js?v=20260611"></script>             <!-- batch 11 NEW -->
<script src="js/pages/AlbumsPage.js?v=20260611"></script>
<script src="js/pages/AlbumView.js?v=20260611"></script>
<script src="js/pages/ArtistProfile.js?v=20260611"></script>
<script src="js/pages/SongDetailPage.js?v=20260611"></script>

<!-- Upload (batch 9) -->
<script src="js/pages/UploadPage.js?v=20260611"></script>

<!-- User dashboards (batch 12) -->
<script src="js/pages/ListenerDashboard.js?v=20260611"></script>
<script src="js/pages/ArtistDashboard.js?v=20260611"></script>
<script src="js/pages/ArtistAlbumsPage.js?v=20260611"></script>       <!-- batch 12 NEW -->
<script src="js/pages/Settings.js?v=20260611"></script>
<script src="js/pages/Earnings.js?v=20260611"></script>
<script src="js/pages/Downloads.js?v=20260611"></script>
<script src="js/pages/LikedPage.js?v=20260611"></script>              <!-- batch 15 rewrite -->
<script src="js/pages/RecentPage.js?v=20260611"></script>

<!-- Wallet & subscriptions (batch 14) -->
<script src="js/pages/WalletPage.js?v=20260611"></script>             <!-- batch 14 NEW -->
<script src="js/pages/SubscriptionPage.js?v=20260611"></script>       <!-- batch 14 NEW -->
<script src="js/pages/PaymentHistoryPage.js?v=20260611"></script>     <!-- batch 14 NEW -->

<!-- Admin (batch 13) -->
<script src="js/pages/AdminDashboard.js?v=20260611"></script>
<script src="js/pages/AdminUsersPage.js?v=20260611"></script>
<script src="js/pages/AdminArtistsPage.js?v=20260611"></script>
<script src="js/pages/AdminAllSongsPage.js?v=20260611"></script>
<script src="js/pages/AdminSongsPage.js?v=20260611"></script>
<script src="js/pages/AdminAlbumsPage.js?v=20260611"></script>
<script src="js/pages/AdminVideosPage.js?v=20260611"></script>
<script src="js/pages/AdminWithdrawalsPage.js?v=20260611"></script>
<script src="js/pages/AdminReportsPage.js?v=20260611"></script>
<script src="js/pages/AdminCommentsPage.js?v=20260611"></script>
<script src="js/pages/AdminSettingsPage.js?v=20260611"></script>

<!-- App boot (last) -->
<script src="js/app.js?v=20260611"></script>
```

Files to REMOVE from index.html (replaced or deleted):
- ❌ `js/pages/ForgotPassword.js` (replaced by ForgotPasswordPage.js)
- ❌ `js/pages/ResetPassword.js` (replaced by ResetPasswordPage.js)
- ❌ `js/services/playerService.js` (replaced by AudioPlayer)

## app.js — router cases

Update the router's switch statement to include every route:

```js
switch (route) {
    // Auth
    case 'login':                 pageInstance = new LoginPage(); break;
    case 'register':              pageInstance = new RegisterPage(); break;
    case 'forgot-password':       pageInstance = new ForgotPasswordPage(); break;
    case 'reset-password':        pageInstance = new ResetPasswordPage(); break;
    case 'verify-email':          pageInstance = new VerifyEmailPage(); break;

    // Discovery
    case '':
    case 'home':                  pageInstance = new HomePage(); break;
    case 'browse':                pageInstance = new BrowsePage(); break;
    case 'trending':              pageInstance = new TrendingPage(); break;
    case 'search':                pageInstance = new SearchPage(); break;
    case 'albums':                pageInstance = new AlbumsPage(); break;

    // Upload (artists only — guard in page)
    case 'upload':                pageInstance = new UploadPage(); break;

    // User dashboards
    case 'dashboard':
        // Branch on role
        pageInstance = authService.getUser()?.role === 'artist'
            ? new ArtistDashboard()
            : new ListenerDashboard();
        break;
    case 'artist/albums':         pageInstance = new ArtistAlbumsPage(); break;
    case 'settings':              pageInstance = new SettingsPage(); break;
    case 'earnings':              pageInstance = new EarningsPage(); break;
    case 'downloads':             pageInstance = new DownloadsPage(); break;
    case 'liked':                 pageInstance = new LikedPage(); break;
    case 'recent':                pageInstance = new RecentPage(); break;

    // Wallet & subscriptions
    case 'wallet':                pageInstance = new WalletPage(); break;
    case 'subscription':          pageInstance = new SubscriptionPage(); break;
    case 'payment-history':       pageInstance = new PaymentHistoryPage(); break;

    // Admin
    case 'admin':
    case 'admin/dashboard':       pageInstance = new AdminDashboardPage(); break;
    case 'admin/users':           pageInstance = new AdminUsersPage(); break;
    case 'admin/artists':         pageInstance = new AdminArtistsPage(); break;
    case 'admin/all-songs':       pageInstance = new AdminAllSongsPage(); break;
    case 'admin/pending':         pageInstance = new AdminSongsPage(); break;
    case 'admin/albums':          pageInstance = new AdminAlbumsPage(); break;
    case 'admin/videos':          pageInstance = new AdminVideosPage(); break;
    case 'admin/withdrawals':     pageInstance = new AdminWithdrawalsPage(); break;
    case 'admin/reports':         pageInstance = new AdminReportsPage(); break;
    case 'admin/comments':        pageInstance = new AdminCommentsPage(); break;
    case 'admin/settings':        pageInstance = new AdminSettingsPage(); break;

    // Dynamic routes
    default:
        if (route.startsWith('album/'))   pageInstance = new AlbumView(route.split('/')[1]);
        else if (route.startsWith('artist/'))  pageInstance = new ArtistProfile(route.split('/')[1]);
        else if (route.startsWith('song/'))    pageInstance = new SongDetailPage(route.split('/')[1]);
        else pageInstance = new HomePage();
}
```

## Backend patches (run in this order)

1. **SystemSettings controller patch** (from batch 6)
   ```bash
   # Apply the patch additions to adminController.js
   # Reference: batch-6/_adminController.systemSettings.patch.js
   ```

2. **Subscription model patch** (from batch 7)
   ```bash
   # Apply to backend/src/models/Subscription.js
   # Reference: batch-7/_Subscription.model.patch.js
   ```

3. **userController.getMyLiked + userRoutes patch** (this batch)
   ```bash
   # Append getMyLiked to backend/src/controllers/userController.js
   # Reference: batch-15/_userController.getMyLiked.patch.js

   # Add the route to backend/src/routes/userRoutes.js
   # Reference: batch-15/_userRoutes.patch.js
   ```

## Database migrations

```bash
# DRY RUN first to see what would change
node batch-15/migration-genres.js --dry-run --mongo-uri $MONGO_URI

# Then for real
node batch-15/migration-genres.js --mongo-uri $MONGO_URI
```

## Frontend api/user.js — getLikedSongs replacement

The existing `getLikedSongs()` in api/user.js (from batch 12)
needs the pagination params added — see
`_api-user.getLikedSongs.patch.js` in this batch.

Replace this:
```js
async getLikedSongs() {
    return this._authedRequest('/me/liked', { method: 'GET' });
}
```

With this:
```js
async getLikedSongs(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const q = new URLSearchParams({ page: String(safePage), limit: String(safeLimit) }).toString();
    return this._authedRequest(`/me/liked?${q}`, { method: 'GET' });
}
```

## Deletes

Run the delete script (or apply the manifest by hand — see `DELETE_LIST.md`):

```bash
bash batch-15/apply-deletes.sh
```

## Sidebar — add wallet + subscription links

The Sidebar (batch 12) has slots for these. If they're not in
your version, add:

```js
{ route: 'wallet',       icon: 'fa-wallet',  label: 'Wallet' },
{ route: 'subscription', icon: 'fa-crown',   label: 'Subscription' },
{ route: 'payment-history', icon: 'fa-history', label: 'Payment History' }
```

These can be in the main nav (visible to all signed-in users).

## Smoke test after applying everything

1. Sign in / sign out works → batch 8
2. Upload a song → batch 9
3. Play a song; premium gate triggers on a premium track → batch 10
4. Search for an artist → batch 11
5. Open Liked → shows actual likes from server, not localStorage → batch 15
6. As artist: open Earnings; request withdrawal → batch 12
7. As admin: open Withdrawals; approve a request; the reason persists → batch 13 fix
8. As user: open Wallet; top up → batch 14 PawaPay flow polls correctly
9. As user: open Subscription; subscribe → batch 14
10. Open Payment History → all of the above shows up → batch 14

If all 10 pass, the platform is in a release-ready state and
you can proceed to batch 16 (production deploy hardening).
