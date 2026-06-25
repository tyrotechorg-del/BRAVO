import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '../../services/adminService'
import { songsService } from '../../services/songsService'
import { uploadService, type UploadProgress } from '../../services/uploadService'
import { toast } from '../../store/toastStore'
import { formatNumber, GENRES, resolveImageUrl } from '../../lib/config'
import { Spinner } from '../../components/ui/common'
import Modal from '../../components/ui/Modal'
import type { PlatformAnalytics, ArtistProfile, Song } from '../../types'

const QUICK_LINKS = [
  { route: '/admin/users', icon: 'fa-users', label: 'Users' },
  { route: '/admin/artists', icon: 'fa-user', label: 'Artists' },
  { route: '/admin/all-songs', icon: 'fa-headphones', label: 'All Songs' },
  { route: '/admin/pending', icon: 'fa-clock', label: 'Pending Songs' },
  { route: '/admin/albums', icon: 'fa-compact-disc', label: 'Albums' },
  { route: '/admin/videos', icon: 'fa-video', label: 'Videos' },
  { route: '/admin/withdrawals', icon: 'fa-money-bill-wave', label: 'Withdrawals' },
  { route: '/admin/reports', icon: 'fa-flag', label: 'Reports' },
  { route: '/admin/comments', icon: 'fa-comment', label: 'Reported Comments' },
  { route: '/admin/settings', icon: 'fa-cog', label: 'Settings' },
]

