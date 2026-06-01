import Promotion from '../models/Promotion.js';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';

const PROMOTION_PACKAGES = {
    homepage: { name: 'Homepage Feature', price: 500, duration: 7, description: 'Your song featured on homepage for 7 days' },
    trending: { name: 'Trending Section', price: 300, duration: 7, description: 'Placement in trending section for 7 days' },
    playlist: { name: 'Playlist Placement', price: 200, duration: 14, description: 'Added to official playlists for 14 days' },
    sponsored: { name: 'Sponsored Placement', price: 1000, duration: 30, description: 'Sponsored placement across platform for 30 days' }
};

export const getPromotionPackages = async (req, res) => {
    try {
        res.json(PROMOTION_PACKAGES);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
};

export const purchasePromotion = async (req, res) => {
    try {
        const { packageId, songId, paymentMethod, phoneNumber } = req.body;
        
        const promotionPackage = PROMOTION_PACKAGES[packageId];
        if (!promotionPackage) {
            return res.status(400).json({ error: 'Invalid package' });
        }
        
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Artist profile required' });
        }
        
        const song = await Song.findById(songId);
        if (!song || song.artist.toString() !== artist._id.toString()) {
            return res.status(404).json({ error: 'Song not found' });
        }
        
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + promotionPackage.duration);
        
        const promotion = new Promotion({
            artist: artist._id,
            song: songId,
            package: packageId,
            duration: promotionPackage.duration,
            endDate,
            amount: promotionPackage.price,
            status: 'pending'
        });
        
        await promotion.save();
        
        res.json({
            message: 'Promotion purchase initiated',
            promotion,
            reference: promotion._id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to purchase promotion' });
    }
};

export const getMyPromotions = async (req, res) => {
    try {
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Artist profile required' });
        }
        
        const promotions = await Promotion.find({ artist: artist._id })
            .populate('song', 'title coverArt')
            .sort({ createdAt: -1 });
        
        res.json(promotions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch promotions' });
    }
};

export const getFeaturedContent = async (req, res) => {
    try {
        const activePromotions = await Promotion.find({
            status: 'active',
            endDate: { $gt: new Date() }
        }).populate('song', 'title coverArt artist');
        
        const featured = {
            homepage: activePromotions.filter(p => p.package === 'homepage'),
            trending: activePromotions.filter(p => p.package === 'trending'),
            sponsored: activePromotions.filter(p => p.package === 'sponsored')
        };
        
        res.json(featured);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch featured content' });
    }
};

export const cancelPromotion = async (req, res) => {
    try {
        const { promotionId } = req.params;
        
        const promotion = await Promotion.findById(promotionId);
        if (!promotion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }
        
        const artist = await Artist.findOne({ userId: req.user._id });
        if (promotion.artist.toString() !== artist._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        promotion.status = 'cancelled';
        await promotion.save();
        
        res.json({ message: 'Promotion cancelled', promotion });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel promotion' });
    }
};