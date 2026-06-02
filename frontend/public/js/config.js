// Bravo Music Frontend Configuration
// ==================== CONFIGURATION ====================

// API URLs - Change for production
const API_BASE_URL = "https://api.bravomusics.com/api";
const WS_BASE_URL = "ws://api.bravomusics.com";

// Export for other scripts
window.API_BASE_URL = API_BASE_URL;
window.WS_BASE_URL = WS_BASE_URL;

window.APP_CONFIG = {
    API_URL: API_BASE_URL,
    WS_URL: WS_BASE_URL,
    STATIC_URL: 'https://api.bravomusics.com',
    FRONTEND_URL: 'https://bravomusics.com',
    APP_NAME: 'Bravo Music',
    APP_VERSION: '2.0.0',
    APP_DESCRIPTION: "Zambia's Premier Music Platform",
    DEFAULT_VOLUME: 0.7,
    DEFAULT_QUALITY: 'medium',
    ITEMS_PER_PAGE: 20,
    MAX_PAGE_LIMIT: 100,
    MAX_AUDIO_SIZE_MB: 20,
    MAX_VIDEO_SIZE_MB: 500,
    MAX_IMAGE_SIZE_MB: 5,
    // Default image placeholder - path relative to the HTML file
    DEFAULT_IMAGE: 'js/images/bravo.png',
    ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/avi', 'video/mkv'],
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    CACHE_DURATION: 3600,
    CACHE_MAX_ITEMS: 100
};

// API Endpoints
window.API_ENDPOINTS = {
    AUTH: '/auth',
    USERS: '/users',
    SONGS: '/songs',
    ARTISTS: '/artists',
    ALBUMS: '/albums',
    ADMIN: '/admin',
    SUBSCRIPTIONS: '/subscriptions',
    PAYMENTS: '/payments',
    PLAYLISTS: '/playlists',
    COMMENTS: '/comments',
    SEARCH: '/search',
    DOWNLOADS: '/downloads',
    NOTIFICATIONS: '/notifications',
    WALLET: '/wallet',
    ANALYTICS: '/analytics'
};

// COMPLETE GENRES - Including Zambian genres Cuundu and Kalindula
window.GENRES = [
    'Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae',
    'Gospel', 'Traditional', 'Amapiano', 'House', 'Pop',
    'Rock', 'Jazz', 'Soul', 'Funk', 'Latin',
    // Zambian Genres
    'Cuundu', 'Kalindula'
];

// Subscription Plans (Artist Only)
window.SUBSCRIPTION_PLANS = {
    artist_basic: { name: 'Basic Artist Plan', price: 50, uploads: 10, features: ['Basic Analytics', 'Email Support'] },
    artist_pro: { name: 'Pro Artist Plan', price: 120, uploads: -1, features: ['Advanced Analytics', 'Monetization', 'Priority Support'] },
    artist_vip: { name: 'VIP Artist Plan', price: 300, uploads: -1, features: ['Verified Badge', 'Homepage Promotion', '24/7 Support'] }
};

// Mobile Money Providers
window.MOBILE_MONEY = {
    mtn: { name: 'MTN Mobile Money', enabled: true },
    airtel: { name: 'Airtel Money', enabled: true },
    zamtel: { name: 'Zamtel Kwacha', enabled: true }
};

// Helper functions
window.getStaticUrl = (path) => {
    if (!path) return window.APP_CONFIG.DEFAULT_IMAGE;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/uploads')) return `${window.APP_CONFIG.STATIC_URL}${path}`;
    return path;
};

window.getDefaultImage = () => {
    return window.APP_CONFIG.DEFAULT_IMAGE;
};

window.apiRequest = async (endpoint, options = {}) => {
    const token = localStorage.getItem('bravo_token');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
    }
    
    return data;
};