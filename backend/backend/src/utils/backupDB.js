import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const backupDir = path.join(__dirname, '../../backups');

const ensureBackupDir = () => {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
};

const createBackup = async () => {
    ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `bravo-music-${timestamp}.gz`);
    
    const mongoUri = process.env.MONGODB_URI;
    
    console.log('Creating database backup...');
    
    exec(`mongodump --uri="${mongoUri}" --archive="${backupFile}" --gzip`, (error, stdout, stderr) => {
        if (error) {
            console.error('Backup failed:', error);
            process.exit(1);
        }
        
        console.log(`Backup created successfully: ${backupFile}`);
        
        const stats = fs.statSync(backupFile);
        const metadata = {
            timestamp: new Date().toISOString(),
            file: path.basename(backupFile),
            size: stats.size,
            sizeMB: (stats.size / 1024 / 1024).toFixed(2)
        };
        
        fs.writeFileSync(
            `${backupFile}.meta.json`,
            JSON.stringify(metadata, null, 2)
        );
        
        console.log(`Backup size: ${metadata.sizeMB} MB`);
        process.exit(0);
    });
};

createBackup();