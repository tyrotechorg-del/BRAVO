import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import Album from '../models/Album.js';
import User from '../models/User.js';

class SearchService {
    async searchAll(query, limit = 20) {
        const [songs, artists, albums] = await Promise.all([
            this.searchSongs(query, limit),
            this.searchArtists(query, limit),
            this.searchAlbums(query, limit)
        ]);
        
        return { songs, artists, albums };
    }

    async searchSongs(query, limit = 20) {
        try {
            return await Song.find(
                { 
                    $or: [
                        { title: { $regex: query, $options: 'i' } },
                        { tags: { $regex: query, $options: 'i' } }
                    ],
                    status: 'approved'
                }
            )
            .sort({ playCount: -1 })
            .limit(limit)
            .populate('artist', 'stageName verified');
        } catch (error) {
            console.error('Search songs error:', error);
            return [];
        }
    }

    async searchArtists(query, limit = 20) {
        try {
            return await Artist.find({
                $or: [
                    { stageName: { $regex: query, $options: 'i' } },
                    { genres: { $regex: query, $options: 'i' } }
                ]
            })
            .limit(limit)
            .populate('userId', 'avatar fullName');
        } catch (error) {
            console.error('Search artists error:', error);
            return [];
        }
    }

    async searchAlbums(query, limit = 20) {
        try {
            return await Album.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { genre: { $regex: query, $options: 'i' } }
                ],
                status: 'published'
            })
            .limit(limit)
            .populate('artist', 'stageName');
        } catch (error) {
            console.error('Search albums error:', error);
            return [];
        }
    }

    async getSuggestions(query) {
        try {
            const songs = await Song.find(
                { title: { $regex: `^${query}`, $options: 'i' }, status: 'approved' },
                'title'
            ).limit(5);
            
            const artists = await Artist.find(
                { stageName: { $regex: `^${query}`, $options: 'i' } },
                'stageName'
            ).limit(5);
            
            return [
                ...songs.map(s => ({ type: 'song', text: s.title })),
                ...artists.map(a => ({ type: 'artist', text: a.stageName }))
            ];
        } catch (error) {
            console.error('Get suggestions error:', error);
            return [];
        }
    }
}

export default new SearchService();