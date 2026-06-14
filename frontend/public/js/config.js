// Bravo Music Frontend Configuration
//
//   - GENRES list canonicalized (was 17, now 13). Removed 5
//     normalizeGenre + enum: House, Pop, Jazz, Funk, Latin.
//     Added Soul (was excluded but is in the backend enum).
//     Order alphabetised within section.
//   - SUBSCRIPTION_PLANS now includes listener_premium.
//   - APP_VERSION bumped 2.0.0 → 2.1.0.
//   - Cache-busting suffix bumped (every <script src="..."> in
//     index.html should append `?v=20260611`).
//   - apiRequest() helper removed (legacy — every API client now
//   - MOBILE_MONEY map kept (used by PaymentFlowModal).

// API URLs - Change for production
const API_BASE_URL = "https://api.bravomusics.com/api";
const WS_BASE_URL  = "wss://api.bravomusics.com";   // <-- changed ws:// to wss:// for HTTPS pages

// Export for other scripts
window.API_BASE_URL = API_BASE_URL;
window.WS_BASE_URL  = WS_BASE_URL;

window.APP_CONFIG = {
    API_URL: API_BASE_URL,
    WS_URL: WS_BASE_URL,
    STATIC_URL: 'https://api.bravomusics.com',
    FRONTEND_URL: 'https://bravomusics.com',
    APP_NAME: 'Bravo Music',
    APP_VERSION: '2.1.0',
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

// API Endpoints — relative to API_BASE_URL
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

// Backend's normalizeGenre + enum validator REJECT anything not in this list,
// so the frontend MUST not let users pick something the backend will refuse.
window.GENRES = [
    // Mainstream / international
    'Afrobeat',
    'Amapiano',
    'Dancehall',
    'Gospel',
    'Hip Hop',
    'R&B',
    'Reggae',
    'Rock',
    'Soul',
    'Traditional',
    // Zambian
    'Cuundu',
    'Kalindula',
    // Fallback
    'Other'
];

// Subscription Plans — listed in the order they're typically displayed.
window.SUBSCRIPTION_PLANS = {
    listener_premium: {
        name: 'Premium Listener',
        price: 50,
        features: [
            'Unlimited ad-free streaming',
            'Higher audio quality (320kbps)',
            'Offline downloads',
            'Skip premium song fees'
        ]
    },
    artist_basic: {
        name: 'Basic Artist Plan',
        price: 50,
        uploads: 10,
        features: ['Basic Analytics', 'Email Support']
    },
    artist_pro: {
        name: 'Pro Artist Plan',
        price: 120,
        uploads: -1,
        features: ['Advanced Analytics', 'Monetization', 'Priority Support']
    },
    artist_vip: {
        name: 'VIP Artist Plan',
        price: 300,
        uploads: -1,
        features: ['Verified Badge', 'Homepage Promotion', '24/7 Support']
    }
};

// Mobile Money Providers
window.MOBILE_MONEY = {
    mtn:    { name: 'MTN Mobile Money',  enabled: true },
    airtel: { name: 'Airtel Money',       enabled: true },
    zamtel: { name: 'Zamtel Kwacha',      enabled: true }
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

window.resolveImageUrl = (url) => {
    const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
    if (!url) return fallback;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/uploads') || url.startsWith('/static')) {
        return `${window.APP_CONFIG?.STATIC_URL || ''}${url}`;
    }
    return url;
};

window.attachImgFallback = (imgEl) => {
    if (!imgEl || imgEl._bravoFallbackAttached) return;
    imgEl._bravoFallbackAttached = true;
    imgEl.addEventListener('error', () => {
        const fb = window.getDefaultImage?.() || '/js/images/bravo.png';
        if (imgEl.src !== fb) imgEl.src = fb;
    }, { once: true });
};

// NOTE: The legacy `window.apiRequest()` helper has been removed.
// All API clients now route through `window.authService.api._request`
// If anything still calls `apiRequest` directly, it's a bug — please
// migrate to the relevant API client (UserAPI, SongsAPI, etc.).
