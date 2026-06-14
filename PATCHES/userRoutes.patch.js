/**
 * userRoutes.patch.js
 *
 * Adds the new route for getMyLiked.
 *
 * ============================================================
 * HOW TO APPLY
 * ============================================================
 * Edit `backend/src/routes/userRoutes.js`:
 *
 *   1. Add this import near the top alongside the other named
 *      controller imports:
 *
 *      import { ..., getMyLiked } from '../controllers/userController.js';
 *
 *   2. Add this route declaration before the catch-all `/:id`
 *      route (so 'me' isn't interpreted as a user ID — the
 *      route order matters):
 *
 *      router.get('/me/liked', auth, getMyLiked);
 *
 * Verify with curl:
 *
 *      curl -H "Authorization: Bearer $TOKEN" \
 *           "https://api.bravomusics.com/api/users/me/liked?page=1&limit=20"
 *
 * Should return:
 *
 *      { "songs": [...], "total": 42, "page": 1, "totalPages": 3, "limit": 20 }
 */

// EXAMPLE OF WHAT THE FINAL ROUTES FILE SHOULD CONTAIN (excerpt):
//
// import express from 'express';
// import {
//     getProfile, updateProfile, getFollowers, getFollowing,
//     followUser, unfollowUser, getListeningHistory,
//     getUserPlaylists, getSettings, updateSettings, deleteAccount,
//     getMyLiked   // <-- NEW
// } from '../controllers/userController.js';
// import { auth } from '../middleware/auth.js';
//
// const router = express.Router();
//
// // Routes for the current user — must come BEFORE the /:id catch-all
// router.get('/me/liked', auth, getMyLiked);
// router.get('/profile', auth, getProfile);
// router.put('/profile', auth, updateProfile);
// router.get('/me/history', auth, getListeningHistory);
// router.get('/settings', auth, getSettings);
// router.put('/settings', auth, updateSettings);
// router.delete('/account', auth, deleteAccount);
//
// // Routes by user id
// router.get('/:id/followers', getFollowers);
// router.get('/:id/following', getFollowing);
// router.post('/:id/follow', auth, followUser);
// router.delete('/:id/follow', auth, unfollowUser);
// router.get('/:id/playlists', getUserPlaylists);
//
// export default router;
