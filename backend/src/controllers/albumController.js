import Album from '../models/Album.js';
import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Payment from '../models/Payment.js';
import storageService from '../services/storageService.js';
import Analytics from '../models/Analytics.js';

export const createAlbum = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Artist profile not found' });
        }

        const { title, description, genre, type, price, isPremium } = req.body;
        const coverArt = req.file;

        if (!coverArt) {
            return res.status(400).json({ error: 'Cover art is required' });
        }

        const coverArtUrl = await storageService.uploadImage(coverArt, 'covers');

        const album = new Album({
            title,
            artist: artist._id,
            description,
            genre,
            type: type || 'album',
            price: price || 0,
            isPremium: isPremium || false,
            coverArt: coverArtUrl,
            status: 'draft'
        });

        await album.save();

        res.status(201).json({
            message: 'Album created successfully',
            album
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create album' });
    }
};

export const getAlbums = async (req, res) => {
    try {
        const { page = 1, limit = 20, genre } = req.query;
        const query = { status: 'published' };
        
        if (genre) query.genre = genre;

        const albums = await Album.find(query)
            .populate('artist', 'stageName verified')
            .populate('songs', 'title duration playCount')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Album.countDocuments(query);

        res.json({
            albums,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
};

export const getAlbum = async (req, res) => {
    try {
        const album = await Album.findById(req.params.id)
            .populate('artist', 'stageName verified avatar')
            .populate('songs', 'title duration playCount audioUrl price isPremium');

        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        if (req.user) {
            const analytics = new Analytics({
                user: req.user._id,
                album: album._id,
                action: 'view'
            });
            await analytics.save();
        }

        res.json(album);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch album' });
    }
};

export const updateAlbum = async (req, res) => {
    try {
        const album = await Album.findById(req.params.id);
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        const artist = await Artist.findOne({ userId: req.user._id });
        const isAdmin = req.user.role === 'admin';
        
        if (!isAdmin && (!artist || album.artist.toString() !== artist._id.toString())) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updates = ['title', 'description', 'genre', 'price', 'isPremium', 'type', 'status'];
        updates.forEach(field => {
            if (req.body[field] !== undefined) {
                album[field] = req.body[field];
            }
        });

        if (req.file) {
            if (album.coverArt && !album.coverArt.startsWith('http')) {
                await storageService.deleteFile(album.coverArt);
            }
            album.coverArt = await storageService.uploadImage(req.file, 'covers');
        }

        album.updatedAt = Date.now();
        await album.save();

        res.json({ message: 'Album updated', album });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update album' });
    }
};

export const deleteAlbum = async (req, res) => {
    try {
        const album = await Album.findById(req.params.id);
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        const artist = await Artist.findOne({ userId: req.user._id });
        const isAdmin = req.user.role === 'admin';
        
        if (!isAdmin && (!artist || album.artist.toString() !== artist._id.toString())) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await Song.updateMany(
            { album: album._id },
            { $unset: { album: "" } }
        );

        if (album.coverArt && !album.coverArt.startsWith('http')) {
            await storageService.deleteFile(album.coverArt);
        }

        await album.deleteOne();

        res.json({ message: 'Album deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete album' });
    }
};

export const addSongToAlbum = async (req, res) => {
    try {
        const { songId } = req.body;
        const album = await Album.findById(req.params.id);
        
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        const artist = await Artist.findOne({ userId: req.user._id });
        if (album.artist.toString() !== artist._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        if (song.artist.toString() !== artist._id.toString()) {
            return res.status(403).json({ error: 'Song does not belong to you' });
        }

        if (album.songs.includes(songId)) {
            return res.status(400).json({ error: 'Song already in album' });
        }

        album.songs.push(songId);
        song.album = album._id;
        
        await album.save();
        await song.save();

        res.json({ message: 'Song added to album', album });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add song to album' });
    }
};

export const removeSongFromAlbum = async (req, res) => {
    try {
        const { songId } = req.body;
        const album = await Album.findById(req.params.id);
        
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        const artist = await Artist.findOne({ userId: req.user._id });
        if (album.artist.toString() !== artist._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        album.songs = album.songs.filter(id => id.toString() !== songId);
        
        const song = await Song.findById(songId);
        if (song) {
            song.album = undefined;
            await song.save();
        }
        
        await album.save();

        res.json({ message: 'Song removed from album', album });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove song from album' });
    }
};

export const purchaseAlbum = async (req, res) => {
    try {
        const album = await Album.findById(req.params.id).populate('artist');
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        if (!album.isPremium || album.price === 0) {
            return res.status(400).json({ error: 'Album is free' });
        }

        const userWallet = await Wallet.findOne({ user: req.user._id });
        
        if (!userWallet || userWallet.balance < album.price) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        await userWallet.deductBalance(album.price, `Purchase album: ${album.title}`);

        const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) / 100;
        const platformCommission = album.price * commissionRate;
        const artistRevenue = album.price - platformCommission;

        const artistWallet = await Wallet.findOne({ user: album.artist.userId });
        if (artistWallet) {
            await artistWallet.addBalance(artistRevenue, `Album sale: ${album.title}`);
        }

        const payment = new Payment({
            user: req.user._id,
            amount: album.price,
            type: 'album_purchase',
            method: 'wallet',
            status: 'completed',
            platformCommission,
            artistRevenue,
            metadata: { albumId: album._id, albumTitle: album.title }
        });
        await payment.save();

        res.json({ message: 'Album purchased successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to purchase album' });
    }
};

export const getTrendingAlbums = async (req, res) => {
    try {
        const albums = await Album.find({ status: 'published' })
            .sort({ totalStreams: -1, totalDownloads: -1 })
            .limit(10)
            .populate('artist', 'stageName');
        
        res.json(albums);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trending albums' });
    }
};

// GET ARTIST ALBUMS - New function
export const getArtistAlbums = async (req, res) => {
    try {
        let artist;
        if (req.params.userId === 'me' || !req.params.userId) {
            artist = await Artist.findOne({ userId: req.user._id });
        } else {
            const user = await User.findById(req.params.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            artist = await Artist.findOne({ userId: user._id });
        }
        
        if (!artist) {
            return res.status(404).json({ error: 'Artist not found' });
        }
        
        const albums = await Album.find({ artist: artist._id })
            .populate('songs', 'title duration playCount audioUrl coverArt')
            .sort({ createdAt: -1 });
        
        res.json(albums);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch artist albums' });
    }
};