import fs from 'fs';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Album from '../models/Album.js';
import Payment from '../models/Payment.js';
import Withdrawal from '../models/Withdrawal.js';
import Report from '../models/Report.js';
import Comment from '../models/Comment.js';
import AdminLog from '../models/AdminLog.js';
import Wallet from '../models/Wallet.js';
import Like from '../models/Like.js';
import Playlist from '../models/Playlist.js';
import backupService from '../services/backupService.js';
import notificationService from '../services/notificationService.js';
import storageService from '../services/storageService.js';
import audioService from '../services/audioService.js';

// ============ USER MANAGEMENT ============

const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;
        const query = {};
        
        if (role && role !== '') query.role = role;
        if (search && search !== '') {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(query)
            .select('-password')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await User.countDocuments(query);
        
        res.json({ 
            users, 
            totalPages: Math.ceil(total / limit), 
            currentPage: parseInt(page), 
            total 
        });
    } catch (error) {
        console.error('getAllUsers error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        let artistProfile = null;
        if (user.role === 'artist') {
            artistProfile = await Artist.findOne({ userId: user._id });
        }
        
        const stats = { totalSongs: 0, totalAlbums: 0, totalStreams: 0, totalSpent: 0 };
        
        if (artistProfile) {
            const songs = await Song.find({ artist: artistProfile._id });
            stats.totalSongs = songs.length;
            stats.totalStreams = songs.reduce((sum, s) => sum + s.playCount, 0);
            stats.totalAlbums = await Album.countDocuments({ artist: artistProfile._id });
        }
        
        const payments = await Payment.find({ user: user._id, status: 'completed' });
        stats.totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
        
        res.json({ user, artistProfile, stats });
    } catch (error) {
        console.error('getUserDetails error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { isActive, role } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if (isActive !== undefined) user.isActive = isActive;
        if (role && ['listener', 'artist', 'admin'].includes(role)) user.role = role;
        
        await user.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'update_user',
            target: user._id,
            details: { changes: req.body }
        });
        await adminLog.save();
        
        res.json({ message: 'User updated successfully', user: user.toJSON() });
    } catch (error) {
        console.error('updateUserStatus error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        await Like.deleteMany({ user: user._id });
        await Comment.deleteMany({ user: user._id });
        await Playlist.deleteMany({ user: user._id });
        await Wallet.deleteOne({ user: user._id });
        
        if (user.role === 'artist') {
            const artist = await Artist.findOne({ userId: user._id });
            if (artist) {
                const songs = await Song.find({ artist: artist._id });
                for (const song of songs) {
                    if (song.audioUrl && !song.audioUrl.startsWith('http')) {
                        await storageService.deleteFile(song.audioUrl);
                    }
                }
                await Song.deleteMany({ artist: artist._id });
                await Artist.deleteOne({ userId: user._id });
            }
        }
        
        await User.findByIdAndDelete(user._id);
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'delete_user',
            target: user._id,
            details: { username: user.username, email: user.email }
        });
        await adminLog.save();
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('deleteUser error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

// ============ ARTIST MANAGEMENT ============

const getAllArtists = async (req, res) => {
    try {
        const artists = await Artist.find()
            .populate('userId', 'email fullName avatar')
            .sort({ createdAt: -1 });
        
        res.json(artists);
    } catch (error) {
        console.error('getAllArtists error:', error);
        res.status(500).json({ error: 'Failed to fetch artists' });
    }
};

const verifyArtist = async (req, res) => {
    try {
        const artist = await Artist.findById(req.params.artistId);
        if (!artist) return res.status(404).json({ error: 'Artist not found' });
        
        artist.verified = true;
        await artist.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'verify_artist',
            target: artist._id,
            details: { stageName: artist.stageName }
        });
        await adminLog.save();
        
        res.json({ message: 'Artist verified successfully', artist });
    } catch (error) {
        console.error('verifyArtist error:', error);
        res.status(500).json({ error: 'Failed to verify artist' });
    }
};

const featureArtist = async (req, res) => {
    try {
        const artist = await Artist.findById(req.params.artistId);
        if (!artist) return res.status(404).json({ error: 'Artist not found' });
        
        artist.featured = !artist.featured;
        await artist.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: artist.featured ? 'feature_artist' : 'unfeature_artist',
            target: artist._id
        });
        await adminLog.save();
        
        res.json({ message: artist.featured ? 'Artist featured' : 'Artist unfeatured', artist });
    } catch (error) {
        console.error('featureArtist error:', error);
        res.status(500).json({ error: 'Failed to update artist feature status' });
    }
};