type ModalKind = null | 'song' | 'video' | 'album'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [artists, setArtists] = useState<{ id: string; name: string }[]>([])

  const loadData = useCallback(async () => {
    const [a, , p] = await Promise.all([
      adminService.getPlatformAnalytics().catch(() => null),
      adminService.getRevenueAnalytics().catch(() => null),
      adminService.getPendingSongs().catch(() => null),
    ])
    setAnalytics(a?.success ? a.data ?? null : null)
    const pending = p?.success ? p.data : null
    setPendingCount(Array.isArray(pending) ? pending.length : (pending && 'songs' in pending ? pending.songs?.length ?? 0 : 0))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const loadArtists = useCallback(async () => {
    const result = await adminService.getAllArtistsForAdmin()
    const list = result.success ? (Array.isArray(result.data) ? result.data : result.data?.artists ?? []) : []
    setArtists((list as ArtistProfile[]).map((a) => ({ id: a._id, name: a.stageName || a.displayName || 'Unknown' })))
  }, [])

  const openModal = async (kind: ModalKind) => {
    await loadArtists()
    setModal(kind)
  }

  const triggerBackup = async () => {
    setBacking(true)
    const result = await adminService.triggerBackup()
    setBacking(false)
    toast.show(result.success ? 'Backup triggered successfully' : result.error || 'Backup failed', result.success ? 'success' : 'error')
  }

  const overview = analytics?.overview || {}
  const growth = analytics?.overview?.growth || analytics?.growth || {}

  const stats = [
    { label: 'Total Users', value: formatNumber(overview.totalUsers || 0) },
    { label: 'Total Artists', value: formatNumber(overview.totalArtists || 0) },
    { label: 'Total Songs', value: formatNumber(overview.totalSongs || 0) },
    { label: 'Total Albums', value: formatNumber(overview.totalAlbums || 0) },
    { label: 'Pending Songs', value: String(pendingCount) },
    { label: 'Total Revenue', value: `K${Number(overview.totalRevenue || 0).toLocaleString()}` },
    { label: 'Platform Commission', value: `K${Number(overview.platformCommission || 0).toLocaleString()}` },
  ]

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-chart-line" /> Admin Dashboard</h1>
        <p>Platform overview and quick actions.</p>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="dashboard-stats mb-6">
            {stats.map((s) => (
              <div key={s.label} className="stat-card">
                <h3>{s.label}</h3>
                <div className="value">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button className="btn-primary" onClick={loadData}><i className="fas fa-sync-alt" /> Refresh</button>
            <button className="btn-outline" onClick={triggerBackup} disabled={backing}>
              <i className="fas fa-database" /> {backing ? 'Backing up…' : 'Trigger Backup'}
            </button>
            <button className="btn-outline" onClick={() => openModal('song')}><i className="fas fa-music" /> Upload Song</button>
            <button className="btn-outline" onClick={() => openModal('video')}><i className="fas fa-video" /> Upload Video</button>
            <button className="btn-outline" onClick={() => openModal('album')}><i className="fas fa-compact-disc" /> Create Album</button>
          </div>

          <div className="growth-stats bg-[#1a1a1a] rounded-2xl p-5 border border-[#2a2a2a] mb-8">
            <h3 className="text-base font-semibold mb-2">Growth (Last 30 Days)</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <span>📈 New Users: <strong>{formatNumber(growth.newUsersLast30Days || 0)}</strong></span>
              <span>🎵 New Songs: <strong>{formatNumber(growth.newSongsLast30Days || 0)}</strong></span>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-3">Quick Links</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {QUICK_LINKS.map((q) => (
              <button key={q.route} className="quick-link-card" onClick={() => navigate(q.route)}>
                <i className={`fas ${q.icon} text-2xl text-primary mb-2 block`} />
                <div className="font-bold text-sm">{q.label}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {modal === 'song' && <UploadSongModal artists={artists} onClose={() => setModal(null)} onDone={loadData} />}
      {modal === 'video' && <UploadVideoModal artists={artists} onClose={() => setModal(null)} onDone={loadData} />}
      {modal === 'album' && <CreateAlbumModal artists={artists} onClose={() => setModal(null)} onDone={loadData} />}
    </div>
  )
}

// ---- Upload Song Modal ----
function UploadSongModal({ artists, onClose, onDone }: { artists: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [audio, setAudio] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState(GENRES[0])
  const [artistId, setArtistId] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [price, setPrice] = useState('0')
  const [tags, setTags] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const submit = async () => {
    setError('')
    if (!audio) return setError('Audio file is required')
    if (!title.trim()) return setError('Title is required')
    if (!artistId) return setError('Select an artist')
    if (cover && cover.size > 5 * 1024 * 1024) return setError('Cover must be 5MB or less')
    if (audio.size > 20 * 1024 * 1024) return setError('Audio file must be 20MB or less')

    const fd = new FormData()
    fd.append('audio', audio)
    if (cover) fd.append('coverArt', cover)
    fd.append('title', title.trim())
    fd.append('genre', genre)
    fd.append('artistId', artistId)
    if (isPremium) {
      fd.append('isPremium', 'true')
      const p = parseFloat(price)
      if (Number.isFinite(p) && p > 0) fd.append('price', String(p))
    }
    if (tags.trim()) tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => fd.append('tags', t))
    if (lyrics.trim()) fd.append('lyrics', lyrics.trim())

    setSubmitting(true)
    setProgress(0)
    const { promise } = uploadService.adminUploadSong('song', fd, (p: UploadProgress) => setProgress(p.percent))
    const result = await promise
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Upload failed')
    onClose()
    toast.show('Song uploaded', 'success')
    onDone()
  }

  return (
    <Modal title="Admin Upload Song" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Uploading…' : 'Upload Song'}</button></>}>
      <div className="form-group"><label>Audio File *</label><input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] || null)} /></div>
      <div className="form-group"><label>Cover Art (max 5MB)</label><input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} /></div>
      <div className="form-group"><label>Song Title *</label><input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label>Genre *</label><select value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></div>
      <div className="form-group"><label>Artist *</label>
        <select value={artistId} onChange={(e) => setArtistId(e.target.value)}>
          <option value="">Select Artist</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} /> Premium content</label></div>
      {isPremium && <div className="form-group"><label>Price (Kwacha)</label><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>}
      <div className="form-group"><label>Tags (comma-separated)</label><input type="text" maxLength={200} placeholder="afrobeat, zambian, new" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
      <div className="form-group"><label>Lyrics</label><textarea rows={4} maxLength={5000} value={lyrics} onChange={(e) => setLyrics(e.target.value)} /></div>
      {submitting && (
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1"><span>Uploading…</span><span>{progress}%</span></div>
          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}

// ---- Upload Video Modal ----
function UploadVideoModal({ artists, onClose, onDone }: { artists: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [video, setVideo] = useState<File | null>(null)
  const [thumb, setThumb] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState(GENRES[0])
  const [artistId, setArtistId] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const submit = async () => {
    setError('')
    if (!video) return setError('Video file is required')
    if (!title.trim()) return setError('Title is required')
    if (!artistId) return setError('Select an artist')
    const fd = new FormData()
    fd.append('video', video)
    if (thumb) fd.append('coverArt', thumb)
    fd.append('title', title.trim())
    fd.append('genre', genre)
    fd.append('artistId', artistId)
    setSubmitting(true)
    setProgress(0)
    const { promise } = uploadService.adminUploadSong('video', fd, (p: UploadProgress) => setProgress(p.percent))
    const result = await promise
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Upload failed')
    onClose()
    toast.show('Video uploaded', 'success')
    onDone()
  }

  return (
    <Modal title="Admin Upload Video" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Uploading…' : 'Upload Video'}</button></>}>
      <div className="form-group"><label>Video File *</label><input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} /></div>
      <div className="form-group"><label>Thumbnail (Cover Art)</label><input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] || null)} /></div>
      <div className="form-group"><label>Title *</label><input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label>Genre *</label><select value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></div>
      <div className="form-group"><label>Artist *</label>
        <select value={artistId} onChange={(e) => setArtistId(e.target.value)}>
          <option value="">Select Artist</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {submitting && (
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1"><span>Uploading…</span><span>{progress}%</span></div>
          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}

// ---- Create Album Modal ----
function CreateAlbumModal({ artists, onClose, onDone }: { artists: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [artistId, setArtistId] = useState('')
  const [genre, setGenre] = useState('')
  const [type, setType] = useState('album')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Song picker — loads the selected artist's songs so they can be added
  // to the album at creation time.
  const [artistSongs, setArtistSongs] = useState<Song[]>([])
  const [loadingSongs, setLoadingSongs] = useState(false)
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())

  // When the artist changes, fetch their songs and reset the selection.
  useEffect(() => {
    setSelectedSongs(new Set())
    setArtistSongs([])
    if (!artistId) return
    setLoadingSongs(true)
    songsService.getByArtist(artistId)
      .then((list) => setArtistSongs(list || []))
      .catch(() => setArtistSongs([]))
      .finally(() => setLoadingSongs(false))
  }, [artistId])

  const toggleSong = (id: string) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submit = async () => {
    setError('')
    if (!title.trim()) return setError('Title is required')
    if (!cover) return setError('Cover art is required')
    if (!artistId) return setError('Select an artist')
    if (cover.size > 5 * 1024 * 1024) return setError('Cover must be 5MB or less')
    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('coverArt', cover)
    fd.append('artistId', artistId)
    if (genre) fd.append('genre', genre)
    if (type) fd.append('type', type)
    if (description.trim()) fd.append('description', description.trim())
    // Append each selected song id — backend reads `songs` (array or CSV)
    // and only links songs that belong to this artist.
    selectedSongs.forEach((id) => fd.append('songs', id))

    setSubmitting(true)
    const result = await adminService.adminUploadAlbum(fd)
    setSubmitting(false)
    if (!result.success) return setError(result.error || 'Create failed')
    onClose()
    const n = selectedSongs.size
    toast.show(n > 0 ? `Album created with ${n} track${n === 1 ? '' : 's'}` : 'Album created', 'success')
    onDone()
  }

  return (
    <Modal title="Admin Create Album" onClose={onClose} maxWidth="max-w-xl"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Creating…' : 'Create Album'}</button></>}>
      <div className="form-group"><label>Title *</label><input type="text" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="form-group"><label>Cover Art *</label><input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} /></div>
      <div className="form-group"><label>Artist *</label>
        <select value={artistId} onChange={(e) => setArtistId(e.target.value)}>
          <option value="">Select Artist</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="form-group"><label>Genre</label><select value={genre} onChange={(e) => setGenre(e.target.value)}><option value="">Select Genre</option>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></div>
      <div className="form-group"><label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="album">Album</option><option value="ep">EP</option><option value="single">Single</option>
        </select>
      </div>
      <div className="form-group"><label>Description</label><textarea rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>

      {/* Song picker */}
      <div className="form-group">
        <label>Add Songs to Album {selectedSongs.size > 0 && <span className="text-primary">({selectedSongs.size} selected)</span>}</label>
        {!artistId ? (
          <p className="text-xs text-[#888]">Select an artist first to see their songs.</p>
        ) : loadingSongs ? (
          <Spinner plain />
        ) : artistSongs.length === 0 ? (
          <p className="text-xs text-[#888]">This artist has no songs to add yet.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto bg-[#0f0f1e] rounded-lg p-1.5 border border-[#2a2a3e]">
            {artistSongs.map((s) => (
              <label key={s._id} className="flex items-center gap-2.5 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={selectedSongs.has(s._id)} onChange={() => toggleSong(s._id)} />
                <img src={resolveImageUrl(s.coverArt)} className="w-8 h-8 rounded object-cover" alt="" />
                <span className="text-sm text-white flex-1 truncate">{s.title}</span>
                {s.isVideo && <span className="text-[10px] text-[#888]"><i className="fas fa-video" /></span>}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}
    </Modal>
  )
}
