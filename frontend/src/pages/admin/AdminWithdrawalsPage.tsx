import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { Spinner, EmptyState } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import type { Withdrawal } from '../../types'

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [approveW, setApproveW] = useState<Withdrawal | null>(null)
  const [rejectW, setRejectW] = useState<Withdrawal | null>(null)
  const [detailW, setDetailW] = useState<Withdrawal | null>(null)

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true)
    const result = await adminService.getWithdrawals(status || null)
    if (result.success) {
      const data = result.data
      setWithdrawals(Array.isArray(data) ? data : data?.withdrawals || [])
    } else setWithdrawals([])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load('pending') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (w: Withdrawal) => setWithdrawals((prev) => prev.map((x) => (x._id === w._id ? w : x)))

  const formatAccount = (details?: Record<string, unknown>, method?: string): string => {
    if (!details || typeof details !== 'object') return '—'
    if (method === 'bank_transfer') {
      const acct = String(details.accountNumber || '')
      const masked = acct.length > 4 ? `••••${acct.slice(-4)}` : acct
      return `${details.bankName || '?'} — ${masked}`
    }
    if (details.phoneNumber) {
      const ph = String(details.phoneNumber)
      return ph.length > 4 ? `${ph.slice(0, 3)}••${ph.slice(-3)}` : ph
    }
    return 'See details'
  }

  const pending = withdrawals.filter((w) => w.status === 'pending').length
  const approved = withdrawals.filter((w) => w.status === 'approved' || w.status === 'completed').length
  const total = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-money-bill-wave" /> Withdrawals</h1>
        <p>Process artist withdrawal requests.</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="stat-card-sm pending"><div className="stat-value">{pending}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card-sm approved"><div className="stat-value">{approved}</div><div className="stat-label">Approved</div></div>
        <div className="stat-card-sm"><div className="stat-value">K{total.toLocaleString()}</div><div className="stat-label">Total Requested</div></div>
      </div>

      <div className="filters-bar flex gap-2 mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); load(e.target.value) }}>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          <option value="completed">Completed</option><option value="failed">Failed</option><option value="">All</option>
        </select>
        <button className="btn-outline" onClick={() => load()}><i className="fas fa-sync-alt" /> Refresh</button>
      </div>

      {loading ? <Spinner /> : withdrawals.length === 0 ? (
        <EmptyState icon="fa-money-bill-wave" title="No withdrawals" message="No withdrawal requests match the current filter." />
      ) : (
        <DataTable headers={['Artist', 'Amount', 'Method', 'Account', 'Status', 'Requested', 'Actions']}>
          {withdrawals.map((w) => (
            <tr key={w._id}>
              <td><strong>{w.user?.username || 'Unknown'}</strong><br /><small className="text-[#888]">{w.user?.email || ''}</small></td>
              <td><span className="amount">K{Number(w.amount || 0).toFixed(2)}</span></td>
              <td><span className="method-badge">{w.method}</span></td>
              <td><small>{formatAccount(w.accountDetails, w.method)}</small></td>
              <td><span className={`status-badge status-${w.status}`}>{w.status}</span></td>
              <td>{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <div className="flex gap-1.5">
                  {w.status === 'pending' && (
                    <>
                      <button className="btn-success btn-sm" onClick={() => setApproveW(w)}><i className="fas fa-check" /> Approve</button>
                      <button className="btn-danger btn-sm" onClick={() => setRejectW(w)}><i className="fas fa-times" /> Reject</button>
                    </>
                  )}
                  <button className="btn-icon" onClick={() => setDetailW(w)} title="View details"><i className="fas fa-eye" /></button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {approveW && <ApproveModal w={approveW} onClose={() => setApproveW(null)} onDone={(w) => { updateRow(w); setApproveW(null) }} />}
      {rejectW && <RejectModal w={rejectW} onClose={() => setRejectW(null)} onDone={(w) => { updateRow(w); setRejectW(null) }} />}
      {detailW && <DetailsModal w={detailW} onClose={() => setDetailW(null)} />}
    </div>
  )
}

function ApproveModal({ w, onClose, onDone }: { w: Withdrawal; onClose: () => void; onDone: (w: Withdrawal) => void }) {
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    setError('')
    if (reference.trim().length < 4) return setError('Reference must be at least 4 characters')
    if (!/^[a-zA-Z0-9_\- ]+$/.test(reference.trim())) return setError('Reference can only contain letters, numbers, spaces, dashes')
    setSubmitting(true)
    const result = await adminService.processWithdrawal(w._id, 'approve', reference.trim(), notes.trim())
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Approval failed')
    toast.show('Withdrawal approved', 'success')
    onDone({ ...w, status: 'approved', transactionReference: reference.trim() })
  }
  return (
    <Modal title="Approve Withdrawal" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-success" onClick={submit} disabled={submitting}>{submitting ? 'Approving…' : 'Confirm Approval'}</button></>}>
      <p className="mb-3">You are about to approve withdrawal of <strong>K{Number(w.amount || 0).toFixed(2)}</strong> to <strong>{w.user?.username || 'Unknown'}</strong>.</p>
      <div className="form-group"><label>Transaction Reference *</label><input type="text" maxLength={100} placeholder="e.g. MTN-2026-ABCD1234" value={reference} onChange={(e) => setReference(e.target.value)} /><small>Internal reference for this payout (4+ characters).</small></div>
      <div className="form-group"><label>Notes (optional)</label><textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}

function RejectModal({ w, onClose, onDone }: { w: Withdrawal; onClose: () => void; onDone: (w: Withdrawal) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    if (reason.trim().length < 5) return setError('Reason must be at least 5 characters')
    setSubmitting(true)
    const result = await adminService.processWithdrawal(w._id, 'reject', null, reason.trim())
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Rejection failed')
    toast.show('Withdrawal rejected', 'info')
    onDone({ ...w, status: 'rejected', notes: reason.trim() })
  }
  return (
    <Modal title="Reject Withdrawal" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={submit} disabled={submitting}>{submitting ? 'Rejecting…' : 'Confirm Rejection'}</button></>}>
      <p className="mb-1">Reject withdrawal of <strong>K{Number(w.amount || 0).toFixed(2)}</strong> from <strong>{w.user?.username || 'Unknown'}</strong>?</p>
      <p className="text-[#888] text-[13px] mb-3">The amount will be returned to the artist's available balance.</p>
      <div className="form-group"><label>Rejection Reason *</label><textarea rows={3} maxLength={500} placeholder="Why is this withdrawal being rejected?" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}

function DetailsModal({ w, onClose }: { w: Withdrawal; onClose: () => void }) {
  return (
    <Modal title="Withdrawal Details" onClose={onClose} footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="detail-section">
        <h4>Request</h4>
        <p><strong>Amount:</strong> K{Number(w.amount || 0).toFixed(2)}</p>
        <p><strong>Method:</strong> {w.method}</p>
        <p><strong>Status:</strong> {w.status}</p>
        <p><strong>Requested:</strong> {w.createdAt ? new Date(w.createdAt).toLocaleString() : '—'}</p>
        {w.processedAt && <p><strong>Processed:</strong> {new Date(w.processedAt).toLocaleString()}</p>}
        {w.transactionReference && <p><strong>Reference:</strong> {w.transactionReference}</p>}
        {w.notes && <p><strong>Notes:</strong> {w.notes}</p>}
      </div>
      <div className="detail-section">
        <h4>Artist</h4>
        <p><strong>Username:</strong> {w.user?.username || ''}</p>
        <p><strong>Email:</strong> {w.user?.email || ''}</p>
      </div>
      <div className="detail-section">
        <h4>Account Details</h4>
        <pre className="bg-[#0f0f1e] p-3 rounded text-[13px] font-mono whitespace-pre-wrap break-words">{JSON.stringify(w.accountDetails || {}, null, 2)}</pre>
      </div>
    </Modal>
  )
}
