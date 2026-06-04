import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
    if (isConnected) {
        console.log('✅ Using existing database connection');
        return;
    }
    
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bravo-music';
        
        console.log(`📡 Connecting to MongoDB...`);
        
        const conn = await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        isConnected = true;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📀 Database Name: ${conn.connection.name}`);
        
        await ensureCollections();
        
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        isConnected = false;
        throw error;
    }
};

async function ensureCollections() {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const requiredCollections = ['users', 'artists', 'songs', 'albums', 'playlists', 'comments', 'likes', 'subscriptions', 'payments', 'wallets', 'transactions', 'notifications', 'analytics', 'reports', 'adminlogs', 'promotions', 'withdrawals', 'downloads'];
    
    for (const collectionName of requiredCollections) {
        if (!collectionNames.includes(collectionName)) {
            await db.createCollection(collectionName);
            console.log(`📁 Created collection: ${collectionName}`);
        }
    }
    
    // Users collection indexes
    try {
        const usersCollection = db.collection('users');
        await usersCollection.createIndex({ email: 1 }, { unique: true });
        console.log('✅ Created email index on users');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ Email index already exists on users');
        } else {
            console.error('❌ Failed to create email index:', error.message);
        }
    }
    
    try {
        const usersCollection = db.collection('users');
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        console.log('✅ Created username index on users');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ Username index already exists on users');
        } else {
            console.error('❌ Failed to create username index:', error.message);
        }
    }
    
    // Songs collection indexes
    try {
        const songsCollection = db.collection('songs');
        await songsCollection.createIndex({ title: 'text', tags: 'text' });
        console.log('✅ Created text index on songs');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ Text index already exists on songs');
        } else if (error.code === 86) {
            console.log('⚠️ Text index conflict, attempting to recreate...');
            try {
                const songsCollection = db.collection('songs');
                const existingIndexes = await songsCollection.indexes();
                const textIndex = existingIndexes.find(idx => idx.key && (idx.key.title === 'text' || idx.key['$**'] === 'text'));
                if (textIndex) {
                    await songsCollection.dropIndex(textIndex.name);
                    console.log('🗑️ Dropped existing text index');
                    await songsCollection.createIndex({ title: 'text', tags: 'text' });
                    console.log('✅ Recreated text index on songs');
                }
            } catch (recreateError) {
                console.error('❌ Failed to recreate text index:', recreateError.message);
            }
        } else {
            console.error('❌ Failed to create text index:', error.message);
        }
    }
    
    try {
        const songsCollection = db.collection('songs');
        await songsCollection.createIndex({ artist: 1, createdAt: -1 });
        console.log('✅ Created artist-createdAt compound index on songs');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ Artist-createdAt index already exists on songs');
        } else {
            console.error('❌ Failed to create artist index:', error.message);
        }
    }
    
    // Artists collection indexes
    try {
        const artistsCollection = db.collection('artists');
        await artistsCollection.createIndex({ userId: 1 }, { unique: true });
        console.log('✅ Created userId index on artists');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ UserId index already exists on artists');
        } else {
            console.error('❌ Failed to create userId index:', error.message);
        }
    }
    
    try {
        const artistsCollection = db.collection('artists');
        await artistsCollection.createIndex({ stageName: 1 }, { unique: true });
        console.log('✅ Created stageName index on artists');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ StageName index already exists on artists');
        } else {
            console.error('❌ Failed to create stageName index:', error.message);
        }
    }
    
    // Additional useful indexes for performance
    try {
        const playlistsCollection = db.collection('playlists');
        await playlistsCollection.createIndex({ userId: 1, createdAt: -1 });
        console.log('✅ Created userId-createdAt index on playlists');
    } catch (error) {
        if (error.code !== 85) {
            console.error('❌ Failed to create playlists index:', error.message);
        }
    }
    
    try {
        const commentsCollection = db.collection('comments');
        await commentsCollection.createIndex({ songId: 1, createdAt: -1 });
        console.log('✅ Created songId-createdAt index on comments');
    } catch (error) {
        if (error.code !== 85) {
            console.error('❌ Failed to create comments index:', error.message);
        }
    }
    
    try {
        const likesCollection = db.collection('likes');
        await likesCollection.createIndex({ userId: 1, songId: 1 }, { unique: true });
        console.log('✅ Created userId-songId unique index on likes');
    } catch (error) {
        if (error.code === 85) {
            console.log('ℹ️ Like index already exists');
        } else if (error.code !== 85) {
            console.error('❌ Failed to create likes index:', error.message);
        }
    }
    
    try {
        const paymentsCollection = db.collection('payments');
        await paymentsCollection.createIndex({ userId: 1, createdAt: -1 });
        await paymentsCollection.createIndex({ transactionId: 1 }, { unique: true });
        console.log('✅ Created indexes on payments');
    } catch (error) {
        if (error.code !== 85) {
            console.error('❌ Failed to create payments indexes:', error.message);
        }
    }
    
    try {
        const subscriptionsCollection = db.collection('subscriptions');
        await subscriptionsCollection.createIndex({ userId: 1, status: 1, expiresAt: 1 });
        console.log('✅ Created indexes on subscriptions');
    } catch (error) {
        if (error.code !== 85) {
            console.error('❌ Failed to create subscriptions indexes:', error.message);
        }
    }
    
    console.log('✅ Database collections and indexes ensured');
}

export const disconnectDB = async () => {
    if (!isConnected) return;
    await mongoose.disconnect();
    isConnected = false;
    console.log('📀 MongoDB disconnected');
};

export const getConnectionStatus = () => isConnected;

export default { connectDB, disconnectDB, getConnectionStatus };