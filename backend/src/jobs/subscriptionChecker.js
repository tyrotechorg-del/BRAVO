const Agenda = require('agenda');
const Artist = require('../models/Artist');
const Subscription = require('../models/Subscription');
const notificationService = require('../services/notificationService');

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define('check expired subscriptions', async () => {
    const now = new Date();
    
    // Find expired artist subscriptions
    const expiredArtists = await Artist.find({
        subscriptionStatus: 'active',
        subscriptionExpiry: { $lt: now }
    });
    
    for (const artist of expiredArtists) {
        artist.subscriptionStatus = 'expired';
        artist.currentPlan = 'none';
        await artist.save();
        
        // Notify artist
        await notificationService.createNotification(
            artist.userId,
            'subscription',
            'Subscription Expired',
            'Your subscription has expired. Renew now to continue uploading music.',
            { type: 'expired' }
        );
    }
    
    // Check for expiring soon (7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const expiringSoon = await Artist.find({
        subscriptionStatus: 'active',
        subscriptionExpiry: { $lt: sevenDaysFromNow, $gt: now }
    });
    
    for (const artist of expiringSoon) {
        const daysLeft = Math.ceil((artist.subscriptionExpiry - now) / (1000 * 60 * 60 * 24));
        await notificationService.notifySubscriptionExpiry(artist.userId, daysLeft);
    }
    
    console.log(`Checked subscriptions: ${expiredArtists.length} expired, ${expiringSoon.length} expiring soon`);
});

agenda.define('check upload credits expiry', async () => {
    const now = new Date();
    
    const expiredCredits = await Artist.find({
        uploadCredits: { $gt: 0 },
        uploadCreditsExpiry: { $lt: now }
    });
    
    for (const artist of expiredCredits) {
        artist.uploadCredits = 0;
        artist.uploadCreditsExpiry = null;
        await artist.save();
        
        await notificationService.createNotification(
            artist.userId,
            'subscription',
            'Upload Credits Expired',
            'Your upload credits have expired. Purchase new credits to continue uploading.',
            { type: 'credits_expired' }
        );
    }
    
    console.log(`Expired upload credits for ${expiredCredits.length} artists`);
});

module.exports = agenda;