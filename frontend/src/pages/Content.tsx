import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { songsService } from '../services/songsService'
import { artistsService } from '../services/artistsService'
import { userService } from '../services/userService'
import { Spinner, EmptyState, Avatar } from '../components/ui/common'
import SongCard from '../components/ui/SongCard'
import CommentSection from '../components/ui/CommentSection'
import ShareModal from '../components/ui/ShareModal'
import AddToPlaylistModal from '../components/ui/AddToPlaylistModal'
import { usePlayerStore } from '../store/playerStore'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { usePurchase } from '../hooks/usePurchase'
import { addDownload } from '../lib/library'
import { resolveImageUrl, formatNumber, extractIdFromSlug, songSlugPath } from '../lib/config'
import { formatDate } from '../lib/formatters'
import type { Song, ArtistProfile as Artist } from '../types'

/* ----------------------------- Song Detail ----------------------------- */
export function SongDetail() {
  const { id: rawId } = useParams<{ id: string }>()
  const id = rawId ? extractIdFromSlug(rawId) : rawId
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const { buySong, purchaseModal } = usePurchase()
  const [song, setSong] = useState<Song | null>(null)
  const [related, setRelated] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    songsService.getById(id).then(async (s) => {
      setSong(s)
      if (s?.artist) {
        const artistId = typeof s.artist === 'object' ? s.artist._id : s.artist
        if (artistId) {
          const list = await songsService.getByArtist(artistId)
          setRelated(list.filter((x) => x._id !== s._id).slice(0, 6))
        }
      }
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />
  if (!song) return <EmptyState icon="fa-music" title="Song not found" />

  const artist = typeof song.artist === 'object' ? song.artist : null
  const like = async () => {
    if (!isAuth) { toast.show('Please login to like songs', 'info'); return navigate('/login') }
    const r = await songsService.like(song._id)
    toast.show(r.success ? 'Added to liked songs ❤️' : r.error || 'Failed', r.success ? 'success' : 'error')
  }
  const share = () => setShareOpen(true)
  const download = () => {
    if (!isAuth) { toast.show('Please login to download', 'info'); return navigate('/login') }
    addDownload({ _id: song._id, title: song.title, coverArt: song.coverArt, artist: typeof song.artist === 'object' ? song.artist : undefined })
    toast.show('Saved to your downloads', 'success')
  }

  return (
    <main className="max-w-[1100px] mx-auto px-5 py-10">
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        <img src={resolveImageUrl(song.coverArt)} alt={song.title} className="w-full md:w-72 h-72 rounded-2xl object-cover shadow-lg2" onError={(e) => { (e.target as HTMLImageElement).src = resolveImageUrl(undefined) }} />
        <div className="flex-1 flex flex-col justify-end">
          <span className="text-xs uppercase tracking-wider text-[#b3b3b3] mb-2">Song</span>
          <h1 className="text-4xl font-extrabold mb-3">{song.title}</h1>
          <div className="flex items-center gap-3 mb-4 text-[#b3b3b3]">
            {artist && <Link to={`/artist/${artist._id}`} className="text-white hover:text-primary no-underline font-medium">{artist.stageName}</Link>}
            <span>·</span><span>{formatNumber(song.playCount || 0)} plays</span>
            {song.genre && <><span>·</span><span className="genre-badge">{song.genre}</span></>}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button className="btn-primary" onClick={() => play(song, [song, ...related])}><i className="fas fa-play" /> Play</button>
            {song.isPremium && (song.price || 0) > 0 && (
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#ffc107,#ff9800)' }} onClick={() => buySong(song)}>
                <i className="fas fa-shopping-cart" /> Buy · K{Number(song.price).toFixed(2)}
              </button>
            )}
            <button className="btn-outline" onClick={like}><i className="fas fa-heart" /> Like</button>
            <button className="btn-outline" onClick={() => { if (!isAuth) { toast.show('Please login to use playlists', 'info'); return navigate('/login') } setPlaylistOpen(true) }}><i className="fas fa-list" /> Add to Playlist</button>
            <button className="btn-outline" onClick={download}><i className="fas fa-download" /> Download</button>
            <button className="btn-outline" onClick={share}><i className="fas fa-share" /> Share</button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-5">More from this artist</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {related.map((s) => <SongCard key={s._id} song={s} playlist={related} />)}
          </div>
        </section>
      )}

      <CommentSection songId={song._id} />
      {purchaseModal}
      {shareOpen && (
        <ShareModal
          url={`${window.location.origin}${songSlugPath(song)}`}
          title={song.title}
          artist={typeof song.artist === 'object' ? song.artist?.stageName : undefined}
          onShared={(platform) => songsService.share(song._id, platform)}
          onClose={() => setShareOpen(false)}
        />
      )}
      {playlistOpen && <AddToPlaylistModal songId={song._id} onClose={() => setPlaylistOpen(false)} />}
    </main>
  )
}

