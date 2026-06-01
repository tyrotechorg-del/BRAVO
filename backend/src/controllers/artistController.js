import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Album from '../models/Album.js';
import Wallet from '../models/Wallet.js';
import Withdrawal from '../models/Withdrawal.js';
import Transaction from '../models/Transaction.js';
import Analytics from '../models/Analytics.js';
import subscriptionService from '../services/subscriptionService.js';
import notificationService from '../services/notificationService.js';

export const getDashboard = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Artist profile not found' });
        }
        
        const songs = await Song.find({ artist: artist._id, status: 'approved' });
        const albums = await Album.find({ artist: artist._id });
        const wallet = await Wallet.findOne({ user: req.user._id });
        
        const totalStreams = songs.reduce((sum, song) => sum + song.playCount, 0);
        const totalDownloads = songs.reduce((sum, song) => sum + song.downloadCount, 0);
        const totalRevenue = songs.reduce((sum, song) => sum + song.revenue, 0);
        
        const recentSongs = await Song.find({ artist: artist._id })
            .sort({ createdAt: -1 })
            .limit(5);
        
        res.json({
            artist,
            stats: {
                totalSongs: songs.length,
                totalAlbums: albums.length,
                totalStreams,
                totalDownloads,
                totalRevenue,
                monthlyListeners: artist.monthlyListeners,
                walletBalance: wallet ? wallet.balance : 0
            },
            recentSongs,
            subscriptionStatus: artist.subscriptionStatus,
            currentPlan: artist.currentPlan,
            uploadCredits: artist.uploadCredits,
            subscriptionExpiry: artist.subscriptionExpiry
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
};

export const getAnalytics = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        const songs = await Song.find({ artist: artist._id });
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const streamsLast30Days = await Analytics.countDocuments({
            song: { $in: songs.map(s => s._id) },
            action: 'stream',
            timestamp: { $gte: thirtyDaysAgo }
        });
        
        const topSongs = await Song.find({ artist: artist._id })
            .sort({ playCount: -1 })
            .limit(5);
        
        const dailyStreams = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const count = await Analytics.countDocuments({
                song: { $in: songs.map(s => s._id) },
                action: 'stream',
                timestamp: { $gte: date, $lt: nextDate }
            });
            
            dailyStreams.push({
                date: date.toISOString().split('T')[0],
                streams: count
            });
        }
        
        res.json({
            totalStreams: songs.reduce((sum, s) => sum + s.playCount, 0),
            streamsLast30Days,
            totalRevenue: songs.reduce((sum, s) => sum + s.revenue, 0),
            topSongs,
            dailyStreams,
            totalDownloads: songs.reduce((sum, s) => sum + s.downloadCount, 0),
            totalLikes: songs.reduce((sum, s) => sum + s.likeCount, 0)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

export const getEarnings = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ user: req.user._id });
        const transactions = await Transaction.find({ user: req.user._id, type: 'royalty' })
            .sort({ createdAt: -1 })
            .limit(50);
        
        const monthlyEarnings = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const earnings = await Transaction.aggregate([
                {
                    $match: {
                        user: req.user._id,
                        type: 'royalty',
                        createdAt: { $gte: monthStart, $lte: monthEnd }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            
            monthlyEarnings.push({
                month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
                earnings: earnings[0]?.total || 0
            });
        }
        
        res.json({
            balance: wallet?.balance || 0,
            totalEarned: wallet?.totalEarned || 0,
            totalWithdrawn: wallet?.totalWithdrawn || 0,
            pendingWithdrawal: wallet?.pendingWithdrawal || 0,
            transactions,
            monthlyEarnings
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
};

export const updateArtistProfile = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(404).json({ error: 'Artist not found' });
        }
        
        const updates = ['stageName', 'genres', 'website', 'recordLabel', 'establishmentYear', 'bio'];
        updates.forEach(field => {
            if (req.body[field] !== undefined) {
                artist[field] = req.body[field];
            }
        });
        
        if (req.file) {
            const storageService = await import('../services/storageService.js');
            artist.bannerImage = await storageService.default.uploadImage(req.file, 'banners');
        }
        
        artist.updatedAt = Date.now();
        await artist.save();
        
        res.json({ message: 'Artist profile updated', artist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

export const getArtistSongs = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        const songs = await Song.find({ artist: artist._id })
            .sort({ createdAt: -1 })
            .populate('album', 'title');
        
        res.json(songs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch songs' });
    }
};

export const getArtistAlbums = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        const albums = await Album.find({ artist: artist._id })
            .sort({ createdAt: -1 })
            .populate('songs', 'title duration');
        
        res.json(albums);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
};

export const requestWithdrawal = async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;
        
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 50;
        if (amount < minWithdrawal) {
            return res.status(400).json({ error: `Minimum withdrawal amount is K${minWithdrawal}` });
        }
        
        const withdrawal = new Withdrawal({
            user: req.user._id,
            amount,
            method,
            accountDetails,
            status: 'pending'
        });
        
        await withdrawal.save();
        
        wallet.pendingWithdrawal += amount;
        wallet.balance -= amount;
        await wallet.save();
        
        await notificationService.notifyAdmins(
            'New Withdrawal Request',
            `${req.user.username} requested withdrawal of K${amount}`,
            { withdrawalId: withdrawal._id }
        );
        
        res.json({ message: 'Withdrawal request submitted', withdrawal });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to request withdrawal' });
    }
};

export const getWithdrawalHistory = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch withdrawal history' });
    }
};

