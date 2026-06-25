import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SongCard from '../components/ui/SongCard'
import { Spinner } from '../components/ui/common'
import { songsService } from '../services/songsService'
import { GENRES } from '../lib/config'
import type { Song } from '../types'

export default function Home() {
  const navigate = useNavigate()
  const [featured, setFeatured] = useState<Song[]>([])
  const [trending, setTrending] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([songsService.getFeatured(), songsService.getTrending()])
      .then(([f, t]) => { setFeatured(f.slice(0, 8)); setTrending(t.slice(0, 8)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <section className="text-center px-10 py-20" style={{ background: 'linear-gradient(135deg, #6c63ff 0%, #5a52d6 100%)' }}>
        <i className="fas fa-music text-5xl mb-4 block" />
        <h1 className="text-4xl font-extrabold mb-3">Welcome to Bravo Music</h1>
        <p className="text-lg opacity-90 mb-8">Zambia's Premier Music Platform</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/browse" className="bg-white text-primary font-semibold px-7 py-3 rounded-lg no-underline hover:bg-white/90 transition-colors">Start Listening</Link>
          <Link to="/register?role=artist" className="bg-transparent border-2 border-white text-white font-semibold px-7 py-3 rounded-lg no-underline hover:bg-white/10 transition-colors">Become an Artist</Link>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-5 py-12">
        <h2 className="text-2xl font-bold mb-5">Popular Genres</h2>
        <div className="flex gap-2 flex-wrap">
          {GENRES.map((g) => (
            <button key={g} onClick={() => navigate(`/browse?genre=${encodeURIComponent(g)}`)}
              className="px-4 py-2 rounded-full bg-[#1a1a1a] text-[#b3b3b3] border border-[#2a2a2a] hover:bg-primary hover:text-white hover:border-primary transition-all text-sm font-medium">
              {g}
            </button>
          ))}
        </div>
      </section>

      <Section title="Featured This Week" linkTo="/browse" loading={loading} songs={featured} />
      <Section title="Trending Now" linkTo="/trending" loading={loading} songs={trending} />

      <section className="mx-5 mb-16 rounded-3xl p-14 text-center border border-[#2a2a2a]" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #050505 100%)' }}>
        <h2 className="text-3xl font-bold mb-3">Are you an Artist?</h2>
        <p className="text-[#b3b3b3] mb-2">Upload your music, reach millions of listeners, and earn money from your art.</p>
        <p className="text-[#888] text-sm mb-8">Artists need email verification after registration</p>
        <Link to="/register?role=artist" className="btn-primary inline-block">Start Your Journey</Link>
      </section>
    </>
  )
}

function Section({ title, linkTo, loading, songs }: { title: string; linkTo: string; loading: boolean; songs: Song[] }) {
  return (
    <section className="max-w-[1400px] mx-auto px-5 pb-12">
      <div className="flex justify-between items-baseline mb-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Link to={linkTo} className="text-primary text-sm no-underline hover:underline">View All →</Link>
      </div>
      {loading ? <Spinner /> : songs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {songs.map((s) => <SongCard key={s._id} song={s} />)}
        </div>
      ) : (
        <p className="text-[#b3b3b3] text-center py-10">No songs to show yet.</p>
      )}
    </section>
  )
}
