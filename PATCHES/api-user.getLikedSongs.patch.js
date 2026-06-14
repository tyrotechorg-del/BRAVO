/**
 * UserAPI Patch — paginated getLikedSongs
 *
 * Apply by replacing the existing `getLikedSongs` method in
 * `frontend/public/js/api/user.js` (which was added in batch 12)
 * with this version.
 *
 * Backwards-compatible: calling `getLikedSongs()` with no args
 * still works (defaults: page 1, limit 20).
 */

async getLikedSongs(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const q = new URLSearchParams({
        page: String(safePage),
        limit: String(safeLimit)
    }).toString();
    return this._authedRequest(`/me/liked?${q}`, { method: 'GET' });
}
