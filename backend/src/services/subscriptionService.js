import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import notificationService from './notificationService.js';

// ARTIST ONLY PLANS
const plans = {
    artist_basic: {
        name: 'Basic Artist Plan',
        price: 50,
        features: ['10 Uploads per month', 'Basic Analytics', 'Email Support'],
        uploadLimit: 10,
        duration: 30
    },
    artist_pro: {
        name: 'Pro Artist Plan',
        price: 120,
        features: ['Unlimited Uploads', 'Advanced Analytics', 'Monetization', 'Priority Support'],
        uploadLimit: -1,
        duration: 30
    },
    artist_vip: {
        name: 'VIP Artist Plan',
        price: 300,
        features: ['Verified Badge', 'Homepage Promotion', 'Unlimited Uploads', 'Monetization', '24/7 Priority Support'],
        uploadLimit: -1,
        duration: 30
    }
};

class SubscriptionService {
    getPlans() {
        return plans;
    }
    
    async createSubscription(userId, planId, paymentMethod) {
        const plan = plans[planId];
        if (!plan) throw new Error('Invalid plan');
        
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration);
        
        const subscription = new Subscription({
            user: userId,
            type: planId,
            plan: {
                name: plan.name,
                price: plan.price,
                currency: 'ZMW',
                features: plan.features,
                uploadLimit: plan.uploadLimit,
                duration: plan.duration
            },
            status: 'pending',
            startDate,
            endDate,
            paymentMethod
        });
        
        await subscription.save();
        return subscription;
    }
    
    async activateSubscription(subscriptionId) {
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) throw new Error('Subscription not found');
        
        subscription.status = 'active';
        await subscription.save();
        
        const artist = await Artist.findOne({ userId: subscription.user });
        if (artist) {
            artist.subscriptionStatus = 'active';
            artist.currentPlan = subscription.type.replace('artist_', '');
            artist.subscriptionExpiry = subscription.endDate;
            await artist.save();
        }
        
        await notificationService.createNotification(
            subscription.user,
            'subscription',
            'Subscription Activated',
            `Your ${subscription.plan.name} is now active!`,
            { subscriptionId: subscription._id }
        );
        
        return subscription;
    }
    
    async cancelSubscription(subscriptionId) {
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) throw new Error('Subscription not found');
        
        subscription.status = 'cancelled';
        subscription.autoRenew = false;
        await subscription.save();
        
        const artist = await Artist.findOne({ userId: subscription.user });
        if (artist) {
            artist.subscriptionStatus = 'inactive';
            artist.currentPlan = 'none';
            await artist.save();
        }
        
        await notificationService.createNotification(
            subscription.user,
            'subscription',
            'Subscription Cancelled',
            `Your ${subscription.plan.name} has been cancelled.`,
            { subscriptionId: subscription._id }
        );
        
        return subscription;
    }
    
    async hasActiveSubscription(userId, type = null) {
        const query = {
            user: userId,
            status: 'active',
            endDate: { $gt: new Date() }
        };
        
        if (type) query.type = type;
        
        const subscription = await Subscription.findOne(query);
        return !!subscription;
    }
    
    async getActiveSubscription(userId) {
        const subscription = await Subscription.findOne({
            user: userId,
            status: 'active',
            endDate: { $gt: new Date() }
        });
        
        return subscription;
    }
    
    async getArtistSubscription(userId) {
        const artist = await Artist.findOne({ userId });
        if (!artist) return null;
        
        return {
            status: artist.subscriptionStatus,
            plan: artist.currentPlan,
            expiryDate: artist.subscriptionExpiry,
            uploadCredits: artist.uploadCredits,
            uploadCreditsExpiry: artist.uploadCreditsExpiry
        };
    }
}

export default new SubscriptionService();