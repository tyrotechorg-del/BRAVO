const socketEvents = {
    // Connection events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECTION_ERROR: 'connect_error',
    
    // Room events
    JOIN_ROOM: 'join-room',
    LEAVE_ROOM: 'leave-room',
    ROOM_JOINED: 'room-joined',
    
    // Music streaming events
    STREAM_START: 'stream-start',
    STREAM_END: 'stream-end',
    STREAM_PROGRESS: 'stream-progress',
    LISTENER_JOINED: 'listener-joined',
    LISTENER_LEFT: 'listener-left',
    LISTENER_COUNT: 'listener-count',
    
    // Comment events
    NEW_COMMENT: 'new-comment',
    COMMENT_ADDED: 'comment-added',
    COMMENT_LIKED: 'comment-liked',
    COMMENT_DELETED: 'comment-deleted',
    TYPING: 'typing',
    USER_TYPING: 'user-typing',
    
    // Like events
    LIKE_SONG: 'like-song',
    SONG_LIKED: 'song-liked',
    SONG_UNLIKED: 'song-unliked',
    
    // Notification events
    NOTIFICATION: 'notification',
    NOTIFICATION_READ: 'notification-read',
    NOTIFICATIONS_CLEARED: 'notifications-cleared',
    
    // Follow events
    FOLLOW_USER: 'follow-user',
    USER_FOLLOWED: 'user-followed',
    USER_UNFOLLOWED: 'user-unfollowed',
    
    // Share events
    SHARE_SONG: 'share-song',
    SONG_SHARED: 'song-shared',
    
    // Playlist events
    PLAYLIST_UPDATED: 'playlist-updated',
    PLAYLIST_DELETED: 'playlist-deleted',
    
    // Admin events
    ADMIN_BROADCAST: 'admin-broadcast',
    CONTENT_UPDATED: 'content-updated',
    
    // Error events
    ERROR: 'error',
    UNAUTHORIZED: 'unauthorized'
};

module.exports = socketEvents;