import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { formatNumber, resolveImageUrl } from '../../lib/config'
import { Spinner, EmptyState, Pagination, Avatar } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import Modal from '../../components/ui/Modal'
import { useConfirm } from '../../hooks/useConfirm'
import { useAuthStore } from '../../store/authStore'
import type { User, UserDetails } from '../../types'

export default function AdminUsersPage() {
  const me = useAuthStore((s) => s.user)
  const { confirm, confirmDialog } = useConfirm()
  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [detailUser, setDetailUser] = useState<UserDetails | null>(null)

  const load = useCallback(async (p = page, s = search, r = roleFilter) => {
    setLoading(true)
    const result = await adminService.getAllUsers(p, 20, r || null, s || null)
    if (result.success) {
      setUsers(result.data?.users || [])
      setTotalPages(result.data?.totalPages || 1)
    } else {
      setUsers([])
      setTotalPages(1)
    }
    setLoading(false)
  }, [page, search, roleFilter])

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => { setPage(1); load(1) }
  const reset = () => { setSearch(''); setRoleFilter(''); setPage(1); load(1, '', '') }

  const onPage = (p: number) => { setPage(p); load(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const doDelete = (user: User) => {
    confirm({
      message: `Delete "${user.username}"? All their data will be removed.`,
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const result = await adminService.deleteUser(user._id)
        if (!result.success) return toast.show(result.error || 'Failed to delete', 'error')
        setUsers((prev) => prev.filter((u) => u._id !== user._id))
        toast.show('User deleted', 'success')
      },
    })
  }

  const openDetails = async (user: User) => {
    const result = await adminService.getUserDetails(user._id)
    if (!result.success) return toast.show(result.error || 'Failed to load details', 'error')
    setDetailUser(result.data || { user })
  }

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-users" /> User Management</h1>
        <p>View and manage all platform users.</p>
      </div>

      <div className="filters-bar flex gap-2 flex-wrap mb-4">
        <input className="flex-1 min-w-[200px]" placeholder="Search username or email..." value={search}
          onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="listener">Listeners</option>
          <option value="artist">Artists</option>
          <option value="admin">Admins</option>
        </select>
        <button className="btn-secondary" onClick={applyFilters}><i className="fas fa-filter" /> Apply</button>
        <button className="btn-outline" onClick={reset}><i className="fas fa-undo" /> Reset</button>
      </div>

      {loading ? <Spinner /> : users.length === 0 ? (
        <EmptyState icon="fa-users" title="No users found" message="Try adjusting your search or filter." />
      ) : (
        <>
          <DataTable headers={['Avatar', 'Username', 'Email', 'Full Name', 'Role', 'Status', 'Joined', 'Actions']}>
            {users.map((u) => {
              const isSelf = String(u._id) === String(me?._id)
              const isAdminRow = u.role === 'admin'
              return (
                <tr key={u._id}>
                  <td><Avatar src={resolveImageUrl(u.avatar)} className="w-8 h-8 rounded-full object-cover" /></td>
                  <td><strong>{u.username}</strong>{isSelf && <span className="text-[#888] text-[11px]"> (you)</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.fullName || '—'}</td>
                  <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                  <td><span className={`status-badge ${u.isActive !== false ? 'active' : 'inactive'}`}>{u.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-icon" disabled={isSelf} onClick={() => setEditUser(u)} title="Edit"><i className="fas fa-edit" /></button>
                      <button className="btn-icon" onClick={() => openDetails(u)} title="View"><i className="fas fa-eye" /></button>
                      <button className="btn-icon" disabled={isAdminRow || isSelf} onClick={() => doDelete(u)} title="Delete"><i className="fas fa-trash" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </DataTable>
          <Pagination page={page} totalPages={totalPages} onChange={onPage} />
        </>
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(isActive, role) => {
            setUsers((prev) => prev.map((u) => (u._id === editUser._id ? { ...u, isActive, role: role as User['role'] } : u)))
            setEditUser(null)
          }}
        />
      )}
      {detailUser && <UserDetailsModal details={detailUser} onClose={() => setDetailUser(null)} />}
      {confirmDialog}
    </div>
  )
}

function EditUserModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (isActive: boolean, role: string) => void }) {
  const [isActive, setIsActive] = useState(user.isActive !== false)
  const [role, setRole] = useState<string>(user.role || 'listener')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [artistId, setArtistId] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [featured, setFeatured] = useState(false)

  useEffect(() => {
    if (user.role === 'artist') {
      adminService.getUserDetails(user._id).then((d) => {
        if (d.success && d.data?.artistProfile?._id) {
          setArtistId(d.data.artistProfile._id)
          setVerified(!!d.data.artistProfile.verified)
          setFeatured(!!d.data.artistProfile.featured)
        }
      })
    }
  }, [user])

  const toggleVerify = async () => {
    if (!artistId) return
    const result = verified ? await adminService.unverifyArtist(artistId) : await adminService.verifyArtist(artistId)
    if (result.success) { setVerified(!verified); toast.show(verified ? 'Artist unverified' : 'Artist verified', 'success') }
    else toast.show(result.error || 'Failed', 'error')
  }
  const toggleFeature = async () => {
    if (!artistId) return
    const result = await adminService.featureArtist(artistId, !featured)
    if (result.success) { setFeatured(!featured); toast.show(!featured ? 'Artist featured' : 'Artist un-featured', 'success') }
    else toast.show(result.error || 'Failed', 'error')
  }

  const save = async () => {
    setError(''); setSaving(true)
    const result = await adminService.updateUserStatus(user._id, isActive, role)
    setSaving(false)
    if (!result.success) return setError(result.error || 'Failed to update')
    toast.show('User updated', 'success')
    onSaved(isActive, role)
  }

  return (
    <Modal title="Edit User" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button></>}>
      <p className="mb-3"><strong>{user.username}</strong></p>
      <div className="form-group"><label>Status</label>
        <select value={String(isActive)} onChange={(e) => setIsActive(e.target.value === 'true')}><option value="true">Active</option><option value="false">Inactive</option></select>
      </div>
      <div className="form-group"><label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}><option value="listener">Listener</option><option value="artist">Artist</option><option value="admin">Admin</option></select>
      </div>
      {user.role === 'artist' && artistId && (
        <div className="border-t border-[#2a2a2a] pt-3">
          <p className="text-sm mb-2">Artist actions</p>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={toggleVerify}><i className="fas fa-check-circle" /> {verified ? 'Unverify' : 'Verify'}</button>
            <button type="button" className="btn-outline" onClick={toggleFeature}><i className="fas fa-star" /> {featured ? 'Un-feature' : 'Feature'}</button>
          </div>
        </div>
      )}
      {error && <p className="text-danger text-sm mt-2">{error}</p>}
    </Modal>
  )
}

