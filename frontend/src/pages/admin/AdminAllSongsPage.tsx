import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { formatNumber, GENRES } from '../../lib/config'
import { Spinner, EmptyState, Pagination } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import { useConfirm } from '../../hooks/useConfirm'
import type { Song } from '../../types'

interface Filters {
  search: string
  status: string
  genre: string
  sortBy: string
  sortOrder: string
}

export default function AdminAllSongsPage() {
  const { confirm, confirmDialog } = useConfirm()
  const [songs, setSongs] = useState<Song[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState<Filters>({ search: '', status: '', genre: '', sortBy: 'createdAt', sortOrder: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [rejectSong, setRejectSong] = useState<Song | null>(null)

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true)
    const result = await adminService.getAllSongsForAdmin({ page: p, limit: 50, ...f })
    if (result.success) {
      setSongs(result.data?.songs || [])
      setTotalPages(result.data?.totalPages || 1)
    } else { setSongs([]); setTotalPages(1) }
    setLoading(false)
  }, [page, filters])

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => { setSelected(new Set()); setPage(1); load(1) }
  const onPage = (p: number) => { setPage(p); load(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(songs.map((s) => s._id)) : new Set())
  }

  const bulk = (action: string) => {
    if (selected.size === 0) return
    if (selected.size > 500) return toast.show('Cannot process more than 500 at once', 'warning')
    const ids = Array.from(selected)
    confirm({
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} ${ids.length} song${ids.length === 1 ? '' : 's'}?`,
      confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
      confirmClass: action === 'delete' || action === 'reject' ? 'btn-danger' : 'btn-primary',
      onConfirm: async () => {
        const result = await adminService.bulkAction(ids, action)
        if (!result.success) return toast.show(result.error || 'Bulk action failed', 'error')
        toast.show(`${ids.length} song${ids.length === 1 ? '' : 's'} ${action}d`, 'success')
        setSelected(new Set())
        load()
      },
    })
  }

  const deleteSong = (song: Song) => {
    confirm({
      message: `Delete "${song.title}"?`,
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const result = await adminService.deleteSong(song._id)
        if (!result.success) return toast.show(result.error || 'Failed to delete', 'error')
        setSongs((prev) => prev.filter((s) => s._id !== song._id))
        toast.show('Song deleted', 'success')
      },
    })
  }

  const approveSong = async (song: Song) => {
    const result = await adminService.approveSong(song._id)
    if (!result.success) return toast.show(result.error || 'Approval failed', 'error')
    setSongs((prev) => prev.map((s) => (s._id === song._id ? { ...s, status: 'approved' } : s)))
    toast.show(`Approved "${song.title}"`, 'success')
  }

  const artistName = (s: Song) => (typeof s.artist === 'object' ? s.artist?.stageName : undefined) || 'Unknown'
  const allChecked = songs.length > 0 && songs.every((s) => selected.has(s._id))

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-headphones" /> All Songs</h1>
        <p>View, filter, and bulk-manage all songs on the platform.</p>
      </div>

      <div className="filters-bar flex gap-2 flex-wrap mb-4">
        <input className="flex-1 min-w-[200px]" placeholder="Search title..." value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && apply()} />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
        <select value={filters.genre} onChange={(e) => setFilters({ ...filters, genre: e.target.value })}>
          <option value="">All Genres</option>{GENRES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select value={`${filters.sortBy}-${filters.sortOrder}`} onChange={(e) => { const [sortBy, sortOrder] = e.target.value.split('-'); setFilters({ ...filters, sortBy, sortOrder }) }}>
          <option value="createdAt-desc">Newest</option><option value="createdAt-asc">Oldest</option><option value="playCount-desc">Most Played</option><option value="likeCount-desc">Most Liked</option>
        </select>
        <button className="btn-secondary" onClick={apply}><i className="fas fa-filter" /> Apply</button>
      </div>

      {selected.size > 0 && (
        <div className="flex gap-2 items-center bg-primary/10 rounded-lg p-3 mb-3 flex-wrap">
          <strong>{selected.size} selected</strong>
          <button className="btn-success btn-sm" onClick={() => bulk('approve')}>Approve</button>
          <button className="btn-danger btn-sm" onClick={() => bulk('reject')}>Reject</button>
          <button className="btn-danger btn-sm" onClick={() => bulk('delete')}>Delete</button>
          <button className="btn-outline btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {loading ? <Spinner /> : songs.length === 0 ? (
        <EmptyState icon="fa-music" title="No songs found" />
      ) : (
        <>
          <DataTable headers={[<input key="all" type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />, 'Title', 'Artist', 'Genre', 'Status', 'Plays', 'Actions']}>
            {songs.map((song) => (
              <tr key={song._id}>
                <td><input type="checkbox" checked={selected.has(song._id)} onChange={() => toggleSelect(song._id)} /></td>
                <td><strong>{song.title}</strong></td>
                <td>{artistName(song)}</td>
                <td><span className="genre-badge">{song.genre || 'Various'}</span></td>
                <td><span className={`status-badge status-${song.status || 'pending'}`}>{song.status || 'pending'}</span></td>
                <td>{formatNumber(song.playCount || 0)}</td>
                <td>
                  <div className="flex gap-1.5">
                    {song.status === 'pending' && (
                      <>
                        <button className="btn-success btn-sm" onClick={() => approveSong(song)}><i className="fas fa-check" /></button>
                        <button className="btn-danger btn-sm" onClick={() => setRejectSong(song)}><i className="fas fa-times" /></button>
                      </>
                    )}
                    <button className="btn-danger btn-sm" onClick={() => deleteSong(song)}><i className="fas fa-trash" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={page} totalPages={totalPages} onChange={onPage} />
        </>
      )}

      {rejectSong && (
        <RejectModal song={rejectSong} onClose={() => setRejectSong(null)}
          onRejected={(id) => { setSongs((prev) => prev.map((s) => (s._id === id ? { ...s, status: 'rejected' } : s))); setRejectSong(null) }} />
      )}
      {confirmDialog}
    </div>
  )
}

function RejectModal({ song, onClose, onRejected }: { song: Song; onClose: () => void; onRejected: (id: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (reason.trim().length < 5) return setError('Reason must be 5+ chars')
    setSubmitting(true)
    const result = await adminService.rejectSong(song._id, reason.trim())
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Failed')
    toast.show('Song rejected', 'info')
    onRejected(song._id)
  }
  return (
    <Modal title="Reject Song" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={submit} disabled={submitting}>{submitting ? 'Rejecting…' : 'Reject'}</button></>}>
      <p className="mb-3">Reject <strong>{song.title}</strong>?</p>
      <div className="form-group"><label>Reason</label><textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}