export const purchaseUploadCredits = async (req, res) => {
    try {
        const { packageId } = req.body;
        
        const packages = {
            single: { credits: 1, price: 10 },
            bundle5: { credits: 5, price: 40 },
            bundle10: { credits: 10, price: 70 }
        };
        
        const selectedPackage = packages[packageId];
        if (!selectedPackage) {
            return res.status(400).json({ error: 'Invalid package' });
        }
        
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet || wallet.balance < selectedPackage.price) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        await wallet.deductBalance(selectedPackage.price, `Purchase ${selectedPackage.credits} upload credits`);
        
        const artist = await Artist.findOne({ userId: req.user._id });
        artist.uploadCredits += selectedPackage.credits;
        
        artist.uploadCreditsExpiry = new Date();
        artist.uploadCreditsExpiry.setDate(artist.uploadCreditsExpiry.getDate() + 30);
        
        await artist.save();
        
        const transaction = new Transaction({
            user: req.user._id,
            amount: selectedPackage.price,
            type: 'upload_credit',
            status: 'completed',
            description: `Purchased ${selectedPackage.credits} upload credits`
        });
        await transaction.save();
        
        res.json({
            message: 'Upload credits purchased',
            credits: artist.uploadCredits,
            expiry: artist.uploadCreditsExpiry
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to purchase credits' });
    }
};

export const getSubscriptionStatus = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        const subscription = await subscriptionService.getArtistSubscription(req.user._id);
        
        res.json({
            status: artist.subscriptionStatus,
            plan: artist.currentPlan,
            expiryDate: artist.subscriptionExpiry,
            uploadCredits: artist.uploadCredits,
            uploadCreditsExpiry: artist.uploadCreditsExpiry,
            subscription
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
};

// Artist upload video song
export const uploadVideoSong = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Artist profile not found' });
        }
        
        // Check upload limits
        if (!artist.canUpload()) {
            return res.status(403).json({ 
                error: 'Upload limit reached. Please subscribe or purchase upload credits.' 
            });
        }
        
        const { title, genre, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;
        
        if (!req.files || !req.files.video) {
            return res.status(400).json({ error: 'Video file is required' });
        }
        
        const videoFile = req.files.video[0];
        const coverArt = req.files.coverArt ? req.files.coverArt[0] : null;
        
        // Upload video
        const videoUrl = await storageService.uploadVideo(videoFile, artist._id);
        
        // Upload cover art
        let coverArtUrl = null;
        if (coverArt) {
            coverArtUrl = await storageService.uploadImage(coverArt, 'covers');
        } else {
            coverArtUrl = 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300';
        }
        
        // Get duration
        let duration = 180;
        try {
            duration = await audioService.getDuration(videoFile.path);
        } catch (err) {
            console.log('Could not get duration');
        }
        
        const song = new Song({
            title,
            artist: artist._id,
            genre,
            duration,
            audioUrl: videoUrl, // Use video URL for audio streaming
            videoUrl,
            coverArt: coverArtUrl,
            price: price || 0,
            isPremium: isPremium === 'true' || isPremium === true,
            isVideo: true,
            lyrics: lyrics || '',
            tags: tags ? tags.split(',') : [],
            featuredArtists: featuredArtists ? featuredArtists.split(',') : [],
            status: 'pending' // Artist uploads need admin approval
        });
        
        await song.save();
        
        // Add to album
        if (albumId) {
            const album = await Album.findById(albumId);
            if (album && album.artist.toString() === artist._id.toString()) {
                album.songs.push(song._id);
                await album.save();
            }
        }
        
        // Use upload credit
        await artist.useUploadCredit();
        artist.songsUploaded++;
        await artist.save();
        
        // Notify admins
        await notificationService.notifyAdmins(
            'New Video Song Pending Approval',
            `${artist.stageName} uploaded a new video: ${title}`,
            { songId: song._id, type: 'video' }
        );
        
        res.status(201).json({
            message: 'Video song uploaded successfully, pending approval',
            song: {
                _id: song._id,
                title: song.title,
                videoUrl: song.videoUrl,
                status: song.status
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Video upload failed' });
    }
};

// Artist upload album
export const uploadAlbum = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Artist profile not found' });
        }
        
        const { title, description, genre, type, price, isPremium } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Cover art is required' });
        }
        
        const coverArtUrl = await storageService.uploadImage(req.file, 'covers');
        
        const album = new Album({
            title,
            artist: artist._id,
            description,
            genre,
            type: type || 'album',
            price: price || 0,
            isPremium: isPremium === 'true' || isPremium === true,
            coverArt: coverArtUrl,
            status: 'draft' // Artist albums start as draft
        });
        
        await album.save();
        
        artist.albumsUploaded++;
        await artist.save();
        
        res.status(201).json({
            message: 'Album created successfully. Add songs to publish.',
            album: {
                _id: album._id,
                title: album.title,
                coverArt: album.coverArt,
                status: album.status
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Album creation failed' });
    }
};

// Publish album (artist)
export const publishAlbum = async (req, res) => {
    try {
        const album = await Album.findById(req.params.albumId);
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }
        
        const artist = await Artist.findOne({ userId: req.user._id });
        if (album.artist.toString() !== artist._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        if (album.songs.length === 0) {
            return res.status(400).json({ error: 'Cannot publish empty album' });
        }
        
        album.status = 'published';
        album.releaseDate = new Date();
        await album.save();
        
        // Update all songs in album to approved
        await Song.updateMany(
            { _id: { $in: album.songs } },
            { album: album._id }
        );
        
        res.json({
            message: 'Album published successfully',
            album
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to publish album' });
    }
};

// Get artist's videos
export const getArtistVideos = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        const videos = await Song.find({ 
            artist: artist._id, 
            isVideo: true 
        }).sort({ createdAt: -1 });
        
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
};

// Get all videos (public)
export const getAllVideos = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const videos = await Song.find({ 
            isVideo: true, 
            status: 'approved' 
        })
        .populate('artist', 'stageName verified avatar')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Song.countDocuments({ isVideo: true, status: 'approved' });
        
        res.json({
            videos,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalVideos: total
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
};

// Stream video
export const streamVideo = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song || !song.isVideo) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const stream = await storageService.getVideoStream(song.videoUrl);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
        
        // Track play count
        await song.incrementPlayCount();
    } catch (error) {
        res.status(500).json({ error: 'Video streaming failed' });
    }
};