// ============ SONG MANAGEMENT ============

const getAllSongs = async (req, res) => {
    try {
        const { page = 1, limit = 50, status } = req.query;
        const query = {};
        if (status && status !== '') query.status = status;
        
        const songs = await Song.find(query)
            .populate('artist', 'stageName')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Song.countDocuments(query);
        
        res.json({
            songs,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('getAllSongs error:', error);
        res.status(500).json({ error: 'Failed to fetch songs' });
    }
};

const getPendingSongs = async (req, res) => {
    try {
        const songs = await Song.find({ status: 'pending' })
            .populate('artist', 'stageName')
            .sort({ createdAt: -1 });
        res.json(songs);
    } catch (error) {
        console.error('getPendingSongs error:', error);
        res.status(500).json({ error: 'Failed to fetch pending songs' });
    }
};

const approveSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.songId).populate('artist');
        if (!song) return res.status(404).json({ error: 'Song not found' });
        
        song.status = 'approved';
        await song.save();
        
        const artist = await Artist.findOne({ _id: song.artist._id });
        if (artist) {
            await notificationService.createNotification(
                artist.userId,
                'admin',
                'Song Approved',
                `Your song "${song.title}" has been approved and is now live!`,
                { songId: song._id }
            );
        }
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'approve_song',
            target: song._id,
            details: { title: song.title }
        });
        await adminLog.save();
        
        res.json({ message: 'Song approved successfully', song });
    } catch (error) {
        console.error('approveSong error:', error);
        res.status(500).json({ error: 'Failed to approve song' });
    }
};

const rejectSong = async (req, res) => {
    try {
        const { reason } = req.body;
        const song = await Song.findById(req.params.songId).populate('artist');
        if (!song) return res.status(404).json({ error: 'Song not found' });
        
        song.status = 'rejected';
        await song.save();
        
        const artist = await Artist.findOne({ _id: song.artist._id });
        if (artist) {
            await notificationService.createNotification(
                artist.userId,
                'admin',
                'Song Rejected',
                `Your song "${song.title}" was rejected. Reason: ${reason || 'Content guidelines violation'}`,
                { songId: song._id }
            );
        }
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'reject_song',
            target: song._id,
            details: { title: song.title, reason }
        });
        await adminLog.save();
        
        res.json({ message: 'Song rejected', song });
    } catch (error) {
        console.error('rejectSong error:', error);
        res.status(500).json({ error: 'Failed to reject song' });
    }
};

const deleteSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.songId);
        if (!song) return res.status(404).json({ error: 'Song not found' });
        
        if (song.audioUrl && !song.audioUrl.startsWith('http')) {
            await storageService.deleteFile(song.audioUrl);
        }
        if (song.coverArt && !song.coverArt.startsWith('http') && !song.coverArt.includes('unsplash')) {
            await storageService.deleteFile(song.coverArt);
        }
        await song.deleteOne();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'delete_song',
            target: song._id,
            details: { title: song.title }
        });
        await adminLog.save();
        
        res.json({ message: 'Song deleted successfully' });
    } catch (error) {
        console.error('deleteSong error:', error);
        res.status(500).json({ error: 'Failed to delete song' });
    }
};

// ============ ALBUM MANAGEMENT ============

