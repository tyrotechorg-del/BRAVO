import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { formatNumber, resolveImageUrl, API_BASE_URL } from '../../lib/config'
import { Spinner, EmptyState, Avatar } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import { useConfirm } from '../../hooks/useConfirm'
import type { VideoItem } from '../../types'

export default function AdminVideosPage() {
  const { confirm, confirmDialog } = useConfirm()
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [rejectVideo, setRejectVideo] = useState<VideoItem | null>(null)
  const [playVideo, setPlayVideo] = useState<VideoItem | null>(null)

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true)
    const result = await adminService.getAllVideos(1, 100, status || null)
    if (result.success) {
      const data = result.data
      setVideos(Array.isArray(data) ? data : (data?.videos || data?.songs || []))
    } else setVideos([])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (v: VideoItem) => {
    const result = await adminService.approveVideo(v._id)
    if (!result.success) return toast.show(result.error || 'Approval failed', 'error')
    setVideos((prev) => prev.map((x) => (x._id === v._id ? { ...x, status: 'approved' } : x)))
    toast.show(`Approved "${v.title}"`, 'success')
  }

  const deleteVideo = (v: VideoItem) => {
    confirm({
      message: `Delete "${v.title}"?`,
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const result = await adminService.deleteVideo(v._id)
        if (!result.success) return toast.show(result.error || 'Failed to delete', 'error')
        setVideos((prev) => prev.filter((x) => x._id !== v._id))
        toast.show('Video deleted', 'success')
      },
    })
  }

  const artistName = (v: VideoItem) => (typeof v.artist === 'object' ? v.artist?.stageName : undefined) || 'Unknown'
  const total = videos.length
  const approved = videos.filter((v) => v.status === 'approved').length
  const pending = videos.filter((v) => v.status === 'pending').length

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-video" /> Videos</h1>
        <p>View and manage all video content on the platform.</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="stat-card-sm"><div className="stat-value">{total}</div><div className="stat-label">Total</div></div>
        <div className="stat-card-sm approved"><div className="stat-value">{approved}</div><div className="stat-label">Approved</div></div>
        <div className="stat-card-sm pending"><div className="stat-value">{pending}</div><div className="stat-label">Pending</div></div>
      </div>

      <div className="filters-bar flex gap-2 mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); load(e.target.value) }}>
          <option value="">All Videos</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
        <button className="btn-outline" onClick={() => load()}><i className="fas fa-sync-alt" /> Refresh</button>
      </div>

      {loading ? <Spinner /> : videos.length === 0 ? (
        <EmptyState icon="fa-video" title="No videos found" />
      ) : (
        <DataTable headers={['Thumbnail', 'Title', 'Artist', 'Genre', 'Views', 'Status', 'Uploaded', 'Actions']}>
          {videos.map((v) => (
            <tr key={v._id}>
              <td><Avatar src={resolveImageUrl(v.coverArt)} className="w-12 h-9 rounded object-cover" /></td>
              <td><strong>{v.title}</strong></td>
              <td>{artistName(v)}</td>
              <td><span className="genre-badge">{v.genre || 'Various'}</span></td>
              <td>{formatNumber(v.playCount || 0)}</td>
              <td><span className={`status-badge status-${v.status || 'pending'}`}>{v.status || 'pending'}</span></td>
              <td>{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <div className="flex gap-1.5">
                  <button className="btn-icon" onClick={() => setPlayVideo(v)} title="Play"><i className="fas fa-play" /></button>
                  {v.status === 'pending' && (
                    <>
                      <button className="btn-success btn-sm" onClick={() => approve(v)}><i className="fas fa-check" /></button>
                      <button className="btn-danger btn-sm" onClick={() => setRejectVideo(v)}><i className="fas fa-times" /></button>
                    </>
                  )}
                  <button className="btn-danger btn-sm" onClick={() => deleteVideo(v)}><i className="fas fa-trash" /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {rejectVideo && (
        <RejectModal video={rejectVideo} onClose={() => setRejectVideo(null)}
          onRejected={(id) => { setVideos((prev) => prev.map((x) => (x._id === id ? { ...x, status: 'rejected' } : x))); setRejectVideo(null) }} />
      )}
      {playVideo && (
        <Modal title={playVideo.title || 'Video'} onClose={() => setPlayVideo(null)} maxWidth="max-w-2xl"
          footer={<button className="btn-secondary" onClick={() => setPlayVideo(null)}>Close</button>}>
          <div className="text-center">
            <video controls className="max-w-full max-h-[60vh] bg-black" preload="metadata">
              <source src={`${API_BASE_URL}/songs/${encodeURIComponent(playVideo._id)}/stream`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </Modal>
      )}
      {confirmDialog}
    </div>
  )
}

function RejectModal({ video, onClose, onRejected }: { video: VideoItem; onClose: () => void; onRejected: (id: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (reason.trim().length < 5) return setError('Reason must be at least 5 characters')
    setSubmitting(true)
    const result = await adminService.rejectVideo(video._id, reason.trim())
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Rejection failed')
    toast.show('Video rejected', 'info')
    onRejected(video._id)
  }
  return (
    <Modal title="Reject Video" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={submit} disabled={submitting}>{submitting ? 'Rejecting…' : 'Confirm Rejection'}</button></>}>
      <p className="mb-3">Reject <strong>{video.title}</strong>?</p>
      <div className="form-group"><label>Rejection Reason *</label><textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /><small>The artist will see this. Be specific.</small></div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}
