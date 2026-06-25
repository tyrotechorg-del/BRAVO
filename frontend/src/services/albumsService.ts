import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult, Album } from '../types'

const BASE = API_ENDPOINTS.ALBUMS

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

interface AlbumListResponse {
  albums: Album[]
  totalPages: number
  currentPage: number
  total: number
}

export const albumsService = {
  async getAll(page = 1, limit = 20, genre?: string | null): Promise<AlbumListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (genre) params.set('genre', genre)
    const result = await publicGet<AlbumListResponse>(`?${params.toString()}`)
    return result.success ? (result.data as AlbumListResponse) : { albums: [], totalPages: 0, currentPage: 1, total: 0 }
  },
  async getById(id: string): Promise<({ album?: Album } & Album) | null> {
    const result = await publicGet<{ album?: Album } & Album>(`/${encodeURIComponent(id)}`)
    return result.success ? result.data ?? null : null
  },
  async getTrending(): Promise<Album[]> {
    const result = await publicGet<Album[] | { data: Album[] }>('/trending')
    if (!result.success) return []
    const d = result.data
    return Array.isArray(d) ? d : (d && 'data' in d ? d.data : []) || []
  },
  getMyAlbums() {
    // The current artist's own albums live under the artist routes.
    return apiClient.call(`/artists/albums`, { method: 'GET' })
  },
  create(formData: FormData) {
    // Albums are created via the artist upload route (multipart with coverArt).
    return apiClient.call(`/artists/upload-album`, { method: 'POST', body: formData })
  },
  update(id: string, data: Record<string, unknown>) {
    return apiClient.call(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })
  },
  delete(id: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  addSong(albumId: string, songId: string): Promise<ApiResult> {
    return apiClient.call(`${BASE}/${encodeURIComponent(albumId)}/add-song`, { method: 'POST', body: JSON.stringify({ songId }) })
  },
  removeSong(albumId: string, songId: string): Promise<ApiResult> {
    return apiClient.call(`${BASE}/${encodeURIComponent(albumId)}/remove-song`, { method: 'DELETE', body: JSON.stringify({ songId }) })
  },
  getArtistAlbums(userId: string) {
    return apiClient.call<Album[] | { albums: Album[] }>(`${BASE}/artist/${encodeURIComponent(userId)}`, { method: 'GET' })
  },
  updateWithCover(id: string, formData: FormData) {
    return apiClient.call(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: formData })
  },
  purchase(id: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(id)}/purchase`, { method: 'POST' })
  },
}
