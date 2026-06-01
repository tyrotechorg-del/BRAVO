import Download from '../models/Download.js';
import Song from '../models/Song.js';
import Album from '../models/Album.js';
import Analytics from '../models/Analytics.js';

export const downloadSong = async (req, res) => {
    try {
        const { songId } = req.params;
        const { quality = 'medium' } = req.query;
        
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }
        
        const download = new Download({
            user: req.user._id,
            song: songId,
            quality,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
        await download.save();
        
        song.downloadCount++;
        await song.save();
        
        const analytics = new Analytics({
            user: req.user._id,
            song: songId,
            action: 'download'
        });
        await analytics.save();
        
        res.json({
            message: 'Download initiated',
            downloadUrl: song.audioUrl,
            song: {
                title: song.title,
                artist: song.artist
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Download failed' });
    }
};

export const downloadAlbum = async (req, res) => {
    try {
        const { albumId } = req.params;
        
        const album = await Album.findById(albumId).populate('songs');
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }
        
        const downloadUrls = [];
        for (const song of album.songs) {
            const download = new Download({
                user: req.user._id,
                song: song._id,
                quality: 'high',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            await download.save();
            
            song.downloadCount++;
            await song.save();
            downloadUrls.push({ id: song._id, title: song.title, url: song.audioUrl });
        }
        
        res.json({
            message: 'Album download prepared',
            songs: downloadUrls
        });
    } catch (error) {
        res.status(500).json({ error: 'Album download failed' });
    }
};

export const getDownloadHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const downloads = await Download.find({ user: req.user._id })
            .populate('song', 'title coverArt artist')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Download.countDocuments({ user: req.user._id });
        
        res.json({
            downloads,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch download history' });
    }
};

export const checkDownloadEligibility = async (req, res) => {
    try {
        const { songId } = req.params;
        
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }
        
        let canDownload = true;
        let reason = null;
        
        if (song.isPremium && req.user.role !== 'admin') {
            canDownload = false;
            reason = 'Premium content requires purchase or subscription';
        }
        
        res.json({
            canDownload,
            reason,
            song: {
                title: song.title,
                isPremium: song.isPremium
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check eligibility' });
    }
};