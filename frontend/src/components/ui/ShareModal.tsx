import Modal from './Modal'
import { toast } from '../../store/toastStore'

export interface ShareData {
  url: string          // full absolute URL (already slugged)
  title: string        // song title
  artist?: string      // artist name
  onShared?: (platform: string) => void  // optional analytics hook
}

interface Props extends ShareData {
  onClose: () => void
}

export default function ShareModal({ url, title, artist, onShared, onClose }: Props) {
  const text = artist ? `${title} by ${artist}` : title
  const shareText = `Listen to ${text} on Bravo Music`
  const enc = encodeURIComponent
  const eu = enc(url)
  const et = enc(shareText)

  const platforms = [
    { id: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366', href: `https://wa.me/?text=${et}%20${eu}` },
    { id: 'facebook', label: 'Facebook', icon: 'fab fa-facebook-f', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${eu}` },
    { id: 'twitter', label: 'X / Twitter', icon: 'fab fa-x-twitter', color: '#000000', href: `https://twitter.com/intent/tweet?text=${et}&url=${eu}` },
    { id: 'telegram', label: 'Telegram', icon: 'fab fa-telegram-plane', color: '#0088cc', href: `https://t.me/share/url?url=${eu}&text=${et}` },
  ]

  const openPlatform = (p: { id: string; href: string }) => {
    window.open(p.href, '_blank', 'noopener,noreferrer,width=600,height=500')
    onShared?.(p.id)
  }

  const nativeShare = async () => {
    const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title, text: shareText, url })
        onShared?.('native')
        onClose()
      } catch { /* user cancelled */ }
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.show('Link copied to clipboard', 'success')
      onShared?.('copy')
    } catch {
      toast.show('Could not copy link', 'error')
    }
  }

  const hasNative = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <Modal title="Share" onClose={onClose}>
      <p className="text-sm text-[#b3b3b3] mb-4 truncate">{shareText}</p>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {platforms.map((p) => (
          <button
            key={p.id}
            onClick={() => openPlatform(p)}
            className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl" style={{ background: p.color }}>
              <i className={p.icon} />
            </span>
            <span className="text-xs text-[#ccc]">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Copy link row */}
      <div className="flex items-center gap-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg p-2">
        <input readOnly value={url} className="flex-1 bg-transparent border-none text-sm text-[#b3b3b3] outline-none min-w-0" onFocus={(e) => e.target.select()} />
        <button onClick={copyLink} className="btn-primary btn-sm shrink-0"><i className="fas fa-copy" /> Copy</button>
      </div>

      {hasNative && (
        <button onClick={nativeShare} className="btn-outline w-full mt-3"><i className="fas fa-share-alt" /> More options…</button>
      )}
    </Modal>
  )
}
