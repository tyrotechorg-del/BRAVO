const mongoose = require('mongoose');
require('dotenv').config();

const migrations = [
    {
        version: '1.0.0',
        name: 'Initial schema',
        up: async () => {
            console.log('Running migration 1.0.0...');
            // Add indexes
            const User = mongoose.model('User');
            await User.collection.createIndex({ email: 1 }, { unique: true });
            await User.collection.createIndex({ username: 1 }, { unique: true });
            
            const Song = mongoose.model('Song');
            await Song.collection.createIndex({ title: 'text', tags: 'text' });
            await Song.collection.createIndex({ artist: 1, createdAt: -1 });
            
            console.log('Migration 1.0.0 completed');
        }
    },
    {
        version: '1.1.0',
        name: 'Add analytics indexes',
        up: async () => {
            console.log('Running migration 1.1.0...');
            const Analytics = mongoose.model('Analytics');
            await Analytics.collection.createIndex({ timestamp: -1 });
            await Analytics.collection.createIndex({ song: 1, timestamp: -1 });
            await Analytics.collection.createIndex({ user: 1, timestamp: -1 });
            console.log('Migration 1.1.0 completed');
        }
    }
];

const runMigrations = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Get current migration version from database
        const Migration = mongoose.model('Migration', new mongoose.Schema({
            version: String,
            appliedAt: Date
        }));
        
        const appliedMigrations = await Migration.find();
        const appliedVersions = appliedMigrations.map(m => m.version);
        
        for (const migration of migrations) {
            if (!appliedVersions.includes(migration.version)) {
                console.log(`Applying migration ${migration.version}: ${migration.name}`);
                await migration.up();
                
                await Migration.create({
                    version: migration.version,
                    appliedAt: new Date()
                });
                
                console.log(`Migration ${migration.version} applied successfully`);
            } else {
                console.log(`Skipping migration ${migration.version} - already applied`);
            }
        }
        
        console.log('All migrations completed');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigrations();