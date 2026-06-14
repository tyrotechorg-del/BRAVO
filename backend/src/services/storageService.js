import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================
// SECURITY: Path traversal protection
// ============================================================
//
// The original `getAudioStream`, `getVideoStream`, and `deleteFile`
// all did `path.join(process.cwd(), url)` without any check that the
// resulting absolute path stays inside the uploads directory. If
// `url` is ever `../../etc/passwd` (e.g., from a malicious DB row, an
// admin bug, or a misrouted call), the function happily reads or
// DELETES outside the uploads tree.
//
// We added the same `resolveStoragePath` helper that streamRange.js
// uses, and route all file operations through it. Anything outside
// `uploads/` is rejected.

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

function resolveStoragePath(url) {
  if (typeof url !== 'string' || !url) return null;
  const candidate = path.resolve(process.cwd(), url.replace(/^\/+/, ''));
  if (candidate !== UPLOADS_ROOT && !candidate.startsWith(UPLOADS_ROOT + path.sep)) {
    return null;
  }
  return candidate;
}

// ============================================================
// SECURITY: MIME / extension allowlist for uploads
// ============================================================
//
// The original upload methods accepted any file extension and any MIME
// type. A user could upload `evil.html` named `song.mp3` — multer
// preserves whatever extension was given. Even if browsers refuse to
// execute the wrong content-type, having attacker-controlled file
// extensions in your uploads folder is a footgun for any future code
// that processes them.
//
// We allowlist extensions per upload type. Multer should also be
// configured with fileFilter at the route level — this is defence
// in depth.

const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

class StorageService {
  constructor() {
    this.uploadDirs = {
      audio: path.join(process.cwd(), 'uploads', 'audio'),
      video: path.join(process.cwd(), 'uploads', 'video'),
      covers: path.join(process.cwd(), 'uploads', 'images', 'covers'),
      avatars: path.join(process.cwd(), 'uploads', 'images', 'avatars'),
      banners: path.join(process.cwd(), 'uploads', 'images', 'banners'),
    };
    this.ensureDirectories();
  }

  ensureDirectories() {
    for (const dir of Object.values(this.uploadDirs)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Build a collision-resistant filename for stored uploads.
   * Original used `${prefix}_${timestamp}${ext}` which could collide
   * if two uploads landed in the same millisecond. Adding 8 random
   * bytes keeps filenames unique.
   */
  buildFilename(prefix, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}_${Date.now()}_${random}${ext}`;
  }

  // ============================================================
  // Audio upload
  // ============================================================
  async uploadAudio(file, userId) {
    try {
      if (!file || !file.path) return null;

      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
        throw new Error(`Unsupported audio format: ${ext || '(none)'}`);
      }

      const stats = fs.statSync(file.path);
      const fileSizeMB = stats.size / (1024 * 1024);
      const maxAudioSizeMB = parseInt(process.env.MAX_AUDIO_SIZE_MB, 10) || 20;

      if (fileSizeMB > maxAudioSizeMB) {
        throw new Error(
          `Audio file too large. Max size is ${maxAudioSizeMB}MB. Your file: ${fileSizeMB.toFixed(2)}MB`
        );
      }

      // Move to the audio directory with a collision-resistant name.
      // The original code did NOT move audio uploads — it relied on
      // multer's destination being `/uploads/audio` already. That works
      // when configured right, but the function had no normalization,
      // and the returned URL was just a relative cwd-stripped path.
      const filename = this.buildFilename(`audio_${userId}`, file.originalname);
      const newPath = path.join(this.uploadDirs.audio, filename);
      fs.renameSync(file.path, newPath);

      const url = `/uploads/audio/${filename}`;
      return url;
    } catch (error) {
      console.error('uploadAudio error:', error.message);
      throw error;
    }
  }

  // ============================================================
  // Video upload
  // ============================================================
  async uploadVideo(file, userId) {
    try {
      if (!file || !file.path) return null;

      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
        throw new Error(`Unsupported video format: ${ext || '(none)'}`);
      }

      const stats = fs.statSync(file.path);
      const fileSizeMB = stats.size / (1024 * 1024);
      const maxVideoSizeMB = parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 500;

      if (fileSizeMB > maxVideoSizeMB) {
        throw new Error(
          `Video file too large. Max size is ${maxVideoSizeMB}MB. Your file: ${fileSizeMB.toFixed(2)}MB`
        );
      }

      const filename = this.buildFilename(`video_${userId}`, file.originalname);
      const newPath = path.join(this.uploadDirs.video, filename);
      fs.renameSync(file.path, newPath);

      const url = `/uploads/video/${filename}`;
      return url;
    } catch (error) {
      console.error('uploadVideo error:', error.message);
      throw error;
    }
  }

  // ============================================================
  // Image upload
  // ============================================================
  async uploadImage(file, folder) {
    try {
      if (!file || !file.path) return null;

      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        throw new Error(`Unsupported image format: ${ext || '(none)'}`);
      }

      const stats = fs.statSync(file.path);
      const fileSizeMB = stats.size / (1024 * 1024);
      const maxImageSizeMB = 5;

      if (fileSizeMB > maxImageSizeMB) {
        throw new Error(`Image too large. Max size is ${maxImageSizeMB}MB.`);
      }

      const targetDir = this.uploadDirs[folder] || this.uploadDirs.covers;
      const filename = this.buildFilename(folder || 'image', file.originalname);
      const newPath = path.join(targetDir, filename);
      fs.renameSync(file.path, newPath);

      // Reverse-engineer the URL from the target directory.
      const relativePath = newPath.substring(process.cwd().length).replace(/\\/g, '/');
      return relativePath;
    } catch (error) {
      console.error('uploadImage error:', error.message);
      throw error;
    }
  }

  // ============================================================
  // Streams
  // ============================================================
  //
  // NOTE: These return raw fs streams WITHOUT HTTP Range support. The
  // streaming endpoints in songController/artistController use the
  // dedicated `streamFileWithRange` helper from utils/streamRange.js
  // for proper Range-aware streaming. These methods are kept for
  // backwards compatibility with any other code that pipes the stream
  // directly.
  async getAudioStream(url) {
    const filePath = resolveStoragePath(url);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    return fs.createReadStream(filePath);
  }

  async getVideoStream(url) {
    const filePath = resolveStoragePath(url);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    return fs.createReadStream(filePath);
  }

  // ============================================================
  // Delete
  // ============================================================
  //
  // Path-traversal protection is MOST critical here. The original
  // method, given a malicious or buggy URL like '../../etc/passwd',
  // would happily unlink arbitrary files. Now refuses anything
  // outside the uploads directory.
  async deleteFile(url) {
    if (!url) return;

    const filePath = resolveStoragePath(url);
    if (!filePath) {
      console.warn('deleteFile refused suspicious path:', url);
      return;
    }

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('deleteFile error:', err.message);
    }
  }

  async getVideoMetadata(filePath) {
    const resolved = resolveStoragePath(filePath);
    if (!resolved) return null;
    try {
      const stats = fs.statSync(resolved);
      return {
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch (error) {
      console.error('getVideoMetadata error:', error.message);
      return null;
    }
  }
}

export default new StorageService();
