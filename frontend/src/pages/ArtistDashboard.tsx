import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { artistsService } from '../services/artistsService'
import { albumsService } from '../services/albumsService'
import { songsService } from '../services/songsService'
import { Spinner, EmptyState } from '../components/ui/common'
import { useConfirm } from '../hooks/useConfirm'
import { usePlayerStore } from '../store/playerStore'
import { toast } from '../store/toastStore'
import { resolveImageUrl, formatNumber, songSlugPath } from '../lib/config'
import type { Song, Album } from '../types'

interface DashboardStats {
  totalSongs?: number
  totalAlbums?: number
  totalStreams?: number
  totalDownloads?: number
  totalRevenue?: number
  monthlyListeners?: number
  walletBalance?: number
}

export default function ArtistDashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)
  const { confirm, confirmDialog } = useConfirm()

  const [stats, setStats] = useState<DashboardStats>({})
  const [songs, setSongs] = useState<Song[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'songs' | 'albums'>('songs')

  const load = useCallback(async () => {
    setLoading(true)
    const [dash, songsRes, albumsRes] = await Promise.all([
      artistsService.getDashboard(),
      artistsService.getMySongs(),
      albumsService.getMyAlbums(),
    ])
    if (dash.success) {
      const d = dash.data as { stats?: DashboardStats }
      setStats(d?.stats || {})
    }
    if (songsRes.success) {
      const d = songsRes.data as { songs?: Song[] } | Song[]
      setSongs(Array.isArray(d) ? d : d?.songs || [])
    }
    if (albumsRes.success) {
      const d = albumsRes.data as { albums?: Album[] } | Album[]
      setAlbums(Array.isArray(d) ? d : d?.albums || [])
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const deleteSong = (s: Song) => confirm({
    message: `Delete "${s.title}"? This cannot be undone.`,
    confirmLabel: 'Delete', confirmClass: 'btn-danger',
    onConfirm: async () => {
      const r = await songsService.deleteSong(s._id)
      if (!r.success) return toast.show(r.error || 'Failed to delete', 'error')
      setSongs((prev) => prev.filter((x) => x._id !== s._id))
      toast.show('Song deleted', 'success')
    },
  })

  const statCards = [
    { label: 'Total Plays', value: formatNumber(stats.totalStreams || 0), icon: 'fa-play', color: '#6c63ff' },
    { label: 'Total Songs', value: formatNumber(stats.totalSongs ?? songs.length), icon: 'fa-music', color: '#ff6584' },
    { label: 'Albums', value: formatNumber(stats.totalAlbums ?? albums.length), icon: 'fa-compact-disc', color: '#00c853' },
    { label: 'Earnings (K)', value: (stats.totalRevenue || 0).toFixed(2), icon: 'fa-money-bill', color: '#ffc107' },
  ]

  const statusBadge = (s?: string) => {
    const map: Record<string, string> = { approved: 'status-completed', featured: 'status-completed', pending: 'status-pending', rejected: 'status-failed' }
    return <span className={`status-badge ${map[s || 'pending'] || 'status-pending'}`}>{s || 'pending'}</span>
  }

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Artist Dashboard</h1>
          <p className="text-[#b3b3b3] mt-1">Welcome back, {user?.username}!</p>
        </div>
        <Link to="/upload" className="btn-primary no-underline"><i className="fas fa-upload" /> Upload Song</Link>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {statCards.map((s) => (
              <div key={s.label} className="bg-[#1a1a1a] rounded-2xl p-5 text-center border border-[#2a2a2a]">
                <i className={`fas ${s.icon} text-2xl mb-3 block`} style={{ color: s.color }} />
                <p className="text-sm text-[#b3b3b3] mb-1">{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#2a2a2a] mb-5">
            <button onClick={() => setTab('songs')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'songs' ? 'text-primary border-primary' : 'text-[#b3b3b3] border-transparent hover:text-white'}`}>
              <i className="fas fa-music mr-2" />My Songs ({songs.length})
            </button>
            <button onClick={() => setTab('albums')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'albums' ? 'text-primary border-primary' : 'text-[#b3b3b3] border-transparent hover:text-white'}`}>
              <i className="fas fa-compact-disc mr-2" />My Albums ({albums.length})
            </button>
          </div>

          {tab === 'songs' && (
            songs.length === 0 ? <EmptyState icon="fa-music" title="No songs yet" message="Songs you or an admin upload for you appear here." /> : (
              <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
                {songs.map((s) => (
                  <div key={s._id} className="flex items-center gap-4 p-3 hover:bg-[#2a2a2a]/30 transition-colors group">
                    <img src={resolveImageUrl(s.coverArt)} className="w-12 h-12 rounded object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-truncate">{s.title}</p>
                      <p className="text-xs text-[#b3b3b3]">{formatNumber(s.playCount || 0)} plays {s.isVideo && '· video'}</p>
                    </div>
                    {statusBadge(s.status)}
                    <button className="btn-icon" onClick={() => play(s, songs)} title="Play"><i className="fas fa-play" /></button>
                    <button className="btn-icon" onClick={() => navigate(songSlugPath(s))} title="View"><i className="fas fa-eye" /></button>
                    <button className="btn-icon" onClick={() => deleteSong(s)} title="Delete"><i className="fas fa-trash" /></button>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'albums' && (
            albums.length === 0 ? (
              <EmptyState icon="fa-compact-disc" title="No albums yet" message="Albums created for you appear here." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {albums.map((a) => (
                  <div key={a._id} className="cursor-pointer group" onClick={() => navigate(`/album/${a._id}`)}>
                    <img src={resolveImageUrl(a.coverArt)} className="w-full aspect-square rounded-xl object-cover mb-2 group-hover:opacity-90 transition-opacity" alt="" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
                    <p className="text-sm font-semibold text-truncate">{a.title}</p>
                    <p className="text-xs text-[#b3b3b3]">{Array.isArray(a.songs) ? a.songs.length : 0} tracks · <span className="capitalize">{a.status || 'draft'}</span></p>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
      {confirmDialog}
    </main>
  )
}
