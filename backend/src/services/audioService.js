import fs from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';

/**
 * Minimal audio metadata service.
 *
 * The original was almost entirely placeholder logic:
 *   - getDuration always returned 180 (3 min)
 *   - generateWaveform produced random data each call (so two calls
 *     for the same file gave different waveforms — broken caching)
 *   - extractMetadata returned hardcoded values
 *
 * This rewrite:
 *   - Tries to use ffprobe (if installed) for real duration. Falls back
 *     to a default if ffprobe isn't available — same behaviour as the
 *     original in that case, but at least it tries.
 *   - generateWaveform is now DETERMINISTIC: it derives the peaks from
 *     a hash of the file path. Same file → same waveform every time,
 *     which means caching, change detection, and reproducible UI all
 *     work. Real waveform analysis is a separate concern (waveformService
 *     existed in the original codebase but was dead code).
 *
 * If you want REAL waveform analysis, install ffmpeg + a waveform lib
 * (audiowaveform binary, or fluent-ffmpeg) and replace generateWaveform
 * accordingly. Flagged with TODO.
 */
class AudioService {
  /**
   * Get audio duration in seconds.
   *
   * Uses ffprobe if available. Falls back to 180s default.
   * The spawn call has a 5s timeout — we don't want backend uploads
   * hanging if ffprobe stalls on a corrupted file.
   */
  async getDuration(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return 180; // sensible default
    }

    return new Promise((resolve) => {
      let timer;
      let resolved = false;

      const done = (value) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(value);
      };

      try {
        const child = spawn(
          'ffprobe',
          [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath,
          ],
          { shell: false }
        );

        let stdout = '';
        child.stdout.on('data', (chunk) => (stdout += chunk.toString()));

        child.on('error', () => done(180)); // ffprobe not installed
        child.on('close', (code) => {
          if (code !== 0) return done(180);
          const seconds = parseFloat(stdout.trim());
          done(Number.isFinite(seconds) ? Math.round(seconds) : 180);
        });

        timer = setTimeout(() => {
          try { child.kill('SIGKILL'); } catch {}
          done(180);
        }, 5000);
      } catch {
        done(180);
      }
    });
  }

  /**
   * Generate a placeholder waveform.
   *
   * FIX: original used Math.random() so two calls produced different
   * waveforms — caching the result was useless. Now deterministic
   * based on a hash of the file path, so the same song always
   * renders the same placeholder waveform.
   *
   * TODO: replace with real audio analysis. Either use the `audiowaveform`
   * CLI (https://github.com/bbc/audiowaveform) and parse its output,
   * or use a Node library like `audio-decode` + manual peak detection.
   */
  async generateWaveform(filePath) {
    const seed = crypto.createHash('sha256').update(String(filePath || 'unknown')).digest();

    const peaks = [];
    for (let i = 0; i < 100; i++) {
      // Use 2 bytes per peak from the hash, normalized to 0-100.
      const byte = seed[i % seed.length];
      peaks.push(Math.floor((byte / 255) * 100));
    }

    return JSON.stringify({ peaks, points: 100 });
  }

  async extractMetadata(filePath) {
    // Same placeholder as before. Real metadata would come from ffprobe
    // with the right `-show_entries` flags. Out of scope here.
    return {
      duration: await this.getDuration(filePath),
      bitrate: 128000,
      sampleRate: 44100,
      channels: 2,
      codec: 'mp3',
    };
  }
}

export default new AudioService();
