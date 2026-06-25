import { create } from 'zustand'
import type { Song } from '../types'

interface PlayerStore {
  currentSong: Song | null
  isPlaying: boolean
  volume: number
  playlist: Song[]
  play: (song: Song, playlist?: Song[]) => void
  toggle: () => void
  stop: () => void
  setVolume: (v: number) => void
  next: () => void
  prev: () => void
}

const savedVolume = (() => {
  const v = localStorage.getItem('player_volume')
  return v ? parseFloat(v) : 0.7
})()

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  volume: savedVolume,
  playlist: [],

  play: (song, playlist) => set({ currentSong: song, isPlaying: true, ...(playlist ? { playlist } : {}) }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stop: () => set({ isPlaying: false }),
  setVolume: (v) => {
    localStorage.setItem('player_volume', String(v))
    set({ volume: v })
  },
  next: () => {
    const { playlist, currentSong } = get()
    if (!playlist.length || !currentSong) return
    const i = playlist.findIndex((s) => s._id === currentSong._id)
    const n = playlist[i + 1]
    if (n) set({ currentSong: n, isPlaying: true })
  },
  prev: () => {
    const { playlist, currentSong } = get()
    if (!playlist.length || !currentSong) return
    const i = playlist.findIndex((s) => s._id === currentSong._id)
    const p = playlist[i - 1]
    if (p) set({ currentSong: p, isPlaying: true })
  },
}))
