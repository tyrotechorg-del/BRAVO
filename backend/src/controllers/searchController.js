import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import Album from '../models/Album.js';
import Playlist from '../models/Playlist.js';

// SECURITY: ReDoS-safe search
//
// method. This passes user input directly into a regex engine, which
// allows two distinct attacks:
//
//   1. REGEX DOS (ReDoS): A query like `(a+)+$` against any string
//      pins the regex engine for seconds. Even simpler patterns like
//      `a.*a.*a.*a.*` are pathologically slow on long inputs.
//
//   2. UNINTENDED MATCHING: A query containing `.` matches any char,
//      `^` anchors, `[abc]` is a char class, etc. A user searching
//      for "C++" gets weird results because `+` is a regex operator.
//
// The fix: escape regex special chars so the search is a literal
// substring match. For prefix searches (autosuggest), we anchor with
// `^` AFTER escaping the query.
//
// We also cap query length at 100 characters — even with escaping,
// MongoDB scanning a long pattern against millions of documents is
// expensive. Users don't search for 1000-char strings.

const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;

/**
 * Escape user-supplied input for use inside a RegExp.
 * Same helper as in songController — could move to utils/ later.
 */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a "contains, case-insensitive" matcher from user input.
 * Returns null if the query is invalid (too short / too long / not a string).
 */
function buildContainsMatch(q) {
  if (typeof q !== 'string') return null;
  const trimmed = q.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;
  if (trimmed.length > MAX_QUERY_LENGTH) return null;
  return { $regex: escapeRegex(trimmed), $options: 'i' };
}

/**
 * Same as above but anchored to the start (for autosuggest / prefix).
 */
function buildPrefixMatch(q) {
  if (typeof q !== 'string') return null;
  const trimmed = q.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;
  if (trimmed.length > MAX_QUERY_LENGTH) return null;
  return { $regex: `^${escapeRegex(trimmed)}`, $options: 'i' };
}

function parseLimit(limitParam, defaultLimit = 20, maxLimit = 50) {
  return Math.min(maxLimit, Math.max(1, parseInt(limitParam, 10) || defaultLimit));
}

// GET /api/search                        (public)
export const searchAll = async (req, res) => {
  try {
    const { q } = req.query;
    const limit = parseLimit(req.query.limit);

    const match = buildContainsMatch(q);
    if (!match) {
      return res.status(400).json({
        error: `Search query must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
      });
    }

    const [songs, artists, albums] = await Promise.all([
      Song.find({
        $or: [{ title: match }, { tags: match }],
        status: 'approved',
      })
        .limit(limit)
        .populate('artist', 'stageName')
        .lean(),

      Artist.find({
        $or: [{ stageName: match }, { genres: match }],
      })
        .limit(limit)
        .populate('userId', 'avatar')
        .lean(),

      Album.find({
        $or: [{ title: match }, { genre: match }],
        status: 'published',
      })
        .limit(limit)
        .populate('artist', 'stageName')
        .lean(),
    ]);

    res.json({ songs, artists, albums });
  } catch (err) {
    console.error('searchAll error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

// GET /api/search/songs                  (public)
export const searchSongs = async (req, res) => {
  try {
    const match = buildContainsMatch(req.query.q);
    if (!match) {
      return res.status(400).json({
        error: `Search query must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
      });
    }

    const limit = parseLimit(req.query.limit);

    const songs = await Song.find({
      $or: [{ title: match }, { tags: match }],
      status: 'approved',
    })
      .limit(limit)
      .populate('artist', 'stageName')
      .lean();

    res.json(songs);
  } catch (err) {
    console.error('searchSongs error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

// GET /api/search/artists                (public)
export const searchArtists = async (req, res) => {
  try {
    const match = buildContainsMatch(req.query.q);
    if (!match) {
      return res.status(400).json({
        error: `Search query must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
      });
    }

    const limit = parseLimit(req.query.limit);

    const artists = await Artist.find({
      $or: [{ stageName: match }, { genres: match }],
    })
      .limit(limit)
      .populate('userId', 'avatar fullName')
      .lean();

    res.json(artists);
  } catch (err) {
    console.error('searchArtists error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

// GET /api/search/albums                 (public)
export const searchAlbums = async (req, res) => {
  try {
    const match = buildContainsMatch(req.query.q);
    if (!match) {
      return res.status(400).json({
        error: `Search query must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
      });
    }

    const limit = parseLimit(req.query.limit);

    const albums = await Album.find({
      $or: [{ title: match }, { genre: match }],
      status: 'published',
    })
      .limit(limit)
      .populate('artist', 'stageName')
      .lean();

    res.json(albums);
  } catch (err) {
    console.error('searchAlbums error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

// GET /api/search/playlists              (public)

export const searchPlaylists = async (req, res) => {
  try {
    const match = buildContainsMatch(req.query.q);
    if (!match) {
      return res.status(400).json({
        error: `Search query must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
      });
    }

    const limit = parseLimit(req.query.limit);

    const playlists = await Playlist.find({
      name: match,
      isPublic: true,
    })
      .limit(limit)
      .populate('user', 'username')
      .lean();

    res.json(playlists);
  } catch (err) {
    console.error('searchPlaylists error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

// GET /api/search/suggestions            (public)
//
// Autosuggest endpoint. Uses prefix-anchored regex (`^q`) so a user
// typing "Bob" matches "Bob Marley" but not "Reggae Bob".
//

//
export const getSuggestions = async (req, res) => {
  try {
    const match = buildPrefixMatch(req.query.q);
    if (!match) {
      // For suggestions, return an empty array instead of 400 — the
      // frontend hits this on every keystroke and shouldn't see errors
      // for "too short".
      return res.json({ suggestions: [] });
    }

    const [songs, artists] = await Promise.all([
      Song.find({ title: match, status: 'approved' }, 'title').limit(5).lean(),
      Artist.find({ stageName: match }, 'stageName').limit(5).lean(),
    ]);

    const suggestions = [
      ...songs.map((s) => ({ type: 'song', text: s.title })),
      ...artists.map((a) => ({ type: 'artist', text: a.stageName })),
    ];

    res.json({ suggestions });
  } catch (err) {
    console.error('getSuggestions error:', err);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};
