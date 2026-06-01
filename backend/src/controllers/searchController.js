import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import Album from '../models/Album.js';
import User from '../models/User.js';

export const searchAll = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }
        
        const [songs, artists, albums] = await Promise.all([
            Song.find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { tags: { $regex: q, $options: 'i' } }
                ],
                status: 'approved'
            }).limit(parseInt(limit)).populate('artist', 'stageName'),
            
            Artist.find({
                $or: [
                    { stageName: { $regex: q, $options: 'i' } },
                    { genres: { $regex: q, $options: 'i' } }
                ]
            }).limit(parseInt(limit)).populate('userId', 'avatar'),
            
            Album.find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { genre: { $regex: q, $options: 'i' } }
                ],
                status: 'published'
            }).limit(parseInt(limit)).populate('artist', 'stageName')
        ]);
        
        res.json({ songs, artists, albums });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Search failed' });
    }
};

export const searchSongs = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        const songs = await Song.find({
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }
            ],
            status: 'approved'
        })
        .limit(parseInt(limit))
        .populate('artist', 'stageName');
        
        res.json(songs);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
};

export const searchArtists = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        const artists = await Artist.find({
            $or: [
                { stageName: { $regex: q, $options: 'i' } },
                { genres: { $regex: q, $options: 'i' } }
            ]
        })
        .limit(parseInt(limit))
        .populate('userId', 'avatar fullName');
        
        res.json(artists);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
};

export const searchAlbums = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        const albums = await Album.find({
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { genre: { $regex: q, $options: 'i' } }
            ],
            status: 'published'
        })
        .limit(parseInt(limit))
        .populate('artist', 'stageName');
        
        res.json(albums);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
};

export const searchPlaylists = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        const Playlist = await import('../models/Playlist.js');
        const playlists = await Playlist.default.find({
            name: { $regex: q, $options: 'i' },
            isPublic: true
        })
        .limit(parseInt(limit))
        .populate('user', 'username');
        
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
};

export const getSuggestions = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }
        
        const songs = await Song.find(
            { title: { $regex: `^${q}`, $options: 'i' }, status: 'approved' },
            'title'
        ).limit(5);
        
        const artists = await Artist.find(
            { stageName: { $regex: `^${q}`, $options: 'i' } },
            'stageName'
        ).limit(5);
        
        const suggestions = [
            ...songs.map(s => ({ type: 'song', text: s.title })),
            ...artists.map(a => ({ type: 'artist', text: a.stageName }))
        ];
        
        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
};