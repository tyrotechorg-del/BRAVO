import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';

class RoyaltyService {
    async calculateRoyalties(songId, streams, downloads) {
        const song = await Song.findById(songId).populate('artist');
        
        const streamRate = 0.003;
        const downloadRate = 0.50;
        
        const streamRevenue = streams * streamRate;
        const downloadRevenue = downloads * downloadRate;
        const totalRevenue = streamRevenue + downloadRevenue;
        
        const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) / 100;
        const platformShare = totalRevenue * commissionRate;
        const artistShare = totalRevenue - platformShare;
        
        return {
            totalRevenue,
            platformShare,
            artistShare,
            streamRevenue,
            downloadRevenue
        };
    }

    async distributeRoyalties(songId, period) {
        const song = await Song.findById(songId);
        const streamsThisPeriod = song.playCount;
        const downloadsThisPeriod = song.downloadCount;
        
        const royalties = await this.calculateRoyalties(
            songId,
            streamsThisPeriod,
            downloadsThisPeriod
        );
        
        if (royalties.artistShare > 0) {
            const artist = await Artist.findById(song.artist);
            if (artist) {
                const wallet = await Wallet.findOne({ user: artist.userId });
                if (wallet) {
                    const transaction = new Transaction({
                        user: artist.userId,
                        amount: royalties.artistShare,
                        type: 'royalty',
                        status: 'completed',
                        description: `Royalty payment for song: ${song.title}`,
                        metadata: {
                            songId: song._id,
                            streams: streamsThisPeriod,
                            downloads: downloadsThisPeriod,
                            period
                        }
                    });
                    
                    await transaction.save();
                    await wallet.addBalance(royalties.artistShare);
                    
                    song.revenue += royalties.artistShare;
                    await song.save();
                    
                    artist.totalRevenue += royalties.artistShare;
                    await artist.save();
                }
            }
        }
        
        return royalties;
    }

    async processMonthlyRoyalties() {
        const songs = await Song.find({ 
            status: 'approved',
            playCount: { $gt: 0 }
        });
        
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const results = [];
        for (const song of songs) {
            const royalties = await this.distributeRoyalties(song._id, lastMonth);
            results.push({
                songId: song._id,
                title: song.title,
                royalties
            });
        }
        
        return results;
    }
}

export default new RoyaltyService();