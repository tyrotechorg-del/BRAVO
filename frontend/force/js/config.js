// Bravo Music Configuration
const API_BASE_URL = "http://localhost:5000/api";
const WS_BASE_URL = "ws://localhost:5000";

window.APP_CONFIG = {
    API_URL: API_BASE_URL,
    WS_URL: WS_BASE_URL,
    APP_NAME: 'Bravo Music',
    APP_VERSION: '2.0.0',
    DEFAULT_VOLUME: 0.7,
    ITEMS_PER_PAGE: 20
};

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

window.SUBSCRIPTION_PLANS = {
    artist_basic: { name: 'Basic Artist Plan', price: 50, uploads: 10 },
    artist_pro: { name: 'Pro Artist Plan', price: 120, uploads: -1 },
    artist_vip: { name: 'VIP Artist Plan', price: 300, uploads: -1 }
};

window.PROMOTION_PACKAGES = {
    homepage: { name: 'Homepage Feature', price: 500, duration: 7 },
    trending: { name: 'Trending Section', price: 300, duration: 7 },
    playlist: { name: 'Playlist Placement', price: 200, duration: 14 },
    sponsored: { name: 'Sponsored Placement', price: 1000, duration: 30 }
};