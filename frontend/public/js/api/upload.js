/**
 * Upload API Client
 */

class UploadAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    
    uploadSong(formData, onProgress) {
        return this._uploadWithProgress('/songs/upload', formData, onProgress);
    }

    /**
     * Admin upload: audio or video song on behalf of an artist.
     *
     * `kind` is 'song' or 'video' to pick the right endpoint.
     */
    adminUploadSong(kind, formData, onProgress) {
        const endpoint = kind === 'video' ? '/admin/upload-video' : '/admin/upload-song';
        return this._uploadWithProgress(endpoint, formData, onProgress);
    }

    /**
     * Admin upload: album (just cover art + metadata, no audio file).
     */
    adminUploadAlbum(formData, onProgress) {
        return this._uploadWithProgress('/admin/upload-album', formData, onProgress);
    }

    /**
     * Internal: shared XHR-based upload with progress + abort + 401-retry.
     */
    _uploadWithProgress(endpoint, formData, onProgress, isRetry = false) {
        const url = `${this.apiUrl}${endpoint}`;
        const xhr = new XMLHttpRequest();
        let aborted = false;

        const promise = new Promise((resolve) => {
            xhr.open('POST', url, true);

            // Attach token if available. We DON'T send `Bearer null` — that
            // weirdly on malformed Authorization headers.
            const token = window.authService?.getToken?.() || localStorage.getItem('bravo_token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            // Real progress! Wired into the XHR upload object, not the
            // response — `xhr.onprogress` would fire on download progress
            // (the response body), not on the request body bytes being sent.
            if (onProgress && xhr.upload) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        onProgress({
                            loaded: e.loaded,
                            total: e.total,
                            percent: Math.round((e.loaded / e.total) * 100)
                        });
                    }
                });
            }

            xhr.addEventListener('load', async () => {
                if (aborted) return; // abort() already resolved

                const status = xhr.status;
                let data = null;
                if (xhr.responseText) {
                    try {
                        data = JSON.parse(xhr.responseText);
                    } catch {
                        data = { error: 'Invalid server response' };
                    }
                } else {
                    data = {};
                }

                if (status >= 200 && status < 300) {
                    return resolve({ success: true, data, status });
                }

                // 401: try one refresh + retry.
                if (status === 401 && !isRetry && window.authService) {
                    const refreshed = await window.authService.api?._tryRefresh?.();
                    if (refreshed) {
                        // Retry by issuing a fresh call. NOTE: we have to
                        // pass the same `onProgress` so the UI keeps
                        // updating from 0% on the retry. We mark isRetry=true
                        // so a second 401 doesn't loop.
                        const retry = this._uploadWithProgress(endpoint, formData, onProgress, true);
                        // forward the retry's resolution to our outer promise
                        retry.promise.then(resolve);
                        return;
                    }
                    // Refresh failed — surface the 401.
                }

                // Status-specific friendly errors.
                let errorMsg = data.error || data.message;
                if (status === 413) {
                    errorMsg = errorMsg || 'File too large. Please check the size limits and try again.';
                } else if (status === 415) {
                    errorMsg = errorMsg || 'Unsupported file format.';
                } else if (status === 429) {
                    errorMsg = errorMsg || 'Upload limit reached. Please try again later (10 uploads per hour).';
                } else if (status === 403) {
                    errorMsg = errorMsg || 'You don\'t have permission to upload. Check your subscription or verify your email.';
                } else if (status >= 500) {
                    errorMsg = errorMsg || 'Server error. Please try again later.';
                } else {
                    errorMsg = errorMsg || 'Upload failed';
                }

                resolve({ success: false, error: errorMsg, status, data });
            });

            xhr.addEventListener('error', () => {
                if (aborted) return;
                resolve({ success: false, error: 'Network error. Please check your connection.', status: 0 });
            });

            xhr.addEventListener('abort', () => {
                if (!aborted) return; // ignore abort caused by anything other than user
                resolve({ success: false, error: 'Upload cancelled', cancelled: true, status: 0 });
            });

            xhr.addEventListener('timeout', () => {
                if (aborted) return;
                resolve({ success: false, error: 'Upload timed out. Try a smaller file or better connection.', status: 0 });
            });

            // No timeout cap on big videos — let the user wait. If you
            // want to enforce one, e.g. 30 minutes:
            //   xhr.timeout = 30 * 60 * 1000;

            xhr.send(formData);
        });

        return {
            promise,
            abort: () => {
                aborted = true;
                try { xhr.abort(); } catch {}
            }
        };
    }
}

window.UploadAPI = UploadAPI;
