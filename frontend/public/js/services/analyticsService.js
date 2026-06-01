/**
 * Analytics Service
 */

class AnalyticsService {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.isEnabled = true;
        this.queue = [];
        this.flushInterval = 30000;
        this.init();
    }

    init() {
        setInterval(() => this.flush(), this.flushInterval);
        window.addEventListener('beforeunload', () => this.flush(true));
    }

    track(event, data = {}) {
        if (!this.isEnabled) return;
        
        this.queue.push({
            event,
            data,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        
        if (this.queue.length >= 10) {
            this.flush();
        }
    }

    trackPageView(page) {
        this.track('page_view', { page });
    }

    trackSongPlay(songId, songTitle, artist) {
        this.track('song_play', { songId, songTitle, artist });
    }

    trackSongDownload(songId, songTitle) {
        this.track('song_download', { songId, songTitle });
    }

    trackShare(songId, platform) {
        this.track('share', { songId, platform });
    }

    trackLogin(method) {
        this.track('login', { method });
    }

    trackRegister(role) {
        this.track('register', { role });
    }

    async flush(sync = false) {
        if (this.queue.length === 0) return;
        
        const events = [...this.queue];
        this.queue = [];
        
        const token = localStorage.getItem('bravo_token');
        
        const sendEvents = async () => {
            try {
                await fetch(`${this.apiUrl}/analytics/track`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Bearer ${token}` })
                    },
                    body: JSON.stringify({ events })
                });
            } catch (error) {
                console.error('Analytics flush failed:', error);
                this.queue.unshift(...events);
            }
        };
        
        if (sync) {
            await sendEvents();
        } else {
            sendEvents();
        }
    }
}

// Create singleton instance
window.analyticsService = new AnalyticsService();
window.AnalyticsService = AnalyticsService;