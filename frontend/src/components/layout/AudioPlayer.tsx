import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../../store/playerStore'
import { useAuthStore } from '../../store/authStore'
import { resolveImageUrl, formatDuration, songSlugPath } from '../../lib/config'
import { songsService } from '../../services/songsService'
import { addDownload } from '../../lib/library'
import { toast } from '../../store/toastStore'
import Equalizer from '../ui/Equalizer'
import ShareModal from '../ui/ShareModal'

export default function AudioPlayer() {
  const navigate = useNavigate()
  const { currentSong, isPlaying, volume, toggle, next, prev, repeat, shuffle, cycleRepeat, toggleShuffle } = usePlayerStore()
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSong) return
    const url = songsService.streamUrl(currentSong._id)
    if (audio.src !== url) { audio.src = url; audio.load() }
    if (isPlaying) audio.play().catch(() => { /* autoplay blocked until gesture */ })
    else audio.pause()
  }, [currentSong, isPlaying])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])

  if (!currentSong) return null

  const artist = (typeof currentSong.artist === 'object' ? currentSong.artist?.stageName : undefined) || 'Bravo Music'
  const pct = duration ? (progress / duration) * 100 : 0

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const like = async () => {
    if (!isAuth) return toast.show('Please login to like songs', 'info')
    const r = await songsService.like(currentSong._id)
    toast.show(r.success ? 'Added to liked songs' : r.error || 'Failed', r.success ? 'success' : 'error')
  }
  const share = () => setShareOpen(true)
  const shareUrl = `${window.location.origin}${songSlugPath(currentSong)}`

  return (
    <div className="player-bar">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => { if (repeat === 'one' && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}) } else next(true) }}
      />
      <div className="player-container">
        {/* Info */}
        <div className="player-info" onClick={() => navigate(songSlugPath(currentSong))}>
          <img className="player-cover" src={resolveImageUrl(currentSong.coverArt)} alt="Cover art" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
          <div className="player-details">
            <div className="player-title flex items-center gap-2"><Equalizer playing={isPlaying} />{currentSong.title}</div>
            <div className="player-artist">{artist}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="player-controls">
          <button className={`player-btn player-btn--shuffle ${shuffle ? 'text-primary' : ''}`} onClick={toggleShuffle} title="Shuffle" aria-label="Shuffle" aria-pressed={shuffle}><i className="fas fa-random" /></button>
          <button className="player-btn" onClick={prev} title="Previous" aria-label="Previous"><i className="fas fa-backward" /></button>
          <button className={`player-btn play-pause ${isPlaying ? 'playing' : ''}`} onClick={toggle} title="Play/Pause" aria-label="Play"><i className={`fas fa-${isPlaying ? 'pause' : 'play'}`} /></button>
          <button className="player-btn" onClick={() => next(false)} title="Next" aria-label="Next"><i className="fas fa-forward" /></button>
          <button className={`player-btn player-btn--repeat relative ${repeat !== 'off' ? 'text-primary' : ''}`} onClick={cycleRepeat} title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'} aria-label="Repeat">
            <i className="fas fa-redo-alt" />
            {repeat === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-primary text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>}
          </button>
        </div>

        {/* Progress */}
        <div className="player-progress">
          <span className="current-time">{formatDuration(progress)}</span>
          <div className="progress-bar" onClick={onSeek} role="slider" tabIndex={0} aria-label="Playback position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="duration">{formatDuration(duration)}</span>
        </div>

        {/* Extra */}
        <div className="player-extra">
          <button className="player-btn player-btn--like" onClick={like} title="Like" aria-label="Like"><i className="far fa-heart" /></button>
          <button className="player-btn player-btn--share" onClick={share} title="Share" aria-label="Share"><i className="fas fa-share-alt" /></button>
          <button className="player-btn" onClick={() => { addDownload({ _id: currentSong._id, title: currentSong.title, coverArt: currentSong.coverArt, artist: typeof currentSong.artist === 'object' ? currentSong.artist : undefined }); toast.show('Saved to your downloads', 'success') }} title="Download" aria-label="Download"><i className="fas fa-download" /></button>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          url={shareUrl}
          title={currentSong.title}
          artist={typeof currentSong.artist === 'object' ? currentSong.artist?.stageName : undefined}
          onShared={(platform) => songsService.share(currentSong._id, platform)}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}
