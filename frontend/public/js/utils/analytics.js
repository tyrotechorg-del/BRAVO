/**
 * Analytics Tracker
 */

class AnalyticsTracker {
    constructor() {
        this.queue = [];
        this.flushInterval = 30000;
        this.isEnabled = true;
        this.init();
    }

    init() {
        setInterval(() => this.flush(), this.flushInterval);
        this.trackPageView();
        
        window.addEventListener('beforeunload', () => this.flush(true));
        window.addEventListener('hashchange', () => this.trackPageView());
    }

    track(event, data = {}) {
        if (!this.isEnabled) return;
        
        this.queue.push({
            event,
            data,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`
        });
        
        if (this.queue.length >= 10) {
            this.flush();
        }
    }

    trackPageView() {
        this.track('page_view', {
            title: document.title,
            path: window.location.pathname,
            hash: window.location.hash
        });
    }

    trackSongPlay(songId, songTitle, artist) {
        this.track('song_play', { songId, songTitle, artist });
    }

    trackSongDownload(songId, songTitle) {
        this.track('song_download', { songId, songTitle });
    }

    trackSearch(query, resultsCount) {
        this.track('search', { query, resultsCount });
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

    trackUpload(fileSize, fileType) {
        this.track('upload', { fileSize, fileType });
    }

    async flush(sync = false) {
        if (this.queue.length === 0) return;
        
        const events = [...this.queue];
        this.queue = [];
        
        const sendEvents = async () => {
            try {
                const token = localStorage.getItem('token');
                await fetch(`${window.config.API_URL}/analytics/track`, {
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

window.AnalyticsTracker = AnalyticsTracker;