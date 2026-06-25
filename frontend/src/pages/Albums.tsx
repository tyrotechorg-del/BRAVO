import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { albumsService } from '../services/albumsService'
import { songsService } from '../services/songsService'
import { Spinner, EmptyState } from '../components/ui/common'
import SongCard from '../components/ui/SongCard'
import { usePlayerStore } from '../store/playerStore'
import { usePurchase } from '../hooks/usePurchase'
import { resolveImageUrl, songSlugPath } from '../lib/config'
import { formatDate } from '../lib/formatters'
import type { Album, Song } from '../types'

/* ----------------------------- Album View ----------------------------- */
export function AlbumView() {
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const play = usePlayerStore((s) => s.play)
  const { buyAlbum, purchaseModal } = usePurchase()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    albumsService.getById(id).then((a) => setAlbum((a && 'album' in a ? a.album : a) as Album | null)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />
  if (!album) return <EmptyState icon="fa-compact-disc" title="Album not found" />

  const songs = (album.songs || []).filter((s): s is Song => typeof s === 'object')
  const artist = typeof album.artist === 'object' ? album.artist : null

  return (
    <main className="max-w-[1100px] mx-auto px-5 py-10">
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <img src={resolveImageUrl(album.coverArt)} alt={album.title} className="w-full md:w-64 h-64 rounded-2xl object-cover shadow-lg2" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
        <div className="flex-1 flex flex-col justify-end">
          <span className="text-xs uppercase tracking-wider text-[#b3b3b3] mb-2">{album.type || 'Album'}</span>
          <h1 className="text-4xl font-extrabold mb-2">{album.title}</h1>
          <p className="text-[#b3b3b3] mb-4">
            {artist && <Link to={`/artist/${artist._id}`} className="text-white hover:text-primary no-underline">{artist.stageName || artist.name}</Link>}
            {album.releaseDate && <> · {formatDate(album.releaseDate, 'long')}</>} · {songs.length} track{songs.length === 1 ? '' : 's'}
          </p>
          {songs.length > 0 && (
            <div className="flex gap-3 flex-wrap self-start">
              <button className="btn-primary" onClick={() => play(songs[0], songs)}><i className="fas fa-play" /> Play</button>
              {album.isPremium && (album.price || 0) > 0 && (
                <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#ffc107,#ff9800)' }} onClick={() => buyAlbum(album)}>
                  <i className="fas fa-shopping-cart" /> Buy · K{Number(album.price).toFixed(2)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {songs.length === 0 ? <EmptyState icon="fa-music" title="No tracks in this album" /> : (
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
          {songs.map((s, i) => (
            <div key={s._id} className="flex items-center gap-4 p-3 hover:bg-[#2a2a2a]/30 transition-colors group">
              <span className="w-6 text-center text-[#b3b3b3] text-sm group-hover:hidden">{i + 1}</span>
              <button className="w-6 text-center text-primary hidden group-hover:block bg-transparent border-none" onClick={() => play(s, songs)}><i className="fas fa-play text-xs" /></button>
              <img src={resolveImageUrl(s.coverArt || album.coverArt)} className="w-10 h-10 rounded object-cover" alt="" />
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-truncate">{s.title}</p></div>
            </div>
          ))}
        </div>
      )}
      {purchaseModal}
    </main>
  )
}

/* ----------------------------- Albums Listing ----------------------------- */
export function AlbumsPage() {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (p: number, reset: boolean) => {
    setLoading(true)
    const res = await albumsService.getAll(p, 24)
    setAlbums((prev) => (reset ? res.albums : [...prev, ...res.albums]))
    setHasMore(p < (res.totalPages || 1))
    setLoading(false)
  }, [])
  useEffect(() => { load(1, true) }, [load])

  return (
    <main className="px-2 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><i className="fas fa-compact-disc text-primary" /> Albums</h1>
      {loading && albums.length === 0 ? <Spinner /> : albums.length === 0 ? <EmptyState icon="fa-compact-disc" title="No albums yet" /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {albums.map((a) => (
              <div key={a._id} className="cursor-pointer group" onClick={() => navigate(`/album/${a._id}`)}>
                <img src={resolveImageUrl(a.coverArt)} alt={a.title} className="w-full aspect-square rounded-xl object-cover mb-2 group-hover:opacity-90 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
                <p className="text-sm font-semibold text-truncate">{a.title}</p>
                <p className="text-xs text-[#b3b3b3] text-truncate">{typeof a.artist === 'object' ? a.artist?.stageName || a.artist?.name : ''}</p>
              </div>
            ))}
          </div>
          {hasMore && <div className="text-center mt-8"><button className="btn-primary" onClick={() => { const n = page + 1; setPage(n); load(n, false) }} disabled={loading}>{loading ? 'Loading…' : 'Load More'}</button></div>}
        </>
      )}
    </main>
  )
}

/* ----------------------------- Videos ----------------------------- */
export function Videos() {
  const navigate = useNavigate()
  const [videos, setVideos] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    songsService.getVideos(1, 30).then((d) => {
      const list = d ? (d.songs || d.videos || []) : []
      setVideos(list)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <main className="px-2 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><i className="fas fa-video text-primary" /> Music Videos</h1>
      {loading ? <Spinner /> : videos.length === 0 ? <EmptyState icon="fa-video" title="No videos yet" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((v) => (
            <div key={v._id} className="cursor-pointer group" onClick={() => navigate(songSlugPath(v))}>
              <div className="relative aspect-video rounded-xl overflow-hidden mb-2">
                <img src={resolveImageUrl(v.coverArt)} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="fas fa-play-circle text-white text-5xl" />
                </div>
              </div>
              <p className="text-sm font-semibold text-truncate">{v.title}</p>
              <p className="text-xs text-[#b3b3b3] text-truncate">{typeof v.artist === 'object' ? v.artist?.stageName : ''}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
