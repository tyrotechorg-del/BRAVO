import Song from '../models/Song.js';
import Like from '../models/Like.js';

class RecommendationService {
    async getPersonalizedRecommendations(userId, limit = 20) {
        try {
            const likes = await Like.find({ user: userId, type: 'song' })
                .populate('song')
                .limit(50);
            
            const likedGenres = likes.map(l => l.song?.genre).filter(Boolean);
            const likedArtists = likes.map(l => l.song?.artist).filter(Boolean);
            
            let recommendations = [];
            
            if (likedGenres.length > 0) {
                const genreBased = await Song.find({
                    genre: { $in: likedGenres },
                    status: 'approved',
                    _id: { $nin: likes.map(l => l.song?._id) }
                }).limit(limit);
                recommendations.push(...genreBased);
            }
            
            if (recommendations.length < limit && likedArtists.length > 0) {
                const artistBased = await Song.find({
                    artist: { $in: likedArtists },
                    status: 'approved',
                    _id: { $nin: recommendations.map(s => s._id) }
                }).limit(limit - recommendations.length);
                recommendations.push(...artistBased);
            }
            
            if (recommendations.length < limit) {
                const trending = await Song.find({ status: 'approved' })
                    .sort({ playCount: -1 })
                    .limit(limit - recommendations.length);
                recommendations.push(...trending);
            }
            
            return recommendations;
        } catch (error) {
            console.error('Recommendation error:', error);
            return [];
        }
    }

    async getSimilarSongs(songId, limit = 10) {
        try {
            const song = await Song.findById(songId);
            if (!song) return [];
            
            const similar = await Song.find({
                _id: { $ne: songId },
                status: 'approved',
                $or: [
                    { genre: song.genre },
                    { tags: { $in: song.tags || [] } },
                    { artist: song.artist }
                ]
            })
            .limit(limit)
            .populate('artist', 'stageName');
            
            return similar;
        } catch (error) {
            console.error('Similar songs error:', error);
            return [];
        }
    }
}

export default new RecommendationService();