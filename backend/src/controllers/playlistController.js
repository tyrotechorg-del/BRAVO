import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';
import Notification from '../models/Notification.js';

export const createPlaylist = async (req, res) => {
    try {
        const { name, description, isPublic } = req.body;
        
        const playlist = new Playlist({
            name,
            description,
            user: req.user._id,
            isPublic: isPublic !== false,
            songs: []
        });

        await playlist.save();

        res.status(201).json({
            message: 'Playlist created successfully',
            playlist
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
};

export const getUserPlaylists = async (req, res) => {
    try {
        const playlists = await Playlist.find({ user: req.user._id })
            .populate('songs', 'title coverArt duration artist')
            .sort({ createdAt: -1 });
        
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
};

export const getPlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id)
            .populate('songs', 'title coverArt duration artist playCount')
            .populate('user', 'username avatar');
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (!playlist.isPublic && playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Private playlist' });
        }

        playlist.playCount++;
        await playlist.save();

        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch playlist' });
    }
};

export const updatePlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { name, description, isPublic } = req.body;
        
        if (name) playlist.name = name;
        if (description !== undefined) playlist.description = description;
        if (isPublic !== undefined) playlist.isPublic = isPublic;
        
        playlist.updatedAt = Date.now();
        await playlist.save();

        res.json({ message: 'Playlist updated', playlist });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update playlist' });
    }
};

export const deletePlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await playlist.deleteOne();

        res.json({ message: 'Playlist deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
};

export const addSongToPlaylist = async (req, res) => {
    try {
        const { songId } = req.body;
        const playlist = await Playlist.findById(req.params.id);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        if (playlist.songs.includes(songId)) {
            return res.status(400).json({ error: 'Song already in playlist' });
        }

        playlist.songs.push(songId);
        await playlist.save();

        res.json({ message: 'Song added to playlist', playlist });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add song' });
    }
};

export const removeSongFromPlaylist = async (req, res) => {
    try {
        const { songId } = req.body;
        const playlist = await Playlist.findById(req.params.id);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        playlist.songs = playlist.songs.filter(id => id.toString() !== songId);
        await playlist.save();

        res.json({ message: 'Song removed from playlist', playlist });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove song' });
    }
};

export const likePlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        const likeIndex = playlist.likes.indexOf(req.user._id);
        
        if (likeIndex > -1) {
            playlist.likes.splice(likeIndex, 1);
            await playlist.save();
            res.json({ message: 'Playlist unliked', liked: false });
        } else {
            playlist.likes.push(req.user._id);
            await playlist.save();
            
            if (playlist.user.toString() !== req.user._id.toString()) {
                const notification = new Notification({
                    user: playlist.user,
                    type: 'like',
                    title: 'Playlist Liked',
                    message: `${req.user.username} liked your playlist "${playlist.name}"`,
                    data: { playlistId: playlist._id }
                });
                await notification.save();
            }
            
            res.json({ message: 'Playlist liked', liked: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to like playlist' });
    }
};

export const getFeaturedPlaylists = async (req, res) => {
    try {
        const playlists = await Playlist.find({ isFeatured: true, isPublic: true })
            .populate('user', 'username')
            .populate('songs', 'title coverArt')
            .limit(10);
        
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch featured playlists' });
    }
};