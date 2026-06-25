const Agenda = require('agenda');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

// Clean up expired sessions
agenda.define('clean expired sessions', async () => {
    const Session = mongoose.model('Session');
    const result = await Session.deleteMany({
        expires: { $lt: new Date() }
    });
    console.log(`Cleaned up ${result.deletedCount} expired sessions`);
});

// Clean up unverified users
agenda.define('clean unverified users', async () => {
    const User = mongoose.model('User');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const result = await User.deleteMany({
        isVerified: false,
        createdAt: { $lt: sevenDaysAgo }
    });
    console.log(`Deleted ${result.deletedCount} unverified users`);
});

// Clean up temporary files
agenda.define('clean temp files', async () => {
    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) return;
    
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            deletedCount++;
        }
    }
    
    console.log(`Cleaned up ${deletedCount} temporary files`);
});

// Clean up expired promotions
agenda.define('clean expired promotions', async () => {
    const Promotion = mongoose.model('Promotion');
    const result = await Promotion.updateMany(
        {
            status: 'active',
            endDate: { $lt: new Date() }
        },
        {
            status: 'expired'
        }
    );
    console.log(`Expired ${result.modifiedCount} promotions`);
});

// Clean up old logs
agenda.define('clean old logs', async () => {
    const AdminLog = mongoose.model('AdminLog');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await AdminLog.deleteMany({
        timestamp: { $lt: thirtyDaysAgo }
    });
    console.log(`Cleaned up ${result.deletedCount} old logs`);
});

// Clean up old analytics data
agenda.define('clean old analytics', async () => {
    const Analytics = mongoose.model('Analytics');
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Aggregate old data before deletion
    const oldData = await Analytics.aggregate([
        {
            $match: {
                timestamp: { $lt: ninetyDaysAgo }
            }
        },
        {
            $group: {
                _id: { song: '$song', action: '$action' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    // Store aggregated data (could be moved to a summary collection)
    const AnalyticsSummary = mongoose.model('AnalyticsSummary');
    for (const summary of oldData) {
        await AnalyticsSummary.findOneAndUpdate(
            {
                song: summary._id.song,
                action: summary._id.action,
                period: 'monthly'
            },
            {
                $inc: { count: summary.count }
            },
            { upsert: true }
        );
    }
    
    // Delete old detailed data
    const result = await Analytics.deleteMany({
        timestamp: { $lt: ninetyDaysAgo }
    });
    console.log(`Cleaned up ${result.deletedCount} old analytics records`);
});

// Clean up abandoned carts/pending payments
agenda.define('clean abandoned payments', async () => {
    const Payment = mongoose.model('Payment');
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const result = await Payment.deleteMany({
        status: 'pending',
        createdAt: { $lt: oneHourAgo }
    });
    console.log(`Cleaned up ${result.deletedCount} abandoned payments`);
});

module.exports = agenda;