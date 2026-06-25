import fs from 'fs';
import path from 'path';

/**
 * HTTP Range-aware file streaming.
 *
 * Implements RFC 7233 for the slice-of-functionality browsers actually
 * use for <audio> and <video>: parse `Range: bytes=START-END`, return
 * `206 Partial Content` with `Content-Range` headers, fall back to a
 * full `200` when no range is requested, and return `416` when the
 * range is malformed or unsatisfiable.
 *
 * Why this exists:
 *   - Express's `res.json(...).pipe()` does not handle Range requests.
 *   - Without Range support, HTML5 audio players can't seek (the player
 *     restarts from byte 0 every time the user scrubs).
 *   - `express.static` handles Range natively, but our streaming
 *     endpoints can't use it — they need to run premium-content checks
 *     and analytics before serving the bytes.
 */

// Cap any single chunk. A client can send `Range: bytes=0-` and ask
// for the whole file; for a 500MB video that's a lot of bandwidth to
// commit to one connection. We cap and let the client send a follow-up
// range request for the next slice (the same pattern YouTube uses).
const MAX_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB

/**
 * Resolve a stored URL like "/uploads/audio/song_123.mp3" to an
 * absolute filesystem path, refusing anything that escapes the uploads
 * root. Returns null on traversal attempt or invalid input.
 *
 * Defense in depth: even if `audioUrl` always comes from our own
 * upload code, never trust a path that came from anywhere except a
 * trusted constant.
 */
export function resolveStoragePath(url) {
  if (typeof url !== 'string' || !url) return null;

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');

  // Strip leading slashes so `path.resolve` doesn't treat the URL as
  // an absolute path that escapes the cwd anchor.
  const candidate = path.resolve(process.cwd(), url.replace(/^\/+/, ''));

  // Confine to uploads/ — anything outside is rejected.
  if (candidate !== uploadsRoot && !candidate.startsWith(uploadsRoot + path.sep)) {
    return null;
  }
  return candidate;
}

/**
 * Parse an RFC 7233 Range header value against a known file size.
 * Returns { start, end } (inclusive) or null if malformed/unsatisfiable.
 *
 * Supported forms:
 *   bytes=0-499        → first 500 bytes
 *   bytes=500-         → from byte 500 to end of file
 *   bytes=-500         → last 500 bytes
 *
 * Multi-range requests (`bytes=0-99,200-299`) are rejected here — they
 * require multipart/byteranges responses and no real media client sends
 * them for streaming.
 */
export function parseRange(rangeHeader, fileSize) {
  if (typeof rangeHeader !== 'string') return null;

  // Single range only — reject comma-separated multi-range.
  if (rangeHeader.includes(',')) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startStr, endStr] = match;

  // bytes=- is invalid (both sides empty).
  if (startStr === '' && endStr === '') return null;

  let start;
  let end;

  if (startStr === '') {
    // Suffix range: bytes=-N means "last N bytes".
    const suffix = parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    if (!Number.isFinite(start)) return null;
    end = endStr === '' ? fileSize - 1 : parseInt(endStr, 10);
    if (!Number.isFinite(end)) return null;
  }

  // Validate against file size.
  if (start < 0 || start > end) return null;
  if (start >= fileSize) return null;

  // Clamp end to the last byte if the client over-requested.
  if (end >= fileSize) end = fileSize - 1;

  return { start, end };
}

/**
 * Stream a file to the response with HTTP Range support.
 *
 * @param {Object}   opts
 * @param {string}   opts.url          - stored URL (e.g. "/uploads/audio/foo.mp3")
 * @param {Request}  opts.req          - Express request
 * @param {Response} opts.res          - Express response
 * @param {string}   opts.contentType  - e.g. "audio/mpeg", "video/mp4"
 * @param {number}   [opts.maxChunkSize] - override default 16MB cap
 *
 * Returns a Promise that resolves when the response is fully sent.
 * The caller can `await` it to know when the stream finished (useful
 * for triggering "after stream" analytics).
 */
export function streamFileWithRange({ url, req, res, contentType, maxChunkSize = MAX_CHUNK_SIZE }) {
  return new Promise((resolve) => {
    const filePath = resolveStoragePath(url);
    if (!filePath) {
      res.status(400).json({ error: 'Invalid file path' });
      return resolve();
    }

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      res.status(404).json({ error: 'File not found' });
      return resolve();
    }

    const fileSize = stats.size;

    // Headers that apply to both 200 and 206 responses.
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    // Light caching — short enough that takedowns propagate, long
    // enough that buffering doesn't repeatedly re-fetch headers.
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // HEAD request: just headers, no body. Some players probe with
    // HEAD to learn Content-Length before requesting ranges.
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', fileSize);
      res.status(200).end();
      return resolve();
    }

    const rangeHeader = req.headers.range;

    // No Range header — send the whole file (200 OK).
    if (!rangeHeader) {
      res.setHeader('Content-Length', fileSize);
      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        console.error('Stream error:', err.message);
        if (!res.headersSent) res.status(500).end();
        else res.end();
        resolve();
      });
      stream.on('close', resolve);
      stream.pipe(res);
      return;
    }

    // Parse the range.
    const range = parseRange(rangeHeader, fileSize);
    if (!range) {
      // RFC 7233: send Content-Range: bytes */SIZE with a 416 so the
      // client knows the canonical size.
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).json({ error: 'Range not satisfiable' });
      return resolve();
    }

    // Cap the chunk size. If the client asked for more than our cap,
    // shrink the response and let them request the next slice.
    const requestedSize = range.end - range.start + 1;
    const actualSize = Math.min(requestedSize, maxChunkSize);
    const actualEnd = range.start + actualSize - 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${actualEnd}/${fileSize}`);
    res.setHeader('Content-Length', actualSize);

    const stream = fs.createReadStream(filePath, {
      start: range.start,
      end: actualEnd,
    });

    stream.on('error', (err) => {
      console.error('Range stream error:', err.message);
      if (!res.headersSent) res.status(500).end();
      else res.end();
      resolve();
    });
    stream.on('close', resolve);
    stream.pipe(res);
  });
}