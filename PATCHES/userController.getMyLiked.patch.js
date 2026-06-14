/**
 * userController.getMyLiked.patch.js
 *
 * Adds a new paginated endpoint to userController.js:
 *   GET /api/users/me/liked
 *
 * ============================================================
 * BACKGROUND
 * ============================================================
 * `LikedPage` (rewritten in batch 12) currently builds the
 * user's liked-songs list by:
 *   1. Reading song IDs from localStorage (`bravo_liked`)
 *   2. Doing N parallel `songsAPI.getById(id)` calls
 *
 * This works but has issues:
 *   - N+1 round-trips on first page load
 *   - Trusts localStorage as source of truth (it isn't —
 *     the Like collection on the server is)
 *   - Doesn't show likes made on other devices
 *   - Pruning happens lazily as fetches 404
 *
 * The proper fix is a single endpoint that joins Like → Song
 * server-side and returns a page of populated songs.
 *
 * ============================================================
 * HOW TO APPLY
 * ============================================================
 * Append the exported `getMyLiked` function to
 *   backend/src/controllers/userController.js
 *
 * Then wire it in routes — see `userRoutes.patch.js` in this
 * batch.
 *
 * ============================================================
 * IMPLEMENTATION NOTES
 * ============================================================
 * - Pagination via the shared parsePagination helper from
 *   batch 1 (apiResponse.js).
 * - Joins Like (filtered by user + type='song') → Song with
 *   .populate(), filtering deleted songs.
 * - Returns the same shape as other list endpoints:
 *     { songs, total, page, totalPages, limit }
 * - Sorted by `createdAt DESC` on the Like so the newest likes
 *   come first (matches the user's mental model of "most
 *   recently liked").
 * - Only returns approved songs (status='approved') — songs
 *   that were liked but later rejected/deleted by admin are
 *   silently filtered out. The lazy-prune behavior of the
 *   client matches.
 */

import Like from '../models/Like.js';
import { parsePagination } from '../utils/apiResponse.js';

export const getMyLiked = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { page, limit, skip } = parsePagination(req.query);

        // Count first (cheap with the user+type index)
        const total = await Like.countDocuments({
            user: req.user._id,
            type: 'song'
        });

        // Then fetch the page, populating song + artist
        const likes = await Like.find({
            user: req.user._id,
            type: 'song'
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'song',
                match: { status: 'approved' },   // hide rejected/deleted songs
                populate: {
                    path: 'artist',
                    select: 'stageName avatar verified'
                }
            })
            .lean();

        // Filter out likes whose song was deleted (populate returns null)
        const songs = likes
            .map(l => l.song)
            .filter(s => s != null);

        const totalPages = Math.max(1, Math.ceil(total / limit));

        return res.json({
            songs,
            total,
            page,
            totalPages,
            limit
        });
    } catch (err) {
        console.error('getMyLiked error:', err);
        return res.status(500).json({ error: 'Failed to load liked songs' });
    }
};
