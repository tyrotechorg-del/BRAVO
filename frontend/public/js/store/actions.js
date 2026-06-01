/**
 * State Actions
 */

const actions = {
    // Auth Actions
    login: (user, token) => {
        AppState.setUser(user);
        localStorage.setItem('token', token);
        return { success: true };
    },

    logout: () => {
        AppState.clearUser();
        localStorage.removeItem('token');
        AppState.setCurrentSong(null);
        AppState.setIsPlaying(false);
        return { success: true };
    },

    // Player Actions
    playSong: (song, playlist = null) => {
        AppState.setCurrentSong(song);
        if (playlist) AppState.setPlaylist(playlist);
        AppState.setIsPlaying(true);
        return { song };
    },

    pauseSong: () => {
        AppState.setIsPlaying(false);
        return { success: true };
    },

    togglePlayPause: () => {
        AppState.setIsPlaying(!AppState.get('isPlaying'));
        return { isPlaying: AppState.get('isPlaying') };
    },

    setVolume: (volume) => {
        AppState.setVolume(volume);
        return { volume };
    },

    nextSong: () => {
        const playlist = AppState.get('playlist');
        const currentSong = AppState.get('currentSong');
        if (!playlist.length || !currentSong) return null;
        
        const currentIndex = playlist.findIndex(s => s._id === currentSong._id);
        if (currentIndex < playlist.length - 1) {
            const nextSong = playlist[currentIndex + 1];
            AppState.setCurrentSong(nextSong);
            return nextSong;
        }
        return null;
    },

    previousSong: () => {
        const playlist = AppState.get('playlist');
        const currentSong = AppState.get('currentSong');
        if (!playlist.length || !currentSong) return null;
        
        const currentIndex = playlist.findIndex(s => s._id === currentSong._id);
        if (currentIndex > 0) {
            const prevSong = playlist[currentIndex - 1];
            AppState.setCurrentSong(prevSong);
            return prevSong;
        }
        return null;
    },

    // UI Actions
    setTheme: (theme) => {
        AppState.set('theme', theme);
        return { theme };
    },

    setLoading: (isLoading) => {
        AppState.setLoading(isLoading);
        return { isLoading };
    },

    setError: (error) => {
        AppState.setError(error);
        return { error };
    },

    // Search Actions
    setSearchQuery: (query) => {
        AppState.set('searchQuery', query);
        return { query };
    },

    setSearchResults: (results) => {
        AppState.set('searchResults', results);
        return { results };
    },

    clearSearch: () => {
        AppState.set('searchQuery', '');
        AppState.set('searchResults', null);
        return { success: true };
    }
};

window.actions = actions;