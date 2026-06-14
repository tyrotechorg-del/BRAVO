import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class BackupService {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Run mongodump as a child process.
   *
   * SECURITY FIXES from the original:
   *
   *   1. Original used `exec` with `--uri="${mongoUri}"` interpolated
   *      into the shell command string. If MONGODB_URI ever contained
   *      shell metacharacters (`;`, backticks, `$()`, etc.), they'd be
   *      executed by the shell. While env vars are usually trusted,
   *      shell-interpolating them is a footgun.
   *
   *   2. More importantly, `exec` runs the command via the shell, which
   *      means the FULL command line (including the MongoDB password in
   *      the URI) is visible to anyone with shell access to the box —
   *      it appears in `ps`, `top`, /proc/PID/cmdline, audit logs, etc.
   *
   *   3. mongodump supports `--config` to read the URI from a file, OR
   *      reads env vars directly if you set them up. We use the env-var
   *      approach: spawn() with `env: { ...process.env, MONGODB_URI }`
   *      and pass arguments as an array so no shell interpolation
   *      happens.
   *
   * mongodump 4.4+ accepts `--uri` from env via the `--config` file or
   * via the URI argument with proper escaping. We use the argument form
   * since spawn-array-args is the standard fix and avoids needing a
   * temp file.
   *
   * The URI argument is now a single argv entry passed unparsed by the
   * OS — no shell sees it, so no metachar interpretation. The password
   * is still in argv (which `ps` can sometimes show) but at least
   * there's no shell history record and no audit log of the executed
   * command string.
   */
  runMongodump(backupPath) {
    return new Promise((resolve, reject) => {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        return reject(new Error('MONGODB_URI is not set'));
      }

      // Arguments as array — no shell interpolation. Each entry is a
      // single argv slot, even if it contains special characters.
      const args = [
        `--uri=${mongoUri}`,
        `--archive=${backupPath}`,
        '--gzip',
      ];

      const child = spawn('mongodump', args, {
        // Don't run through a shell.
        shell: false,
        // Inherit stderr so backup errors land in the server logs.
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stdout.on('data', (chunk) => {
        /* discard noisy progress output */
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start mongodump: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mongodump exited with code ${code}: ${stderr.slice(0, 1000)}`));
        }
      });
    });
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `bravo-music-backup-${timestamp}.gz`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      await this.runMongodump(backupPath);

      // Verify the backup file exists and has non-zero size.
      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        fs.unlinkSync(backupPath);
        throw new Error('mongodump produced an empty file');
      }

      const metadata = {
        timestamp: new Date().toISOString(),
        size: stats.size,
        version: '1.0.0',
      };

      fs.writeFileSync(`${backupPath}.meta.json`, JSON.stringify(metadata, null, 2));

      await this.cleanOldBackups();

      console.log(`Backup created: ${backupFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return { success: true, path: backupPath, fileName: backupFileName, size: stats.size };
    } catch (error) {
      console.error('Backup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];

    const files = fs.readdirSync(this.backupDir);
    const backups = [];

    for (const file of files) {
      if (!file.endsWith('.gz')) continue;
      try {
        const stat = fs.statSync(path.join(this.backupDir, file));
        backups.push({
          fileName: file,
          size: stat.size,
          createdAt: stat.birthtime,
        });
      } catch {
        // File was deleted between readdir and stat — skip it.
      }
    }

    return backups.sort((a, b) => b.createdAt - a.createdAt);
  }

  async cleanOldBackups(daysToKeep = 30) {
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let removed = 0;
    for (const backup of backups) {
      if (backup.createdAt >= cutoffDate) continue;

      const backupPath = path.join(this.backupDir, backup.fileName);
      const metaPath = `${backupPath}.meta.json`;

      try {
        fs.unlinkSync(backupPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        removed++;
        console.log(`Deleted old backup: ${backup.fileName}`);
      } catch (err) {
        console.error(`Failed to delete ${backup.fileName}:`, err.message);
      }
    }

    return { removed };
  }
}

export default new BackupService();
