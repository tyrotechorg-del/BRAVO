import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import SongCard from '../components/ui/SongCard'
import { Spinner, EmptyState } from '../components/ui/common'
import { songsService } from '../services/songsService'
import { GENRES } from '../lib/config'
import type { Song } from '../types'

export default function Browse() {
  const [params] = useSearchParams()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [genre, setGenre] = useState(params.get('genre') || 'All')

  const load = useCallback(async (p: number, g: string, reset: boolean) => {
    setLoading(true)
    const result = await songsService.getAll(p, 20, g === 'All' ? undefined : g)
    const list = result.songs || []
    setSongs((prev) => (reset ? list : [...prev, ...list]))
    setHasMore(p < (result.totalPages || 1))
    setLoading(false)
  }, [])

  useEffect(() => { setPage(1); load(1, genre, true) }, [genre, load])

  const loadMore = () => { const next = page + 1; setPage(next); load(next, genre, false) }

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-12">
      <h1 className="text-3xl font-bold mb-2">Browse Music</h1>
      <div className="flex gap-2 my-6 flex-wrap">
        {['All', ...GENRES].map((g) => (
          <button key={g} onClick={() => setGenre(g)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              genre === g ? 'bg-primary text-white border-primary' : 'bg-[#1a1a1a] text-[#b3b3b3] border-[#2a2a2a] hover:bg-primary hover:text-white hover:border-primary'
            }`}>{g}</button>
        ))}
      </div>

      {loading && songs.length === 0 ? <Spinner /> : songs.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {songs.map((s) => <SongCard key={s._id} song={s} playlist={songs} />)}
          </div>
          {hasMore && <div className="text-center mt-10"><button className="btn-primary" onClick={loadMore} disabled={loading}>{loading ? 'Loading…' : 'Load More'}</button></div>}
        </>
      ) : (
        <EmptyState icon="fa-search" title={`No songs found${genre !== 'All' ? ` in ${genre}` : ''}.`} />
      )}
    </main>
  )
}
