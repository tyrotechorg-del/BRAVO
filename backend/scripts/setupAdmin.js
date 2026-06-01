const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../backend/src/models/User');
const Wallet = require('../backend/src/models/Wallet');

const setupAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@bravomusic.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
        
        // Check if admin exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        
        if (existingAdmin) {
            console.log('Admin user already exists');
            console.log(`Email: ${existingAdmin.email}`);
            process.exit(0);
        }
        
        // Create admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = new User({
            username: 'bravo_admin',
            email: adminEmail,
            password: hashedPassword,
            fullName: 'Bravo Music Administrator',
            role: 'admin',
            isVerified: true,
            isActive: true
        });
        
        await admin.save();
        
        // Create wallet for admin
        const wallet = new Wallet({
            user: admin._id,
            balance: 0
        });
        
        await wallet.save();
        
        console.log('✅ Admin user created successfully');
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log('Please change the password after first login!');
        
        process.exit(0);
    } catch (error) {
        console.error('Failed to create admin:', error);
        process.exit(1);
    }
};

setupAdmin();