const getAllAlbums = async (req, res) => {
    try {
        const albums = await Album.find()
            .populate('artist', 'stageName')
            .populate('songs', 'title duration')
            .sort({ createdAt: -1 });
        res.json(albums);
    } catch (error) {
        console.error('getAllAlbums error:', error);
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
};

// ============ ADMIN UPLOAD ============

const adminUploadSong = async (req, res) => {
    try {
        console.log('=== ADMIN UPLOAD SONG ===');
        console.log('Request files:', req.files);
        console.log('Request body:', req.body);
        
        const { title, genre, artistId, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;
        
        const artist = await Artist.findById(artistId);
        if (!artist) {
            return res.status(404).json({ error: 'Artist not found' });
        }
        
        let audioFile = null;
        let audioUrl = null;
        let coverArtUrl = null;
        
        if (req.files && req.files.audio && req.files.audio[0]) {
            audioFile = req.files.audio[0];
            audioUrl = await storageService.uploadAudio(audioFile, artistId);
        } else {
            audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        }
        
        if (req.files && req.files.coverArt && req.files.coverArt[0]) {
            const coverFile = req.files.coverArt[0];
            coverArtUrl = await storageService.uploadImage(coverFile, 'covers');
        } else {
            coverArtUrl = 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300';
        }
        
        let duration = 180;
        if (audioFile && audioFile.path && fs.existsSync(audioFile.path)) {
            try {
                duration = await audioService.getDuration(audioFile.path);
            } catch (err) {
                console.log('Could not get duration, using default');
            }
        }
        
        const song = new Song({
            title,
            artist: artistId,
            genre,
            duration,
            audioUrl,
            coverArt: coverArtUrl,
            price: price || 0,
            isPremium: isPremium === 'true' || isPremium === true,
            lyrics: lyrics || '',
            tags: tags ? tags.split(',') : [],
            featuredArtists: featuredArtists ? featuredArtists.split(',') : [],
            status: 'approved'
        });
        
        await song.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'admin_upload_song',
            target: song._id,
            details: { title, artist: artist.stageName, audioUrl }
        });
        await adminLog.save();
        
        res.status(201).json({
            message: 'Song uploaded and approved successfully',
            song
        });
    } catch (error) {
        console.error('Admin upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
};

// ============ WITHDRAWALS ============

const getWithdrawals = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && status !== '') query.status = status;
        
        const withdrawals = await Withdrawal.find(query)
            .populate('user', 'username email fullName')
            .sort({ createdAt: -1 });
        
        res.json(withdrawals);
    } catch (error) {
        console.error('getWithdrawals error:', error);
        res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
};

const processWithdrawal = async (req, res) => {
    try {
        const { withdrawalId, action, transactionReference } = req.body;
        
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
        
        if (action === 'approve') {
            withdrawal.status = 'approved';
            withdrawal.processedAt = new Date();
            withdrawal.transactionReference = transactionReference;
            
            const wallet = await Wallet.findOne({ user: withdrawal.user });
            if (wallet) {
                wallet.totalWithdrawn += withdrawal.amount;
                wallet.pendingWithdrawal -= withdrawal.amount;
                await wallet.save();
            }
            
            await notificationService.createNotification(
                withdrawal.user,
                'withdrawal',
                'Withdrawal Approved',
                `Your withdrawal of K${withdrawal.amount} has been approved and processed.`,
                { amount: withdrawal.amount, status: 'approved' }
            );
        } else if (action === 'reject') {
            withdrawal.status = 'rejected';
            
            const wallet = await Wallet.findOne({ user: withdrawal.user });
            if (wallet) {
                wallet.balance += withdrawal.amount;
                wallet.pendingWithdrawal -= withdrawal.amount;
                await wallet.save();
            }
            
            await notificationService.createNotification(
                withdrawal.user,
                'withdrawal',
                'Withdrawal Rejected',
                `Your withdrawal request of K${withdrawal.amount} has been rejected.`,
                { amount: withdrawal.amount, status: 'rejected' }
            );
        }
        
        await withdrawal.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: `withdrawal_${action}`,
            target: withdrawal._id,
            details: { amount: withdrawal.amount, reference: transactionReference }
        });
        await adminLog.save();
        
        res.json({ message: `Withdrawal ${action}d`, withdrawal });
    } catch (error) {
        console.error('processWithdrawal error:', error);
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
};

// ============ REPORTS ============

