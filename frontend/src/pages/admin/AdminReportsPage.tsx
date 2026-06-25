import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { Spinner, EmptyState } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import type { Report } from '../../types'

type ResolveAction = 'dismiss' | 'warn' | 'remove' | 'ban'

const ACTION_LABELS: Record<ResolveAction, string> = {
  dismiss: 'Dismiss Report',
  warn: 'Warn User',
  remove: 'Remove Content',
  ban: 'Ban User',
}
const ACTION_DESCS: Record<ResolveAction, string> = {
  dismiss: 'Marks the report as reviewed with no further action.',
  warn: 'Sends a warning to the reported user.',
  remove: 'Removes the reported content from the platform.',
  ban: 'Bans the reported user. This action is heavy — be sure.',
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [resolve, setResolve] = useState<{ report: Report; action: ResolveAction } | null>(null)
  const [detail, setDetail] = useState<Report | null>(null)

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true)
    const result = await adminService.getReports(status || null)
    if (result.success) {
      const data = result.data
      setReports(Array.isArray(data) ? data : data?.reports || [])
    } else setReports([])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load('pending') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onResolved = (id: string, notes: string) => {
    if (statusFilter === 'pending') setReports((prev) => prev.filter((r) => r._id !== id))
    else setReports((prev) => prev.map((r) => (r._id === id ? { ...r, status: 'resolved', adminNotes: notes } : r)))
    setResolve(null)
  }

  const pending = reports.filter((r) => r.status === 'pending').length
  const resolved = reports.filter((r) => r.status === 'resolved').length

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-flag" /> Reports</h1>
        <p>Review and resolve user reports.</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="stat-card-sm pending"><div className="stat-value">{pending}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card-sm approved"><div className="stat-value">{resolved}</div><div className="stat-label">Resolved</div></div>
        <div className="stat-card-sm"><div className="stat-value">{reports.length}</div><div className="stat-label">Total</div></div>
      </div>

      <div className="filters-bar flex gap-2 mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); load(e.target.value) }}>
          <option value="pending">Pending</option><option value="resolved">Resolved</option><option value="">All</option>
        </select>
        <button className="btn-outline" onClick={() => load()}><i className="fas fa-sync-alt" /> Refresh</button>
      </div>

      {loading ? <Spinner /> : reports.length === 0 ? (
        <EmptyState icon="fa-flag" title="No reports" message="No reports match the current filter." />
      ) : (
        <DataTable headers={['Type', 'Reporter', 'Reported Item', 'Reason', 'Status', 'Date', 'Actions']}>
          {reports.map((r) => (
            <tr key={r._id}>
              <td><span className="type-badge">{r.type || 'unknown'}</span></td>
              <td><strong>{r.reporter?.username || 'Unknown'}</strong><br /><small className="text-[#888]">{r.reporter?.email || ''}</small></td>
              <td><small>{r.contentId || 'N/A'}</small></td>
              <td>{r.reason || '—'}</td>
              <td><span className={`status-badge status-${r.status || 'pending'}`}>{r.status || 'pending'}</span></td>
              <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <div className="flex gap-1 flex-wrap">
                  {r.status === 'pending' ? (
                    <>
                      <button className="btn-success btn-sm" onClick={() => setResolve({ report: r, action: 'dismiss' })}><i className="fas fa-check" /> Dismiss</button>
                      <button className="btn-warning btn-sm" onClick={() => setResolve({ report: r, action: 'warn' })}><i className="fas fa-exclamation-triangle" /> Warn</button>
                      <button className="btn-danger btn-sm" onClick={() => setResolve({ report: r, action: 'remove' })}><i className="fas fa-trash" /> Remove</button>
                      <button className="btn-danger btn-sm" onClick={() => setResolve({ report: r, action: 'ban' })}><i className="fas fa-ban" /> Ban</button>
                    </>
                  ) : <span className="resolved-badge">Resolved</span>}
                  <button className="btn-icon" onClick={() => setDetail(r)} title="View details"><i className="fas fa-eye" /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {resolve && <ResolveModal report={resolve.report} action={resolve.action} onClose={() => setResolve(null)} onResolved={onResolved} />}
      {detail && <DetailsModal r={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function ResolveModal({ report, action, onClose, onResolved }: { report: Report; action: ResolveAction; onClose: () => void; onResolved: (id: string, notes: string) => void }) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isHeavy = action === 'ban' || action === 'remove'
  const title = ACTION_LABELS[action]

  const submit = async () => {
    if (isHeavy && notes.trim().length < 5) return setError('Notes are required for this action (min 5 chars)')
    setSubmitting(true)
    const result = await adminService.resolveReport(report._id, action, notes.trim())
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Resolution failed')
    toast.show(`Report ${action}ed`, 'success')
    onResolved(report._id, notes.trim())
  }

  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className={isHeavy ? 'btn-danger' : 'btn-primary'} onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : title}</button></>}>
      <p className="mb-3">{ACTION_DESCS[action]}</p>
      <div className="form-group"><label>Admin Notes {isHeavy ? '*' : '(optional)'}</label><textarea rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}

function DetailsModal({ r, onClose }: { r: Report; onClose: () => void }) {
  return (
    <Modal title="Report Details" onClose={onClose} footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="detail-section">
        <h4>Report</h4>
        <p><strong>Type:</strong> {r.type || 'unknown'}</p>
        <p><strong>Reason:</strong> {r.reason || '—'}</p>
        <p><strong>Description:</strong> {r.description || 'No description'}</p>
        <p><strong>Status:</strong> {r.status || 'pending'}</p>
        <p><strong>Date:</strong> {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</p>
        <p><strong>Content ID:</strong> {r.contentId || 'N/A'}</p>
      </div>
      <div className="detail-section">
        <h4>Reporter</h4>
        <p><strong>Username:</strong> {r.reporter?.username || 'Unknown'}</p>
        <p><strong>Email:</strong> {r.reporter?.email || ''}</p>
      </div>
      {r.reportedUser && (
        <div className="detail-section">
          <h4>Reported User</h4>
          <p><strong>Username:</strong> {r.reportedUser.username || ''}</p>
          <p><strong>Email:</strong> {r.reportedUser.email || ''}</p>
        </div>
      )}
      {r.adminNotes && (
        <div className="detail-section">
          <h4>Admin Notes</h4>
          <p>{r.adminNotes}</p>
        </div>
      )}
    </Modal>
  )
}
