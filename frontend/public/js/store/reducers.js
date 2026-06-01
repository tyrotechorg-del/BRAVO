/**
 * State Reducers
 */

const reducers = {
    // Player Reducer
    playerReducer: (state, action) => {
        switch (action.type) {
            case 'PLAY_SONG':
                return {
                    ...state,
                    currentSong: action.payload,
                    isPlaying: true
                };
            case 'PAUSE':
                return { ...state, isPlaying: false };
            case 'RESUME':
                return { ...state, isPlaying: true };
            case 'STOP':
                return {
                    ...state,
                    currentSong: null,
                    isPlaying: false,
                    progress: 0
                };
            case 'SEEK':
                return { ...state, progress: action.payload };
            case 'VOLUME_CHANGE':
                return { ...state, volume: action.payload };
            default:
                return state;
        }
    },

    // Queue Reducer
    queueReducer: (state, action) => {
        switch (action.type) {
            case 'ADD_TO_QUEUE':
                return { ...state, queue: [...state.queue, action.payload] };
            case 'REMOVE_FROM_QUEUE':
                const newQueue = [...state.queue];
                newQueue.splice(action.payload, 1);
                return { ...state, queue: newQueue };
            case 'CLEAR_QUEUE':
                return { ...state, queue: [], currentIndex: -1 };
            case 'SET_QUEUE':
                return {
                    ...state,
                    queue: action.payload,
                    currentIndex: 0
                };
            case 'NEXT_TRACK':
                if (state.currentIndex + 1 < state.queue.length) {
                    return {
                        ...state,
                        currentIndex: state.currentIndex + 1,
                        currentSong: state.queue[state.currentIndex + 1]
                    };
                }
                return state;
            case 'PREVIOUS_TRACK':
                if (state.currentIndex - 1 >= 0) {
                    return {
                        ...state,
                        currentIndex: state.currentIndex - 1,
                        currentSong: state.queue[state.currentIndex - 1]
                    };
                }
                return state;
            default:
                return state;
        }
    },

    // UI Reducer
    uiReducer: (state, action) => {
        switch (action.type) {
            case 'TOGGLE_SIDEBAR':
                return { ...state, sidebarOpen: !state.sidebarOpen };
            case 'SET_THEME':
                return { ...state, theme: action.payload };
            case 'SET_LOADING':
                return { ...state, isLoading: action.payload };
            case 'SET_ERROR':
                return { ...state, error: action.payload };
            default:
                return state;
        }
    },

    // Search Reducer
    searchReducer: (state, action) => {
        switch (action.type) {
            case 'SET_SEARCH_QUERY':
                return { ...state, searchQuery: action.payload };
            case 'SET_SEARCH_RESULTS':
                return { ...state, searchResults: action.payload };
            case 'CLEAR_SEARCH':
                return { ...state, searchQuery: '', searchResults: null };
            default:
                return state;
        }
    },

    // Notification Reducer
    notificationReducer: (state, action) => {
        switch (action.type) {
            case 'ADD_NOTIFICATION':
                return {
                    ...state,
                    notifications: [action.payload, ...state.notifications],
                    unreadCount: state.unreadCount + 1
                };
            case 'MARK_READ':
                const updated = state.notifications.map(n =>
                    n._id === action.payload ? { ...n, read: true } : n
                );
                return {
                    ...state,
                    notifications: updated,
                    unreadCount: updated.filter(n => !n.read).length
                };
            case 'MARK_ALL_READ':
                const allRead = state.notifications.map(n => ({ ...n, read: true }));
                return {
                    ...state,
                    notifications: allRead,
                    unreadCount: 0
                };
            default:
                return state;
        }
    }
};

window.reducers = reducers;