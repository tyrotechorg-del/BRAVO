const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { FILE_LIMITS } = require('./constants');

// Ensure upload directories exist
const ensureUploadDirs = () => {
    const dirs = [
        'uploads/audio',
        'uploads/audio/2024/January',
        'uploads/audio/2024/February',
        'uploads/audio/2024/March',
        'uploads/audio/2024/April',
        'uploads/audio/2024/May',
        'uploads/audio/2024/June',
        'uploads/audio/2024/July',
        'uploads/audio/2024/August',
        'uploads/audio/2024/September',
        'uploads/audio/2024/October',
        'uploads/audio/2024/November',
        'uploads/audio/2024/December',
        'uploads/audio/temp',
        'uploads/images/covers',
        'uploads/images/avatars',
        'uploads/images/banners',
        'uploads/video/musicVideos',
        'uploads/waveforms'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

ensureUploadDirs();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads/temp';
        
        if (file.fieldname === 'audio' || file.mimetype.startsWith('audio/')) {
            const date = new Date();
            const month = date.toLocaleString('default', { month: 'long' });
            folder = `uploads/audio/${date.getFullYear()}/${month}`;
        } else if (file.fieldname === 'coverArt' || file.fieldname === 'avatar') {
            folder = 'uploads/images/covers';
        } else if (file.fieldname === 'banner') {
            folder = 'uploads/images/banners';
        } else if (file.fieldname === 'video') {
            folder = 'uploads/video/musicVideos';
        }
        
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedAudio = FILE_LIMITS.ALLOWED_AUDIO_TYPES;
    const allowedImages = FILE_LIMITS.ALLOWED_IMAGE_TYPES;
    
    if (allowedAudio.includes(file.mimetype) || allowedImages.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// Create multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: FILE_LIMITS.MAX_AUDIO_SIZE_MB * 1024 * 1024
    }
});

// Helper to delete file
const deleteFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
};

// Helper to get file info
const getFileInfo = (file) => {
    if (!file) return null;
    
    return {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
        url: `/uploads/${file.path.split('uploads/')[1]}`
    };
};

// Helper to validate file size
const validateFileSize = (file, maxMB) => {
    const maxBytes = maxMB * 1024 * 1024;
    return file.size <= maxBytes;
};

// Helper to validate file type
const validateFileType = (file, allowedTypes) => {
    return allowedTypes.includes(file.mimetype);
};

module.exports = {
    upload,
    deleteFile,
    getFileInfo,
    validateFileSize,
    validateFileType
};