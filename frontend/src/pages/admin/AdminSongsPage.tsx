import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { resolveImageUrl } from '../../lib/config'
import { Spinner, EmptyState, Avatar } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import { usePlayerStore } from '../../store/playerStore'
import type { Song } from '../../types'

export default function AdminSongsPage() {
  const play = usePlayerStore((s) => s.play)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectSong, setRejectSong] = useState<Song | null>(null)
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getPendingSongs()
    if (result.success) {
      const data = result.data
      setSongs(Array.isArray(data) ? data : data?.songs || [])
    } else setSongs([])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const approve = async (song: Song) => {
    if (processing.has(song._id)) return
    setProcessing((p) => new Set(p).add(song._id))
    const result = await adminService.approveSong(song._id)
    setProcessing((p) => { const n = new Set(p); n.delete(song._id); return n })
    if (!result.success) return toast.show(result.error || 'Approval failed', 'error')
    setSongs((prev) => prev.filter((s) => s._id !== song._id))
    toast.show(`Approved "${song.title}"`, 'success')
  }

  const artistName = (s: Song) => (typeof s.artist === 'object' ? s.artist?.stageName : undefined) || 'Unknown'

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-clock" /> Pending Songs</h1>
        <p>Review and approve songs uploaded by artists.</p>
      </div>

      {loading ? <Spinner /> : songs.length === 0 ? (
        <EmptyState icon="fa-check-circle" title="No pending songs" message="All caught up — every song has been reviewed." />
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-3">{songs.length} song{songs.length === 1 ? '' : 's'} awaiting approval</h2>
          <DataTable headers={['Cover', 'Title', 'Artist', 'Genre', 'Uploaded', 'Actions']}>
            {songs.map((song) => (
              <tr key={song._id}>
                <td><Avatar src={resolveImageUrl(song.coverArt)} className="w-10 h-10 rounded object-cover" /></td>
                <td><strong>{song.title}</strong></td>
                <td>{artistName(song)}</td>
                <td><span className="genre-badge">{song.genre || 'Various'}</span></td>
                <td>{song.createdAt ? new Date(song.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="btn-icon" onClick={() => play(song)} title="Preview"><i className="fas fa-play" /></button>
                    <button className="btn-success btn-sm" disabled={processing.has(song._id)} onClick={() => approve(song)}><i className="fas fa-check" /> Approve</button>
                    <button className="btn-danger btn-sm" onClick={() => setRejectSong(song)}><i className="fas fa-times" /> Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      {rejectSong && (
        <RejectModal
          song={rejectSong}
          onClose={() => setRejectSong(null)}
          onRejected={(id) => { setSongs((prev) => prev.filter((s) => s._id !== id)); setRejectSong(null) }}
        />
      )}
    </div>
  )
}

function RejectModal({ song, onClose, onRejected }: { song: Song; onClose: () => void; onRejected: (id: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const artist = typeof song.artist === 'object' ? song.artist?.stageName : 'Unknown'

  const submit = async () => {
    if (reason.trim().length < 5) return setError('Reason must be at least 5 characters')
    setSubmitting(true)
    const result = await adminService.rejectSong(song._id, reason.trim())
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Rejection failed')
    toast.show(`Rejected "${song.title}"`, 'info')
    onRejected(song._id)
  }

  return (
    <Modal title="Reject Song" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={submit} disabled={submitting}>{submitting ? 'Rejecting…' : 'Confirm Rejection'}</button></>}>
      <p className="mb-3">Reject <strong>{song.title}</strong> by <strong>{artist}</strong>?</p>
      <div className="form-group">
        <label>Rejection Reason *</label>
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <small>The artist will see this. Be specific and constructive.</small>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}