/* ----------------------------- Artist Profile ----------------------------- */
export function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const [artist, setArtist] = useState<Artist | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const playAll = usePlayerStore((s) => s.play)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([artistsService.getById(id), songsService.getByArtist(id)]).then(([a, s]) => {
      if (a.success) {
        const d = a.data as { artist?: Artist; isFollowing?: boolean } & Artist
        setArtist(d?.artist || d)
        setFollowing(!!d?.isFollowing)
      }
      setSongs(s)
    }).finally(() => setLoading(false))
  }, [id])

  // Resolve the user id to follow (follow targets a User, not an Artist profile)
  const followUserId = (() => {
    const u = artist?.userId
    if (!u) return null
    return typeof u === 'object' ? (u as { _id?: string })._id : u
  })()

  const toggleFollow = async () => {
    if (!isAuth) { toast.show('Please login to follow artists', 'info'); return navigate('/login') }
    if (!followUserId) return
    setFollowBusy(true)
    const r = following
      ? await userService.unfollowUser(followUserId)
      : await userService.followUser(followUserId)
    setFollowBusy(false)
    if (!r.success) return toast.show(r.error || 'Action failed', 'error')
    setFollowing(!following)
    toast.show(following ? 'Unfollowed' : 'Following', 'success')
  }

  if (loading) return <Spinner />
  if (!artist) return <EmptyState icon="fa-user" title="Artist not found" />

  return (
    <main className="max-w-[1100px] mx-auto px-5 py-10">
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-10">
        <Avatar src={resolveImageUrl(artist.avatar)} className="w-40 h-40 rounded-full object-cover shadow-lg2" />
        <div className="text-center md:text-left">
          <span className="text-xs uppercase tracking-wider text-[#b3b3b3]">Artist</span>
          <h1 className="text-4xl font-extrabold flex items-center gap-2 justify-center md:justify-start">
            {artist.stageName}
            {artist.verified && <i className="fas fa-check-circle text-primary text-2xl" title="Verified" />}
          </h1>
          <p className="text-[#b3b3b3] mt-1">{formatNumber(artist.monthlyListeners || 0)} monthly listeners</p>
          <div className="flex gap-3 mt-4 justify-center md:justify-start">
            {songs.length > 0 && <button className="btn-primary" onClick={() => playAll(songs[0], songs)}><i className="fas fa-play" /> Play</button>}
            {followUserId && (
              <button className={following ? 'btn-outline' : 'btn-primary'} onClick={toggleFollow} disabled={followBusy}>
                <i className={`fas fa-${following ? 'user-check' : 'user-plus'}`} /> {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>
      </div>

      {artist.bio && <p className="text-[#b3b3b3] max-w-2xl mb-10">{artist.bio}</p>}

      <section>
        <h2 className="text-2xl font-bold mb-5">Songs</h2>
        {songs.length === 0 ? <EmptyState icon="fa-music" title="No songs yet" /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {songs.map((s) => <SongCard key={s._id} song={s} playlist={songs} />)}
          </div>
        )}
      </section>
    </main>
  )
}
