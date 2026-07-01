import { create } from 'zustand'
import type { Song } from '../types'

type RepeatMode = 'off' | 'all' | 'one'

interface PlayerStore {
  currentSong: Song | null
  isPlaying: boolean
  volume: number
  playlist: Song[]
  repeat: RepeatMode
  shuffle: boolean
  play: (song: Song, playlist?: Song[]) => void
  toggle: () => void
  stop: () => void
  setVolume: (v: number) => void
  next: (auto?: boolean) => void
  prev: () => void
  cycleRepeat: () => void
  toggleShuffle: () => void
}

const savedVolume = (() => {
  const v = localStorage.getItem('player_volume')
  return v ? parseFloat(v) : 0.7
})()

// Pick a random index different from `exclude` (when possible)
function randomIndex(len: number, exclude: number): number {
  if (len <= 1) return 0
  let i = exclude
  while (i === exclude) i = Math.floor(Math.random() * len)
  return i
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  volume: savedVolume,
  playlist: [],
  repeat: 'off',
  shuffle: false,

  play: (song, playlist) =>
    set((s) => ({
      currentSong: song,
      isPlaying: true,
      // If a queue is provided use it. Otherwise, if the song isn't already in
      // the current queue, start a single-item queue so prev/next have context.
      playlist: playlist && playlist.length
        ? playlist
        : s.playlist.some((x) => x._id === song._id) ? s.playlist : [song],
    })),

  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stop: () => set({ isPlaying: false }),
  setVolume: (v) => {
    localStorage.setItem('player_volume', String(v))
    set({ volume: v })
  },

  // `auto` = true when called from the audio 'ended' event (vs the Next button)
  next: (auto = false) => {
    const { playlist, currentSong, repeat, shuffle } = get()
    // TEMP DIAGNOSTIC — remove once confirmed working
    console.log('[player] next()', { queueLength: playlist.length, current: currentSong?.title, inQueue: playlist.some((s) => s._id === currentSong?._id) })
    if (!currentSong) return
    // If we somehow have no real queue, there's nothing to advance to.
    if (playlist.length <= 1) { if (repeat === 'one' && auto && playlist.length === 1) set({ isPlaying: true }); return }

    let i = playlist.findIndex((s) => s._id === currentSong._id)
    if (i === -1) i = 0   // current song not in queue — treat as start

    // Repeat-one only auto-repeats on track end; the Next button still advances.
    if (repeat === 'one' && auto) {
      set({ currentSong: playlist[i], isPlaying: true })
      return
    }

    let nextIndex: number
    if (shuffle) {
      nextIndex = randomIndex(playlist.length, i)
    } else if (i < playlist.length - 1) {
      nextIndex = i + 1
    } else {
      // End of queue
      if (repeat === 'all') nextIndex = 0
      else { set({ isPlaying: false }); return }   // stop at the end
    }
    set({ currentSong: playlist[nextIndex], isPlaying: true })
  },

  prev: () => {
    const { playlist, currentSong, shuffle } = get()
    if (!currentSong) return
    if (playlist.length <= 1) return

    let i = playlist.findIndex((s) => s._id === currentSong._id)
    if (i === -1) i = 0

    let prevIndex: number
    if (shuffle) {
      prevIndex = randomIndex(playlist.length, i)
    } else if (i > 0) {
      prevIndex = i - 1
    } else {
      prevIndex = playlist.length - 1   // wrap to the end
    }
    set({ currentSong: playlist[prevIndex], isPlaying: true })
  },

  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
}))