const getReports = async (req, res) => {
    try {
        const reports = await Report.find({ status: 'pending' })
            .populate('reporter', 'username email')
            .populate('reportedUser', 'username email')
            .sort({ createdAt: -1 });
        res.json(reports);
    } catch (error) {
        console.error('getReports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
};

const resolveReport = async (req, res) => {
    try {
        const { reportId, action, adminNotes } = req.body;
        
        const report = await Report.findById(reportId);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        report.status = 'resolved';
        report.resolvedAt = new Date();
        report.resolvedBy = req.user._id;
        report.adminNotes = adminNotes;
        
        if (action === 'remove_content') {
            if (report.type === 'song') {
                await Song.findByIdAndDelete(report.contentId);
            } else if (report.type === 'comment') {
                await Comment.findByIdAndDelete(report.contentId);
            }
            report.actionTaken = 'content_removed';
        } else if (action === 'warn_user') {
            report.actionTaken = 'user_warned';
        } else if (action === 'ban_user') {
            if (report.reportedUser) {
                await User.findByIdAndUpdate(report.reportedUser, { isActive: false });
            }
            report.actionTaken = 'user_banned';
        } else if (action === 'dismiss') {
            report.actionTaken = 'dismissed';
        }
        
        await report.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'resolve_report',
            target: report._id,
            details: { action, adminNotes }
        });
        await adminLog.save();
        
        res.json({ message: 'Report resolved', report });
    } catch (error) {
        console.error('resolveReport error:', error);
        res.status(500).json({ error: 'Failed to resolve report' });
    }
};

// ============ SETTINGS ============

