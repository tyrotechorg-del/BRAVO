

class PurchaseFlow {
    /**
     * Buy a song.
     *
     * @param {object} song - Song with at minimum { _id, title, price }
     * @param {object} opts
     *   - {function} onSuccess(data) - Called when the purchase completes
     *   - {function} onFailure(reason) - Called when the purchase fails
     *   - {boolean} useWalletFirst - Try to pay from wallet balance first
     */
    static buySong(song, opts = {}) {
        if (!song || !song._id) {
            Toast.show?.('Invalid song', 'error');
            return null;
        }
        const price = Number(song.price || 0);
        if (price <= 0) {
            Toast.show?.('This song is free', 'info');
            if (typeof opts.onSuccess === 'function') opts.onSuccess({ free: true });
            return null;
        }
        const title = String(song.title || 'song');

        return PurchaseFlow._open({
            title: 'Buy Song',
            summary: `Purchase "${title}" for K${price.toFixed(2)}. The song will be added to your library and available offline.`,
            amount: price,
            type: 'song_purchase',
            metadata: { songId: song._id, songTitle: title },
            opts
        });
    }

    /**
     * Buy an album.
     *
     * @param {object} album - Album with at minimum { _id, title, price }
     * @param {object} opts - same as buySong
     */
    static buyAlbum(album, opts = {}) {
        if (!album || !album._id) {
            Toast.show?.('Invalid album', 'error');
            return null;
        }
        const price = Number(album.price || 0);
        if (price <= 0) {
            Toast.show?.('This album is free', 'info');
            if (typeof opts.onSuccess === 'function') opts.onSuccess({ free: true });
            return null;
        }
        const title = String(album.title || 'album');

        return PurchaseFlow._open({
            title: 'Buy Album',
            summary: `Purchase "${title}" for K${price.toFixed(2)}. All tracks will be added to your library.`,
            amount: price,
            type: 'album_purchase',
            metadata: { albumId: album._id, albumTitle: title },
            opts
        });
    }

    /**
     * Internal: open the PaymentFlowModal with the right callbacks.
     */
    static _open({ title, summary, amount, type, metadata, opts }) {
        const paymentsAPI = new PaymentsAPI();

        return PaymentFlowModal.show({
            title,
            summary,
            amount,
            onConfirm: async ({ phoneNumber, method }) => {
                const result = await paymentsAPI.initiatePayment(
                    amount,
                    type,
                    method,
                    phoneNumber,
                    metadata
                );
                if (!result.success) {
                    return { error: result.error || 'Failed to start payment' };
                }
                const data = result.data || {};
                return {
                    reference: data.reference || data.paymentReference || data.payment?.reference,
                    data
                };
            },
            onSuccess: (data) => {
                // Fire an event so other components can refresh (e.g., AudioPlayer
                // can re-check premium access, library can reload, etc.)
                try {
                    window.dispatchEvent(new CustomEvent('bravo:purchase-complete', {
                        detail: { type, metadata, data }
                    }));
                } catch {}

                Toast.show?.('Purchase complete — content unlocked', 'success');
                if (typeof opts.onSuccess === 'function') {
                    try { opts.onSuccess(data); } catch (err) { console.error(err); }
                }
            },
            onFailure: ({ message }) => {
                Toast.show?.(message || 'Purchase failed', 'error');
                if (typeof opts.onFailure === 'function') {
                    try { opts.onFailure(message); } catch (err) { console.error(err); }
                }
            }
        });
    }
}

window.PurchaseFlow = PurchaseFlow;
