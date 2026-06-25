import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SongCard from '../components/ui/SongCard'
import { Spinner, EmptyState, Pagination } from '../components/ui/common'
import { useConfirm } from '../hooks/useConfirm'
import { useAuthStore } from '../store/authStore'
import { userService } from '../services/userService'
import { songsService } from '../services/songsService'
import { getHistoryIds, getLikedIds, clearHistory } from '../lib/library'
import { toast } from '../store/toastStore'
import type { Song } from '../types'

function unwrapSongs(result: { success: boolean; data?: unknown }): Song[] {
  if (!result.success) return []
  const d = result.data
  if (Array.isArray(d)) return d as Song[]
  if (d && typeof d === 'object') {
    const o = d as { songs?: Song[]; history?: Song[] }
    return o.songs || o.history || []
  }
  return []
}

async function fetchByIds(ids: string[]): Promise<Song[]> {
  const results = await Promise.all(ids.map((id) => songsService.getById(id).catch(() => null)))
  return results.filter((s): s is Song => !!s && !!s._id)
}

// ---------- Listener Dashboard ----------
export function ListenerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [recent, setRecent] = useState<Song[]>([])
  const [liked, setLiked] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const recentIds = getHistoryIds().slice(0, 8)
      const likedIds = getLikedIds().slice(0, 8)
      const [r, l] = await Promise.all([fetchByIds(recentIds), fetchByIds(likedIds)])
      setRecent(r); setLiked(l); setLoading(false)
    })()
  }, [])

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-10">
      <h1 className="text-3xl font-bold mb-2">Your Library</h1>
      <p className="text-[#b3b3b3] mb-8">Welcome back, {user?.username}!</p>

      <div className="grid grid-cols-2 gap-5 mb-10 max-w-md">
        <div className="stat-card"><h3>Liked Songs</h3><div className="value">{getLikedIds().length}</div></div>
        <div className="stat-card"><h3>Recently Played</h3><div className="value">{getHistoryIds().length}</div></div>
      </div>

      <LibrarySection title="Recently Played" linkTo="/recent" loading={loading} songs={recent} emptyIcon="fa-history" emptyText="Nothing here yet — go listen!" />
      <LibrarySection title="Liked Songs" linkTo="/liked" loading={loading} songs={liked} emptyIcon="fa-heart" emptyText="Heart songs to save them here." />
    </main>
  )
}

function LibrarySection({ title, linkTo, loading, songs, emptyIcon, emptyText }: { title: string; linkTo: string; loading: boolean; songs: Song[]; emptyIcon: string; emptyText: string }) {
  return (
    <section className="mb-10">
      <div className="flex justify-between items-baseline mb-5">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link to={linkTo} className="text-primary text-sm no-underline hover:underline">View All →</Link>
      </div>
      {loading ? <Spinner /> : songs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {songs.map((s) => <SongCard key={s._id} song={s} playlist={songs} />)}
        </div>
      ) : <div className="text-center py-10 text-[#b3b3b3]"><i className={`fas ${emptyIcon} text-3xl mb-2 block opacity-30`} /><p>{emptyText}</p></div>}
    </section>
  )
}

// ---------- Liked Page ----------
export function LikedPage() {
  const navigate = useNavigate()
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const [songs, setSongs] = useState<Song[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await userService.getLikedSongs()
    const list = unwrapSongs(result)
    setSongs(list)
    const data = result.success && result.data && !Array.isArray(result.data) ? (result.data as { totalPages?: number; total?: number }) : {}
    setTotalPages(data.totalPages || 1)
    setTotal(data.total || list.length)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isAuth()) { toast.show('Please sign in to see your liked songs', 'info'); navigate('/login'); return }
    load()
  }, [isAuth, navigate, load])

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-12">
      <div className="page-header"><h1><i className="fas fa-heart text-danger" /> Liked Songs</h1>
        <p>{loading ? 'Loading…' : total === 0 ? "You haven't liked any songs yet." : `${total} song${total === 1 ? '' : 's'}`}</p>
      </div>
      {loading ? <Spinner /> : songs.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {songs.map((s) => <SongCard key={s._id} song={s} playlist={songs} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </>
      ) : <EmptyState icon="fa-heart" title="No liked songs yet" message="Tap the heart on any song to add it here." />}
    </main>
  )
}

// ---------- Recent Page ----------
export function RecentPage() {
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const ids = getHistoryIds()
    setSongs(ids.length ? await fetchByIds(ids) : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onClear = () => {
    confirm({
      message: 'Clear all listening history?',
      confirmLabel: 'Clear',
      confirmClass: 'btn-danger',
      onConfirm: () => { clearHistory(); setSongs([]); toast.show('History cleared', 'success') },
    })
  }

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-12">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div className="page-header mb-0">
          <h1><i className="fas fa-history" /> Recently Played</h1>
          <p>{songs.length ? `${songs.length} song${songs.length === 1 ? '' : 's'}` : ''}</p>
        </div>
        {songs.length > 0 && <button className="btn-outline" onClick={onClear}><i className="fas fa-trash" /> Clear History</button>}
      </div>
      {loading ? <Spinner /> : songs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {songs.map((s) => <SongCard key={s._id} song={s} playlist={songs} />)}
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-history" />
          <h3>No history yet</h3>
          <p className="mb-4">Songs you play will appear here.</p>
          <button className="btn-primary" onClick={() => navigate('/browse')}>Discover Music</button>
        </div>
      )}
      {confirmDialog}
    </main>
  )
}
