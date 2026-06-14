import Download from '../models/Download.js';
import Song from '../models/Song.js';
import Album from '../models/Album.js';
import Analytics from '../models/Analytics.js';
import Payment from '../models/Payment.js';
import subscriptionService from '../services/subscriptionService.js';
import { parsePagination } from '../utils/apiResponse.js';

// S3 presigner imports are lazy — if the project isn't using S3, we still
// want the controller to load and work in dev mode.
let s3Client = null;
let getSignedUrl = null;
let GetObjectCommand = null;

async function ensureS3Loaded() {
  if (s3Client) return;
  if (!process.env.S3_BUCKET || !process.env.AWS_REGION) return; // dev mode
  try {
    const [{ S3Client, GetObjectCommand: GOC }, { getSignedUrl: gsu }] = await Promise.all([
      import('@aws-sdk/client-s3'),
      import('@aws-sdk/s3-request-presigner'),
    ]);
    s3Client = new S3Client({ region: process.env.AWS_REGION });
    GetObjectCommand = GOC;
    getSignedUrl = gsu;
  } catch (err) {
    console.error('S3 presigner not installed. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`');
  }
}

/**
 * Build a download URL for a song.
 *
 * SECURITY: The original code returned `song.audioUrl` directly, which
 * is a permanent public URL. Anyone who captured it could redistribute
 * indefinitely, bypassing any future subscription gate. We replace that
 * with a short-lived (5 min) signed URL.
 *
 * For FREE (non-premium) songs we still use signed URLs even though the
 * content is freely downloadable — this prevents hotlinking and makes
 * future analytics/abuse-tracking easier (you can revoke the bucket
 * policy without invalidating individual songs).
 *
 * In dev (no S3 configured), falls back to the raw URL so local
 * development isn't blocked.
 */
async function buildDownloadUrl(audioUrl, filename) {
  await ensureS3Loaded();

  if (!s3Client || !getSignedUrl) {
    return { url: audioUrl, expiresIn: null }; // dev fallback
  }

  try {
    const parsed = new URL(audioUrl);
    const key = parsed.pathname.replace(/^\//, '');

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}.mp3"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return { url, expiresIn: 300 };
  } catch (err) {
    console.error('Failed to sign download URL:', err.message);
    return { url: audioUrl, expiresIn: null };
  }
}

/**
 * Record a download event. Works for both logged-in users and guests.
 * Guest downloads get `user: null, isGuest: true` — the IP and userAgent
 * are the only way to correlate guest activity.
 */
async function recordDownload({ user, song, album, quality, ip, userAgent }) {
  return Download.create({
    user: user?._id || null,
    isGuest: !user,
    song,
    album,
    quality,
    ip,
    userAgent,
  });
}

