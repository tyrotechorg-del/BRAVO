import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult } from '../types'

const BASE = API_ENDPOINTS.COMMENTS

export interface SongComment {
  _id: string
  content: string
  likeCount?: number
  createdAt?: string
  user?: { _id?: string; username?: string; avatar?: string }
}

export const commentsService = {
  async getForSong(songId: string, page = 1, limit = 20): Promise<ApiResult<{ comments: SongComment[]; totalPages?: number }>> {
    try {
      const token = apiClient.getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE_URL}${BASE}/song/${encodeURIComponent(songId)}?page=${page}&limit=${limit}`, { headers })
      const data = await res.json().catch(() => null)
      if (!res.ok) return { success: false, error: data?.error || 'Failed to load comments', status: res.status }
      return { success: true, data, status: res.status }
    } catch {
      return { success: false, error: 'Network error', status: 0 }
    }
  },
  post(songId: string, content: string) {
    return apiClient.call<SongComment>(BASE, { method: 'POST', body: JSON.stringify({ songId, content }) })
  },
  like(commentId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(commentId)}/like`, { method: 'POST' })
  },
  report(commentId: string, reason: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(commentId)}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
  },
  delete(commentId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(commentId)}`, { method: 'DELETE' })
  },
}
