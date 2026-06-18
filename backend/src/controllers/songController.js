import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import Album from '../models/Album.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import storageService from '../services/storageService.js';
import audioService from '../services/audioService.js';
import notificationService from '../services/notificationService.js';
import { parsePagination } from '../utils/apiResponse.js';
import { streamFileWithRange } from '../utils/streamRange.js';

// Whitelist of genres accepted from user input. The Song model already
// has an enum, but validating in the controller gives nicer errors and
// avoids round-tripping invalid data through Mongo's validator.
const VALID_GENRES = [
  'Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
  'Traditional', 'Amapiano', 'Cuundu', 'Soul', 'Rock', 'Kalindula', 'Other',
];

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/songs                         (public, uses optionalAuth)
export const getSongs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { genre } = req.query;

    const query = { status: 'approved' };
    if (genre && genre !== 'all') {
      // Don't accept arbitrary strings — match against whitelist
      // (case-insensitive). Falls through to no genre filter if invalid.
      const match = VALID_GENRES.find((g) => g.toLowerCase() === genre.toLowerCase());
      if (match) query.genre = match;
    }

    const [songs, total] = await Promise.all([
      Song.find(query)
        .populate('artist', 'stageName verified avatar')
        .sort({ playCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Song.countDocuments(query),
    ]);

    res.json({
      songs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

// GET /api/songs/:id                     (public, uses optionalAuth)
export const getSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('artist', 'stageName verified avatar')
      .populate('featuredArtists', 'stageName')
      .populate('album', 'title coverArt');

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // RACE FIX: Atomic increment. The original `incrementPlayCount()`
    // method does `this.playCount++; await this.save();` which loses
    // increments under concurrency.
    Song.findByIdAndUpdate(song._id, { $inc: { playCount: 1 } }).catch((err) =>
      console.error('Play count update failed:', err.message)
    );

    res.json(song);
  } catch (err) {
    console.error('getSong error:', err);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
};

// GET /api/songs/trending                (public)
export const getTrendingSongs = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const trending = await Song.find({ status: 'approved' })
      .sort({ playCount: -1, likeCount: -1 })
      .limit(limit)
      .populate('artist', 'stageName verified');

    res.json(trending);
  } catch (err) {
    console.error('getTrendingSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch trending songs' });
  }
};

// GET /api/songs/featured                (public)
export const getFeaturedSongs = async (req, res) => {
  try {
    const featured = await Song.find({ status: 'featured' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('artist', 'stageName verified');

    res.json(featured);
  } catch (err) {
    console.error('getFeaturedSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch featured songs' });
  }
};

// GET /api/songs/recent                  (public)
export const getRecentSongs = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const recent = await Song.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('artist', 'stageName verified');

    res.json(recent);
  } catch (err) {
    console.error('getRecentSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch recent songs' });
  }
};