function UserDetailsModal({ details, onClose }: { details: UserDetails; onClose: () => void }) {
  const u = details.user
  const stats = details.stats || {}
  const ap = details.artistProfile
  return (
    <Modal title="User Details" onClose={onClose} footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="detail-section">
        <h4><i className="fas fa-user" /> Account</h4>
        <p><strong>Username:</strong> {u?.username}</p>
        <p><strong>Email:</strong> {u?.email}</p>
        <p><strong>Full Name:</strong> {u?.fullName || '—'}</p>
        <p><strong>Role:</strong> {u?.role || 'listener'}</p>
        <p><strong>Status:</strong> {u?.isActive !== false ? 'Active' : 'Inactive'}</p>
        <p><strong>Verified:</strong> {u?.isVerified ? 'Yes' : 'No'}</p>
        <p><strong>Joined:</strong> {u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</p>
      </div>
      <div className="detail-section">
        <h4><i className="fas fa-chart-bar" /> Activity</h4>
        <p><strong>Total Songs:</strong> {formatNumber(stats.totalSongs || 0)}</p>
        <p><strong>Total Streams:</strong> {formatNumber(stats.totalStreams || 0)}</p>
        <p><strong>Total Spent:</strong> K{Number(stats.totalSpent || 0).toFixed(2)}</p>
      </div>
      {ap && (
        <div className="detail-section">
          <h4><i className="fas fa-music" /> Artist Profile</h4>
          <p><strong>Stage Name:</strong> {ap.stageName}</p>
          <p><strong>Genres:</strong> {ap.genres?.join(', ') || 'None'}</p>
          <p><strong>Verified:</strong> {ap.verified ? 'Yes' : 'No'}</p>
          <p><strong>Featured:</strong> {ap.featured ? 'Yes' : 'No'}</p>
          <p><strong>Monthly Listeners:</strong> {formatNumber(ap.monthlyListeners || 0)}</p>
          <p><strong>Total Revenue:</strong> K{Number(ap.totalRevenue || 0).toFixed(2)}</p>
        </div>
      )}
    </Modal>
  )
}
