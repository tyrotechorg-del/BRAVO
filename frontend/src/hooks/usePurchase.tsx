import { useState, useCallback } from 'react'
import PaymentFlowModal, { type PaymentRequest } from '../components/ui/PaymentFlowModal'
import { toast } from '../store/toastStore'
import type { Song, Album } from '../types'

interface PurchaseHandlers {
  onSuccess?: (data: unknown) => void
  onFailure?: (message: string) => void
}

// Mirrors the original PurchaseFlow.buySong / buyAlbum, as a React hook.
export function usePurchase() {
  const [request, setRequest] = useState<(PaymentRequest & PurchaseHandlers) | null>(null)

  const buySong = useCallback((song: Song & { price?: number }, handlers: PurchaseHandlers = {}) => {
    if (!song?._id) return toast.show('Invalid song', 'error')
    const price = Number(song.price || 0)
    if (price <= 0) { toast.show('This song is free', 'info'); handlers.onSuccess?.({ free: true }); return }
    setRequest({
      title: 'Buy Song',
      summary: `Purchase "${song.title}" for K${price.toFixed(2)}. The song will be added to your library and available offline.`,
      amount: price,
      type: 'song_purchase',
      metadata: { songId: song._id, songTitle: song.title },
      ...handlers,
    })
  }, [])

  const buyAlbum = useCallback((album: Album & { price?: number }, handlers: PurchaseHandlers = {}) => {
    if (!album?._id) return toast.show('Invalid album', 'error')
    const price = Number(album.price || 0)
    if (price <= 0) { toast.show('This album is free', 'info'); handlers.onSuccess?.({ free: true }); return }
    setRequest({
      title: 'Buy Album',
      summary: `Purchase "${album.title}" for K${price.toFixed(2)}. All tracks will be added to your library.`,
      amount: price,
      type: 'album_purchase',
      metadata: { albumId: album._id, albumTitle: album.title },
      ...handlers,
    })
  }, [])

  const purchaseModal = request ? (
    <PaymentFlowModal
      request={request}
      onClose={() => setRequest(null)}
      onSuccess={(data) => {
        toast.show('Purchase complete — content unlocked', 'success')
        request.onSuccess?.(data)
        setRequest(null)
      }}
      onFailure={(msg) => {
        request.onFailure?.(msg)
      }}
    />
  ) : null

  return { buySong, buyAlbum, purchaseModal }
}