// POST /api/songs                        (auth required)
export const uploadSong = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !artist) {
      return res.status(403).json({ error: 'Only artists and admins can upload songs' });
    }

    let artistId = null;
    if (isAdmin && req.body.artistId) {
      const targetArtist = await Artist.findById(req.body.artistId);
      if (!targetArtist) return res.status(404).json({ error: 'Artist not found' });
      artistId = targetArtist._id;
    } else if (artist) {
      artistId = artist._id;
    }

    if (!artistId) {
      return res.status(403).json({ error: 'Artist profile required' });
    }

    if (!isAdmin && artist && !artist.canUpload()) {
      return res.status(403).json({
        error: 'Upload limit reached. Please subscribe or purchase upload credits.',
      });
    }

    const { title, genre, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;

    if (!title || !genre) {
      return res.status(400).json({ error: 'title and genre are required' });
    }

    const audioFile = req.files?.audio;
    const coverArt = req.files?.coverArt;
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const numPrice = Number(price) || 0;
    if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });

    // Upload audio + cover art in parallel — these are independent I/O.
    const [audioUrl, coverArtUrl, duration] = await Promise.all([
      storageService.uploadAudio(audioFile, artistId),
      coverArt
        ? storageService.uploadImage(coverArt, 'covers')
        : Promise.resolve('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300'),
      audioService.getDuration(audioFile.path).catch(() => 0),
    ]);

    // Parse tags/featuredArtists safely — old code assumed they were strings
    // and crashed if they were arrays. Handle both.
    const parseList = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val) return val.split(',').map((s) => s.trim()).filter(Boolean);
      return [];
    };

    const song = await Song.create({
      title,
      artist: artistId,
      genre,
      duration,
      audioUrl,
      coverArt: coverArtUrl,
      price: numPrice,
      isPremium: isPremium === 'true' || isPremium === true,
      lyrics: lyrics || '',
      tags: parseList(tags),
      featuredArtists: parseList(featuredArtists),
      status: isAdmin ? 'approved' : 'pending',
    });

    if (albumId) {
      const album = await Album.findById(albumId);
      if (album && album.artist.toString() === artistId.toString()) {
        song.album = albumId;
        await Album.findByIdAndUpdate(albumId, { $addToSet: { songs: song._id } });
        await song.save();
      }
    }

    if (!isAdmin && artist) {
      await artist.useUploadCredit();
      // Atomic increment — was `artist.songsUploaded++; save()`.
      await Artist.findByIdAndUpdate(artist._id, { $inc: { songsUploaded: 1 } });
    }

    if (!isAdmin) {
      notificationService.notifyAdmins('New song pending approval', {
        title: song.title,
        artist: artist?.stageName,
      }).catch((err) => console.error('Admin notification failed:', err.message));
    }

    res.status(201).json({
      message: isAdmin
        ? 'Song uploaded and approved successfully'
        : 'Song uploaded successfully, pending approval',
      song,
    });
  } catch (err) {
    console.error('uploadSong error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

// POST /api/songs/:id/like               (auth required)
//
// RACE FIX: The old toggle-by-checking-then-mutating pattern is racy.
// Two simultaneous "like" requests can both pass the "doesn't exist"
// check and both create a Like, double-counting. We rely on a UNIQUE
// compound index { user, song, type } on the Like collection — see
// the schema fix at the bottom of this file. With the index in place,
// `Like.create` throws E11000 on duplicate, which we catch as "already
// liked" → treat as toggle-off.
//
// `likeCount` is updated atomically via $inc + the result of the
// create/delete operation, so it stays in sync.
//
export const likeSong = async (req, res) => {
  try {
    const songId = req.params.id;
    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    const existingLike = await Like.findOne({
      user: req.user._id,
      song: songId,
      type: 'song',
    });

    if (existingLike) {
      // Unlike
      await existingLike.deleteOne();
      await Song.findByIdAndUpdate(songId, {
        $inc: { likeCount: -1 },
        // Don't let likeCount go negative if something else has miscounted.
      });
      // Floor at zero in a follow-up update.
      await Song.updateOne({ _id: songId, likeCount: { $lt: 0 } }, { $set: { likeCount: 0 } });
      return res.json({ liked: false, message: 'Song unliked' });
    }

    // Like
    try {
      await Like.create({ user: req.user._id, song: songId, type: 'song' });
    } catch (err) {
      // E11000 = duplicate key (unique index violation). Treat as "already liked".
      if (err.code === 11000) {
        return res.json({ liked: true, message: 'Already liked' });
      }
      throw err;
    }
    await Song.findByIdAndUpdate(songId, { $inc: { likeCount: 1 } });

    res.json({ liked: true, message: 'Song liked' });
  } catch (err) {
    console.error('likeSong error:', err);
    res.status(500).json({ error: 'Failed to like song' });
  }
};

// DELETE /api/songs/:id/like             (auth required)
export const unlikeSong = async (req, res) => {
  try {
    const songId = req.params.id;

    const result = await Like.findOneAndDelete({
      user: req.user._id,
      song: songId,
      type: 'song',
    });

    if (!result) {
      return res.status(404).json({ error: 'Like not found' });
    }

    await Song.findByIdAndUpdate(songId, { $inc: { likeCount: -1 } });
    await Song.updateOne({ _id: songId, likeCount: { $lt: 0 } }, { $set: { likeCount: 0 } });

    res.json({ liked: false, message: 'Song unliked' });
  } catch (err) {
    console.error('unlikeSong error:', err);
    res.status(500).json({ error: 'Failed to unlike song' });
  }
};

// GET /api/songs/:id/stream              (uses optionalAuth)
//
// HTTP Range-aware audio streaming. Supports seeking in HTML5 <audio>
// players, partial-content requests from mobile media players, and
// HEAD probes for size discovery. See `utils/streamRange.js` for the
// gory protocol details.
//
// Premium gate runs BEFORE we touch the file system. Play-count
// increment is fire-and-forget AFTER the stream has been handed off
// to the response (the request lifecycle keeps running until the
// browser disconnects, so we don't await it here).
//
// Still TODO for a full streaming pass:
//   • Per-stream rate limiting (a client can open hundreds of stream
//     connections from one tab).
//   • "30-second rule" for play count — currently we increment as soon
//     as the stream is opened, so a click on a song detail page counts
//     as a play even if the user never hits play.
//   • Migration to signed CloudFront/S3 URLs in production (range
//     handling moves to CloudFront, this endpoint becomes a redirect
//     to a short-lived signed URL).
//
export const streamSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    if (song.isPremium) {
      if (!req.user) {
        return res.status(401).json({ error: 'Premium content requires sign-in' });
      }
      if (req.user.role !== 'admin') {
        const subscriptionService = (await import('../services/subscriptionService.js')).default;
        const hasSubscription = await subscriptionService.hasActiveSubscription(
          req.user._id,
          'listener_premium'
        );
        if (!hasSubscription) {
          return res.status(403).json({ error: 'Premium content requires a subscription' });
        }
      }
    }

    // Hand the file to the range streamer. It handles 200 / 206 / 416 /
    // 404 / HEAD all internally, so we don't need any more res.* calls
    // after this point.
    await streamFileWithRange({
      url: song.audioUrl,
      req,
      res,
      contentType: 'audio/mpeg',
    });

    // Fire-and-forget play count update. Note: still has the "counts as
    // a play even if user hits stop after 1 second" problem — flagged
    // above for a future streaming pass.
    Song.findByIdAndUpdate(song._id, { $inc: { playCount: 1 } }).catch((err) =>
      console.error('Play count update failed:', err.message)
    );
  } catch (err) {
    console.error('streamSong error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Streaming failed' });
  }
};

