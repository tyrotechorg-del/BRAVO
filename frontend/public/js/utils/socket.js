/**
 * WebSocket Service
 */

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.isConnected = false;
    }

    connect(token) {
        if (this.socket && this.socket.connected) {
            return this.socket;
        }
        
        this.socket = io(window.config.WS_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('🔌 Socket connected');
            this.isConnected = true;
        });
        
        this.socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
            this.isConnected = false;
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
        
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
        
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        }
    }

    joinRoom(room) {
        this.emit('join-room', { room });
    }

    leaveRoom(room) {
        this.emit('leave-room', { room });
    }

    sendComment(songId, comment) {
        this.emit('new-comment', { songId, comment });
    }

    sendTyping(songId, isTyping) {
        this.emit('typing', { songId, isTyping });
    }

    notifyStreamStart(songId) {
        this.emit('stream-start', { songId });
    }

    notifyStreamEnd(songId) {
        this.emit('stream-end', { songId });
    }
}

window.SocketService = SocketService;