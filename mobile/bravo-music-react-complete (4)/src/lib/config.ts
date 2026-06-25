// Bravo Music Frontend Configuration (ported from config.js)

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.bravomusics.com/api'
export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL || 'wss://api.bravomusics.com'

export const APP_CONFIG = {
  API_URL: API_BASE_URL,
  WS_URL: WS_BASE_URL,
  STATIC_URL: import.meta.env.VITE_STATIC_URL || 'https://api.bravomusics.com',
  FRONTEND_URL: 'https://bravomusics.com',
  APP_NAME: 'Bravo Music',
  APP_VERSION: '2.1.0',
  APP_DESCRIPTION: "Zambia's Premier Music Platform",
  DEFAULT_VOLUME: 0.7,
  ITEMS_PER_PAGE: 20,
  MAX_PAGE_LIMIT: 100,
  MAX_AUDIO_SIZE_MB: 20,
  MAX_VIDEO_SIZE_MB: 500,
  MAX_IMAGE_SIZE_MB: 5,
  // Local branded placeholder, served from the frontend's public/ folder.
  DEFAULT_IMAGE: '/images/bravo.png',
}

export const API_ENDPOINTS = {
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
  ANALYTICS: '/analytics',
}

// Backend's normalizeGenre + enum validator reject anything not in this list.
export const GENRES = [
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
  'Cuundu',
  'Kalindula',
  'Other',
]

export const SUBSCRIPTION_PLANS = {
  listener_premium: {
    name: 'Premium Listener',
    price: 50,
    features: [
      'Unlimited ad-free streaming',
      'Higher audio quality (320kbps)',
      'Offline downloads',
      'Skip premium song fees',
    ],
  },
  artist_basic: { name: 'Basic Artist Plan', price: 50, uploads: 10, features: ['Basic Analytics', 'Email Support'] },
  artist_pro: { name: 'Pro Artist Plan', price: 120, uploads: -1, features: ['Advanced Analytics', 'Monetization', 'Priority Support'] },
  artist_vip: { name: 'VIP Artist Plan', price: 300, uploads: -1, features: ['Verified Badge', 'Homepage Promotion', '24/7 Support'] },
}

export const MOBILE_MONEY = {
  mtn: { name: 'MTN Mobile Money', enabled: true },
  airtel: { name: 'Airtel Money', enabled: true },
  zamtel: { name: 'Zamtel Kwacha', enabled: true },
}

// Helpers (ported from config.js)
export function getDefaultImage(): string {
  return APP_CONFIG.DEFAULT_IMAGE
}

export function resolveImageUrl(url?: string | null): string {
  const fallback = getDefaultImage()
  if (!url) return fallback
  // Backend stores the default as a bare "images/bravo.png" — serve the local
  // bundled asset rather than hitting the static host.
  if (url === 'images/bravo.png' || url === '/images/bravo.png' || url.endsWith('/images/bravo.png')) {
    return '/images/bravo.png'
  }
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/uploads') || url.startsWith('/static')) {
    return `${APP_CONFIG.STATIC_URL}${url}`
  }
  return url
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num || 0)
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Build a URL-friendly slug, e.g. "Soka Moya" + "Yo Maps" -> "soka-moya-yo-maps"
export function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, '')           // trim hyphens
    .slice(0, 80)
}

// Song share path: /song/<title>-<artist>-<id>. The id stays at the end so the
// route can still extract it; the slug is purely for readability/SEO.
export function songSlugPath(song: {
  _id: string
  title?: string
  artist?: { stageName?: string } | string
}): string {
  const artist = typeof song.artist === 'object' ? song.artist?.stageName : undefined
  const parts = [song.title, artist].filter(Boolean).join(' ')
  const slug = slugify(parts)
  return slug ? `/song/${slug}-${song._id}` : `/song/${song._id}`
}

// Extract the trailing 24-char Mongo id from a slugged param like
// "soka-moya-yo-maps-6a2ce1b08fa1508e3ba6e7d4".
export function extractIdFromSlug(param: string): string {
  if (!param) return param
  const m = param.match(/([a-f\d]{24})$/i)
  return m ? m[1] : param
}
