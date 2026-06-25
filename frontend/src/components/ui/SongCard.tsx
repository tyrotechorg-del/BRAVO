import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Song } from '../../types'
import { resolveImageUrl, formatNumber, songSlugPath } from '../../lib/config'
import { usePlayerStore } from '../../store/playerStore'
import { toast } from '../../store/toastStore'
import { useAuthStore } from '../../store/authStore'
import { songsService } from '../../services/songsService'
import { isLiked as isLikedLocal, toggleLikedLocal, pushHistory } from '../../lib/library'

export default function SongCard({ song, playlist }: { song: Song; playlist?: Song[] }) {
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const [liked, setLiked] = useState(isLikedLocal(song._id))
  const artist = (typeof song.artist === 'object' ? song.artist?.stageName : undefined) || 'Unknown Artist'

  const onPlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    play(song, playlist)
    pushHistory(song._id)
    toast.show(`Now playing: ${song.title}`, 'success')
  }

  const onLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isAuth()) { toast.show('Please login to like songs', 'info'); navigate('/login'); return }
    const next = toggleLikedLocal(song._id)
    setLiked(next)
    try {
      if (next) { await songsService.like(song._id); toast.show('Added to liked songs ❤️', 'success') }
      else { await songsService.unlike(song._id); toast.show('Removed from liked songs', 'info') }
    } catch { /* keep optimistic */ }
  }

  return (
    <div className="group relative bg-[#1a1a1a] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg2">
      <div className="relative aspect-square" onClick={() => navigate(songSlugPath(song))}>
        <img src={resolveImageUrl(song.coverArt)} alt={song.title} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onPlay}
            className="w-11 h-11 rounded-full bg-primary hover:bg-primary-dark text-white flex items-center justify-center transition-transform hover:scale-110 border-none">
            <i className="fas fa-play" />
          </button>
          <button onClick={onLike}
            className={`w-11 h-11 rounded-full text-white flex items-center justify-center transition-transform hover:scale-110 border-none ${liked ? 'bg-danger' : 'bg-primary hover:bg-primary-dark'}`}>
            <i className="fas fa-heart" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <h4 className="text-sm font-semibold text-truncate mb-1">{song.title}</h4>
        <p className="text-xs text-[#b3b3b3] text-truncate mb-2">{artist}</p>
        <div className="flex gap-3 text-[11px] text-[#b3b3b3]">
          <span><i className="fas fa-play mr-1" />{formatNumber(song.playCount || 0)}</span>
          {song.likeCount !== undefined && <span><i className="fas fa-heart mr-1" />{formatNumber(song.likeCount)}</span>}
        </div>
      </div>
    </div>
  )
}
