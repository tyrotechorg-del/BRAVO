import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Wallet from '../models/Wallet.js';

dotenv.config();

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bravo-music');
        console.log('✅ Connected to MongoDB');
        
        // Clear existing data
        await User.deleteMany({});
        await Artist.deleteMany({});
        await Song.deleteMany({});
        await Wallet.deleteMany({});
        console.log('🗑️ Cleared existing data');
        
        // Create admin user
        const adminPassword = await bcrypt.hash('Admin@123', 10);
        const admin = new User({
            username: 'bravo_admin',
            email: 'admin@bravomusic.com',
            password: adminPassword,
            fullName: 'Bravo Administrator',
            role: 'admin',
            isVerified: true,
            isActive: true,
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'
        });
        await admin.save();
        
        const adminWallet = new Wallet({ user: admin._id, balance: 0 });
        await adminWallet.save();
        
        // Create demo listener
        const listenerPassword = await bcrypt.hash('password123', 10);
        const listener = new User({
            username: 'demo_user',
            email: 'demo@example.com',
            password: listenerPassword,
            fullName: 'Demo User',
            role: 'listener',
            isVerified: true,
            isActive: true,
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
        });
        await listener.save();
        
        const listenerWallet = new Wallet({ user: listener._id, balance: 500 });
        await listenerWallet.save();
        
        // Create demo artist
        const artistPassword = await bcrypt.hash('password123', 10);
        const artistUser = new User({
            username: 'demo_artist',
            email: 'artist@example.com',
            password: artistPassword,
            fullName: 'Demo Artist',
            role: 'artist',
            isVerified: true,
            isActive: true,
            avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100'
        });
        await artistUser.save();
        
        const artistWallet = new Wallet({ user: artistUser._id, balance: 1000 });
        await artistWallet.save();
        
        const artistProfile = new Artist({
            userId: artistUser._id,
            stageName: 'Demo Artist',
            genres: ['Afrobeat', 'Hip Hop'],
            verified: false,
            subscriptionStatus: 'active',
            currentPlan: 'pro',
            uploadCredits: 10,
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            bio: 'Emerging Zambian artist bringing fresh vibes',
            monthlyListeners: 25000,
            totalStreams: 150000,
            totalDownloads: 25000,
            totalRevenue: 12500
        });
        await artistProfile.save();
        
        // Create sample songs
        const sampleSongs = [
            { title: 'Mwana Wa Mama', genre: 'Afrobeat', duration: 180, playCount: 15420, likeCount: 1245 },
            { title: 'Zambian Pride', genre: 'Hip Hop', duration: 210, playCount: 12340, likeCount: 987 },
            { title: 'Kwacha Dance', genre: 'Dancehall', duration: 195, playCount: 9870, likeCount: 756 }
        ];
        
        for (const songData of sampleSongs) {
            const song = new Song({
                title: songData.title,
                genre: songData.genre,
                duration: songData.duration,
                playCount: songData.playCount,
                likeCount: songData.likeCount,
                artist: artistProfile._id,
                coverArt: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300',
                audioUrl: `https://example.com/songs/${songData.title.toLowerCase().replace(/ /g, '_')}.mp3`,
                status: 'approved'
            });
            await song.save();
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ DATABASE SEEDING COMPLETED!');
        console.log('='.repeat(50));
        console.log('\n🔐 Test Accounts:');
        console.log('   👤 Listener: demo@example.com / password123');
        console.log('   🎨 Artist:   artist@example.com / password123');
        console.log('   👑 Admin:    admin@bravomusic.com / Admin@123');
        console.log('\n' + '='.repeat(50));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedDatabase();