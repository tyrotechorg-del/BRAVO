import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import Payment from '../models/Payment.js';
import paymentService from '../services/paymentService.js';
import notificationService from '../services/notificationService.js';

// ARTIST ONLY SUBSCRIPTION PLANS (removed listener_premium)
const SUBSCRIPTION_PLANS = {
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

export const getSubscriptionPlans = async (req, res) => {
    try {
        res.json(SUBSCRIPTION_PLANS);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};

export const subscribe = async (req, res) => {
    try {
        const { planId, paymentMethod, phoneNumber } = req.body;
        
        // Check if user is artist
        const artist = await Artist.findOne({ userId: req.user._id });
        if (!artist) {
            return res.status(403).json({ error: 'Only artists can subscribe to plans' });
        }
        
        const plan = SUBSCRIPTION_PLANS[planId];
        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const existingSubscription = await Subscription.findOne({
            user: req.user._id,
            status: 'active',
            endDate: { $gt: new Date() }
        });

        if (existingSubscription) {
            return res.status(400).json({ error: 'Already have an active subscription' });
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration);

        const subscription = new Subscription({
            user: req.user._id,
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

        const paymentResult = await paymentService.initiatePayment(
            req.user._id,
            plan.price,
            'subscription',
            paymentMethod,
            { phoneNumber, subscriptionId: subscription._id }
        );

        res.json({
            message: 'Subscription initiated',
            subscription,
            paymentUrl: paymentResult.paymentUrl,
            reference: paymentResult.payment.reference
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
};

export const getMySubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            user: req.user._id,
            status: 'active',
            endDate: { $gt: new Date() }
        });

        if (!subscription) {
            return res.json({ active: false, message: 'No active subscription' });
        }

        const daysLeft = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));

        res.json({
            active: true,
            subscription,
            daysLeft,
            expiresAt: subscription.endDate
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};

export const cancelSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            user: req.user._id,
            status: 'active',
            endDate: { $gt: new Date() }
        });

        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        subscription.status = 'cancelled';
        subscription.autoRenew = false;
        await subscription.save();

        const artist = await Artist.findOne({ userId: req.user._id });
        if (artist) {
            artist.subscriptionStatus = 'inactive';
            artist.currentPlan = 'none';
            await artist.save();
        }

        await notificationService.createNotification(
            req.user._id,
            'subscription',
            'Subscription Cancelled',
            `Your ${subscription.plan.name} has been cancelled.`,
            { subscriptionId: subscription._id }
        );

        res.json({ message: 'Subscription cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
};

export const renewSubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            user: req.user._id,
            status: { $in: ['active', 'expired'] }
        });

        if (!subscription) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + subscription.plan.duration);

        subscription.endDate = newEndDate;
        subscription.status = 'active';
        subscription.autoRenew = req.body.autoRenew || false;
        await subscription.save();

        const artist = await Artist.findOne({ userId: req.user._id });
        if (artist) {
            artist.subscriptionStatus = 'active';
            artist.currentPlan = subscription.type.replace('artist_', '');
            artist.subscriptionExpiry = newEndDate;
            await artist.save();
        }

        await notificationService.createNotification(
            req.user._id,
            'subscription',
            'Subscription Renewed',
            `Your ${subscription.plan.name} has been renewed until ${newEndDate.toLocaleDateString()}`,
            { subscriptionId: subscription._id }
        );

        res.json({ message: 'Subscription renewed', subscription });
    } catch (error) {
        res.status(500).json({ error: 'Failed to renew subscription' });
    }
};

export const getSubscriptionHistory = async (req, res) => {
    try {
        const subscriptions = await Subscription.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        
        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

export const webhook = async (req, res) => {
    try {
        const { reference, status, transactionId } = req.body;
        
        const payment = await Payment.findOne({ reference });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        if (status === 'completed') {
            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.metadata.transactionId = transactionId;
            await payment.save();

            const subscription = await Subscription.findById(payment.metadata.subscriptionId);
            if (subscription) {
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
                    'Subscription Active',
                    `Your ${subscription.plan.name} is now active!`,
                    { subscriptionId: subscription._id }
                );
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};