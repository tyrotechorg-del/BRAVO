const Agenda = require('agenda');
const emailService = require('../services/emailService');

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define('send welcome email', async (job) => {
    const { email, username } = job.attrs.data;
    await emailService.sendWelcomeEmail(email, username);
    console.log(`Welcome email sent to ${email}`);
});

agenda.define('send verification email', async (job) => {
    const { email, token } = job.attrs.data;
    await emailService.sendVerificationEmail(email, token);
    console.log(`Verification email sent to ${email}`);
});

agenda.define('send password reset email', async (job) => {
    const { email, token } = job.attrs.data;
    await emailService.sendPasswordResetEmail(email, token);
    console.log(`Password reset email sent to ${email}`);
});

agenda.define('send payment receipt', async (job) => {
    const { email, amount, reference, items } = job.attrs.data;
    await emailService.sendPaymentReceipt(email, amount, reference, items);
    console.log(`Payment receipt sent to ${email}`);
});

agenda.define('send subscription renewal reminder', async (job) => {
    const { email, plan, expiryDate } = job.attrs.data;
    await emailService.sendSubscriptionRenewal(email, plan, expiryDate);
    console.log(`Subscription renewal reminder sent to ${email}`);
});

agenda.define('send bulk newsletter', async (job) => {
    const { recipients, subject, template, data } = job.attrs.data;
    
    for (const recipient of recipients) {
        try {
            await emailService.sendCustomEmail(recipient, subject, template, data);
        } catch (error) {
            console.error(`Failed to send email to ${recipient}:`, error);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Bulk email sent to ${recipients.length} recipients`);
});

agenda.define('send daily digest', async (job) => {
    const User = mongoose.model('User');
    const users = await User.find({
        'preferences.notifications.email': true,
        isActive: true
    });
    
    for (const user of users) {
        // Get user's daily digest data
        const digestData = await getDailyDigestData(user._id);
        await emailService.sendDailyDigest(user.email, user.username, digestData);
    }
    
    console.log(`Daily digest sent to ${users.length} users`);
});

async function getDailyDigestData(userId) {
    const Analytics = mongoose.model('Analytics');
    const Song = mongoose.model('Song');
    const Artist = mongoose.model('Artist');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get new releases from followed artists
    const user = await User.findById(userId).populate('following');
    const followedArtists = await Artist.find({ userId: { $in: user.following } });
    
    const newReleases = await Song.find({
        artist: { $in: followedArtists.map(a => a._id) },
        createdAt: { $gte: yesterday },
        status: 'approved'
    }).limit(5);
    
    // Get top trending songs
    const trending = await Song.find({ status: 'approved' })
        .sort({ playCount: -1 })
        .limit(5);
    
    return {
        newReleases,
        trending,
        date: new Date()
    };
}

module.exports = agenda;