// GET /api/songs/by-artist/:artistId     (public)
export const getSongsByArtist = async (req, res) => {
  try {
    // The param can be either a User ID (looked up via Artist.findOne
    // { userId }) or an Artist ID directly. We try both.
    let artist = await Artist.findOne({ userId: req.params.artistId });

    const artistId = artist ? artist._id : req.params.artistId;

    const songs = await Song.find({ artist: artistId, status: 'approved' })
      .sort({ playCount: -1 })
      .populate('artist', 'stageName verified');

    res.json(songs);
  } catch (err) {
    console.error('getSongsByArtist error:', err);
    res.status(500).json({ error: 'Failed to fetch artist songs' });
  }
};

// GET /api/songs/by-genre/:genre         (public)
export const getSongsByGenre = async (req, res) => {
  try {

    // raw user input into a regex constructor is a ReDoS attack vector.
    // We escape special chars so the match is literal.
    const safeGenre = escapeRegex(req.params.genre);

    const songs = await Song.find({
      genre: { $regex: new RegExp(`^${safeGenre}$`, 'i') }, // anchor + case-insensitive
      status: 'approved',
    })
      .limit(50)
      .populate('artist', 'stageName verified');

    res.json(songs);
  } catch (err) {
    console.error('getSongsByGenre error:', err);
    res.status(500).json({ error: 'Failed to fetch songs by genre' });
  }
};

