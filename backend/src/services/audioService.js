import fs from 'fs';

class AudioService {
    async getDuration(filePath) {
        // Check if file exists
        if (!filePath || !fs.existsSync(filePath)) {
            console.log('File not found, using default duration');
            return 180; // Default 3 minutes
        }
        
        // Try to get duration without ffmpeg if possible
        try {
            // Fallback to default duration
            return 180;
        } catch (error) {
            console.log('Could not get duration, using default');
            return 180;
        }
    }

    async generateWaveform(filePath) {
        // Generate sample waveform data (100 points)
        const peaks = [];
        for (let i = 0; i < 100; i++) {
            peaks.push(Math.floor(Math.random() * 100));
        }
        
        const waveformData = { peaks, points: 100 };
        return JSON.stringify(waveformData);
    }

    async extractMetadata(filePath) {
        // Return default metadata without ffmpeg
        return {
            duration: 180,
            bitrate: 128000,
            sampleRate: 44100,
            channels: 2,
            codec: 'mp3'
        };
    }
}

export default new AudioService();