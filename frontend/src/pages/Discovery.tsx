import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom'
import { searchService, type SearchResults } from '../services/searchService'
import { playlistsService } from '../services/playlistsService'
import { notificationsService } from '../services/notificationsService'
import { userService } from '../services/userService'
import { albumsService } from '../services/albumsService'
import { Spinner, EmptyState, Avatar } from '../components/ui/common'
import SongCard from '../components/ui/SongCard'
import { useConfirm } from '../hooks/useConfirm'
import Modal from '../components/ui/Modal'
import { toast } from '../store/toastStore'
import { usePlayerStore } from '../store/playerStore'
import { resolveImageUrl } from '../lib/config'
import { formatDate } from '../lib/formatters'
import { getDownloads, removeDownload, clearDownloads } from '../lib/library'
import type { Playlist, NotificationItem, Album, Song } from '../types'

/* ----------------------------- Search ----------------------------- */
export function Search() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(params.get('q') || '')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); return }
    setLoading(true)
    const r = await searchService.searchAll(q, 10)
    setResults(r.success ? (r.data as SearchResults) : { songs: [], artists: [], albums: [] })
    setLoading(false)
  }, [])

  useEffect(() => { const q = params.get('q'); if (q) { setQuery(q); run(q) } }, [params, run])

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); setParams({ q: query }); run(query) }

  return (
    <main className="px-2 py-8">
      <form onSubmit={onSubmit} className="mb-8 max-w-xl">
        <div className="flex items-center bg-[#1a1a1a] rounded-full px-5 py-3 border border-[#2a2a2a] focus-within:border-primary">
          <i className="fas fa-search text-[#b3b3b3] mr-3" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs, artists, albums..." className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-[#b3b3b3]" />
        </div>
      </form>

      {loading ? <Spinner /> : results ? (
        <>
          {!!results.songs?.length && (
            <section className="mb-10">
              <h2 className="text-xl font-bold mb-4">Songs</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{results.songs.map((s) => <SongCard key={s._id} song={s} />)}</div>
            </section>
          )}
          {!!results.artists?.length && (
            <section className="mb-10">
              <h2 className="text-xl font-bold mb-4">Artists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
                {results.artists.map((a) => (
                  <div key={a._id} className="text-center cursor-pointer" onClick={() => navigate(`/artist/${a._id}`)}>
                    <Avatar src={resolveImageUrl(a.avatar)} className="w-24 h-24 rounded-full object-cover mx-auto mb-2" />
                    <p className="text-sm font-semibold text-truncate">{a.stageName}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!!results.albums?.length && (
            <section className="mb-10">
              <h2 className="text-xl font-bold mb-4">Albums</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
                {results.albums.map((a) => (
                  <div key={a._id} className="cursor-pointer" onClick={() => navigate(`/album/${a._id}`)}>
                    <img src={resolveImageUrl(a.coverArt)} className="w-full aspect-square rounded-xl object-cover mb-2" alt="" />
                    <p className="text-sm font-semibold text-truncate">{a.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!results.songs?.length && !results.artists?.length && !results.albums?.length && (
            <EmptyState icon="fa-search" title="No results" message={`Nothing found for "${query}"`} />
          )}
        </>
      ) : <EmptyState icon="fa-search" title="Search Bravo Music" message="Find your favourite songs, artists and albums." />}
    </main>
  )
}

/* ----------------------------- Playlists ----------------------------- */
export function Playlists() {
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await playlistsService.getMine()
    if (r.success) { const d = r.data as { playlists?: Playlist[] } | Playlist[]; setPlaylists(Array.isArray(d) ? d : d?.playlists || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const r = await playlistsService.create({ name: name.trim(), isPublic })
    if (!r.success) return toast.show(r.error || 'Failed to create', 'error')
    toast.show('Playlist created', 'success'); setShowCreate(false); setName(''); load()
  }
  const remove = (p: Playlist) => confirm({
    message: `Delete playlist "${p.name}"?`, confirmLabel: 'Delete', confirmClass: 'btn-danger',
    onConfirm: async () => { const r = await playlistsService.delete(p._id); if (!r.success) return toast.show(r.error || 'Failed', 'error'); setPlaylists((prev) => prev.filter((x) => x._id !== p._id)); toast.show('Playlist deleted', 'success') },
  })

  return (
    <main className="px-2 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3"><i className="fas fa-list text-primary" /> Playlists</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}><i className="fas fa-plus" /> New Playlist</button>
      </div>
      {loading ? <Spinner /> : playlists.length === 0 ? <EmptyState icon="fa-list" title="No playlists yet" message="Create your first playlist to organize your music." /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {playlists.map((p) => (
            <div key={p._id} className="bg-[#1a1a1a] rounded-xl p-4 hover:bg-[#2a2a2a]/40 transition-colors group relative">
              <div className="cursor-pointer" onClick={() => navigate(`/playlist/${p._id}`)}>
                <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mb-3"><i className="fas fa-music text-3xl text-white/80" /></div>
                <p className="text-sm font-semibold text-truncate">{p.name}</p>
                <p className="text-xs text-[#b3b3b3]">{Array.isArray(p.songs) ? p.songs.length : 0} songs</p>
              </div>
              <button className="absolute top-2 right-2 btn-icon opacity-0 group-hover:opacity-100" onClick={() => remove(p)}><i className="fas fa-trash text-xs" /></button>
            </div>
          ))}
        </div>
      )}
      {showCreate && (
        <Modal title="New Playlist" onClose={() => setShowCreate(false)}
          footer={<><button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn-primary" onClick={create}>Create</button></>}>
          <div className="form-group"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Playlist" autoFocus /></div>
          <label className="checkbox-label"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Make public</label>
        </Modal>
      )}
      {confirmDialog}
    </main>
  )
}

/* ----------------------------- Playlist Detail ----------------------------- */
export function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)
  const { confirm, confirmDialog } = useConfirm()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const r = await playlistsService.getById(id)
    if (r.success) { const d = r.data as { playlist?: Playlist } & Playlist; setPlaylist(d?.playlist || d) }
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (!playlist) return <EmptyState icon="fa-list" title="Playlist not found" />

  const songs = (playlist.songs || []).filter((s): s is Song => typeof s === 'object')

  const removeSong = (songId: string) => confirm({
    message: 'Remove this song from the playlist?', confirmLabel: 'Remove', confirmClass: 'btn-danger',
    onConfirm: async () => {
      const r = await playlistsService.removeSong(playlist._id, songId)
      if (!r.success) return toast.show(r.error || 'Failed', 'error')
      setPlaylist((p) => p ? { ...p, songs: (p.songs || []).filter((s) => (typeof s === 'object' ? s._id : s) !== songId) } : p)
      toast.show('Song removed', 'success')
    },
  })

  return (
    <main className="px-2 py-8">
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="w-full md:w-52 h-52 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shrink-0">
          <i className="fas fa-music text-5xl text-white/80" />
        </div>
        <div className="flex-1 flex flex-col justify-end">
          <span className="text-xs uppercase tracking-wider text-[#b3b3b3] mb-1">Playlist</span>
          <h1 className="text-4xl font-extrabold mb-2">{playlist.name}</h1>
          {playlist.description && <p className="text-[#b3b3b3] mb-3">{playlist.description}</p>}
          <p className="text-sm text-[#b3b3b3] mb-4">{songs.length} song{songs.length === 1 ? '' : 's'}</p>
          {songs.length > 0 && <button className="btn-primary self-start" onClick={() => play(songs[0], songs)}><i className="fas fa-play" /> Play</button>}
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-music" />
          <h3>This playlist is empty</h3>
          <p className="mb-4">Add songs from anywhere in the app.</p>
          <button className="btn-primary" onClick={() => navigate('/browse')}>Browse Music</button>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
          {songs.map((s, i) => {
            const artist = (typeof s.artist === 'object' ? s.artist?.stageName : undefined) || 'Unknown'
            return (
              <div key={s._id} className="flex items-center gap-4 p-3 hover:bg-[#2a2a2a]/30 transition-colors group">
                <span className="w-6 text-center text-[#b3b3b3] text-sm group-hover:hidden">{i + 1}</span>
                <button className="w-6 text-center text-primary hidden group-hover:block bg-transparent border-none" onClick={() => play(s, songs)}><i className="fas fa-play text-xs" /></button>
                <img src={resolveImageUrl(s.coverArt)} className="w-10 h-10 rounded object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-truncate">{s.title}</p><p className="text-xs text-[#b3b3b3] text-truncate">{artist}</p></div>
                <button className="btn-icon opacity-0 group-hover:opacity-100" onClick={() => removeSong(s._id)} title="Remove"><i className="fas fa-times" /></button>
              </div>
            )
          })}
        </div>
      )}
      {confirmDialog}
    </main>
  )
}

/* ----------------------------- Downloads ----------------------------- */
export function Downloads() {
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)
  const { confirm, confirmDialog } = useConfirm()
  const [items, setItems] = useState(getDownloads())

  const remove = (id: string) => { removeDownload(id); setItems(getDownloads()); toast.show('Removed download', 'info') }
  const clearAll = () => confirm({
    message: 'Remove all downloaded songs?', confirmLabel: 'Clear All', confirmClass: 'btn-danger',
    onConfirm: () => { clearDownloads(); setItems([]); toast.show('Downloads cleared', 'success') },
  })

  return (
    <main className="px-2 py-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="text-3xl font-bold flex items-center gap-3"><i className="fas fa-download text-primary" /> Downloads</h1>
        {items.length > 0 && <button className="btn-danger btn-sm" onClick={clearAll}><i className="fas fa-trash" /> Clear All</button>}
      </div>
      <p className="text-[#b3b3b3] text-sm mb-6">{items.length} song{items.length === 1 ? '' : 's'} saved for offline listening.</p>

      {items.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-download" />
          <h3>No downloads yet</h3>
          <p className="mb-4">Download songs to keep them ready to play.</p>
          <button className="btn-primary" onClick={() => navigate('/browse')}>Browse Music</button>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
          {items.map((d) => {
            const artist = (typeof d.artist === 'object' ? d.artist?.stageName : d.artist) || 'Unknown Artist'
            return (
              <div key={d._id} className="flex items-center gap-3 p-3 hover:bg-[#2a2a2a]/30 transition-colors">
                <img src={resolveImageUrl(d.coverArt)} alt="" className="w-12 h-12 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-truncate">{d.title || 'Untitled'}</p>
                  <p className="text-xs text-[#b3b3b3] text-truncate">{artist}</p>
                </div>
                <button className="btn-icon" onClick={() => play({ _id: d._id, title: d.title || '', coverArt: d.coverArt, artist: typeof d.artist === 'object' ? d.artist : undefined } as never)} title="Play"><i className="fas fa-play" /></button>
                <button className="btn-icon" onClick={() => remove(d._id)} title="Remove"><i className="fas fa-trash" /></button>
              </div>
            )
          })}
        </div>
      )}
      {confirmDialog}
    </main>
  )
}

/* ----------------------------- Notifications ----------------------------- */
export function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await notificationsService.getAll(1, 50)
    if (r.success) { const d = r.data as { notifications?: NotificationItem[] }; setItems(d?.notifications || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const markAll = async () => { await notificationsService.markAllAsRead(); setItems((prev) => prev.map((n) => ({ ...n, read: true }))); toast.show('All marked as read', 'success') }
  const markOne = async (n: NotificationItem) => { if (n.read) return; await notificationsService.markAsRead(n._id); setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x))) }

  return (
    <main className="max-w-[760px] mx-auto px-2 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3"><i className="fas fa-bell text-primary" /> Notifications</h1>
        {items.some((n) => !n.read) && <button className="btn-outline btn-sm" onClick={markAll}>Mark all read</button>}
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="fa-bell" title="No notifications" /> : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n._id} onClick={() => markOne(n)} className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${n.read ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-primary/10 border-primary/30'}`}>
              <i className={`fas fa-${n.type === 'payment' ? 'money-bill' : n.type === 'song' ? 'music' : 'bell'} text-primary mt-1`} />
              <div className="flex-1">
                {n.title && <p className="font-medium text-sm">{n.title}</p>}
                <p className="text-sm text-[#b3b3b3]">{n.message}</p>
                {n.createdAt && <p className="text-xs text-[#666] mt-1">{formatDate(n.createdAt, 'relative')}</p>}
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-2" />}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

/* ----------------------------- Upgrade to Artist ----------------------------- */
export function Upgrade() {
  const navigate = useNavigate()
  const [stageName, setStageName] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stageName.trim()) return toast.show('Stage name is required', 'warning')
    setBusy(true)
    const r = await userService.upgradeToArtist({ stageName: stageName.trim(), bio: bio.trim() })
    setBusy(false)
    if (!r.success) return toast.show(r.error || 'Upgrade failed', 'error')
    toast.show('You are now an artist! Check your email to verify.', 'success')
    setTimeout(() => navigate('/artist-dashboard'), 1200)
  }

  return (
    <main className="max-w-[560px] mx-auto px-2 py-10">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><i className="fas fa-crown text-warning" /> Become an Artist</h1>
      <p className="text-[#b3b3b3] mb-8">Upload your music, reach listeners, and earn from your art.</p>
      <form onSubmit={submit} className="bg-[#1a1a1a] rounded-2xl p-8 border border-[#2a2a2a]">
        <div className="form-group"><label>Stage Name *</label><input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Your artist name" /></div>
        <div className="form-group"><label>Bio</label><textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell listeners about yourself..." /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Upgrading…' : 'Upgrade to Artist'}</button>
      </form>
    </main>
  )
}

/* ----------------------------- Artist Albums (manage) ----------------------------- */
export function ArtistAlbums() {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    albumsService.getMyAlbums().then((r) => {
      if (r.success) { const d = r.data as { albums?: Album[] } | Album[]; setAlbums(Array.isArray(d) ? d : d?.albums || []) }
    }).finally(() => setLoading(false))
  }, [])

  return (
    <main className="px-2 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><i className="fas fa-compact-disc text-primary" /> My Albums</h1>
      {loading ? <Spinner /> : albums.length === 0 ? <EmptyState icon="fa-compact-disc" title="No albums yet" message="Albums you create will appear here." /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {albums.map((a) => (
            <div key={a._id} className="cursor-pointer" onClick={() => navigate(`/album/${a._id}`)}>
              <img src={resolveImageUrl(a.coverArt)} className="w-full aspect-square rounded-xl object-cover mb-2" alt="" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
              <p className="text-sm font-semibold text-truncate">{a.title}</p>
              <p className="text-xs text-[#b3b3b3]">{Array.isArray(a.songs) ? a.songs.length : 0} tracks · <span className="capitalize">{a.status || 'draft'}</span></p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
