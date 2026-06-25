import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult, Song } from '../types'

const BASE = API_ENDPOINTS.SONGS

async function publicGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) return { success: false, error: data?.error || 'Request failed', status: res.status }
    return { success: true, data, status: res.status }
  } catch {
    return { success: false, error: 'Network error', status: 0 }
  }
}

interface SongListResponse {
  songs: Song[]
  totalPages: number
  currentPage: number
  total: number
}

function unwrapList(d: unknown, key = 'data'): Song[] {
  if (Array.isArray(d)) return d as Song[]
  if (d && typeof d === 'object' && key in d) return ((d as Record<string, Song[]>)[key]) || []
  return []
}

export const songsService = {
  async getAll(page = 1, limit = 20, genre?: string | null): Promise<SongListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (genre && genre !== 'all' && genre !== 'All') params.set('genre', genre)
    const result = await publicGet<SongListResponse>(`?${params.toString()}`)
    return result.success ? (result.data as SongListResponse) : { songs: [], totalPages: 0, currentPage: 1, total: 0 }
  },
  async getById(id: string): Promise<Song | null> {
    const result = await publicGet<Song>(`/${encodeURIComponent(id)}`)
    return result.success ? (result.data as Song) : null
  },
  async getTrending(): Promise<Song[]> {
    const result = await publicGet('/trending')
    return result.success ? unwrapList(result.data) : []
  },
  async getFeatured(): Promise<Song[]> {
    const result = await publicGet('/featured')
    return result.success ? unwrapList(result.data) : []
  },
  async getRecent(): Promise<Song[]> {
    const result = await publicGet('/recent')
    return result.success ? unwrapList(result.data) : []
  },
  async getByArtist(artistId: string): Promise<Song[]> {
    const result = await publicGet(`/artist/${encodeURIComponent(artistId)}`)
    return result.success ? unwrapList(result.data, 'songs') : []
  },
  async getVideos(page = 1, limit = 20, genre?: string | null) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (genre) params.append('genre', genre)
    const result = await publicGet<{ songs?: Song[]; videos?: Song[]; totalPages?: number }>(`/videos?${params.toString()}`)
    return result.success ? result.data : null
  },
  like(songId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(songId)}/like`, { method: 'POST' })
  },
  unlike(songId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(songId)}/like`, { method: 'DELETE' })
  },
  share(songId: string, platform = 'copy') {
    return apiClient.call(`${BASE}/${encodeURIComponent(songId)}/share`, { method: 'POST', body: JSON.stringify({ platform }) })
  },
  deleteSong(songId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(songId)}`, { method: 'DELETE' })
  },
  async getByGenre(genre: string): Promise<Song[]> {
    const result = await publicGet(`/genre/${encodeURIComponent(genre)}`)
    return result.success ? unwrapList(result.data) : []
  },
  streamUrl(songId: string): string {
    return `${API_BASE_URL}${BASE}/${encodeURIComponent(songId)}/stream`
  },
}
