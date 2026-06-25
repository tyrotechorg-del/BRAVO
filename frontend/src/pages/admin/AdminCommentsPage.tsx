import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { Spinner, EmptyState } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import { useConfirm } from '../../hooks/useConfirm'
import type { ReportedComment } from '../../types'

export default function AdminCommentsPage() {
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [comments, setComments] = useState<ReportedComment[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getReportedComments()
    if (result.success) {
      const data = result.data
      setComments(Array.isArray(data) ? data : data?.comments || [])
    } else setComments([])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const remove = (c: ReportedComment) => {
    confirm({
      message: 'Delete this comment permanently?',
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        setProcessing((p) => new Set(p).add(c._id))
        const result = await adminService.deleteComment(c._id)
        setProcessing((p) => { const n = new Set(p); n.delete(c._id); return n })
        if (!result.success) return toast.show(result.error || 'Failed to delete', 'error')
        setComments((prev) => prev.filter((x) => x._id !== c._id))
        toast.show('Comment deleted', 'success')
      },
    })
  }

  const dismiss = async (c: ReportedComment) => {
    if (processing.has(c._id)) return
    setProcessing((p) => new Set(p).add(c._id))
    const result = await adminService.dismissCommentReport(c._id)
    setProcessing((p) => { const n = new Set(p); n.delete(c._id); return n })
    if (!result.success) return toast.show(result.error || 'Failed to dismiss', 'error')
    setComments((prev) => prev.filter((x) => x._id !== c._id))
    toast.show('Report dismissed', 'info')
  }

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-comment" /> Reported Comments</h1>
        <p>Review and moderate comments flagged by users.</p>
      </div>

      <div className="mb-4">
        <div className="stat-card-sm pending inline-block"><div className="stat-value">{comments.length}</div><div className="stat-label">Reported Comments</div></div>
      </div>

      {loading ? <Spinner /> : comments.length === 0 ? (
        <EmptyState icon="fa-check-circle" title="No reported comments" message="Nothing to moderate right now." />
      ) : (
        <DataTable headers={['User', 'Song', 'Comment', 'Reason', 'Reported At', 'Actions']}>
          {comments.map((c) => {
            const reportedAt = c.flaggedAt || c.reportedAt || c.createdAt
            return (
              <tr key={c._id}>
                <td><strong>{c.user?.username || 'Unknown'}</strong></td>
                <td>{c.song?.title || 'Unknown Song'}</td>
                <td className="max-w-[300px]"><span className="block truncate">"{c.content}"</span></td>
                <td>{c.flaggedReason || c.reportReason || 'No reason provided'}</td>
                <td>{reportedAt ? new Date(reportedAt).toLocaleString() : '—'}</td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="btn-danger btn-sm" disabled={processing.has(c._id)} onClick={() => remove(c)}><i className="fas fa-trash" /> Delete</button>
                    <button className="btn-warning btn-sm" disabled={processing.has(c._id)} onClick={() => dismiss(c)}><i className="fas fa-check" /> Dismiss</button>
                    {c.song?._id && <button className="btn-icon" onClick={() => navigate(`/song/${c.song?._id}`)} title="View song"><i className="fas fa-music" /></button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </DataTable>
      )}
      {confirmDialog}
    </div>
  )
}
