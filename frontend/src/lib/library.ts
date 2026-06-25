// Local play-history + liked-song id tracking (mirrors original localStorage keys)

const HISTORY_KEY = 'bravo_history'
const LIKED_KEY = 'bravo_liked_songs'

export function getHistoryIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map((i: unknown) => (typeof i === 'string' ? i : (i as { _id?: string })?._id)).filter(Boolean) as string[]
  } catch {
    return []
  }
}

export function pushHistory(songId: string) {
  const ids = getHistoryIds().filter((id) => id !== songId)
  ids.unshift(songId)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(ids.slice(0, 100)))
}

export function clearHistory() {
  localStorage.setItem(HISTORY_KEY, '[]')
}

export function getLikedIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function isLiked(songId: string): boolean {
  return getLikedIds().includes(songId)
}

export function toggleLikedLocal(songId: string): boolean {
  const ids = getLikedIds()
  const has = ids.includes(songId)
  const next = has ? ids.filter((id) => id !== songId) : [...ids, songId]
  localStorage.setItem(LIKED_KEY, JSON.stringify(next))
  return !has
}

// ---- Offline downloads (mirrors bravo_downloaded_songs) ----
const DOWNLOADS_KEY = 'bravo_downloaded_songs'

export interface DownloadedSong {
  _id: string
  title?: string
  coverArt?: string
  artist?: { stageName?: string } | string
  downloadedAt?: string
}

export function getDownloads(): DownloadedSong[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DOWNLOADS_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function addDownload(song: DownloadedSong) {
  const list = getDownloads().filter((d) => d._id !== song._id)
  list.unshift({ ...song, downloadedAt: new Date().toISOString() })
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(list))
}

export function removeDownload(id: string) {
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(getDownloads().filter((d) => d._id !== id)))
}

export function clearDownloads() {
  localStorage.setItem(DOWNLOADS_KEY, '[]')
}
