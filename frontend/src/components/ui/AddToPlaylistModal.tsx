import { useEffect, useState, useCallback } from 'react'
import Modal from './Modal'
import { Spinner } from './common'
import { playlistsService } from '../../services/playlistsService'
import { toast } from '../../store/toastStore'
import type { Playlist } from '../../types'

interface Props {
  songId: string
  onClose: () => void
}

export default function AddToPlaylistModal({ songId, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await playlistsService.getMine()
    if (r.success) {
      const d = r.data as { playlists?: Playlist[] } | Playlist[]
      setPlaylists(Array.isArray(d) ? d : d?.playlists || [])
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const songInPlaylist = (p: Playlist) =>
    Array.isArray(p.songs) && p.songs.some((s) => (typeof s === 'object' ? s._id : s) === songId)

  const addTo = async (p: Playlist) => {
    if (songInPlaylist(p)) { toast.show('Already in this playlist', 'info'); return }
    setBusyId(p._id)
    const r = await playlistsService.addSong(p._id, songId)
    setBusyId(null)
    if (!r.success) return toast.show(r.error || 'Failed to add', 'error')
    toast.show(`Added to "${p.name}"`, 'success')
    onClose()
  }

  const createAndAdd = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const created = await playlistsService.create({ name: newName.trim(), isPublic: false })
    if (!created.success) { setCreating(false); return toast.show(created.error || 'Failed to create', 'error') }
    const pl = created.data as Playlist & { playlist?: Playlist }
    const playlistId = pl?.playlist?._id || pl?._id
    if (playlistId) {
      const added = await playlistsService.addSong(playlistId, songId)
      setCreating(false)
      if (!added.success) return toast.show(added.error || 'Created, but failed to add song', 'error')
      toast.show(`Created "${newName.trim()}" and added the song`, 'success')
      onClose()
    } else {
      setCreating(false)
      toast.show('Playlist created', 'success')
      onClose()
    }
  }

  return (
    <Modal title="Add to playlist" onClose={onClose}>
      {loading ? <Spinner plain /> : (
        <>
          {playlists.length === 0 && !showCreate && (
            <p className="text-sm text-[#b3b3b3] mb-4">You don't have any playlists yet. Create one below.</p>
          )}

          {playlists.length > 0 && (
            <div className="max-h-64 overflow-y-auto mb-4 -mx-1">
              {playlists.map((p) => {
                const inside = songInPlaylist(p)
                return (
                  <button
                    key={p._id}
                    onClick={() => addTo(p)}
                    disabled={busyId === p._id || inside}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer text-left disabled:opacity-60"
                  >
                    <span className="w-10 h-10 rounded bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shrink-0">
                      <i className="fas fa-music text-white/80 text-sm" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-white truncate">{p.name}</span>
                      <span className="block text-xs text-[#b3b3b3]">{Array.isArray(p.songs) ? p.songs.length : 0} songs</span>
                    </span>
                    {busyId === p._id ? <i className="fas fa-spinner fa-spin text-primary" />
                      : inside ? <i className="fas fa-check text-success" />
                      : <i className="fas fa-plus text-[#b3b3b3]" />}
                  </button>
                )
              })}
            </div>
          )}

          {showCreate ? (
            <div className="border-t border-[#2a2a2a] pt-4">
              <div className="form-group"><label>New playlist name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Playlist" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') createAndAdd() }} />
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={createAndAdd} disabled={creating || !newName.trim()}>
                  {creating ? 'Creating…' : 'Create & add'}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-outline w-full" onClick={() => setShowCreate(true)}>
              <i className="fas fa-plus" /> New playlist
            </button>
          )}
        </>
      )}
    </Modal>
  )
}
