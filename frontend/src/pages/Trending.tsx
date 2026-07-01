import { useEffect, useState } from 'react'
import SongCard from '../components/ui/SongCard'
import { Spinner, EmptyState } from '../components/ui/common'
import { songsService } from '../services/songsService'
import type { Song } from '../types'

export default function Trending() {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    songsService.getTrending()
      .then((list) => setSongs(list))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-12">
      <div className="flex items-center gap-3 mb-8">
        <i className="fas fa-fire text-secondary text-3xl" />
        <h1 className="text-3xl font-bold">Trending Now</h1>
      </div>
      {loading ? <Spinner /> : songs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {songs.map((s, i) => (
            <div key={s._id} className="relative">
              <span className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <SongCard song={s} playlist={songs} />
            </div>
          ))}
        </div>
      ) : <EmptyState icon="fa-fire" title="No trending songs yet." />}
    </main>
  )
}