const getSystemSettings = async (req, res) => {
    try {
        res.json({
            platformCommission: process.env.PLATFORM_COMMISSION_RATE || 20,
            minWithdrawalAmount: process.env.MIN_WITHDRAWAL_AMOUNT || 50,
            maxUploadSize: process.env.MAX_UPLOAD_SIZE_MB || 50,
            subscriptionPlans: {
                artist_basic: { price: 50, uploadLimit: 10, features: ['Basic Analytics', '10 Uploads'] },
                artist_pro: { price: 120, uploadLimit: -1, features: ['Advanced Analytics', 'Unlimited Uploads', 'Monetization'] },
                artist_vip: { price: 300, uploadLimit: -1, features: ['Verified Badge', 'Homepage Promotion', 'Priority Support'] }
            }
        });
    } catch (error) {
        console.error('getSystemSettings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        const { platformCommission, minWithdrawalAmount, maxUploadSize } = req.body;
        
        if (platformCommission) process.env.PLATFORM_COMMISSION_RATE = platformCommission;
        if (minWithdrawalAmount) process.env.MIN_WITHDRAWAL_AMOUNT = minWithdrawalAmount;
        if (maxUploadSize) process.env.MAX_UPLOAD_SIZE_MB = maxUploadSize;
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'update_settings',
            details: { platformCommission, minWithdrawalAmount, maxUploadSize }
        });
        await adminLog.save();
        
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('updateSystemSettings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

// ============ BACKUP ============

const triggerBackup = async (req, res) => {
    try {
        await backupService.createBackup();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'trigger_backup'
        });
        await adminLog.save();
        
        res.json({ message: 'Backup initiated successfully' });
    } catch (error) {
        console.error('triggerBackup error:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
};

// ============ REPORTED COMMENTS ============

const getReportedComments = async (req, res) => {
    try {
        const comments = await Comment.find({ isFlagged: true, isDeleted: false })
            .populate('user', 'username')
            .populate('song', 'title')
            .sort({ flaggedAt: -1 });
        res.json(comments);
    } catch (error) {
        console.error('getReportedComments error:', error);
        res.status(500).json({ error: 'Failed to fetch reported comments' });
    }
};

const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        
        comment.isDeleted = true;
        await comment.save();
        
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'delete_comment',
            target: comment._id
        });
        await adminLog.save();
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('deleteComment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};

// ============ PLATFORM ANALYTICS ============

const getPlatformAnalytics = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalArtists = await Artist.countDocuments();
        const totalSongs = await Song.countDocuments({ status: 'approved' });
        const totalAlbums = await Album.countDocuments();
        const totalPending = await Song.countDocuments({ status: 'pending' });
        
        const totalRevenue = await Payment.aggregate([
            { $match: { status: 'completed', type: { $ne: 'withdrawal' } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const platformCommission = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$platformCommission' } } }
        ]);
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const newUsersLast30Days = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
        const newSongsLast30Days = await Song.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'approved' });
        
        res.json({
            overview: {
                totalUsers,
                totalArtists,
                totalSongs,
                totalAlbums,
                totalPending,
                totalRevenue: totalRevenue[0]?.total || 0,
                platformCommission: platformCommission[0]?.total || 0
            },
            growth: { newUsersLast30Days, newSongsLast30Days }
        });
    } catch (error) {
        console.error('getPlatformAnalytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const monthlyRevenue = await Payment.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 11)) } } },
            { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$amount' }, commission: { $sum: '$platformCommission' } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        const revenueByType = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ]);
        
        res.json({ monthly: monthlyRevenue, byType: revenueByType });
    } catch (error) {
        console.error('getRevenueAnalytics error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
};

// ==================== NEW ADMIN FUNCTIONS ====================

// Get all songs with filters for admin management
const getAllSongsForAdmin = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            genre, 
            artistId,
            search,
            isVideo,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;
        
        const query = {};
        
        if (status) query.status = status;
        if (genre) query.genre = genre;
        if (artistId) query.artist = artistId;
        if (isVideo !== undefined) query.isVideo = isVideo === 'true';
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }
        
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const songs = await Song.find(query)
            .populate('artist', 'stageName userId email')
            .populate('album', 'title')
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Song.countDocuments(query);
        
        // Get summary statistics
        const stats = {
            total: total,
            pending: await Song.countDocuments({ status: 'pending' }),
            approved: await Song.countDocuments({ status: 'approved' }),
            rejected: await Song.countDocuments({ status: 'rejected' }),
            featured: await Song.countDocuments({ status: 'featured' }),
            withVideo: await Song.countDocuments({ isVideo: true }),
            byGenre: await Song.aggregate([
                { $group: { _id: '$genre', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        };
        
        res.json({
            success: true,
            songs,
            stats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch songs' });
    }
};

// Get all artists with their IDs for admin upload reference
const getAllArtistsForAdmin = async (req, res) => {
    try {
        const { search, verified, featured, limit = 100 } = req.query;
        
        const query = {};
        if (search) {
            query.$or = [
                { stageName: { $regex: search, $options: 'i' } },
                { 'userId.email': { $regex: search, $options: 'i' } }
            ];
        }
        if (verified !== undefined) query.verified = verified === 'true';
        if (featured !== undefined) query.featured = featured === 'true';
        
        const artists = await Artist.find(query)
            .populate('userId', 'username email avatar fullName')
            .select('stageName userId verified featured genres monthlyListeners totalStreams subscriptionStatus currentPlan')
            .limit(parseInt(limit))
            .sort({ stageName: 1 });
        
        // Format for easy selection
        const formattedArtists = artists.map(artist => ({
            _id: artist._id,
            stageName: artist.stageName,
            email: artist.userId?.email,
            username: artist.userId?.username,
            verified: artist.verified,
            featured: artist.featured,
            genres: artist.genres,
            monthlyListeners: artist.monthlyListeners,
            subscriptionStatus: artist.subscriptionStatus,
            currentPlan: artist.currentPlan,
            avatar: artist.userId?.avatar,
            displayName: `${artist.stageName} (${artist.userId?.email})`
        }));
        
        res.json({
            success: true,
            total: artists.length,
            artists: formattedArtists
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch artists' });
    }
};

// Admin upload video song
const adminUploadVideo = async (req, res) => {
    try {
        console.log('=== ADMIN UPLOAD VIDEO ===');
        console.log('Request files:', req.files);
        console.log('Request body:', req.body);
        
        const { title, genre, artistId, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;
        
        // Verify artist exists
        const artist = await Artist.findById(artistId);
        if (!artist) {
            return res.status(404).json({ error: 'Artist not found' });
        }
        
        let videoUrl = null;
        let audioUrl = null;
        let coverArtUrl = null;
        
        // Upload video file
        if (req.files && req.files.video && req.files.video[0]) {
            const videoFile = req.files.video[0];
            console.log('Video file received:', videoFile.originalname);
            
            // Upload video to storage
            videoUrl = await storageService.uploadVideo(videoFile, artistId);
            console.log('Video URL saved:', videoUrl);
        } else {
            return res.status(400).json({ error: 'Video file is required' });
        }
        
        // Upload audio (optional - can extract from video)
        if (req.files && req.files.audio && req.files.audio[0]) {
            const audioFile = req.files.audio[0];
            audioUrl = await storageService.uploadAudio(audioFile, artistId);
        }
        
        // Upload cover art
        if (req.files && req.files.coverArt && req.files.coverArt[0]) {
            const coverFile = req.files.coverArt[0];
            coverArtUrl = await storageService.uploadImage(coverFile, 'covers');
        } else {
            coverArtUrl = 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300';
        }
        
        // Get duration (using video duration)
        let duration = 180;
        if (req.files && req.files.video && req.files.video[0]) {
            try {
                duration = await audioService.getDuration(req.files.video[0].path);
            } catch (err) {
                console.log('Could not get duration, using default');
            }
        }
        
        const song = new Song({
            title,
            artist: artistId,
            genre,
            duration,
            audioUrl: audioUrl || videoUrl, // Use video URL as audio if no separate audio
            videoUrl,
            coverArt: coverArtUrl,
            price: price || 0,
            isPremium: isPremium === 'true' || isPremium === true,
            isVideo: true,
            lyrics: lyrics || '',
            tags: tags ? tags.split(',') : [],
            featuredArtists: featuredArtists ? featuredArtists.split(',') : [],
            status: 'approved' // Admin uploads are auto-approved
        });
        
        await song.save();
        
        // Add to album if specified
        if (albumId) {
            const album = await Album.findById(albumId);
            if (album && album.artist.toString() === artistId) {
                album.songs.push(song._id);
                await album.save();
            }
        }
        
        // Log admin action
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'admin_upload_video',
            target: song._id,
            details: { title, artist: artist.stageName, videoUrl, isVideo: true }
        });
        await adminLog.save();
        
        res.status(201).json({
            message: 'Video song uploaded and approved successfully',
            song: {
                _id: song._id,
                title: song.title,
                genre: song.genre,
                videoUrl: song.videoUrl,
                coverArt: song.coverArt,
                status: song.status,
                isVideo: true
            }
        });
    } catch (error) {
        console.error('Admin video upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
};

// Admin upload album
const adminUploadAlbum = async (req, res) => {
    try {
        console.log('=== ADMIN UPLOAD ALBUM ===');
        
        const { title, artistId, description, genre, type, price, isPremium, songs } = req.body;
        
        // Verify artist exists
        const artist = await Artist.findById(artistId);
        if (!artist) {
            return res.status(404).json({ error: 'Artist not found' });
        }
        
        let coverArtUrl = null;
        
        // Upload cover art
        if (req.file) {
            coverArtUrl = await storageService.uploadImage(req.file, 'covers');
        } else {
            return res.status(400).json({ error: 'Cover art is required' });
        }
        
        const album = new Album({
            title,
            artist: artistId,
            description,
            genre,
            type: type || 'album',
            price: price || 0,
            isPremium: isPremium === 'true' || isPremium === true,
            coverArt: coverArtUrl,
            status: 'published' // Admin albums are auto-published
        });
        
        await album.save();
        
        // Add existing songs to album if specified
        if (songs && songs.length > 0) {
            const songIds = songs.split(',');
            for (const songId of songIds) {
                const song = await Song.findById(songId);
                if (song && song.artist.toString() === artistId) {
                    album.songs.push(song._id);
                    song.album = album._id;
                    await song.save();
                }
            }
            await album.save();
        }
        
        // Log admin action
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: 'admin_upload_album',
            target: album._id,
            details: { title, artist: artist.stageName, genre }
        });
        await adminLog.save();
        
        res.status(201).json({
            message: 'Album created and published successfully',
            album: {
                _id: album._id,
                title: album.title,
                genre: album.genre,
                coverArt: album.coverArt,
                status: album.status,
                songsCount: album.songs.length
            }
        });
    } catch (error) {
        console.error('Admin album upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
};

// Admin bulk action on songs
const adminBulkAction = async (req, res) => {
    try {
        const { action, songIds, data } = req.body;
        
        if (!songIds || !songIds.length) {
            return res.status(400).json({ error: 'No songs selected' });
        }
        
        let result;
        
        switch (action) {
            case 'approve':
                result = await Song.updateMany(
                    { _id: { $in: songIds } },
                    { status: 'approved', updatedAt: new Date() }
                );
                break;
                
            case 'reject':
                result = await Song.updateMany(
                    { _id: { $in: songIds } },
                    { status: 'rejected', updatedAt: new Date() }
                );
                break;
                
            case 'feature':
                result = await Song.updateMany(
                    { _id: { $in: songIds } },
                    { status: 'featured', updatedAt: new Date() }
                );
                break;
                
            case 'delete':
                // Delete songs and their files
                const songsToDelete = await Song.find({ _id: { $in: songIds } });
                for (const song of songsToDelete) {
                    if (song.audioUrl) await storageService.deleteFile(song.audioUrl);
                    if (song.videoUrl) await storageService.deleteFile(song.videoUrl);
                    if (song.coverArt && !song.coverArt.includes('unsplash')) {
                        await storageService.deleteFile(song.coverArt);
                    }
                    await song.deleteOne();
                }
                result = { deletedCount: songsToDelete.length };
                break;
                
            case 'setGenre':
                if (!data?.genre) {
                    return res.status(400).json({ error: 'Genre is required' });
                }
                result = await Song.updateMany(
                    { _id: { $in: songIds } },
                    { genre: data.genre, updatedAt: new Date() }
                );
                break;
                
            case 'setPremium':
                if (data?.isPremium === undefined) {
                    return res.status(400).json({ error: 'isPremium flag is required' });
                }
                result = await Song.updateMany(
                    { _id: { $in: songIds } },
                    { isPremium: data.isPremium, price: data.price || 0, updatedAt: new Date() }
                );
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
        // Log admin action
        const adminLog = new AdminLog({
            admin: req.user._id,
            action: `bulk_${action}`,
            details: { songIds, count: songIds.length, data }
        });
        await adminLog.save();
        
        res.json({
            message: `Bulk ${action} completed`,
            modifiedCount: result.modifiedCount || result.deletedCount,
            action
        });
    } catch (error) {
        console.error('Bulk action error:', error);
        res.status(500).json({ error: 'Failed to perform bulk action' });
    }
};

// Get song statistics for admin dashboard
const getSongStatistics = async (req, res) => {
    try {
        const stats = await Song.aggregate([
            {
                $facet: {
                    totalCount: [{ $count: 'count' }],
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    byGenre: [
                        { $group: { _id: '$genre', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    byMonth: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$createdAt' },
                                    month: { $month: '$createdAt' }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id.year': -1, '_id.month': -1 } },
                        { $limit: 12 }
                    ],
                    videoVsAudio: [
                        {
                            $group: {
                                _id: '$isVideo',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    premiumVsFree: [
                        {
                            $group: {
                                _id: '$isPremium',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    topArtists: [
                        {
                            $group: {
                                _id: '$artist',
                                songCount: { $sum: 1 },
                                totalPlays: { $sum: '$playCount' }
                            }
                        },
                        { $sort: { songCount: -1 } },
                        { $limit: 10 },
                        {
                            $lookup: {
                                from: 'artists',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'artistInfo'
                            }
                        },
                        { $unwind: '$artistInfo' }
                    ]
                }
            }
        ]);
        
        res.json({
            success: true,
            statistics: {
                totalSongs: stats[0].totalCount[0]?.count || 0,
                byStatus: stats[0].byStatus,
                byGenre: stats[0].byGenre,
                monthlyUploads: stats[0].byMonth,
                videoSongs: stats[0].videoVsAudio.find(v => v._id === true)?.count || 0,
                audioSongs: stats[0].videoVsAudio.find(v => v._id === false)?.count || 0,
                premiumSongs: stats[0].premiumVsFree.find(p => p._id === true)?.count || 0,
                freeSongs: stats[0].premiumVsFree.find(p => p._id === false)?.count || 0,
                topArtists: stats[0].topArtists
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};

export {
    // User Management
    getAllUsers,
    getUserDetails,
    updateUserStatus,
    deleteUser,
    
    // Artist Management
    getAllArtists,
    verifyArtist,
    featureArtist,
    
    // Song Management
    getAllSongs,
    getPendingSongs,
    approveSong,
    rejectSong,
    deleteSong,
    
    // Album Management
    getAllAlbums,
    
    // Admin Upload
    adminUploadSong,
    adminUploadVideo,
    adminUploadAlbum,
    
    // Withdrawals
    getWithdrawals,
    processWithdrawal,
    
    // Reports
    getReports,
    resolveReport,
    
    // Settings
    getSystemSettings,
    updateSystemSettings,
    
    // Backup
    triggerBackup,
    
    // Reported Comments
    getReportedComments,
    deleteComment,
    
    // Analytics
    getPlatformAnalytics,
    getRevenueAnalytics,
    
    // NEW Admin Functions
    getAllSongsForAdmin,
    getAllArtistsForAdmin,
    adminBulkAction,
    getSongStatistics
};