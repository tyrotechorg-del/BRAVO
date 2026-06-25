import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { albumsService } from '../../services/albumsService'
import { toast } from '../../store/toastStore'
import { resolveImageUrl } from '../../lib/config'
import { Spinner, EmptyState, Avatar } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import { useConfirm } from '../../hooks/useConfirm'
import type { Album, Song } from '../../types'

export default function AdminAlbumsPage() {
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [allAlbums, setAllAlbums] = useState<Album[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tracksAlbum, setTracksAlbum] = useState<Album | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getAllAlbums()
    if (result.success) {
      const data = result.data
      setAllAlbums(Array.isArray(data) ? data : data?.albums || [])
    } else setAllAlbums([])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const albums = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allAlbums
    return allAlbums.filter((a) =>
      (a.title || '').toLowerCase().includes(term) ||
      ((typeof a.artist === 'object' ? a.artist?.stageName : '') || '').toLowerCase().includes(term),
    )
  }, [allAlbums, search])

  const deleteAlbum = (album: Album) => {
    confirm({
      message: `Delete "${album.title}"? Songs in this album will be unlinked, not deleted.`,
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const result = await adminService.deleteAlbum(album._id)
        if (!result.success) return toast.show(result.error || 'Failed to delete', 'error')
        setAllAlbums((prev) => prev.filter((a) => a._id !== album._id))
        toast.show('Album deleted', 'success')
      },
    })
  }

  const artistName = (a: Album) => (typeof a.artist === 'object' ? a.artist?.stageName : undefined) || 'Unknown'
  const total = allAlbums.length
  const published = allAlbums.filter((a) => a.status === 'published').length
  const draft = allAlbums.filter((a) => a.status === 'draft').length

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-compact-disc" /> Albums</h1>
        <p>View and manage all albums on the platform.</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="stat-card-sm"><div className="stat-value">{total}</div><div className="stat-label">Total</div></div>
        <div className="stat-card-sm published"><div className="stat-value">{published}</div><div className="stat-label">Published</div></div>
        <div className="stat-card-sm draft"><div className="stat-value">{draft}</div><div className="stat-label">Draft</div></div>
      </div>

      <div className="filters-bar flex gap-2 mb-4">
        <input className="flex-1 min-w-[200px]" placeholder="Search title or artist..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-outline" onClick={() => { setSearch(''); load() }}><i className="fas fa-sync-alt" /> Refresh</button>
      </div>

      {loading ? <Spinner /> : albums.length === 0 ? (
        <EmptyState icon="fa-compact-disc" title="No albums found" message={search ? 'Try a different search term.' : undefined} />
      ) : (
        <DataTable headers={['Cover', 'Title', 'Artist', 'Genre', 'Type', 'Tracks', 'Status', 'Released', 'Actions']}>
          {albums.map((a) => (
            <tr key={a._id}>
              <td><Avatar src={resolveImageUrl(a.coverArt)} className="w-10 h-10 rounded object-cover" /></td>
              <td><strong>{a.title}</strong></td>
              <td>{artistName(a)}</td>
              <td><span className="genre-badge">{a.genre || 'Various'}</span></td>
              <td><span className="type-badge">{a.type || 'album'}</span></td>
              <td>{Array.isArray(a.songs) ? a.songs.length : 0}</td>
              <td><span className={`status-badge status-${a.status || 'draft'}`}>{a.status || 'draft'}</span></td>
              <td>{a.releaseDate ? new Date(a.releaseDate).toLocaleDateString() : '—'}</td>
              <td>
                <div className="flex gap-1">
                  <button className="btn-icon" onClick={() => navigate(`/album/${a._id}`)} title="View"><i className="fas fa-eye" /></button>
                  <button className="btn-icon" onClick={() => setTracksAlbum(a)} title="Manage tracks"><i className="fas fa-music" /></button>
                  <button className="btn-danger btn-sm" onClick={() => deleteAlbum(a)}><i className="fas fa-trash" /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {tracksAlbum && (
        <ManageTracksModal album={tracksAlbum} onClose={() => setTracksAlbum(null)}
          onChange={(songIds) => setAllAlbums((prev) => prev.map((a) => (a._id === tracksAlbum._id ? { ...a, songs: songIds } : a)))} />
      )}
      {confirmDialog}
    </div>
  )
}

type Scope = 'owner' | 'all'

function ManageTracksModal({ album: albumStub, onClose, onChange }: { album: Album; onClose: () => void; onChange: (songIds: string[]) => void }) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [allSongs, setAllSongs] = useState<Song[]>([])
  const [inAlbumIds, setInAlbumIds] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState<Scope>('owner')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Set<string>>(new Set())

  const ownerArtistId = useMemo(() => {
    if (!album) return ''
    return String((typeof album.artist === 'object' ? album.artist?._id : album.artist) || '')
  }, [album])
  const ownerArtistName =
    (album && typeof album.artist === 'object' ? album.artist?.stageName || album.artist?.name : '') || 'Album artist'

  useEffect(() => {
    (async () => {
      const [albumData, songsResult] = await Promise.all([
        albumsService.getById(albumStub._id),
        adminService.getAllSongs(1, 500),
      ])
      const resolved = (albumData && 'album' in albumData ? albumData.album : albumData) || albumStub
      setAlbum(resolved as Album)
      const songs = songsResult.success
        ? (Array.isArray(songsResult.data) ? songsResult.data : songsResult.data?.songs || [])
        : []
      setAllSongs(songs as Song[])
      const ids = new Set((resolved.songs || []).map((s) => String(typeof s === 'object' ? s._id : s)))
      setInAlbumIds(ids)
      if (!String((typeof resolved.artist === 'object' ? resolved.artist?._id : resolved.artist) || '')) setScope('all')
      setLoading(false)
    })()
  }, [albumStub])

  const toggleTrack = async (song: Song, isIn: boolean) => {
    if (pending.has(song._id) || !album) return
    setPending((p) => new Set(p).add(song._id))
    const result = isIn ? await albumsService.removeSong(album._id, song._id) : await albumsService.addSong(album._id, song._id)
    setPending((p) => { const n = new Set(p); n.delete(song._id); return n })
    if (!result.success) return toast.show(result.error || (isIn ? 'Failed to remove' : 'Failed to add'), 'error')
    toast.show(isIn ? 'Track removed' : 'Track added', 'success', 1500)
    setInAlbumIds((prev) => {
      const n = new Set(prev)
      isIn ? n.delete(String(song._id)) : n.add(String(song._id))
      onChange(Array.from(n))
      return n
    })
  }

  const inSongs = allSongs.filter((s) => inAlbumIds.has(String(s._id)))
  const available = allSongs.filter((s) => {
    if (inAlbumIds.has(String(s._id))) return false
    if (scope === 'owner' && ownerArtistId) {
      const sa = String((typeof s.artist === 'object' ? s.artist?._id : s.artist) || '')
      if (sa !== ownerArtistId) return false
    }
    if (search.trim()) {
      const t = (s.title || '').toLowerCase()
      const a = (typeof s.artist === 'object' ? s.artist?.stageName : '')?.toLowerCase() || ''
      if (!t.includes(search.toLowerCase()) && !a.includes(search.toLowerCase())) return false
    }
    return true
  })

  return (
    <Modal title={`Manage Tracks — ${albumStub.title}`} onClose={onClose} maxWidth="max-w-2xl"
      footer={<button className="btn-primary" onClick={onClose}>Done</button>}>
      {loading ? <Spinner /> : (
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="mb-4">
            <h4 className="font-semibold mb-2">In this album ({inSongs.length})</h4>
            <div className="bg-[#0f0f1e] rounded-lg p-2 min-h-[40px]">
              {inSongs.length === 0 ? (
                <p className="text-[#888] text-center py-3">No tracks in this album yet.</p>
              ) : inSongs.map((s) => <TrackRow key={s._id} song={s} isIn pending={pending.has(s._id)} onToggle={() => toggleTrack(s, true)} />)}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Available songs</h4>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <button type="button" className={`px-3 py-1.5 rounded-md text-[13px] border ${scope === 'owner' ? 'bg-primary text-white border-primary' : 'bg-transparent text-[#aaa] border-[#2a2a3e]'}`}
                disabled={!ownerArtistId} onClick={() => setScope('owner')}>{ownerArtistName}'s songs</button>
              <button type="button" className={`px-3 py-1.5 rounded-md text-[13px] border ${scope === 'all' ? 'bg-primary text-white border-primary' : 'bg-transparent text-[#aaa] border-[#2a2a3e]'}`}
                onClick={() => setScope('all')}>All songs</button>
            </div>
            <input type="search" placeholder="Filter by title..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-md text-white mb-2 outline-none focus:border-primary" />
            <div className="bg-[#0f0f1e] rounded-lg p-2 min-h-[40px]">
              {available.length === 0 ? (
                <p className="text-[#888] text-center py-3">
                  {search ? 'No songs match your search.' : scope === 'owner' ? `${ownerArtistName} hasn't uploaded any other songs yet. Switch to "All songs" to add tracks from other artists.` : 'No songs available to add.'}
                </p>
              ) : (
                <>
                  {available.slice(0, 100).map((s) => <TrackRow key={s._id} song={s} isIn={false} pending={pending.has(s._id)} onToggle={() => toggleTrack(s, false)} />)}
                  {available.length > 100 && <p className="text-[#888] text-center py-2">{available.length - 100} more — use the search above to narrow down.</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function TrackRow({ song, isIn, pending, onToggle }: { song: Song; isIn: boolean; pending: boolean; onToggle: () => void }) {
  const artist = (typeof song.artist === 'object' ? song.artist?.stageName : undefined) || 'Unknown'
  return (
    <div className="flex items-center gap-2.5 p-2 border-b border-[#1f1f33] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">{song.title || 'Untitled'}</div>
        <div className="text-[#888] text-xs">{artist}</div>
      </div>
      <button type="button" disabled={pending} onClick={onToggle}
        className={`w-8 h-8 rounded-full text-white flex items-center justify-center disabled:opacity-50 ${isIn ? 'bg-danger' : 'bg-success'}`}
        title={isIn ? 'Remove from album' : 'Add to album'}>
        <i className={`fas fa-${isIn ? 'times' : 'plus'}`} />
      </button>
    </div>
  )
}