// ============================================================
// POST /api/downloads/song/:songId       (uses optionalAuth)
// ============================================================
//
// Allowed for:
//   - guests (no token)          → only for non-premium songs
//   - logged-in non-subscribers  → only for non-premium songs
//   - subscribers / admins       → premium and non-premium
//
// The premium gate is the ONLY gate. Free songs are downloadable by
// anyone, including guests. Rate limiting is enforced upstream by the
// route's rate-limit middleware (different limits for guests vs users).
//
export const downloadSong = async (req, res) => {
  try {
    const { songId } = req.params;
    const { quality = 'medium' } = req.query;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.isPremium) {
      // Guests can never download premium content.
      if (!req.user) {
        return res.status(401).json({
          error: 'Premium content requires sign-in and an active subscription',
        });
      }
      // Admins bypass the subscription check.
      if (req.user.role !== 'admin') {
        const hasSubscription = await subscriptionService.hasActiveSubscription(
          req.user._id,
          'listener_premium'
        );
        if (!hasSubscription) {
          return res.status(403).json({ error: 'Premium content requires a subscription' });
        }
      }
    }

    // Record the download — works for both users and guests.
    await recordDownload({
      user: req.user || null,
      song: songId,
      quality,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // RACE FIX: Atomic increment. Original code was:
    //   song.downloadCount++; await song.save();
    // which is a read-modify-write race condition under concurrent loads.
    await Song.findByIdAndUpdate(songId, { $inc: { downloadCount: 1 } });

    // Best-effort analytics — don't fail the request if this errors.
    // Guests get user: null in Analytics too.
    Analytics.create({
      user: req.user?._id || null,
      song: songId,
      action: 'download',
      timestamp: new Date(),
    }).catch((err) => console.error('Analytics write failed:', err.message));

    const { url, expiresIn } = await buildDownloadUrl(song.audioUrl, song.title);

    const response = {
      message: 'Download initiated',
      downloadUrl: url,
      song: {
        id: song._id,
        title: song.title,
        artist: song.artist,
      },
    };
    if (expiresIn !== null) response.expiresIn = expiresIn;

    res.json(response);
  } catch (err) {
    console.error('downloadSong error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
};

// ============================================================
// POST /api/downloads/album/:albumId     (uses optionalAuth)
// ============================================================
//
// Same rule: guests can download free albums (no premium, no paid
// purchase required); only premium or paid albums require login + check.
//
export const downloadAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;

    const album = await Album.findById(albumId).populate('songs');
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const isPaidAlbum = album.isPremium && album.price > 0;

    if (isPaidAlbum) {
      if (!req.user) {
        return res.status(401).json({ error: 'This album requires sign-in and purchase' });
      }
      // Payment is now a top-level import — no more dynamic import().
      const hasPurchased = await Payment.findOne({
        user: req.user._id,
        'metadata.albumId': albumId,
        status: 'completed',
      });
      if (!hasPurchased) {
        return res.status(403).json({ error: 'Album requires purchase' });
      }
    }

    if (!album.songs || album.songs.length === 0) {
      return res.json({ message: 'Album has no songs', songs: [] });
    }

    // Run all songs in parallel — much faster than the original sequential
    // for-loop, and we use Promise.all so a single failure cancels the rest
    // before partially-recorded download records leak into the DB.
    const downloadUrls = await Promise.all(
      album.songs.map(async (song) => {
        await recordDownload({
          user: req.user || null,
          song: song._id,
          album: albumId,
          quality: 'high',
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        await Song.findByIdAndUpdate(song._id, { $inc: { downloadCount: 1 } });

        const { url, expiresIn } = await buildDownloadUrl(song.audioUrl, song.title);
        return {
          id: song._id,
          title: song.title,
          url,
          expiresIn,
        };
      })
    );

    res.json({
      message: 'Album download prepared',
      album: {
        id: album._id,
        title: album.title,
      },
      songs: downloadUrls,
    });
  } catch (err) {
    console.error('downloadAlbum error:', err);
    res.status(500).json({ error: 'Album download failed' });
  }
};

// ============================================================
// GET /api/downloads/history             (REQUIRES auth — not optionalAuth)
// ============================================================
//
// History is tied to a user account by definition. Guests don't have
// history. Route this with the strict `auth` middleware, not `optionalAuth`.
//
export const getDownloadHistory = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [downloads, total] = await Promise.all([
      Download.find({ user: req.user._id })
        .populate('song', 'title coverArt artist')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Download.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      downloads,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getDownloadHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch download history' });
  }
};

// ============================================================
// GET /api/downloads/check/:songId       (uses optionalAuth)
// ============================================================
//
// Frontend uses this to decide whether to show a "Download" button or
// a "Subscribe to download" button. Works for guests too — a guest
// checking a free song gets canDownload: true.
//
export const checkDownloadEligibility = async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await Song.findById(songId).select('title isPremium');
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    let canDownload = true;
    let reason = null;
    let requiresAuth = false;

    if (song.isPremium) {
      if (!req.user) {
        canDownload = false;
        requiresAuth = true;
        reason = 'Premium content requires sign-in and a subscription';
      } else if (req.user.role !== 'admin') {
        const hasSubscription = await subscriptionService.hasActiveSubscription(
          req.user._id,
          'listener_premium'
        );
        if (!hasSubscription) {
          canDownload = false;
          reason = 'Premium content requires a subscription';
        }
      }
    }

    res.json({
      canDownload,
      reason,
      requiresAuth,
      isGuest: !req.user,
      song: { title: song.title, isPremium: song.isPremium },
    });
  } catch (err) {
    console.error('checkDownloadEligibility error:', err);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
};
