const Agenda = require('agenda');
const backupService = require('../services/backupService');

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define('daily database backup', async () => {
    console.log('Starting daily database backup...');
    
    try {
        const result = await backupService.createBackup();
        
        if (result.success) {
            console.log(`Daily backup completed: ${result.fileName}`);
            
            // Clean up old backups (keep last 30 days)
            await backupService.cleanOldBackups(30);
        } else {
            console.error('Daily backup failed:', result.error);
        }
    } catch (error) {
        console.error('Backup job error:', error);
    }
});

agenda.define('weekly full backup', async () => {
    console.log('Starting weekly full backup...');
    
    try {
        const result = await backupService.createBackup();
        
        if (result.success) {
            console.log(`Weekly backup completed: ${result.fileName}`);
        } else {
            console.error('Weekly backup failed:', result.error);
        }
    } catch (error) {
        console.error('Weekly backup error:', error);
    }
});

const startBackupScheduler = async () => {
    // Schedule daily backup at 2 AM
    await agenda.every('0 2 * * *', 'daily database backup');
    
    // Schedule weekly full backup on Sunday at 3 AM
    await agenda.every('0 3 * * 0', 'weekly full backup');
    
    await agenda.start();
    console.log('Backup scheduler started');
};

module.exports = { startBackupScheduler };