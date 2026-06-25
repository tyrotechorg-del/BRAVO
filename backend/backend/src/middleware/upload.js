import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureUploadDirs = () => {
    const dirs = [
        path.join(process.cwd(), 'uploads/audio'),
        path.join(process.cwd(), 'uploads/video'),
        path.join(process.cwd(), 'uploads/images/covers'),
        path.join(process.cwd(), 'uploads/images/avatars'),
        path.join(process.cwd(), 'uploads/images/banners'),
        path.join(process.cwd(), 'uploads/temp')
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
};

ensureUploadDirs();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = path.join(process.cwd(), 'uploads/temp');
        
        if (file.fieldname === 'audio' || file.mimetype?.startsWith('audio/')) {
            folder = path.join(process.cwd(), 'uploads/audio');
        } else if (file.fieldname === 'video' || file.mimetype?.startsWith('video/')) {
            folder = path.join(process.cwd(), 'uploads/video');
        } else if (file.fieldname === 'coverArt' || file.fieldname === 'avatar') {
            folder = path.join(process.cwd(), 'uploads/images/covers');
        } else if (file.fieldname === 'banner') {
            folder = path.join(process.cwd(), 'uploads/images/banners');
        }
        
        console.log(`Saving ${file.fieldname} to: ${folder}`);
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = uniqueSuffix + ext;
        console.log(`Generated filename: ${filename}`);
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/x-m4a'];
    const allowedVideo = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/avi', 'video/mkv'];
    const allowedImages = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    if (allowedAudio.includes(file.mimetype) || 
        allowedVideo.includes(file.mimetype) ||
        allowedImages.includes(file.mimetype)) {
        console.log(`File accepted: ${file.originalname} (${file.mimetype})`);
        cb(null, true);
    } else {
        console.log(`File rejected: ${file.originalname} (${file.mimetype})`);
        cb(new Error('Invalid file type'), false);
    }
};

// UPDATED: Audio: 20MB, Video: 500MB
export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB max (handles both audio and video)
    }
});

export default upload;