export const USER_ROLES = {
    LISTENER: 'listener',
    ARTIST: 'artist',
    ADMIN: 'admin'
};

export const SUBSCRIPTION_PLANS = {
    ARTIST_BASIC: 'artist_basic',
    ARTIST_PRO: 'artist_pro',
    ARTIST_VIP: 'artist_vip'
};

export const PAYMENT_METHODS = {
    MTN_MONEY: 'mtn_money',
    AIRTEL_MONEY: 'airtel_money',
    ZAMTEL_KWACHA: 'zamtel_kwacha',
    CARD: 'card',
    WALLET: 'wallet'
};

export const PAYMENT_TYPES = {
    SUBSCRIPTION: 'subscription',
    UPLOAD_CREDIT: 'upload_credit',
    PROMOTION: 'promotion',
    SONG_PURCHASE: 'song_purchase',
    ALBUM_PURCHASE: 'album_purchase',
    WITHDRAWAL: 'withdrawal',
    DEPOSIT: 'deposit'
};

export const SONG_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    FEATURED: 'featured'
};

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};