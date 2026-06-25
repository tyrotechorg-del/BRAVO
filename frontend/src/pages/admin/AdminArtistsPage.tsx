import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { formatNumber, resolveImageUrl } from '../../lib/config'
import { Spinner, EmptyState, Avatar } from '../../components/ui/common'
import { DataTable } from '../../components/admin/DataTable'
import type { ArtistProfile } from '../../types'

export default function AdminArtistsPage() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState<ArtistProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (term = search) => {
    setLoading(true)
    const result = await adminService.getAllArtistsForAdmin(term)
    if (result.success) {
      const data = result.data
      setArtists(Array.isArray(data) ? data : data?.artists || [])
    } else setArtists([])
    setLoading(false)
  }, [search])

  useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVerify = async (a: ArtistProfile) => {
    const result = a.verified ? await adminService.unverifyArtist(a._id) : await adminService.verifyArtist(a._id)
    if (!result.success) return toast.show(result.error || 'Action failed', 'error')
    setArtists((prev) => prev.map((x) => (x._id === a._id ? { ...x, verified: !a.verified } : x)))
    toast.show(a.verified ? 'Artist unverified' : 'Artist verified', 'success')
  }
  const toggleFeature = async (a: ArtistProfile) => {
    const result = await adminService.featureArtist(a._id, !a.featured)
    if (!result.success) return toast.show(result.error || 'Action failed', 'error')
    setArtists((prev) => prev.map((x) => (x._id === a._id ? { ...x, featured: !a.featured } : x)))
    toast.show(!a.featured ? 'Artist featured' : 'Artist un-featured', 'success')
  }

  const total = artists.length
  const verifiedCount = artists.filter((a) => a.verified).length
  const featuredCount = artists.filter((a) => a.featured).length

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-user" /> Artists</h1>
        <p>View, verify, and manage all artists.</p>
      </div>

      <div className="filters-bar flex gap-2 mb-4">
        <input className="flex-1 min-w-[200px]" placeholder="Search stage name..." value={search}
          onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn-secondary" onClick={() => load()}><i className="fas fa-search" /> Search</button>
        <button className="btn-outline" onClick={() => { setSearch(''); load('') }}><i className="fas fa-sync-alt" /> Refresh</button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="stat-card-sm"><div className="stat-value">{total}</div><div className="stat-label">Total</div></div>
        <div className="stat-card-sm verified"><div className="stat-value">{verifiedCount}</div><div className="stat-label">Verified</div></div>
        <div className="stat-card-sm featured"><div className="stat-value">{featuredCount}</div><div className="stat-label">Featured</div></div>
      </div>

      {loading ? <Spinner /> : artists.length === 0 ? (
        <EmptyState icon="fa-user" title="No artists found" />
      ) : (
        <DataTable headers={['Avatar', 'Stage Name', 'User', 'Songs', 'Monthly Listeners', 'Status', 'Actions']}>
          {artists.map((a) => {
            const u = typeof a.userId === 'object' && a.userId ? a.userId : null
            return (
            <tr key={a._id}>
              <td><Avatar src={resolveImageUrl(a.avatar || u?.avatar)} className="w-9 h-9 rounded-full object-cover" /></td>
              <td><strong>{a.stageName || 'Unknown'}</strong></td>
              <td>{u?.username || a.user?.username || '—'}<br /><small className="text-[#888]">{u?.email || a.user?.email || ''}</small></td>
              <td>{formatNumber(a.songCount || a.totalSongs || 0)}</td>
              <td>{formatNumber(a.monthlyListeners || 0)}</td>
              <td>
                {a.verified && <span className="badge badge-success mr-1"><i className="fas fa-check-circle" /> Verified</span>}
                {a.featured && <span className="badge badge-warning"><i className="fas fa-star" /> Featured</span>}
                {!a.verified && !a.featured && <span className="badge">—</span>}
              </td>
              <td>
                <div className="flex gap-1.5 flex-wrap">
                  <button className={`btn-sm ${a.verified ? 'btn-outline' : 'btn-success'}`} onClick={() => toggleVerify(a)}><i className="fas fa-check-circle" /> {a.verified ? 'Unverify' : 'Verify'}</button>
                  <button className={`btn-sm ${a.featured ? 'btn-outline' : 'btn-primary'}`} onClick={() => toggleFeature(a)}><i className="fas fa-star" /> {a.featured ? 'Un-feature' : 'Feature'}</button>
                  <button className="btn-icon" onClick={() => navigate(`/artist/${a._id}`)}><i className="fas fa-eye" /></button>
                </div>
              </td>
            </tr>
            )
          })}
        </DataTable>
      )}
    </div>
  )
}
