import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Wallet from '../models/Wallet.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Proper path handling - relative to project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..'); // Goes up to backend/ or project root
const MUSIC_PATH = path.join(PROJECT_ROOT, 'src', 'utils', 'music');
const IMAGES_PATH = path.join(PROJECT_ROOT, 'src', 'utils', 'images');

// Alternative: Using current working directory
// const MUSIC_PATH = path.join(process.cwd(), 'src', 'utils', 'music');
// const IMAGES_PATH = path.join(process.cwd(), 'src', 'utils', 'images');

// Or using environment variables (recommended for production)
// const MUSIC_PATH = process.env.MUSIC_PATH || path.join(process.cwd(), 'src', 'utils', 'music');
// const IMAGES_PATH = process.env.IMAGES_PATH || path.join(process.cwd(), 'src', 'utils', 'images');

console.log('📁 Music Path:', MUSIC_PATH);
console.log('🖼️ Images Path:', IMAGES_PATH);

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
        const adminPassword = await bcrypt.hash('Admin@comBravo', 10);
        const admin = new User({
            username: 'bravo_admin',
            email: 'admin@bravomusic.com',
            password: adminPassword,
            fullName: 'Bravo Administrator',
            role: 'admin',
            isVerified: true,
            isActive: true,
            avatar: 'images/bravo.png'
        });
        await admin.save();
        
        const adminWallet = new Wallet({ user: admin._id, balance: 0 });
        await adminWallet.save();
        
        // Create demo listener
        const listenerPassword = await bcrypt.hash('listener123', 10);
        const listener = new User({
            username: 'demo_user',
            email: 'listener@bravomusics.com',
            password: listenerPassword,
            fullName: 'Demo User',
            role: 'listener',
            isVerified: true,
            isActive: true,
            avatar: 'images/bravo.png'
        });
        await listener.save();
        
        const listenerWallet = new Wallet({ user: listener._id, balance: 500 });
        await listenerWallet.save();
        
        // Create demo artist
        const artistPassword = await bcrypt.hash('artist123', 10);
        const artistUser = new User({
            username: 'demo_artist',
            email: 'artist@example.com',
            password: artistPassword,
            fullName: 'Demo Artist',
            role: 'artist',
            isVerified: true,
            isActive: true,
            avatar: 'images/bravo.png'
        });
        await artistUser.save();
        
        const artistWallet = new Wallet({ user: artistUser._id, balance: 1000 });
        await artistWallet.save();
        
        const artistProfile = new Artist({
            userId: artistUser._id,
            stageName: 'Demo Artist',
            genres: ['cuundu', 'rock', 'soul'],
            verified: false,
            subscriptionStatus: 'active',
            currentPlan: 'pro',
            uploadCredits: 10,
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            bio: 'Versatile artist bringing cuundu, rock, and soul vibes',
            monthlyListeners: 25000,
            totalStreams: 150000,
            totalDownloads: 25000,
            totalRevenue: 12500
        });
        await artistProfile.save();
        
        // Create sample songs from your actual music files
        const sampleSongs = [
            { 
                title: 'Spy Dollar ft Nawizy - Kapondo', 
                genre: 'cuundu', 
                duration: 210, 
                playCount: 15420, 
                likeCount: 1245,
                filename: 'SPY_DOLLAR_ft_Nawizy...kapondo.(128k).mp3',
                coverImage: 'spy-dolllar.png'
            },
            { 
                title: 'Foster Halyz ft Real Jay - Mudolopo', 
                genre: 'cuundu', 
                duration: 195, 
                playCount: 12340, 
                likeCount: 987,
                filename: 'Foster_Halyz_Ft_Real_Jay...Mudolopo__Official_Video_...#michaeltonkanya_#Realjay_#mudolopo(128k).mp3',
                coverImage: 'real-jay_forster.png'
            },
            { 
                title: 'Chile One - Be My Teacher', 
                genre: 'rock', 
                duration: 225, 
                playCount: 18750, 
                likeCount: 2150,
                filename: 'Be_My_Teacher-Chile_One_MrZambia_Official_Visualizer_(128k).m4a',
                coverImage: 'chile one.png'
            },
            { 
                title: 'Beyonce & Jay Z - Forever Young', 
                genre: 'soul', 
                duration: 248, 
                playCount: 32100, 
                likeCount: 5430,
                filename: 'Beyonce_And_Jay_Z__Forever_Young_(128k).mp3',
                coverImage: null
            },
            { 
                title: 'Céline Dion ft Bee Gees - Immortality', 
                genre: 'soul', 
                duration: 267, 
                playCount: 28940, 
                likeCount: 4670,
                filename: 'Céline_Dion_-_Immortality__Official_HD_Video__ft._Bee_Gees(48k).m4a',
                coverImage: 'celine dion.png'
            },
            { 
                title: 'Driemo - Pensulo', 
                genre: 'rock', 
                duration: 198, 
                playCount: 11230, 
                likeCount: 876,
                filename: 'Driemo_–_Pensulo__Official_Music_Video_(48k).m4a',
                coverImage: 'driemo pensulo.png'
            },
            { 
                title: 'Enya - One By One', 
                genre: 'soul', 
                duration: 232, 
                playCount: 9850, 
                likeCount: 654,
                filename: 'Enya_-_One_By_One(128k).mp3',
                coverImage: 'enya.png'
            },
            { 
                title: 'Enya - Only Time', 
                genre: 'soul', 
                duration: 218, 
                playCount: 25430, 
                likeCount: 3210,
                filename: 'Enya_-_Only_Time__Official_4K_Music_Video_(256k).mp3',
                coverImage: 'enya.png'
            }
        ];
        
        for (const songData of sampleSongs) {
            // Construct full file paths using path.join for cross-platform compatibility
            const audioFullPath = path.join(MUSIC_PATH, songData.filename);
            const coverFullPath = songData.coverImage 
                ? path.join(IMAGES_PATH, songData.coverImage)
                : 'images/bravo.png';
            
            const song = new Song({
                title: songData.title,
                genre: songData.genre,
                duration: songData.duration,
                playCount: songData.playCount,
                likeCount: songData.likeCount,
                artist: artistProfile._id,
                coverArt: coverFullPath,
                audioUrl: audioFullPath,
                status: 'approved'
            });
            await song.save();
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ DATABASE SEEDING COMPLETED!');
        console.log('='.repeat(50));
        console.log('\n📊 Seeded Data:');
        console.log(`   🎵 Songs: ${sampleSongs.length} songs added`);
        console.log('   📍 Music files path:', MUSIC_PATH);
        console.log('   🖼️ Images path:', IMAGES_PATH);
        console.log('\n🎵 Songs Added:');
        sampleSongs.forEach((song, index) => {
            console.log(`   ${index + 1}. ${song.title} (${song.genre})`);
        });
        console.log('\n🔐 Test Accounts:');
        console.log('   👤 Listener: listener@bravomusics.com / listener123');
        console.log('   🎨 Artist:   artist@example.com / artist123');
        console.log('   👑 Admin:    admin@bravomusic.com / Admin@comBravo');
        console.log('\n' + '='.repeat(50));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedDatabase();