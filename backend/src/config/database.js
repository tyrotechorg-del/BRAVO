import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let isConnected = false;

export const connectDB = async () => {
    if (isConnected) {
        console.log('✅ Using existing database connection');
        return;
    }
    
    try {
        const mongoURI = process.env.MONGO_URI;
        
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
    
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('songs').createIndex({ title: 'text', tags: 'text', genre: 'text', lyrics: 'text' }, { name: 'title_text_tags_text_genre_text' });
    await db.collection('songs').createIndex({ artist: 1, createdAt: -1 });
    await db.collection('artists').createIndex({ userId: 1 }, { unique: true });
    await db.collection('artists').createIndex({ stageName: 1 }, { unique: true });
    
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