/**
 * upgradeToArtist.patch.js
 *
 * Adds a new endpoint:
 *   POST /api/users/me/upgrade-to-artist
 *
 * Lets a 'listener' role user upgrade to 'artist' role. Creates
 * an Artist record (using the supplied stage name, bio, genres,
 * and social links) and updates user.role from 'listener' to
 * 'artist'. Returns { user, artist }.
 *
 * ============================================================
 * HOW TO APPLY (two steps)
 * ============================================================
 *
 * STEP 1 — Append the exported function below to
 *   backend/src/controllers/userController.js
 *
 * Make sure the import line is at the top of that file:
 *   import Artist from '../models/Artist.js';
 *
 *
 * STEP 2 — Add the route to backend/src/routes/userRoutes.js
 *
 * Import alongside other named imports:
 *   import { ..., upgradeToArtist } from '../controllers/userController.js';
 *
 * Add this route BEFORE the catch-all /:id route (same rule as
 * the getMyLiked patch from batch 15):
 *
 *   router.post('/me/upgrade-to-artist', auth, upgradeToArtist);
 *
 * ============================================================
 * BUSINESS LOGIC NOTES
 * ============================================================
 *
 * - The endpoint REQUIRES authentication (the `auth` middleware
 *   on the route).
 *
 * - It rejects if the user is already an artist or admin —
 *   nothing to upgrade.
 *
 * - It auto-creates an Artist record. This is "self-service"
 *   upgrade. If you'd rather require admin approval before
 *   granting the artist role, change the line marked APPROVAL
 *   below to set isVerified=false and add a separate admin
 *   approval flow. As shipped, the user becomes an artist
 *   immediately but isn't verified — admin can review later
 *   and grant the verified badge via AdminArtistsPage.
 *
 * - Stage name uniqueness is checked. If taken, returns 409.
 *
 * - Wallet creation on upgrade: NOT done here. The artist's
 *   first withdrawal request will trigger wallet creation
 *   automatically via the existing walletController.
 */

import Artist from '../models/Artist.js';

export const upgradeToArtist = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Pull the full user document so we can update it.
        const user = req.user;

        // Already an artist or admin? Nothing to do.
        if (user.role === 'artist' || user.role === 'admin') {
            return res.status(400).json({ error: 'You are already an artist.' });
        }

        const { stageName, bio, genres, socialLinks } = req.body || {};

        // Validation
        if (typeof stageName !== 'string' || stageName.trim().length < 2) {
            return res.status(400).json({ error: 'Stage name must be at least 2 characters.' });
        }
        if (typeof bio !== 'string' || bio.trim().length < 30) {
            return res.status(400).json({ error: 'Bio must be at least 30 characters.' });
        }
        if (!Array.isArray(genres) || genres.length === 0) {
            return res.status(400).json({ error: 'Pick at least one genre.' });
        }

        const trimmedStageName = stageName.trim();
        const trimmedBio = bio.trim();

        // Stage-name uniqueness
        const existingArtist = await Artist.findOne({
            stageName: { $regex: `^${escapeRegex(trimmedStageName)}$`, $options: 'i' }
        }).lean();
        if (existingArtist) {
            return res.status(409).json({ error: 'That stage name is already taken. Try another.' });
        }

        // Create the Artist record.
        // APPROVAL: change isVerified to false and add an admin-review
        // flow if you don't want self-service upgrades.
        const artist = await Artist.create({
            user: user._id,
            stageName: trimmedStageName,
            bio: trimmedBio,
            genres: genres.slice(0, 5),   // cap at 5
            socialLinks: socialLinks && typeof socialLinks === 'object' ? socialLinks : {},
            isVerified: false,            // verification is a separate step (AdminArtistsPage)
            uploadCredits: 3              // give them 3 free uploads to start
        });

        // Update user role
        user.role = 'artist';
        user.artistId = artist._id;
        await user.save();

        // Return the updated user + new artist record.
        return res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                artistId: user.artistId,
                isVerified: user.isVerified
            },
            artist
        });
    } catch (err) {
        console.error('upgradeToArtist error:', err);
        return res.status(500).json({ error: 'Failed to upgrade account. Please try again.' });
    }
};

// Simple regex escape — keep it inline so the patch is self-contained.
function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
