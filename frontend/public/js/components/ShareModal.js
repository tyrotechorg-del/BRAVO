/**
 * Share Modal Component
 */

class ShareModal {
    static show(song, onShareComplete = null) {
        const songUrl = `${window.location.origin}/#song/${song._id}`;
        const songTitle = song.title;
        const artistName = song.artist?.stageName || 'Unknown Artist';
        const shareText = `Check out "${songTitle}" by ${artistName} on Bravo Music! 🎵`;
        
        Modal.show({
            title: 'Share Song',
            content: `
                <div class="share-options">
                    <div class="share-url-container">
                        <input type="text" id="share-url" value="${songUrl}" readonly>
                        <button class="btn-secondary copy-url-btn" id="copy-url-btn">Copy</button>
                    </div>
                    <div class="share-buttons">
                        <button class="share-platform" data-platform="facebook">
                            <i class="fab fa-facebook-f"></i> Facebook
                        </button>
                        <button class="share-platform" data-platform="twitter">
                            <i class="fab fa-twitter"></i> Twitter
                        </button>
                        <button class="share-platform" data-platform="whatsapp">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="share-platform" data-platform="telegram">
                            <i class="fab fa-telegram"></i> Telegram
                        </button>
                        <button class="share-platform" data-platform="email">
                            <i class="fas fa-envelope"></i> Email
                        </button>
                        <button class="share-platform" data-platform="linkedin">
                            <i class="fab fa-linkedin-in"></i> LinkedIn
                        </button>
                        <button class="share-platform" data-platform="reddit">
                            <i class="fab fa-reddit-alien"></i> Reddit
                        </button>
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Close', class: 'btn-secondary', action: 'close' }
            ]
        });
        
        setTimeout(() => {
            const copyBtn = document.getElementById('copy-url-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const urlInput = document.getElementById('share-url');
                    urlInput.select();
                    document.execCommand('copy');
                    Toast.show('Link copied to clipboard!', 'success');
                });
            }
            
            document.querySelectorAll('.share-platform').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const platform = btn.dataset.platform;
                    await this.shareToPlatform(platform, songUrl, shareText, song, onShareComplete);
                });
            });
        }, 100);
    }
    
    static async shareToPlatform(platform, url, text, song, onShareComplete) {
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);
        
        let shareUrl = '';
        switch(platform) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
                break;
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
                break;
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=Check out this song&body=${encodedText}%0A%0A${encodedUrl}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
                break;
            case 'reddit':
                shareUrl = `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
                break;
            default:
                return;
        }
        
        window.open(shareUrl, '_blank', 'width=600,height=400');
        
        // Track share on backend
        try {
            const songsAPI = new SongsAPI();
            await songsAPI.share(song._id, platform);
            if (onShareComplete) onShareComplete(platform);
            Toast.show(`Shared on ${platform}!`, 'success');
        } catch (error) {
            console.error('Share tracking error:', error);
        }
    }
}

window.ShareModal = ShareModal;