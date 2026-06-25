import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult, Playlist } from '../types'

const BASE = API_ENDPOINTS.PLAYLISTS

async function publicGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const token = apiClient.getToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`, { headers })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { success: false, error: data?.error || 'Request failed', status: res.status }
    return { success: true, data, status: res.status }
  } catch {
    return { success: false, error: 'Network error', status: 0 }
  }
}

export const playlistsService = {
  getById(playlistId: string): Promise<ApiResult<Playlist | { playlist: Playlist }>> {
    return publicGet(`/${encodeURIComponent(playlistId)}`)
  },
  getPublic(page = 1, limit = 20) {
    return publicGet<{ playlists: Playlist[]; totalPages?: number }>(`/public?page=${page}&limit=${limit}`)
  },
  create(data: { name: string; description?: string; isPublic?: boolean }) {
    return apiClient.call<Playlist>(`${BASE}/create`, { method: 'POST', body: JSON.stringify(data) })
  },
  update(playlistId: string, data: Record<string, unknown>) {
    return apiClient.call(`${BASE}/${encodeURIComponent(playlistId)}`, { method: 'PUT', body: JSON.stringify(data) })
  },
  delete(playlistId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(playlistId)}`, { method: 'DELETE' })
  },
  getUserPlaylists(): Promise<ApiResult<Playlist[] | { playlists: Playlist[] }>> {
    return apiClient.call(`${BASE}`, { method: 'GET' })
  },
  getMine(): Promise<ApiResult<Playlist[] | { playlists: Playlist[] }>> {
    return apiClient.call(`${BASE}`, { method: 'GET' })
  },
  addSong(playlistId: string, songId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(playlistId)}/add-song`, { method: 'POST', body: JSON.stringify({ songId }) })
  },
  removeSong(playlistId: string, songId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(playlistId)}/remove-song`, { method: 'DELETE', body: JSON.stringify({ songId }) })
  },
  // NOTE: the backend has no reorder endpoint; this is a frontend-only helper
  // kept for forward-compatibility. It will 404 until the route is added.
  reorderSongs(playlistId: string, songIds: string[]) {
    return apiClient.call(`${BASE}/${encodeURIComponent(playlistId)}/reorder`, { method: 'PUT', body: JSON.stringify({ songIds }) })
  },
}
