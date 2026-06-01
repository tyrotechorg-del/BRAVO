import fs from 'fs';
import path from 'path';

class StorageService {
    constructor() {
        this.uploadDirs = {
            audio: path.join(process.cwd(), 'uploads/audio'),
            video: path.join(process.cwd(), 'uploads/video'),
            covers: path.join(process.cwd(), 'uploads/images/covers'),
            avatars: path.join(process.cwd(), 'uploads/images/avatars'),
            banners: path.join(process.cwd(), 'uploads/images/banners')
        };
        this.ensureDirectories();
    }

    ensureDirectories() {
        Object.values(this.uploadDirs).forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async uploadAudio(file, userId) {
        try {
            if (!file || !file.path) {
                console.log('No audio file provided');
                return null;
            }
            
            // Check file size (20MB max for audio)
            const stats = fs.statSync(file.path);
            const fileSizeMB = stats.size / (1024 * 1024);
            const maxAudioSizeMB = parseInt(process.env.MAX_AUDIO_SIZE_MB) || 20;
            
            if (fileSizeMB > maxAudioSizeMB) {
                throw new Error(`Audio file too large. Max size is ${maxAudioSizeMB}MB. Your file: ${fileSizeMB.toFixed(2)}MB`);
            }
            
            if (!fs.existsSync(file.path)) {
                console.log(`File not found at: ${file.path}`);
                return null;
            }
            
            const relativePath = file.path.replace(process.cwd(), '').replace(/\\/g, '/');
            const url = relativePath;
            
            console.log(`Audio file saved at: ${url} (${fileSizeMB.toFixed(2)}MB)`);
            return url;
        } catch (error) {
            console.error('Upload audio error:', error);
            throw error;
        }
    }

    async uploadVideo(file, userId) {
        try {
            if (!file || !file.path) {
                console.log('No video file provided');
                return null;
            }
            
            // Check file size (500MB max for video)
            const stats = fs.statSync(file.path);
            const fileSizeMB = stats.size / (1024 * 1024);
            const maxVideoSizeMB = parseInt(process.env.MAX_VIDEO_SIZE_MB) || 500;
            
            if (fileSizeMB > maxVideoSizeMB) {
                throw new Error(`Video file too large. Max size is ${maxVideoSizeMB}MB. Your file: ${fileSizeMB.toFixed(2)}MB`);
            }
            
            if (!fs.existsSync(file.path)) {
                console.log(`Video not found at: ${file.path}`);
                return null;
            }
            
            // Create video-specific directory
            const videoDir = this.uploadDirs.video;
            if (!fs.existsSync(videoDir)) {
                fs.mkdirSync(videoDir, { recursive: true });
            }
            
            // Move file to videos directory
            const timestamp = Date.now();
            const ext = path.extname(file.originalname);
            const filename = `video_${userId}_${timestamp}${ext}`;
            const newPath = path.join(videoDir, filename);
            
            fs.renameSync(file.path, newPath);
            
            const url = `/uploads/video/${filename}`;
            console.log(`Video saved at: ${url} (${fileSizeMB.toFixed(2)}MB)`);
            return url;
        } catch (error) {
            console.error('Upload video error:', error);
            throw error;
        }
    }

    async uploadImage(file, folder) {
        try {
            if (!file || !file.path) {
                console.log('No image file provided');
                return null;
            }
            
            const stats = fs.statSync(file.path);
            const fileSizeMB = stats.size / (1024 * 1024);
            const maxImageSizeMB = 5;
            
            if (fileSizeMB > maxImageSizeMB) {
                console.log(`Warning: Image size ${fileSizeMB.toFixed(2)}MB exceeds recommended ${maxImageSizeMB}MB`);
            }
            
            if (!fs.existsSync(file.path)) {
                console.log(`Image not found at: ${file.path}`);
                return null;
            }
            
            const targetDir = this.uploadDirs[folder] || this.uploadDirs.covers;
            const timestamp = Date.now();
            const ext = path.extname(file.originalname);
            const filename = `${folder}_${timestamp}${ext}`;
            const newPath = path.join(targetDir, filename);
            
            fs.renameSync(file.path, newPath);
            
            const relativePath = newPath.replace(process.cwd(), '').replace(/\\/g, '/');
            console.log(`Image saved at: ${relativePath}`);
            return relativePath;
        } catch (error) {
            console.error('Upload image error:', error);
            return null;
        }
    }

    async getAudioStream(url) {
        try {
            const filePath = path.join(process.cwd(), url);
            if (fs.existsSync(filePath)) {
                return fs.createReadStream(filePath);
            }
            console.log(`File not found for streaming: ${filePath}`);
            return null;
        } catch (error) {
            console.error('Get audio stream error:', error);
            return null;
        }
    }

    async getVideoStream(url) {
        try {
            const filePath = path.join(process.cwd(), url);
            if (fs.existsSync(filePath)) {
                return fs.createReadStream(filePath);
            }
            console.log(`Video not found for streaming: ${filePath}`);
            return null;
        } catch (error) {
            console.error('Get video stream error:', error);
            return null;
        }
    }

    async deleteFile(url) {
        try {
            if (!url) return;
            const filePath = path.join(process.cwd(), url);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const fileSizeMB = stats.size / (1024 * 1024);
                fs.unlinkSync(filePath);
                console.log(`Deleted file: ${filePath} (${fileSizeMB.toFixed(2)}MB)`);
            }
        } catch (error) {
            console.error('Delete file error:', error);
        }
    }

    async getVideoMetadata(filePath) {
        try {
            const fullPath = path.join(process.cwd(), filePath);
            const stats = fs.statSync(fullPath);
            return {
                size: stats.size,
                sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            console.error('Get video metadata error:', error);
            return null;
        }
    }
}

export default new StorageService();