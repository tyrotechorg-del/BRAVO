import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

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
    
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `bravo-music-backup-${timestamp}.gz`;
        const backupPath = path.join(this.backupDir, backupFileName);
        
        try {
            const mongoUri = process.env.MONGODB_URI;
            
            await execPromise(`mongodump --uri="${mongoUri}" --archive="${backupPath}" --gzip`);
            
            const metadata = {
                timestamp: new Date().toISOString(),
                size: fs.statSync(backupPath).size,
                version: '1.0.0'
            };
            
            fs.writeFileSync(`${backupPath}.meta.json`, JSON.stringify(metadata, null, 2));
            await this.cleanOldBackups();
            
            console.log(`Backup created: ${backupFileName}`);
            return { success: true, path: backupPath, fileName: backupFileName };
        } catch (error) {
            console.error('Backup failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async listBackups() {
        const files = fs.readdirSync(this.backupDir);
        const backups = [];
        
        for (const file of files) {
            if (file.endsWith('.gz')) {
                const stat = fs.statSync(path.join(this.backupDir, file));
                backups.push({ fileName: file, size: stat.size, createdAt: stat.birthtime });
            }
        }
        
        return backups.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    async cleanOldBackups(daysToKeep = 30) {
        const backups = await this.listBackups();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        for (const backup of backups) {
            if (backup.createdAt < cutoffDate) {
                const backupPath = path.join(this.backupDir, backup.fileName);
                const metaPath = `${backupPath}.meta.json`;
                
                fs.unlinkSync(backupPath);
                if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
                console.log(`Deleted old backup: ${backup.fileName}`);
            }
        }
    }
}

export default new BackupService();