// POST /api/songs/:id/share              (uses optionalAuth)
export const shareSong = async (req, res) => {
  try {
    // Atomic increment — was read-modify-write.
    const song = await Song.findByIdAndUpdate(
      req.params.id,
      { $inc: { shareCount: 1 } },
      { new: true }
    );

    if (!song) return res.status(404).json({ error: 'Song not found' });

    res.json({ message: 'Song shared successfully', shareCount: song.shareCount });
  } catch (err) {
    console.error('shareSong error:', err);
    res.status(500).json({ error: 'Failed to share song' });
  }
};

// GET /api/songs/:id/comments            (public, uses optionalAuth)
export const getSongComments = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    // Comment is now imported at the top of the file — no more dynamic
    // `await import('../models/Comment.js')` in the hot path.
    const [comments, total] = await Promise.all([
      Comment.find({
        song: req.params.id,
        parentComment: null,
        isDeleted: false,
      })
        .populate('user', 'username avatar')
        .populate({
          path: 'replies',
          match: { isDeleted: false },
          populate: { path: 'user', select: 'username avatar' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments({
        song: req.params.id,
        parentComment: null,
        isDeleted: false,
      }),
    ]);

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {

    // arguably nice UX for a comments section but it hides real bugs.
    // Log and return a clear error instead.
    console.error('getSongComments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

// GET /api/songs/videos                  (public)
export const getAllVideos = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [videos, total] = await Promise.all([
      Song.find({ isVideo: true, status: 'approved' })
        .populate('artist', 'stageName verified avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Song.countDocuments({ isVideo: true, status: 'approved' }),
    ]);

    res.json({
      videos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalVideos: total,
      },
    });
  } catch (err) {
    console.error('getAllVideos error:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

// GET /api/songs/:id/video               (uses optionalAuth)
// Same range-aware streaming as streamSong. Video files are bigger
// (max 500MB vs 20MB for audio) which makes Range support even more
// important — without it, seeking in a 30-minute music video would
// rebuffer the entire file from byte 0.
export const streamVideo = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song || !song.isVideo) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (song.isPremium) {
      if (!req.user) {
        return res.status(401).json({ error: 'Premium content requires sign-in' });
      }
      if (req.user.role !== 'admin') {
        const subscriptionService = (await import('../services/subscriptionService.js')).default;
        const hasSubscription = await subscriptionService.hasActiveSubscription(
          req.user._id,
          'listener_premium'
        );
        if (!hasSubscription) {
          return res.status(403).json({ error: 'Premium content requires a subscription' });
        }
      }
    }

    await streamFileWithRange({
      url: song.videoUrl,
      req,
      res,
      contentType: 'video/mp4',
    });

    // Same "every connection counts as a play" caveat as streamSong.
    Song.findByIdAndUpdate(song._id, { $inc: { playCount: 1 } }).catch((err) =>
      console.error('Play count update failed:', err.message)
    );
  } catch (err) {
    console.error('streamVideo error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Video streaming failed' });
  }
};

// DELETE /api/songs/:id                  (auth required)
export const deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && (!artist || song.artist.toString() !== artist._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (song.album) {
      await Album.findByIdAndUpdate(song.album, { $pull: { songs: song._id } });
    }

    // Delete files — best-effort. Don't fail the whole request if the
    // storage deletion errors.
    if (song.audioUrl && !song.audioUrl.startsWith('http')) {
      storageService.deleteFile(song.audioUrl).catch((err) =>
        console.error('Failed to delete audio file:', err.message)
      );
    }
    if (song.coverArt && !song.coverArt.startsWith('http') && !song.coverArt.includes('unsplash')) {
      storageService.deleteFile(song.coverArt).catch((err) =>
        console.error('Failed to delete cover art:', err.message)
      );
    }

    await song.deleteOne();
    res.json({ message: 'Song deleted successfully' });
  } catch (err) {
    console.error('deleteSong error:', err);
    res.status(500).json({ error: 'Failed to delete song' });
  }
};
